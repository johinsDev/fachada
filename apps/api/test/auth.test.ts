import { createExecutionContext, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { app } from "../src/index";

const unique = () => crypto.randomUUID().slice(0, 8);

export async function signup(overrides: Record<string, unknown> = {}) {
  const res = await app.request(
    "/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: `Constructora ${unique()}`,
        email: `${unique()}@demo.co`,
        password: "secreto123",
        template: "pro",
        ...overrides,
      }),
    },
    env,
    createExecutionContext(),
  );
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { res, cookie };
}

describe("auth", () => {
  it("signs up, sets a session cookie and /auth/me returns the tenant", async () => {
    const { res, cookie } = await signup({ companyName: "Constructora Sol" });
    expect(res.status).toBe(201);
    const body = await res.json<{ tenant: { slug: string }; siteUrl: string }>();
    expect(body.siteUrl).toBe(`https://${body.tenant.slug}.fachada.dev`);
    expect(cookie).toMatch(/^__Host-fs_session=/);
    const raw = res.headers.get("set-cookie") ?? "";
    expect(raw).not.toMatch(/domain=/i);
    expect(raw).toMatch(/samesite=strict/i);
    const me = await app.request("/auth/me", { headers: { cookie } }, env);
    expect(me.status).toBe(200);
    expect((await me.json<{ tenant: { slug: string } }>()).tenant.slug).toBe(body.tenant.slug);
  });

  it("rejects a repeated email with 409", async () => {
    const email = `${unique()}@demo.co`;
    await signup({ email });
    const { res } = await signup({ email });
    expect(res.status).toBe(409);
  });

  it("rejects a wrong password with 401", async () => {
    const email = `${unique()}@demo.co`;
    await signup({ email });
    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "otraclave99" }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("logs in with the right password", async () => {
    const email = `${unique()}@demo.co`;
    await signup({ email });
    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "secreto123" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/__Host-fs_session=/);
  });

  it("protects session routes", async () => {
    const res = await app.request("/auth/me", {}, env);
    expect(res.status).toBe(401);
  });
});
