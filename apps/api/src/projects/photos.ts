import { Hono } from "hono";
import { scoped } from "../db/tenant";
import type { AppEnv } from "../env";
import { onSiteDataChanged } from "../site/hooks";

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const photoRoutes = new Hono<AppEnv>()
  .post("/", async (c) => {
    const projectId = c.req.param("id")!;
    const db = scoped(c.env.DB, c.var.tenantId);
    const project = await db.first(
      "SELECT id FROM projects WHERE tenant_id = ? AND id = ?",
      projectId,
    );
    if (!project) return c.json({ error: "not_found" }, 404);

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
    const ext = EXTENSIONS[file.type];
    if (!ext) return c.json({ error: "unsupported_type" }, 415);
    if (file.size > MAX_BYTES) return c.json({ error: "too_large" }, 413);

    const id = crypto.randomUUID();
    const key = `${c.var.tenantId}/${projectId}/${id}.${ext}`;
    await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const next = await db.first<{ n: number }>(
      "SELECT COALESCE(MAX(position) + 1, 0) AS n FROM project_photos WHERE tenant_id = ? AND project_id = ?",
      projectId,
    );
    const alt = String(form.get("alt") ?? "");
    await db.run(
      "INSERT INTO project_photos (tenant_id, id, project_id, key, alt, position) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      projectId,
      key,
      alt,
      next?.n ?? 0,
    );
    c.executionCtx.waitUntil(onSiteDataChanged(c.env, c.var.tenantId));
    return c.json({ id, alt, url: `https://media.${c.env.ROOT_DOMAIN}/${key}` }, 201);
  })
  .delete("/:photoId", async (c) => {
    const db = scoped(c.env.DB, c.var.tenantId);
    const photo = await db.first<{ key: string }>(
      "SELECT key FROM project_photos WHERE tenant_id = ? AND id = ? AND project_id = ?",
      c.req.param("photoId"),
      c.req.param("id"),
    );
    if (!photo) return c.json({ error: "not_found" }, 404);
    await db.run(
      "DELETE FROM project_photos WHERE tenant_id = ? AND id = ?",
      c.req.param("photoId"),
    );
    await c.env.MEDIA.delete(photo.key);
    c.executionCtx.waitUntil(onSiteDataChanged(c.env, c.var.tenantId));
    return c.json({ ok: true });
  });
