import { Files } from "@cloudflare/sandbox";
import type { SiteData, TemplateId } from "@fachada/shared";
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import type { BuildResult, SourceRef } from "./site-runtime";

const SITE = "/workspace/site"; // live preview, edited by the agent
const BUILD = "/workspace/build"; // fresh copy for each publish
const TEMPLATES = "/opt/templates";
const PORT = 4321;
const IDLE_MS = 30 * 60 * 1000;
const dec = new TextDecoder();

/** Shell-quotes one argument. */
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * One per tenant (named "t-<slug>"): the container that holds the tenant's site source,
 * runs `astro dev` for the live preview and `astro build` for publishing.
 */
export class SiteSandbox extends DurableObject<Env> {
  private get container(): Container {
    const container = this.ctx.container;
    if (!container) throw new Error("The SiteSandbox container binding is not configured");
    return container;
  }

  private files() {
    return new Files(this.container);
  }

  private async ensure() {
    const container = this.container;
    if (!container.running) {
      container.start({
        image: container.images.site,
        entrypoint: ["sleep", "infinity"],
        // Astro fetches fonts and the photos come from public URLs.
        enableInternet: true,
      });
    }
    await container.setInactivityTimeout(IDLE_MS);
  }

  private async sh(script: string, timeoutMs = 180_000) {
    const proc = await this.container.exec(["sh", "-c", script], {
      stderr: "combined",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const out = await proc.output();
    return { exitCode: out.exitCode, output: dec.decode(out.stdout) };
  }

  private async load(dir: string, src: SourceRef, template: TemplateId) {
    const tpl = `${TEMPLATES}/${template}`;
    let unpack: string;
    if (src.kind === "tar") {
      await this.files().writeFile(`/tmp/src.tar`, src.bytes);
      unpack = `tar -xf /tmp/src.tar -C ${dir}`;
    } else {
      unpack = `tar -C ${tpl} --exclude=./node_modules --exclude=./dist --exclude=./.astro -cf - . | tar -xf - -C ${dir}`;
    }
    const res = await this.sh(
      `set -e; rm -rf ${dir}; mkdir -p ${dir}; ${unpack}; ln -sfn ${tpl}/node_modules ${dir}/node_modules; echo ${template} > ${dir}/.fachada-template`,
    );
    if (res.exitCode !== 0) throw new Error(`Could not load the site source: ${res.output}`);
  }

  private async writeData(dir: string, data: SiteData) {
    await this.files().writeFile(`${dir}/src/data/site.json`, JSON.stringify(data, null, 2));
  }

  private async previewIsUp(): Promise<boolean> {
    try {
      const res = await this.container
        .getTcpPort(PORT)
        .fetch("http://container/", { signal: AbortSignal.timeout(1_500) });
      await res.body?.cancel();
      return true;
    } catch {
      return false;
    }
  }

  async isAwake(): Promise<boolean> {
    return this.ctx.container?.running === true && (await this.previewIsUp());
  }

  async touch(): Promise<void> {
    if (this.ctx.container?.running) {
      await this.container.setInactivityTimeout(IDLE_MS);
      await this.previewIsUp();
    }
  }

  async openPreview(slug: string, src: SourceRef, template: TemplateId, data: SiteData) {
    await this.ensure();
    await this.sh("pkill -f 'astro dev' || true");
    await this.load(SITE, src, template);
    await this.writeData(SITE, data);
    await this.container.exec(
      [
        "sh",
        "-c",
        `cd ${SITE} && FACHADA_PREVIEW=1 nohup ./node_modules/.bin/astro dev --host 0.0.0.0 --port ${PORT} > /tmp/dev.log 2>&1 &`,
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (await this.previewIsUp()) return { url: `https://p-${slug}.${this.env.ROOT_DOMAIN}` };
      await scheduler.wait(750);
    }
    const log = await this.sh("tail -n 40 /tmp/dev.log");
    throw new Error(`The preview did not start:\n${log.output}`);
  }

  async writeSiteData(data: SiteData) {
    await this.writeData(SITE, data);
  }

  async listFiles(dir: string): Promise<string[]> {
    const res = await this.sh(
      `cd ${SITE} && find ${q(dir)} -type f -not -path '*/node_modules/*' | sort`,
    );
    return res.output
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/^\.\//, ""));
  }

  async readFile(path: string): Promise<string> {
    return (await this.files().readFile(`${SITE}/${path}`)).text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const full = `${SITE}/${path}`;
    await this.sh(`mkdir -p ${q(full.slice(0, full.lastIndexOf("/")))}`);
    await this.files().writeFile(full, content);
  }

  async deleteFile(path: string): Promise<void> {
    await this.files().remove(`${SITE}/${path}`);
  }

  async check(): Promise<{ ok: boolean; output: string }> {
    const res = await this.sh(
      `cd ${SITE} && ./node_modules/.bin/astro check && ./node_modules/.bin/astro build --outDir /tmp/check-dist`,
    );
    return { ok: res.exitCode === 0, output: res.output.slice(-8_000) };
  }

  async snapshot(): Promise<Uint8Array> {
    return this.tarOf(SITE);
  }

  private async tarOf(dir: string): Promise<Uint8Array> {
    const res = await this.sh(
      `tar -C ${dir} --exclude=./node_modules --exclude=./dist --exclude=./.astro -cf /tmp/snapshot.tar .`,
    );
    if (res.exitCode !== 0) throw new Error(`Could not snapshot the site: ${res.output}`);
    return new Uint8Array(await (await this.files().readFile("/tmp/snapshot.tar")).arrayBuffer());
  }

  async build(src: SourceRef, template: TemplateId, data: SiteData): Promise<BuildResult> {
    await this.ensure();
    await this.load(BUILD, src, template);
    await this.writeData(BUILD, data);
    const res = await this.sh(`cd ${BUILD} && ./node_modules/.bin/astro build`, 300_000);
    if (res.exitCode !== 0) return { ok: false, output: res.output.slice(-20_000) };
    const list = await this.sh(`cd ${BUILD}/dist && find . -type f`);
    const paths = list.output
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/^\.\//, ""));
    const files = [];
    for (const path of paths) {
      const body = await this.files().readFile(`${BUILD}/dist/${path}`);
      files.push({ path, bytes: new Uint8Array(await body.arrayBuffer()) });
    }
    return { ok: true, files, source: await this.tarOf(BUILD) };
  }

  /** Forwards a preview request (p-<slug> host) to the dev server in the container. */
  async fetch(request: Request): Promise<Response> {
    if (!this.ctx.container?.running || !(await this.previewIsUp())) {
      return new Response(
        "<!doctype html><meta charset=utf-8><title>Preview</title><p style='font:16px system-ui;padding:2rem'>Encendiendo preview… recarga en unos segundos.</p>",
        {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8", "retry-after": "5" },
        },
      );
    }
    const response = await this.container.getTcpPort(PORT).fetch(request);
    if (response.webSocket) return response;
    const headers = new Headers(response.headers);
    headers.set("x-robots-tag", "noindex, nofollow");
    return new Response(response.body, { status: response.status, headers });
  }
}
