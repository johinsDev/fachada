export type TemplateId = "galias" | "pro";
export const TEMPLATE_IDS = ["galias", "pro"] as const satisfies readonly TemplateId[];

export type ProjectStatus = "planos" | "construccion" | "entrega";
export const PROJECT_STATUSES = [
  "planos",
  "construccion",
  "entrega",
] as const satisfies readonly ProjectStatus[];

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
