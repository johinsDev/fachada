import type { ProjectStatus, SiteData, TemplateId } from "@fachada/shared";
import { scoped } from "../db/tenant";
import type { Env } from "../env";
import type { ProjectRow } from "../projects/routes";

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  template: TemplateId;
  settings_json: string;
  active_version_id: string | null;
}

export async function getTenant(env: Env, tenantId: string): Promise<TenantRow> {
  const row = await env.DB.prepare(
    "SELECT id, slug, name, template, settings_json, active_version_id FROM tenants WHERE id = ?",
  )
    .bind(tenantId)
    .first<TenantRow>();
  if (!row) throw new Error(`Unknown tenant ${tenantId}`);
  return row;
}

export async function buildSiteData(env: Env, tenantId: string): Promise<SiteData> {
  const tenant = await getTenant(env, tenantId);
  const settings = JSON.parse(tenant.settings_json) as {
    logoUrl?: string | null;
    whatsapp?: string | null;
    colors?: { primary: string; accent: string };
  };
  const db = scoped(env.DB, tenantId);
  const projects = await db.all<ProjectRow>(
    "SELECT * FROM projects WHERE tenant_id = ? AND published = 1 ORDER BY updated_at DESC",
  );
  const photos = await db.all<{ project_id: string; key: string; alt: string }>(
    "SELECT project_id, key, alt FROM project_photos WHERE tenant_id = ? ORDER BY position",
  );
  const media = (key: string) => `https://media.${env.ROOT_DOMAIN}/${key}`;

  return {
    company: {
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: settings.logoUrl ?? null,
      whatsapp: settings.whatsapp ?? null,
      colors: settings.colors ?? { primary: "#1f3a5f", accent: "#c8a24a" },
    },
    projects: projects.map((p) => ({
      slug: p.slug,
      name: p.name,
      city: p.city,
      status: p.status as ProjectStatus,
      priceFromCOP: p.price_from_cop,
      areaMin: p.area_min,
      areaMax: p.area_max,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      description: p.description,
      photos: photos
        .filter((ph) => ph.project_id === p.id)
        .map((ph) => ({ url: media(ph.key), alt: ph.alt })),
    })),
    apiBase: `https://api.${env.ROOT_DOMAIN}`,
    generatedAt: new Date().toISOString(),
  };
}
