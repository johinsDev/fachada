import { createExecutionContext, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { FakeRuntime } from "../src/runtime/fake-runtime";
import { runBuild } from "../src/site/build-service";
import { distKey } from "../src/site/keys";
import { signupTenant } from "./helpers";

function get(url: string) {
  return worker.fetch(new Request(url), env, createExecutionContext());
}

async function publishedTenant() {
  const { tenant } = await signupTenant({
    companyName: `Sitio ${crypto.randomUUID().slice(0, 6)}`,
  });
  const { versionId } = await runBuild(env, new FakeRuntime(), tenant.id, ["signup"]);
  return { tenant, versionId };
}

describe("serving tenant sites", () => {
  it("serves the active version's index.html", async () => {
    const { tenant } = await publishedTenant();
    const res = await get(`https://${tenant.slug}.fachada.dev/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<h1>Sitio");
  });

  it("resolves a pretty URL to its index.html", async () => {
    const { tenant, versionId } = await publishedTenant();
    await env.SITES.put(
      distKey(tenant.id, versionId, "proyectos/torre-norte/index.html"),
      "<h1>Torre</h1>",
    );
    const res = await get(`https://${tenant.slug}.fachada.dev/proyectos/torre-norte`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>Torre</h1>");
  });

  it("shows the building page while the first version is not ready", async () => {
    const { tenant } = await signupTenant();
    const res = await get(`https://${tenant.slug}.fachada.dev/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Estamos creando este sitio");
  });

  it("escapes the company name on the building page", async () => {
    const { tenant } = await signupTenant({ companyName: "Hack <img src=x onerror=alert(1)>" });
    const text = await (await get(`https://${tenant.slug}.fachada.dev/`)).text();
    expect(text).not.toContain("<img src=x");
    expect(text).toContain("&lt;img");
  });

  it("answers an unknown tenant with its own 404 page", async () => {
    const res = await get("https://no-existe-nunca.fachada.dev/");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Este sitio no existe");
  });

  it("uses the site's 404.html for a missing file, else the platform one", async () => {
    const { tenant, versionId } = await publishedTenant();
    const plain = await get(`https://${tenant.slug}.fachada.dev/nada`);
    expect(plain.status).toBe(404);
    expect(await plain.text()).toContain("Página no encontrada");
    await env.SITES.put(distKey(tenant.id, versionId, "404.html"), "<p>404 propio</p>");
    const custom = await get(`https://${tenant.slug}.fachada.dev/nada`);
    expect(custom.status).toBe(404);
    expect(await custom.text()).toBe("<p>404 propio</p>");
  });

  it("answers a malformed URL with 404, not 500", async () => {
    const { tenant } = await publishedTenant();
    expect((await get(`https://${tenant.slug}.fachada.dev/%E0%A4%A`)).status).toBe(404);
    expect((await get("https://media.fachada.dev/%E0%A4%A")).status).toBe(404);
  });

  it("serves media from the media bucket", async () => {
    await env.MEDIA.put("t1/p1/foto.jpg", new Uint8Array([7, 7]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const res = await get("https://media.fachada.dev/t1/p1/foto.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });
});
