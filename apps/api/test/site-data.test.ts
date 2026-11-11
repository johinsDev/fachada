import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { buildSiteData } from "../src/site/site-data";
import { call, signupTenant, unique } from "./helpers";

async function createProject(cookie: string, published: boolean) {
  const res = await call("/projects", cookie, {
    method: "POST",
    body: JSON.stringify({
      name: `Proyecto ${unique()}`,
      slug: `p-${unique()}`.replace(/^p-/, "x"),
      city: "Cali",
      status: "planos",
      priceFromCOP: 250000000,
      published,
    }),
  });
  return (await res.json<{ id: string }>()).id;
}

async function addPhoto(cookie: string, projectId: string, alt: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1])], "x.jpg", { type: "image/jpeg" }));
  form.append("alt", alt);
  await call(`/projects/${projectId}/photos`, cookie, { method: "POST", body: form });
}

describe("buildSiteData", () => {
  it("includes only published projects with ordered media URLs", async () => {
    const { cookie, tenant } = await signupTenant({ companyName: "Constructora Luna" });
    const published = await createProject(cookie, true);
    await createProject(cookie, false);
    await addPhoto(cookie, published, "Fachada");
    await addPhoto(cookie, published, "Sala");

    const data = await buildSiteData(env, tenant.id);
    expect(data.company.name).toBe("Constructora Luna");
    expect(data.company.slug).toBe(tenant.slug);
    expect(data.apiBase).toBe("https://api.fachada.dev");
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]!.photos.map((p) => p.alt)).toEqual(["Fachada", "Sala"]);
    expect(data.projects[0]!.photos[0]!.url).toMatch(/^https:\/\/media\.fachada\.dev\//);
  });

  it("never includes another tenant's projects", async () => {
    const a = await signupTenant();
    const b = await signupTenant();
    await createProject(a.cookie, true);
    expect((await buildSiteData(env, b.tenant.id)).projects).toEqual([]);
  });
});
