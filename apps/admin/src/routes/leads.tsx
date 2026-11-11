import { useQuery } from "@tanstack/react-query";
import { Download, Inbox } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, API_URL, unwrap } from "@/lib/api";
import { projectsQuery } from "@/lib/projects";

interface Lead {
  id: string;
  project_slug: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  is_test: number;
  created_at: number;
}

const ALL = "__all";
const dateFmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

export function LeadsPage() {
  const [project, setProject] = useState(ALL);
  const [includeTests, setIncludeTests] = useState(false);
  const { data: projects } = useQuery(projectsQuery);
  const query = {
    ...(project !== ALL ? { project } : {}),
    ...(includeTests ? { includeTests: "1" } : {}),
  };
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", query],
    queryFn: async () => (await unwrap(api.leads.$get({ query }))) as unknown as Lead[],
    refetchInterval: 15_000,
  });
  const nameOf = (slug: string | null) =>
    projects?.find((p) => p.slug === slug)?.name ?? slug ?? "General";
  const exportUrl = `${API_URL}/leads/export.csv?${new URLSearchParams(query)}`;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Todo lo que llega por los formularios de tu sitio, lo más nuevo primero."
        actions={
          <Button variant="outline" asChild>
            <a href={exportUrl}>
              <Download /> Exportar CSV
            </a>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-6">
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los proyectos</SelectItem>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.slug}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="tests" checked={includeTests} onCheckedChange={setIncludeTests} />
          <Label htmlFor="tests">Incluir pruebas del preview</Label>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !leads?.length ? (
        <div className="grid place-items-center rounded-xl border border-dashed py-16 text-center">
          <Inbox className="text-muted-foreground size-8" />
          <p className="mt-3 font-medium">Aún no llegan leads</p>
          <p className="text-muted-foreground text-sm">
            Cuando alguien llene un formulario de tu sitio, aparece aquí.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {dateFmt.format(lead.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {lead.name} {lead.is_test ? <Badge variant="secondary">Prueba</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://wa.me/57${lead.phone.replace(/^57/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {lead.phone}
                    </a>
                    {lead.email && (
                      <div className="text-muted-foreground text-xs">{lead.email}</div>
                    )}
                  </TableCell>
                  <TableCell>{nameOf(lead.project_slug)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {lead.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
