import { vValidator } from "@hono/valibot-validator";
import { TEMPLATE_IDS } from "@fachada/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { requireSession } from "../auth/session";
import { scoped } from "../db/tenant";
import type { AppEnv, Env } from "../env";
import { makeRuntime } from "../runtime";
import type { SourceRef } from "../runtime/site-runtime";
import { draftKey, sourceKey } from "./keys";
import { buildSiteData, getTenant } from "./site-data";

interface VersionRow {
  id: string;
  template: string;
  status: "building" | "ready" | "failed";
  reason: string;
  prompt_summary: string | null;
  build_log: string | null;
  created_at: number;
}

/** The source the live preview opens: the AI draft, else the published version, else the seed. */
export async function previewSource(env: Env, tenantId: string, activeVersionId: string | null) {
  for (const key of [draftKey(tenantId), activeVersionId && sourceKey(tenantId, activeVersionId)]) {
    if (!key) continue;
    const object = await env.SITES.get(key);
    if (object)
      return { kind: "tar", bytes: new Uint8Array(await object.arrayBuffer()) } as SourceRef;
  }
  return { kind: "seed" } as SourceRef;
}

export const siteRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get("/", async (c) => {
    const tenant = await getTenant(c.env, c.var.tenantId);
    const latest = await scoped(c.env.DB, c.var.tenantId).first<VersionRow>(
      "SELECT * FROM site_versions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
    );
    return c.json({
      slug: tenant.slug,
      template: tenant.template,
      siteUrl: `https://${tenant.slug}.${c.env.ROOT_DOMAIN}`,
      previewUrl: `https://p-${tenant.slug}.${c.env.ROOT_DOMAIN}`,
      activeVersionId: tenant.active_version_id,
      latest,
      hasDraft: (await c.env.SITES.head(draftKey(c.var.tenantId))) !== null,
    });
  })
  .get("/versions", async (c) => {
    const rows = await scoped(c.env.DB, c.var.tenantId).all<VersionRow>(
      "SELECT id, template, status, reason, prompt_summary, created_at FROM site_versions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    );
    return c.json(rows);
  })
  .post("/versions/:id/activate", async (c) => {
    const version = await scoped(c.env.DB, c.var.tenantId).first<VersionRow>(
      "SELECT id, status FROM site_versions WHERE tenant_id = ? AND id = ?",
      c.req.param("id"),
    );
    if (!version) return c.json({ error: "not_found" }, 404);
    if (version.status !== "ready") return c.json({ error: "version_not_ready" }, 409);
    await c.env.DB.prepare("UPDATE tenants SET active_version_id = ? WHERE id = ?")
      .bind(version.id, c.var.tenantId)
      .run();
    return c.json({ ok: true });
  })
  .post("/publish", async (c) => {
    await c.env.BUILDS.getByName(c.var.tenantId).enqueue(c.var.tenantId, "publish");
    return c.json({ ok: true }, 202);
  })
  .post(
    "/template",
    vValidator("json", v.object({ template: v.picklist(TEMPLATE_IDS) })),
    async (c) => {
      const { template } = c.req.valid("json");
      await c.env.DB.prepare("UPDATE tenants SET template = ? WHERE id = ?")
        .bind(template, c.var.tenantId)
        .run();
      await c.env.SITES.delete(draftKey(c.var.tenantId));
      await c.env.BUILDS.getByName(c.var.tenantId).enqueue(c.var.tenantId, "template");
      const tenant = await getTenant(c.env, c.var.tenantId);
      const runtime = makeRuntime(c.env);
      if (await runtime.isAwake(tenant.slug)) {
        c.executionCtx.waitUntil(
          buildSiteData(c.env, tenant.id).then((data) =>
            runtime.openPreview(tenant.slug, { kind: "seed" }, template, data),
          ),
        );
      }
      return c.json({ ok: true });
    },
  )
  .post("/preview/start", async (c) => {
    const tenant = await getTenant(c.env, c.var.tenantId);
    const src = await previewSource(c.env, tenant.id, tenant.active_version_id);
    const { url } = await makeRuntime(c.env).openPreview(
      tenant.slug,
      src,
      tenant.template,
      await buildSiteData(c.env, tenant.id),
    );
    return c.json({ url });
  })
  .post("/preview/heartbeat", async (c) => {
    const tenant = await getTenant(c.env, c.var.tenantId);
    const runtime = makeRuntime(c.env);
    await runtime.touch(tenant.slug);
    return c.json({ awake: await runtime.isAwake(tenant.slug) });
  });
