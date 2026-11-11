import type { Env } from "../env";
import { escape } from "./pages";

const USER = "johan";

async function sameSecret(a: string, b: string) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

async function authorized(env: Env, request: Request) {
  const password = env.SUPER_ADMIN_PASSWORD;
  if (!password) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  return decoded.slice(0, i) === USER && (await sameSecret(decoded.slice(i + 1), password));
}

interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  template: string;
  created_at: number;
  email: string | null;
  projects: number;
  published: number;
  leads: number;
  last_lead: number | null;
  build: string | null;
  active_version_id: string | null;
}

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Bogota",
});
const when = (ms: number | null) => (ms ? dateFmt.format(ms) : "—");

/** admin.fachada.dev: a read-only list of every constructora that signed up. */
export async function serveSuperAdmin(env: Env, request: Request): Promise<Response> {
  if (!(await authorized(env, request))) {
    return new Response("Autenticación requerida", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="Fachada admin", charset="UTF-8"' },
    });
  }

  const { results: tenants } = await env.DB.prepare(
    `SELECT t.id, t.slug, t.name, t.template, t.created_at, t.active_version_id,
       (SELECT email FROM users u WHERE u.tenant_id = t.id ORDER BY u.created_at LIMIT 1) AS email,
       (SELECT COUNT(*) FROM projects p WHERE p.tenant_id = t.id) AS projects,
       (SELECT COUNT(*) FROM projects p WHERE p.tenant_id = t.id AND p.published = 1) AS published,
       (SELECT COUNT(*) FROM leads l WHERE l.tenant_id = t.id AND l.is_test = 0) AS leads,
       (SELECT MAX(created_at) FROM leads l WHERE l.tenant_id = t.id AND l.is_test = 0) AS last_lead,
       (SELECT status FROM site_versions v WHERE v.tenant_id = t.id ORDER BY v.created_at DESC LIMIT 1) AS build
     FROM tenants t ORDER BY t.created_at DESC`,
  ).all<TenantSummary>();

  const root = env.ROOT_DOMAIN;
  const totals = {
    tenants: tenants.length,
    projects: tenants.reduce((n, t) => n + t.projects, 0),
    leads: tenants.reduce((n, t) => n + t.leads, 0),
  };
  const badge = (t: TenantSummary) =>
    t.build === "failed"
      ? `<span class="b red">falló</span>`
      : t.build === "building"
        ? `<span class="b">publicando</span>`
        : t.active_version_id
          ? `<span class="b green">en línea</span>`
          : `<span class="b">sin publicar</span>`;

  const rows = tenants
    .map(
      (t) => `<tr>
  <td><strong>${escape(t.name)}</strong><div class="m">${escape(t.email ?? "—")}</div></td>
  <td><a href="https://${t.slug}.${root}" target="_blank" rel="noreferrer">${t.slug}.${root}</a><div class="m">${escape(t.template)}</div></td>
  <td>${badge(t)}</td>
  <td class="n">${t.published}/${t.projects}</td>
  <td class="n">${t.leads}<div class="m">${when(t.last_lead)}</div></td>
  <td class="m">${when(t.created_at)}</td>
</tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Fachada · Constructoras</title>
<style>
body{margin:0;font:14px/1.45 system-ui,sans-serif;background:#fafafa;color:#111}
main{max-width:1100px;margin:0 auto;padding:32px 20px}
h1{font-size:22px;margin:0 0 4px}.sub{color:#666;margin:0 0 24px}
.cards{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:14px 18px;min-width:140px}
.card b{display:block;font-size:24px}.card span{color:#666;font-size:12px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid #eee;vertical-align:top}
th{font-size:12px;color:#666;font-weight:600;background:#f6f6f6}
.n{text-align:right;font-variant-numeric:tabular-nums}.m{color:#777;font-size:12px}
a{color:#111}.b{display:inline-block;padding:2px 8px;border-radius:99px;background:#eee;font-size:12px}
.green{background:#e6f4ea;color:#1e6b3a}.red{background:#fdecea;color:#a12622}
</style></head><body><main>
<h1>Constructoras en Fachada</h1>
<p class="sub">Todo lo que se ha registrado, lo más reciente primero.</p>
<div class="cards">
  <div class="card"><b>${totals.tenants}</b><span>constructoras</span></div>
  <div class="card"><b>${totals.projects}</b><span>proyectos</span></div>
  <div class="card"><b>${totals.leads}</b><span>leads (sin pruebas)</span></div>
</div>
<table><thead><tr><th>Constructora</th><th>Sitio</th><th>Estado</th><th class="n">Proyectos publicados</th><th class="n">Leads</th><th>Registro</th></tr></thead>
<tbody>${rows || `<tr><td colspan="6" class="m">Nadie se ha registrado todavía.</td></tr>`}</tbody></table>
</main></body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
