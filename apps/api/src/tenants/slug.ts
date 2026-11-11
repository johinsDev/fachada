export const RESERVED_SLUGS = new Set(["app", "api", "www", "media", "sitios"]);

export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/g, "")
    // p-<slug> is the preview host, so a site slug may not start with it.
    .replace(/^p-/, "p");
  return base || "constructora";
}

export async function uniqueSlug(db: D1Database, name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const taken = await db.prepare("SELECT 1 FROM tenants WHERE slug = ?").bind(candidate).first();
    if (!taken) return candidate;
  }
}
