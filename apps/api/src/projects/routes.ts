import { vValidator } from "@hono/valibot-validator";
import { ProjectInputSchema, type ProjectInput } from "@fachada/shared";
import { Hono } from "hono";
import { requireSession } from "../auth/session";
import { scoped } from "../db/tenant";
import type { AppEnv } from "../env";
import { onSiteDataChanged } from "../site/hooks";
import { photoRoutes } from "./photos";

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: string;
  price_from_cop: number | null;
  area_min: number | null;
  area_max: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string;
  published: number;
  updated_at: number;
}

export function mediaUrl(env: { ROOT_DOMAIN: string }, key: string) {
  return `https://media.${env.ROOT_DOMAIN}/${key}`;
}

const toColumns = (p: ProjectInput) => [
  p.slug,
  p.name,
  p.city,
  p.status,
  p.priceFromCOP ?? null,
  p.areaMin ?? null,
  p.areaMax ?? null,
  p.bedrooms ?? null,
  p.bathrooms ?? null,
  p.description,
  p.published ? 1 : 0,
  Date.now(),
];

const isUniqueViolation = (e: unknown) => String(e).includes("UNIQUE constraint failed");

export const projectRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get("/", async (c) => {
    const rows = await scoped(c.env.DB, c.var.tenantId).all<ProjectRow>(
      "SELECT * FROM projects WHERE tenant_id = ? ORDER BY updated_at DESC",
    );
    return c.json(rows);
  })
  .post("/", vValidator("json", ProjectInputSchema), async (c) => {
    const id = crypto.randomUUID();
    try {
      await scoped(c.env.DB, c.var.tenantId).run(
        `INSERT INTO projects (tenant_id, id, slug, name, city, status, price_from_cop, area_min,
          area_max, bedrooms, bathrooms, description, published, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ...toColumns(c.req.valid("json")),
      );
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "slug_taken" }, 409);
      throw e;
    }
    c.executionCtx.waitUntil(onSiteDataChanged(c.env, c.var.tenantId));
    return c.json({ id }, 201);
  })
  .get("/:id", async (c) => {
    const db = scoped(c.env.DB, c.var.tenantId);
    const row = await db.first<ProjectRow>(
      "SELECT * FROM projects WHERE tenant_id = ? AND id = ?",
      c.req.param("id"),
    );
    if (!row) return c.json({ error: "not_found" }, 404);
    const photos = await db.all<{ id: string; key: string; alt: string; position: number }>(
      "SELECT id, key, alt, position FROM project_photos WHERE tenant_id = ? AND project_id = ? ORDER BY position",
      row.id,
    );
    return c.json({
      ...row,
      photos: photos.map((p) => ({ id: p.id, alt: p.alt, url: mediaUrl(c.env, p.key) })),
    });
  })
  .put("/:id", vValidator("json", ProjectInputSchema), async (c) => {
    let result: D1Result;
    try {
      const cols = toColumns(c.req.valid("json"));
      result = await scoped(c.env.DB, c.var.tenantId).run(
        `UPDATE projects SET slug = ?2, name = ?3, city = ?4, status = ?5, price_from_cop = ?6,
          area_min = ?7, area_max = ?8, bedrooms = ?9, bathrooms = ?10, description = ?11,
          published = ?12, updated_at = ?13
         WHERE tenant_id = ?1 AND id = ?14`,
        ...cols,
        c.req.param("id"),
      );
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "slug_taken" }, 409);
      throw e;
    }
    if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
    c.executionCtx.waitUntil(onSiteDataChanged(c.env, c.var.tenantId));
    return c.json({ ok: true });
  })
  .delete("/:id", async (c) => {
    const db = scoped(c.env.DB, c.var.tenantId);
    const id = c.req.param("id");
    const photos = await db.all<{ key: string }>(
      "SELECT key FROM project_photos WHERE tenant_id = ? AND project_id = ?",
      id,
    );
    await db.run("DELETE FROM project_photos WHERE tenant_id = ? AND project_id = ?", id);
    const result = await db.run("DELETE FROM projects WHERE tenant_id = ? AND id = ?", id);
    if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
    if (photos.length) await c.env.MEDIA.delete(photos.map((p) => p.key));
    c.executionCtx.waitUntil(onSiteDataChanged(c.env, c.var.tenantId));
    return c.json({ ok: true });
  })
  .route("/:id/photos", photoRoutes);
