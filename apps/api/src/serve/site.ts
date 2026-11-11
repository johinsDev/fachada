import type { Env } from "../env";
import { contentTypeFor } from "../site/build-service";
import { distKey } from "../site/keys";
import { buildingPage, notFoundPage, preparingPage, unknownSitePage } from "./pages";

const html = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });

function safeDecode(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/** Candidate object paths for a URL path: /a → a/index.html, a.html, a. */
function candidates(pathname: string): string[] {
  const decoded = safeDecode(pathname);
  if (decoded === null) return [];
  const path = decoded.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!path) return ["index.html"];
  if (/\.[a-z0-9]+$/i.test(path)) return [path];
  return [`${path}/index.html`, `${path}.html`];
}

function respond(object: R2ObjectBody, path: string, status = 200) {
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType ?? contentTypeFor(path),
  });
  headers.set("etag", object.httpEtag);
  headers.set(
    "cache-control",
    path.startsWith("_astro/") ? "public, max-age=31536000, immutable" : "no-cache",
  );
  return new Response(object.body, { status, headers });
}

export async function serveSite(env: Env, slug: string, pathname: string): Promise<Response> {
  const tenant = await env.DB.prepare(
    "SELECT id, name, active_version_id FROM tenants WHERE slug = ?",
  )
    .bind(slug)
    .first<{ id: string; name: string; active_version_id: string | null }>();
  if (!tenant) return html(unknownSitePage(), 404);
  if (!tenant.active_version_id) {
    const latest = await env.DB.prepare(
      "SELECT status FROM site_versions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(tenant.id)
      .first<{ status: string }>();
    const page = latest?.status === "failed" ? preparingPage : buildingPage;
    return html(page(tenant.name), 200);
  }

  for (const path of candidates(pathname)) {
    const object = await env.SITES.get(distKey(tenant.id, tenant.active_version_id, path));
    if (object) return respond(object, path);
  }
  const custom = await env.SITES.get(distKey(tenant.id, tenant.active_version_id, "404.html"));
  if (custom) return respond(custom, "404.html", 404);
  return html(notFoundPage(), 404);
}

export async function serveMedia(env: Env, pathname: string): Promise<Response> {
  const key = safeDecode(pathname)?.replace(/^\/+/, "") ?? "";
  const object = key ? await env.MEDIA.get(key) : null;
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType ?? contentTypeFor(key),
    "cache-control": "public, max-age=31536000, immutable",
    etag: object.httpEtag,
  });
  return new Response(object.body, { headers });
}
