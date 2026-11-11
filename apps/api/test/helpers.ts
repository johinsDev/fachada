import { env } from "cloudflare:test";

export async function seedTenant(id: string, slug = id) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO tenants (id, slug, name, template, settings_json, created_at) VALUES (?, ?, ?, 'pro', '{}', 0)",
  )
    .bind(id, slug, id)
    .run();
}

import { createExecutionContext } from "cloudflare:test";
import { app } from "../src/index";

export const unique = () => crypto.randomUUID().slice(0, 8);

/** Signs up a fresh tenant and returns its session cookie. */
export async function signupTenant(overrides: Record<string, unknown> = {}) {
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
  const body = await res.json<{ tenant: { id: string; slug: string } }>();
  return { cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "", tenant: body.tenant };
}

export function call(path: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (init.body && typeof init.body === "string") headers.set("content-type", "application/json");
  return app.request(path, { ...init, headers }, env, createExecutionContext());
}
