import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Plug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, unwrap } from "@/lib/api";
import { uploadFile } from "@/lib/upload";

interface Company {
  name: string;
  logoUrl: string | null;
  whatsapp: string | null;
  colors: { primary: string; accent: string };
}

export function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await unwrap(api.settings.company.$get())) as unknown as Company,
  });
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined);
  if (!data) return <Skeleton className="h-80 w-full" />;
  const logo = logoUrl === undefined ? data.logoUrl : logoUrl;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const whatsapp = String(f.get("whatsapp") ?? "").trim();
    const res = await api.settings.company.$put({
      json: {
        name: String(f.get("name")),
        logoUrl: logo ?? null,
        whatsapp: whatsapp || null,
        colors: { primary: String(f.get("primary")), accent: String(f.get("accent")) },
      },
    });
    if (!res.ok)
      return toast.error(
        "Revisa los datos: el WhatsApp va con indicativo, p. ej. +57 300 123 4567.",
      );
    await queryClient.invalidateQueries({ queryKey: ["company"] });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    toast.success("Guardado · el preview ya lo muestra, publicando…");
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const { url } = await uploadFile<{ url: string }>("/settings/company/logo", file);
    setLogoUrl(url);
  }

  return (
    <>
      <PageHeader
        title="Empresa"
        description="Nombre, logo, WhatsApp y colores de marca de tu sitio."
      />
      <form onSubmit={onSubmit}>
        <Card className="max-w-2xl">
          <CardContent className="grid gap-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required defaultValue={data.name} />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="bg-muted grid h-14 w-32 place-items-center rounded-lg border">
                  {logo ? (
                    <img src={logo} alt="Logo" className="max-h-10 max-w-28" />
                  ) : (
                    <span className="text-muted-foreground text-xs">Sin logo</span>
                  )}
                </div>
                <Button variant="outline" asChild>
                  <label>
                    Subir logo
                    <input
                      type="file"
                      hidden
                      accept="image/png,image/svg+xml,image/webp,image/jpeg"
                      onChange={(e) => onLogo(e.target.files?.[0])}
                    />
                  </label>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                placeholder="+57 300 123 4567"
                defaultValue={data.whatsapp ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(["primary", "accent"] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>
                    {key === "primary" ? "Color principal" : "Color de acento"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={key}
                      name={key}
                      type="color"
                      defaultValue={data.colors[key]}
                      className="h-9 w-12 cursor-pointer rounded-md border"
                    />
                    <span className="text-muted-foreground text-xs">
                      Botones, etiquetas y detalles
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Guardar</Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}

interface DomainState {
  hostname: string;
  status: "pending";
  dns: { type: "CNAME"; name: string; target: string };
}

export function DomainSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["domain"],
    queryFn: async () =>
      (await unwrap(api.settings.domain.$get())) as unknown as DomainState | null,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hostname = String(new FormData(event.currentTarget).get("hostname"));
    const res = await api.settings.domain.$put({ json: { hostname } });
    if (!res.ok) return toast.error("Escribe un dominio válido, p. ej. www.miconstructora.com");
    await queryClient.invalidateQueries({ queryKey: ["domain"] });
  }

  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado"));

  return (
    <>
      <PageHeader
        title="Dominio"
        description="Usa tu propio dominio en lugar del subdominio de Fachada."
      />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <form onSubmit={onSubmit}>
            <CardContent className="space-y-2 pt-6">
              <Label htmlFor="hostname">Tu dominio</Label>
              <div className="flex gap-2">
                <Input
                  id="hostname"
                  name="hostname"
                  placeholder="www.miconstructora.com"
                  defaultValue={data?.hostname}
                />
                <Button type="submit">Conectar</Button>
              </div>
            </CardContent>
          </form>
        </Card>
        {isLoading
          ? null
          : data && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {data.hostname} <Badge variant="secondary">Pendiente de verificación</Badge>
                  </CardTitle>
                  <CardDescription>
                    Crea este registro en el proveedor de tu dominio. Cuando lo detectemos, emitimos
                    el certificado y tu sitio queda en esa dirección.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-x-6 gap-y-2 rounded-lg border p-4 font-mono text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <span className="text-muted-foreground">Nombre</span>
                    <span className="text-muted-foreground">Valor</span>
                    <span>{data.dns.type}</span>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-left"
                      onClick={() => copy(data.dns.name)}
                    >
                      {data.dns.name} <Copy className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-left"
                      onClick={() => copy(data.dns.target)}
                    >
                      {data.dns.target} <Copy className="size-3" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
      </div>
    </>
  );
}

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected";
  fields: { key: string; label: string; secret?: boolean }[];
  config: Record<string, string>;
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Integration | null>(null);
  const { data } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await unwrap(api.settings.integrations.$get())) as unknown as Integration[],
  });

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open) return;
    const body = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    await api.settings.integrations[":id"].connect.$post({
      param: { id: open.id },
      json: body,
    } as never);
    await queryClient.invalidateQueries({ queryKey: ["integrations"] });
    toast.success(`${open.name} conectado`);
    setOpen(null);
  }

  async function disconnect(item: Integration) {
    await api.settings.integrations[":id"].disconnect.$post({ param: { id: item.id } });
    await queryClient.invalidateQueries({ queryKey: ["integrations"] });
  }

  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Conecta tus leads y tu sitio con las herramientas que ya usas."
      />
      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Plug className="size-4" /> {item.name}
                  </span>
                  {item.status === "connected" && (
                    <Badge className="gap-1">
                      <CheckCircle2 className="size-3" /> Conectada
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                {item.status === "connected" ? (
                  <Button variant="outline" size="sm" onClick={() => disconnect(item)}>
                    Desconectar
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setOpen(item)}>
                    Conectar
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form onSubmit={connect}>
            <DialogHeader>
              <DialogTitle>Conectar {open?.name}</DialogTitle>
              <DialogDescription>{open?.description}</DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-4">
              {open?.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    name={field.key}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit">Conectar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
