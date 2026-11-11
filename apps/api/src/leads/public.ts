import { LeadInputSchema } from "@fachada/shared";
import { Hono } from "hono";
import * as v from "valibot";
import type { AppEnv } from "../env";
import { hostOfOrigin, parseHost } from "../hosts";

async function tenantForOrigin(env: AppEnv["Bindings"], origin: string | undefined) {
  const host = hostOfOrigin(origin);
  if (!host) return null;
  const parsed = parseHost(host, env.ROOT_DOMAIN);
  const slug =
    parsed.kind === "site" ? parsed.slug : parsed.kind === "preview" ? parsed.slug : null;
  if (!slug) return null;
  const row = await env.DB.prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind(slug)
    .first<{ id: string }>();
  return row ? { tenantId: row.id, isTest: parsed.kind === "preview" } : null;
}

/** Endpoints the published sites call from the browser. The tenant comes from the Origin. */
export const publicRoutes = new Hono<AppEnv>()
  .options("/leads", async (c) => {
    const origin = c.req.header("origin");
    if (!(await tenantForOrigin(c.env, origin))) return c.body(null, 403);
    return c.body(null, 204, {
      "access-control-allow-origin": origin!,
      "access-control-allow-methods": "POST",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
      vary: "Origin",
    });
  })
  .post("/leads", async (c) => {
    const origin = c.req.header("origin");
    const target = await tenantForOrigin(c.env, origin);
    if (!target) return c.json({ error: "forbidden_origin" }, 403);
    c.header("access-control-allow-origin", origin!);
    c.header("vary", "Origin");

    const parsed = v.safeParse(LeadInputSchema, await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid", issues: v.flatten(parsed.issues) }, 400);
    const lead = parsed.output;
    await c.env.DB.prepare(
      `INSERT INTO leads (id, tenant_id, project_slug, name, phone, email, message, is_test, origin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        target.tenantId,
        lead.projectSlug ?? null,
        lead.name,
        lead.phone,
        lead.email ?? null,
        lead.message ?? null,
        target.isTest ? 1 : 0,
        origin ?? null,
        Date.now(),
      )
      .run();
    return c.json({ ok: true }, 201);
  });
