import { createExecutionContext, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { parseHost } from "../src/hosts";
import { uniqueSlug } from "../src/tenants/slug";
import { call, signupTenant } from "./helpers";

const PASSWORD = "test-super-password";
function get(auth?: string) {
  const headers = auth ? { authorization: `Basic ${btoa(auth)}` } : undefined;
  return worker.fetch(
    new Request("https://admin.fachada.dev/", { headers }),
    { ...env, SUPER_ADMIN_PASSWORD: PASSWORD },
    createExecutionContext(),
  );
}

describe("super admin", () => {
  it("is a platform host and a reserved slug", async () => {
    expect(parseHost("admin.fachada.dev", "fachada.dev")).toEqual({ kind: "admin" });
    expect(await uniqueSlug(env.DB, "Admin")).toBe("admin-2");
  });

  it("asks for credentials", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Basic/);
    expect((await get("johan:otra")).status).toBe(401);
  });

  it("lists every tenant with its owner, counts and site, escaped", async () => {
    const { cookie, tenant } = await signupTenant({ companyName: "Super <b>Test</b>" });
    await call("/projects", cookie, {
      method: "POST",
      body: JSON.stringify({ name: "Torre", slug: "torre-super", city: "Cali", status: "planos" }),
    });
    const res = await get(`johan:${PASSWORD}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Super &lt;b&gt;Test&lt;/b&gt;");
    expect(html).toContain(`https://${tenant.slug}.fachada.dev`);
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("is closed when no password is configured", async () => {
    const res = await worker.fetch(
      new Request("https://admin.fachada.dev/", {
        headers: { authorization: `Basic ${btoa("johan:")}` },
      }),
      { ...env, SUPER_ADMIN_PASSWORD: "" },
      createExecutionContext(),
    );
    expect(res.status).toBe(401);
  });
});
