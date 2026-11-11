import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./api";

export type ProjectStatus = "planos" | "construccion" | "entrega";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planos: "Sobre planos",
  construccion: "En construcción",
  entrega: "Entrega inmediata",
};

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: ProjectStatus;
  price_from_cop: number | null;
  area_min: number | null;
  area_max: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string;
  published: number;
  updated_at: number;
}

export interface ProjectDetail extends ProjectRow {
  photos: { id: string; alt: string; url: string }[];
}

export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => (await unwrap(api.projects.$get())) as unknown as ProjectRow[],
});

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: ["projects", id],
    queryFn: async () =>
      (await unwrap(api.projects[":id"].$get({ param: { id } }))) as unknown as ProjectDetail,
  });

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
