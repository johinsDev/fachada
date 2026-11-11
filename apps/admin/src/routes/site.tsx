import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { ExternalLink, History, LayoutTemplate, Loader2, RefreshCw, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TemplatePicker, type TemplateId } from "@/components/template-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiteChat } from "@/features/site/chat";
import { api, unwrap } from "@/lib/api";

interface Version {
  id: string;
  template: string;
  status: "building" | "ready" | "failed";
  reason: string;
  build_log?: string | null;
  created_at: number;
}

interface SiteState {
  slug: string;
  template: TemplateId;
  siteUrl: string;
  previewUrl: string;
  activeVersionId: string | null;
  latest: Version | null;
  hasDraft: boolean;
}

const REASON: Record<string, string> = {
  signup: "Sitio creado",
  data: "Datos actualizados",
  publish: "Cambios publicados",
  template: "Cambio de plantilla",
};
/** The end of a build log, where the error usually is. */
function lastLines(log: string | null | undefined, count = 8): string {
  return (log ?? "").trim().split("\n").slice(-count).join("\n");
}

const dateFmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" });

export function SitePage() {
  const queryClient = useQueryClient();
  const { data: site } = useQuery({
    queryKey: ["site"],
    queryFn: async () => (await unwrap(api.site.$get())) as unknown as SiteState,
    refetchInterval: (q) =>
      q.state.data?.latest?.status === "building" || !q.state.data?.activeVersionId
        ? 3_000
        : 20_000,
  });
  const { data: chat } = useQuery({
    queryKey: ["chat"],
    queryFn: async () => (await unwrap(api.site.chat.$get())) as unknown as UIMessage[],
    staleTime: Infinity,
  });
  const preview = useMutation({
    mutationFn: async () => (await unwrap(api.site.preview.start.$post())) as { url: string },
    onError: () => toast.error("No se pudo encender el preview. Intenta de nuevo."),
  });
  const [frameKey, setFrameKey] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("pro");
  const started = useRef(false);

  // Open the preview once, then keep the sandbox awake while this tab is visible.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    preview.mutate();
  }, [preview]);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void api.site.preview.heartbeat.$post();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["site"] });

  async function publish() {
    await api.site.publish.$post();
    toast.success("Publicando… tu sitio se actualiza en unos segundos.");
    setTimeout(refresh, 1_000);
  }

  async function switchTemplate() {
    await api.site.template.$post({ json: { template } });
    setTemplateOpen(false);
    toast.success("Cambiando de plantilla…");
    await refresh();
    setTimeout(() => setFrameKey((k) => k + 1), 8_000);
  }

  async function activate(version: Version) {
    const res = await api.site.versions[":id"].activate.$post({ param: { id: version.id } });
    if (!res.ok) return toast.error("Esa versión no se puede activar.");
    toast.success("Listo: el sitio volvió a esa versión.");
    await refresh();
  }

  const latest = site?.latest;
  // Building only while a build runs (or before the first one shows up); a failed first
  // build must not keep "Creando tu sitio" and a disabled Publicar forever.
  const building = latest?.status === "building" || (site && !site.activeVersionId && !latest);
  const failedExcerpt = latest?.status === "failed" ? lastLines(latest.build_log) : null;

  return (
    <div className="-m-6 flex h-[calc(100svh)] flex-col md:-m-8">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold">Tu sitio</p>
          {site && (
            <a
              href={site.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 truncate text-xs"
            >
              {site.siteUrl.replace("https://", "")} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {building ? (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="size-3 animate-spin" />{" "}
            {site?.activeVersionId ? "Publicando" : "Creando tu sitio"}
          </Badge>
        ) : latest?.status === "failed" ? (
          <Badge variant="destructive">La última publicación falló</Badge>
        ) : (
          <Badge variant="outline">Publicado</Badge>
        )}
        {site?.hasDraft && <Badge variant="secondary">Cambios sin publicar</Badge>}
        <VersionsMenu onActivate={activate} activeId={site?.activeVersionId ?? null} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTemplate(site?.template === "pro" ? "galias" : "pro");
            setTemplateOpen(true);
          }}
        >
          <LayoutTemplate /> Plantilla
        </Button>
        <Button size="sm" onClick={publish} disabled={building}>
          <Rocket /> Publicar
        </Button>
      </div>

      {failedExcerpt && (
        <div className="border-b bg-red-50 px-4 py-2 text-xs text-red-900 dark:bg-red-950 dark:text-red-100">
          <p className="font-medium">
            El sitio publicado sigue con la versión anterior. Pídele al chat que lo corrija o vuelve
            a publicar.
          </p>
          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono">
            {failedExcerpt}
          </pre>
        </div>
      )}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_1fr]">
        <aside className="min-h-0 border-r">
          {chat ? (
            <SiteChat
              initialMessages={chat}
              onTurnEnd={() => {
                void refresh();
                void queryClient.invalidateQueries({ queryKey: ["chat"] });
              }}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          )}
        </aside>
        <section className="bg-muted/40 relative min-h-0 p-3">
          <div className="bg-background flex h-full flex-col overflow-hidden rounded-xl border shadow-sm">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <span className="flex gap-1.5">
                <i className="size-2.5 rounded-full bg-red-400" />
                <i className="size-2.5 rounded-full bg-amber-400" />
                <i className="size-2.5 rounded-full bg-green-400" />
              </span>
              <span className="text-muted-foreground mx-auto truncate font-mono text-xs">
                {preview.data?.url.replace("https://", "") ?? "Encendiendo preview…"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setFrameKey((k) => k + 1)}
                aria-label="Recargar preview"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
            {preview.data ? (
              <iframe
                key={frameKey}
                src={preview.data.url}
                title="Preview del sitio"
                className="h-full w-full flex-1"
              />
            ) : (
              <div className="text-muted-foreground grid flex-1 place-items-center text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Encendiendo preview…
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar de plantilla</DialogTitle>
            <DialogDescription>
              Tus proyectos y datos se mantienen. Los cambios hechos con la IA sobre la plantilla
              actual se descartan.
            </DialogDescription>
          </DialogHeader>
          <TemplatePicker value={template} onChange={setTemplate} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={switchTemplate} disabled={template === site?.template}>
              Cambiar a {template === "pro" ? "Pro" : "Galias"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionsMenu({
  activeId,
  onActivate,
}: {
  activeId: string | null;
  onActivate: (v: Version) => void;
}) {
  const { data } = useQuery({
    queryKey: ["versions"],
    queryFn: async () => (await unwrap(api.site.versions.$get())) as unknown as Version[],
    refetchInterval: 10_000,
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <History /> Versiones
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Historial</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data?.slice(0, 12).map((v) => (
          <DropdownMenuItem
            key={v.id}
            disabled={v.status !== "ready" || v.id === activeId}
            onSelect={() => onActivate(v)}
            className="flex justify-between gap-3"
          >
            <span>
              <span className="block text-sm">
                {REASON[v.reason.split(",")[0] ?? ""] ?? v.reason}
              </span>
              <span className="text-muted-foreground text-xs">
                {dateFmt.format(v.created_at)} · {v.template === "pro" ? "Pro" : "Galias"}
              </span>
            </span>
            <span className="text-xs">
              {v.id === activeId
                ? "En línea"
                : v.status === "failed"
                  ? "Falló"
                  : v.status === "building"
                    ? "…"
                    : "Volver a esta"}
            </span>
          </DropdownMenuItem>
        ))}
        {!data?.length && (
          <p className="text-muted-foreground px-2 py-3 text-sm">Aún no hay versiones.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
