import { vValidator } from "@hono/valibot-validator";
import { CompanySettingsSchema } from "@fachada/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { requireSession } from "../auth/session";
import { scoped } from "../db/tenant";
import type { AppEnv } from "../env";
import { onSiteDataChanged } from "../site/hooks";
import { INTEGRATIONS } from "./integrations-catalog";

const DomainSchema = v.object({
  hostname: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.regex(/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
  ),
});

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

const mask = (s: string) => `••••${s.slice(-4)}`;

const dnsFor = (hostname: string, root: string) => ({
  type: "CNAME" as const,
  name: hostname.split(".")[0] ?? "www",
  target: `sitios.${root}`,
});

export const settingsRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get("/company", async (c) => {
    // The tenants table is keyed by id; the id comes from the session, never the client.
    const row = await c.env.DB.prepare("SELECT settings_json FROM tenants WHERE id = ?")
      .bind(c.var.tenantId)
      .first<{ settings_json: string }>();
    const s = JSON.parse(row?.settings_json ?? "{}");
    return c.json({
      name: s.name,
      logoUrl: s.logoUrl ?? null,
      whatsapp: s.whatsapp ?? null,
      colors: s.colors,
    });
  })
  .put("/company", vValidator("json", CompanySettingsSchema), async (c) => {
    const settings = c.req.valid("json");
    await c.env.DB.prepare("UPDATE tenants SET settings_json = ?, name = ? WHERE id = ?")
      .bind(JSON.stringify(settings), settings.name, c.var.tenantId)
      .run();
    c.executionCtx.waitUntil(onSiteDataChanged(c.env, c.var.tenantId));
    return c.json({ ok: true });
  })
  .post("/company/logo", async (c) => {
    const file = (await c.req.formData()).get("file");
    if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
    const ext = LOGO_TYPES[file.type];
    if (!ext) return c.json({ error: "unsupported_type" }, 415);
    const key = `${c.var.tenantId}/logo-${crypto.randomUUID()}.${ext}`;
    await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    return c.json({ url: `https://media.${c.env.ROOT_DOMAIN}/${key}` }, 201);
  })
  .get("/integrations", async (c) => {
    const rows = await scoped(c.env.DB, c.var.tenantId).all<{
      provider: string;
      status: string;
      config_json: string;
    }>("SELECT provider, status, config_json FROM integrations WHERE tenant_id = ?");
    const byId = new Map(rows.map((r) => [r.provider, r]));
    return c.json(
      INTEGRATIONS.map((def) => {
        const row = byId.get(def.id);
        return {
          ...def,
          status: row?.status ?? "disconnected",
          config: row ? (JSON.parse(row.config_json) as Record<string, string>) : {},
        };
      }),
    );
  })
  .post("/integrations/:id/connect", async (c) => {
    const def = INTEGRATIONS.find((i) => i.id === c.req.param("id"));
    if (!def) return c.json({ error: "not_found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const config: Record<string, string> = {};
    for (const field of def.fields) {
      const value = String(body[field.key] ?? "");
      config[field.key] = field.secret && value ? mask(value) : value;
    }
    await scoped(c.env.DB, c.var.tenantId).run(
      `INSERT INTO integrations (tenant_id, provider, status, config_json) VALUES (?, ?, 'connected', ?)
       ON CONFLICT (tenant_id, provider) DO UPDATE SET status = 'connected', config_json = excluded.config_json`,
      def.id,
      JSON.stringify(config),
    );
    return c.json({ ok: true });
  })
  .post("/integrations/:id/disconnect", async (c) => {
    await scoped(c.env.DB, c.var.tenantId).run(
      "DELETE FROM integrations WHERE tenant_id = ? AND provider = ?",
      c.req.param("id"),
    );
    return c.json({ ok: true });
  })
  .get("/domain", async (c) => {
    const row = await scoped(c.env.DB, c.var.tenantId).first<{ hostname: string; status: string }>(
      "SELECT hostname, status FROM domains WHERE tenant_id = ? LIMIT 1",
    );
    if (!row) return c.json(null);
    return c.json({ ...row, dns: dnsFor(row.hostname, c.env.ROOT_DOMAIN) });
  })
  .put("/domain", vValidator("json", DomainSchema), async (c) => {
    const { hostname } = c.req.valid("json");
    const db = scoped(c.env.DB, c.var.tenantId);
    await db.run("DELETE FROM domains WHERE tenant_id = ?");
    await db.run(
      "INSERT INTO domains (tenant_id, hostname, status) VALUES (?, ?, 'pending')",
      hostname,
    );
    return c.json({ hostname, status: "pending", dns: dnsFor(hostname, c.env.ROOT_DOMAIN) });
  });
