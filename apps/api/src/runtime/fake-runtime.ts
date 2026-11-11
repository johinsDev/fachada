import type { SiteData, TemplateId } from "@fachada/shared";
import type { BuildResult, SiteRuntime, SourceRef } from "./site-runtime";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** In-memory SiteRuntime for tests and local runs without containers. */
export class FakeRuntime implements SiteRuntime {
  awake = new Set<string>();
  files = new Map<string, Map<string, string>>();
  siteDataWrites: { slug: string; data: SiteData }[] = [];
  failNextBuild: string | null = null;
  lastBuildSource: { kind: "seed" } | { kind: "tar"; text: string } | null = null;

  private fs(slug: string) {
    let files = this.files.get(slug);
    if (!files) this.files.set(slug, (files = new Map()));
    return files;
  }

  async isAwake(slug: string) {
    return this.awake.has(slug);
  }

  async touch(_slug: string) {}

  async openPreview(slug: string, _src: SourceRef, _template: TemplateId, data: SiteData) {
    this.awake.add(slug);
    this.fs(slug).set("src/data/site.json", JSON.stringify(data));
    return { url: `https://p-${slug}.fachada.dev` };
  }

  async writeSiteData(slug: string, data: SiteData) {
    this.siteDataWrites.push({ slug, data });
    this.fs(slug).set("src/data/site.json", JSON.stringify(data));
  }

  async listFiles(slug: string, dir: string) {
    const prefix = dir.replace(/\/?$/, "/");
    return [...this.fs(slug).keys()].filter((p) => p.startsWith(prefix));
  }

  async readFile(slug: string, path: string) {
    const content = this.fs(slug).get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  async writeFile(slug: string, path: string, content: string) {
    this.fs(slug).set(path, content);
  }

  async deleteFile(slug: string, path: string) {
    this.fs(slug).delete(path);
  }

  async check(_slug: string) {
    if (this.failNextBuild) {
      const output = this.failNextBuild;
      this.failNextBuild = null;
      return { ok: false, output };
    }
    return { ok: true, output: "0 errors" };
  }

  async snapshot(slug: string) {
    return enc.encode(JSON.stringify(Object.fromEntries(this.fs(slug))));
  }

  async build(
    _slug: string,
    src: SourceRef,
    template: TemplateId,
    data: SiteData,
  ): Promise<BuildResult> {
    this.lastBuildSource =
      src.kind === "seed" ? { kind: "seed" } : { kind: "tar", text: dec.decode(src.bytes) };
    if (this.failNextBuild) {
      const output = this.failNextBuild;
      this.failNextBuild = null;
      return { ok: false, output };
    }
    const files = [
      { path: "index.html", bytes: enc.encode(`<h1>${data.company.name}</h1><p>${template}</p>`) },
      ...data.projects.map((p) => ({
        path: `proyectos/${p.slug}/index.html`,
        bytes: enc.encode(`<h1>${p.name}</h1>`),
      })),
    ];
    return {
      ok: true,
      files,
      source: src.kind === "tar" ? src.bytes : enc.encode(`seed:${template}`),
    };
  }
}
