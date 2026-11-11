import type { Env } from "../env";
import type { SiteRuntime, SourceRef } from "../runtime/site-runtime";
import { distKey, draftKey, sourceKey } from "./keys";
import { buildSiteData, getTenant } from "./site-data";

export type BuildReason = "signup" | "data" | "publish" | "template";

async function readTar(env: Env, key: string): Promise<SourceRef | null> {
  const object = await env.SITES.get(key);
  return object ? { kind: "tar", bytes: new Uint8Array(await object.arrayBuffer()) } : null;
}

/**
 * Which source a build starts from: a template switch or a first build starts from the
 * seed; a publish takes the AI draft; anything else rebuilds the active version.
 */
async function pickSource(
  env: Env,
  tenantId: string,
  activeVersionId: string | null,
  reasons: BuildReason[],
) {
  if (reasons.includes("template") || !activeVersionId)
    return { src: { kind: "seed" } as SourceRef, fromDraft: false };
  if (reasons.includes("publish")) {
    const draft = await readTar(env, draftKey(tenantId));
    if (draft) return { src: draft, fromDraft: true };
  }
  const active = await readTar(env, sourceKey(tenantId, activeVersionId));
  return { src: active ?? ({ kind: "seed" } as SourceRef), fromDraft: false };
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  woff2: "font/woff2",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
};

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

export async function runBuild(
  env: Env,
  runtime: SiteRuntime,
  tenantId: string,
  reasons: BuildReason[],
): Promise<{ versionId: string; status: "ready" | "failed" }> {
  const tenant = await getTenant(env, tenantId);
  const versionId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO site_versions (id, tenant_id, template, status, reason, created_at) VALUES (?, ?, ?, 'building', ?, ?)",
  )
    .bind(versionId, tenantId, tenant.template, reasons.join(","), Date.now())
    .run();

  const { src, fromDraft } = await pickSource(env, tenantId, tenant.active_version_id, reasons);
  const data = await buildSiteData(env, tenantId);
  let result;
  try {
    result = await runtime.build(tenant.slug, src, tenant.template, data);
  } catch (error) {
    result = { ok: false as const, output: String(error) };
  }

  if (!result.ok) {
    await env.DB.prepare("UPDATE site_versions SET status = 'failed', build_log = ? WHERE id = ?")
      .bind(result.output.slice(-20_000), versionId)
      .run();
    return { versionId, status: "failed" };
  }

  await env.SITES.put(sourceKey(tenantId, versionId), result.source);
  await Promise.all(
    result.files.map((file) =>
      env.SITES.put(distKey(tenantId, versionId, file.path), file.bytes, {
        httpMetadata: { contentType: contentTypeFor(file.path) },
      }),
    ),
  );
  await env.DB.batch([
    env.DB.prepare("UPDATE site_versions SET status = 'ready' WHERE id = ?").bind(versionId),
    env.DB.prepare("UPDATE tenants SET active_version_id = ? WHERE id = ?").bind(
      versionId,
      tenantId,
    ),
  ]);
  if (fromDraft) await env.SITES.delete(draftKey(tenantId));
  return { versionId, status: "ready" };
}
