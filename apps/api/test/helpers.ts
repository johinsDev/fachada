import { env } from "cloudflare:test";

export async function seedTenant(id: string, slug = id) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO tenants (id, slug, name, template, settings_json, created_at) VALUES (?, ?, ?, 'pro', '{}', 0)",
  )
    .bind(id, slug, id)
    .run();
}
