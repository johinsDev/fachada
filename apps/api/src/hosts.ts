export type HostKind =
  | { kind: "app" | "api" | "media" }
  | { kind: "site"; slug: string }
  | { kind: "preview"; slug: string }
  | { kind: "unknown" };

const PLATFORM = new Set(["app", "api", "media"]);
/** A tenant's live preview lives at p-<slug>.<root>. */
export const PREVIEW_PREFIX = "p-";
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function parseHost(host: string, root: string): HostKind {
  const hostname = host.toLowerCase().split(":")[0] ?? "";
  if (!hostname.endsWith(`.${root}`)) return { kind: "unknown" };
  const label = hostname.slice(0, -(root.length + 1));
  if (label.includes(".") || !LABEL.test(label)) return { kind: "unknown" };
  if (PLATFORM.has(label)) return { kind: label as "app" | "api" | "media" };
  if (label.startsWith(PREVIEW_PREFIX) && label.length > PREVIEW_PREFIX.length) {
    return { kind: "preview", slug: label.slice(PREVIEW_PREFIX.length) };
  }
  return { kind: "site", slug: label };
}

export function hostOfOrigin(origin: string | undefined | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
