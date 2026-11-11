import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { call, signupTenant, unique } from "./helpers";

const project = (slug = `torre-${unique()}`) => ({
  name: "Torre Norte",
  slug,
  city: "Cali",
  status: "planos",
  priceFromCOP: 320000000,
  areaMin: 54,
  areaMax: 82,
  bedrooms: 3,
  bathrooms: 2,
  description: "Apartamentos cerca al parque.",
  published: true,
});

describe("projects", () => {
  it("creates, lists and edits a project", async () => {
    const { cookie } = await signupTenant();
    const created = await call("/projects", cookie, {
      method: "POST",
      body: JSON.stringify(project()),
    });
    expect(created.status).toBe(201);
    const { id } = await created.json<{ id: string }>();
    const list = await (await call("/projects", cookie)).json<{ id: string }[]>();
    expect(list.map((p) => p.id)).toContain(id);
    const edited = await call(`/projects/${id}`, cookie, {
      method: "PUT",
      body: JSON.stringify({ ...project("torre-editada"), name: "Torre Sur" }),
    });
    expect(edited.status).toBe(200);
    const got = await (await call(`/projects/${id}`, cookie)).json<{ name: string }>();
    expect(got.name).toBe("Torre Sur");
  });

  it("rejects a repeated slug within a tenant but allows it in another", async () => {
    const a = await signupTenant();
    const b = await signupTenant();
    const body = JSON.stringify(project("mismo-slug"));
    expect((await call("/projects", a.cookie, { method: "POST", body })).status).toBe(201);
    expect((await call("/projects", a.cookie, { method: "POST", body })).status).toBe(409);
    expect((await call("/projects", b.cookie, { method: "POST", body })).status).toBe(201);
  });

  it("hides another tenant's project", async () => {
    const a = await signupTenant();
    const b = await signupTenant();
    const { id } = await (
      await call("/projects", a.cookie, { method: "POST", body: JSON.stringify(project()) })
    ).json<{ id: string }>();
    expect((await call(`/projects/${id}`, b.cookie)).status).toBe(404);
    expect((await call(`/projects/${id}`, b.cookie, { method: "DELETE" })).status).toBe(404);
  });

  it("uploads a photo under the tenant prefix and rejects a pdf", async () => {
    const { cookie, tenant } = await signupTenant();
    const { id } = await (
      await call("/projects", cookie, { method: "POST", body: JSON.stringify(project()) })
    ).json<{ id: string }>();
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "fachada.jpg", { type: "image/jpeg" }),
    );
    form.append("alt", "Fachada");
    const up = await call(`/projects/${id}/photos`, cookie, { method: "POST", body: form });
    expect(up.status).toBe(201);
    const photo = await up.json<{ url: string }>();
    const key = new URL(photo.url).pathname.slice(1);
    expect(key.startsWith(`${tenant.id}/${id}/`)).toBe(true);
    expect(await env.MEDIA.head(key)).not.toBeNull();

    const pdf = new FormData();
    pdf.append("file", new File(["%PDF"], "x.pdf", { type: "application/pdf" }));
    expect(
      (await call(`/projects/${id}/photos`, cookie, { method: "POST", body: pdf })).status,
    ).toBe(415);
  });

  it("requires a session", async () => {
    expect((await call("/projects", "")).status).toBe(401);
  });
});
