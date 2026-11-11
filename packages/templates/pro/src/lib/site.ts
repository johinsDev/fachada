// Platform file. Every number and name on the site comes from here, never from page copy.
import data from "../data/site.json";

export type ProjectStatus = "planos" | "construccion" | "entrega";

export interface SiteProject {
  slug: string;
  name: string;
  city: string;
  status: ProjectStatus;
  priceFromCOP: number | null;
  areaMin: number | null;
  areaMax: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string;
  photos: { url: string; alt: string }[];
}

export interface SiteData {
  company: {
    name: string;
    slug: string;
    logoUrl: string | null;
    whatsapp: string | null;
    colors: { primary: string; accent: string };
  };
  projects: SiteProject[];
  apiBase: string;
  generatedAt: string;
}

export function getSite(): SiteData {
  return data as SiteData;
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planos: "Sobre planos",
  construccion: "En construcción",
  entrega: "Entrega inmediata",
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number | null): string {
  return value == null ? "Precio por confirmar" : cop.format(value);
}

export function formatArea(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min} – ${max} m²`;
  return `${min ?? max} m²`;
}

export function whatsappHref(phone: string | null, text: string): string | null {
  if (!phone) return null;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function cities(projects: SiteProject[]): string[] {
  return [...new Set(projects.map((p) => p.city))].sort((a, b) => a.localeCompare(b, "es"));
}
