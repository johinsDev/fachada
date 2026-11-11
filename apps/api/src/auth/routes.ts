import { vValidator } from "@hono/valibot-validator";
import { LoginSchema, SignupSchema } from "@fachada/shared";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { onTenantCreated } from "../site/hooks";
import { uniqueSlug } from "../tenants/slug";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, requireSession } from "./session";

const DEFAULT_SETTINGS = {
  colors: { primary: "#1f3a5f", accent: "#c8a24a" },
  logoUrl: null,
  whatsapp: null,
};

export async function tenantSummary(db: D1Database, tenantId: string) {
  return db
    .prepare("SELECT id, slug, name, template FROM tenants WHERE id = ?")
    .bind(tenantId)
    .first<{ id: string; slug: string; name: string; template: string }>();
}

export const authRoutes = new Hono<AppEnv>()
  .post("/signup", vValidator("json", SignupSchema), async (c) => {
    const input = c.req.valid("json");
    const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?")
      .bind(input.email)
      .first();
    if (exists) return c.json({ error: "email_taken" }, 409);

    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const slug = await uniqueSlug(c.env.DB, input.companyName);
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO tenants (id, slug, name, template, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        tenantId,
        slug,
        input.companyName,
        input.template,
        JSON.stringify({ ...DEFAULT_SETTINGS, name: input.companyName }),
        now,
      ),
      c.env.DB.prepare(
        "INSERT INTO users (id, tenant_id, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(userId, tenantId, input.email, await hashPassword(input.password), now),
    ]);
    await createSession(c, userId, tenantId);
    c.executionCtx.waitUntil(onTenantCreated(c.env, tenantId));
    const tenant = await tenantSummary(c.env.DB, tenantId);
    return c.json({ tenant, siteUrl: `https://${slug}.${c.env.ROOT_DOMAIN}` }, 201);
  })
  .post("/login", vValidator("json", LoginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const user = await c.env.DB.prepare(
      "SELECT id, tenant_id, password_hash FROM users WHERE email = ?",
    )
      .bind(email)
      .first<{ id: string; tenant_id: string; password_hash: string }>();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ error: "invalid_credentials" }, 401);
    }
    await createSession(c, user.id, user.tenant_id);
    return c.json({ tenant: await tenantSummary(c.env.DB, user.tenant_id) });
  })
  .post("/logout", async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  })
  .get("/me", requireSession, async (c) => {
    const tenant = await tenantSummary(c.env.DB, c.var.tenantId);
    return c.json({ tenant, siteUrl: `https://${tenant?.slug}.${c.env.ROOT_DOMAIN}` });
  });
