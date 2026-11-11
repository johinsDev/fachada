import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, API_URL, ApiError } from "@/lib/api";
import {
  projectQuery,
  slugify,
  STATUS_LABEL,
  type ProjectDetail,
  type ProjectStatus,
} from "@/lib/projects";
import { uploadFile } from "@/lib/upload";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[^\d.]/g, "");
  return s ? Number(s) : null;
};

export function ProjectFormPage() {
  const { id } = useParams({ from: "/app/proyectos/$id" });
  const isNew = id === "nuevo";
  const { data, isLoading } = useQuery({ ...projectQuery(id), enabled: !isNew });
  if (!isNew && (isLoading || !data)) return <Skeleton className="h-96 w-full" />;
  return <ProjectForm key={id} project={isNew ? null : data!} />;
}

function ProjectForm({ project }: { project: ProjectDetail | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planos");
  const [published, setPublished] = useState(project ? project.published === 1 : true);
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(project));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const json = {
      name: String(f.get("name")),
      slug,
      city: String(f.get("city")),
      status,
      priceFromCOP: num(f.get("priceFromCOP")),
      areaMin: num(f.get("areaMin")),
      areaMax: num(f.get("areaMax")),
      bedrooms: num(f.get("bedrooms")),
      bathrooms: num(f.get("bathrooms")),
      description: String(f.get("description") ?? ""),
      published,
    };
    setSaving(true);
    try {
      const res = project
        ? await api.projects[":id"].$put({ param: { id: project.id }, json })
        : await api.projects.$post({ json });
      if (res.status === 409) return toast.error("Ya tienes un proyecto con esa dirección (slug).");
      if (!res.ok) return toast.error("Revisa los campos obligatorios.");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Guardado · el preview ya lo muestra, publicando…");
      if (!project) {
        const { id } = (await res.json()) as { id: string };
        navigate({ to: "/proyectos/$id", params: { id } });
      }
    } finally {
      setSaving(false);
    }
  }

  async function onPhotos(files: FileList | null) {
    if (!project || !files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(`/projects/${project.id}/photos`, file, { alt: project.name });
      }
      await queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      toast.success("Fotos subidas");
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 415
          ? "Solo JPG, PNG, WebP o AVIF."
          : "No se pudo subir la foto.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photoId: string) {
    if (!project) return;
    await fetch(`${API_URL}/projects/${project.id}/photos/${photoId}`, {
      method: "DELETE",
      credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
  }

  async function removeProject() {
    if (!project || !confirm(`¿Borrar ${project.name}? Se quita del sitio.`)) return;
    await api.projects[":id"].$delete({ param: { id: project.id } });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    navigate({ to: "/proyectos" });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
        <Link to="/proyectos">
          <ArrowLeft /> Proyectos
        </Link>
      </Button>
      <PageHeader
        title={project?.name ?? "Nuevo proyecto"}
        actions={
          project && (
            <Button variant="outline" onClick={removeProject}>
              <Trash2 /> Borrar
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form id="project-form" onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos del proyecto</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  defaultValue={project?.name}
                  onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Dirección en el sitio</Label>
                <Input
                  id="slug"
                  value={slug}
                  required
                  pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
                <p className="text-muted-foreground text-xs">/proyectos/{slug || "…"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" name="city" required defaultValue={project?.city} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceFromCOP">Precio desde (COP)</Label>
                <Input
                  id="priceFromCOP"
                  name="priceFromCOP"
                  inputMode="numeric"
                  defaultValue={project?.price_from_cop ?? ""}
                  placeholder="Vacío = por confirmar"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="areaMin">Área desde (m²)</Label>
                  <Input
                    id="areaMin"
                    name="areaMin"
                    inputMode="decimal"
                    defaultValue={project?.area_min ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="areaMax">Área hasta (m²)</Label>
                  <Input
                    id="areaMax"
                    name="areaMax"
                    inputMode="decimal"
                    defaultValue={project?.area_max ?? ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Alcobas</Label>
                  <Input
                    id="bedrooms"
                    name="bedrooms"
                    inputMode="numeric"
                    defaultValue={project?.bedrooms ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Baños</Label>
                  <Input
                    id="bathrooms"
                    name="bathrooms"
                    inputMode="numeric"
                    defaultValue={project?.bathrooms ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={6}
                  defaultValue={project?.description}
                  placeholder="Deja una línea en blanco entre párrafos."
                />
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">Publicado</span>
                  <span className="text-muted-foreground text-xs">Visible en tu sitio</span>
                </span>
                <Switch checked={published} onCheckedChange={setPublished} />
              </label>
              <Button type="submit" form="project-form" className="w-full" disabled={saving}>
                {saving ? "Guardando…" : project ? "Guardar cambios" : "Crear proyecto"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fotos</CardTitle>
              <CardDescription>
                {project ? "La primera es la portada." : "Guarda el proyecto para subir fotos."}
              </CardDescription>
            </CardHeader>
            {project && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {project.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border"
                    >
                      <img src={photo.url} alt={photo.alt} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="bg-background/90 absolute top-1 right-1 hidden rounded-md p-1 group-hover:block"
                        aria-label="Quitar foto"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full" asChild disabled={uploading}>
                  <label>
                    <ImagePlus /> {uploading ? "Subiendo…" : "Subir fotos"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      multiple
                      hidden
                      onChange={(e) => onPhotos(e.target.files)}
                    />
                  </label>
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
