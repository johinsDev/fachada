import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/api";
import { projectsQuery, STATUS_LABEL } from "@/lib/projects";

export function ProjectsPage() {
  const { data: projects, isLoading } = useQuery(projectsQuery);

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Lo que publiques aquí aparece en tu sitio. El preview se actualiza al instante."
        actions={
          <Button asChild>
            <Link to="/proyectos/$id" params={{ id: "nuevo" }}>
              <Plus /> Nuevo proyecto
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !projects?.length ? (
        <div className="grid place-items-center rounded-xl border border-dashed py-16 text-center">
          <Building2 className="text-muted-foreground size-8" />
          <p className="mt-3 font-medium">Todavía no tienes proyectos</p>
          <p className="text-muted-foreground text-sm">Crea el primero y míralo en tu sitio.</p>
          <Button className="mt-4" asChild>
            <Link to="/proyectos/$id" params={{ id: "nuevo" }}>
              <Plus /> Nuevo proyecto
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Precio desde</TableHead>
                <TableHead>Sitio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link to="/proyectos/$id" params={{ id: p.id }} className="hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.city}</TableCell>
                  <TableCell>{STATUS_LABEL[p.status]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(p.price_from_cop)}
                  </TableCell>
                  <TableCell>
                    {p.published ? (
                      <Badge>Publicado</Badge>
                    ) : (
                      <Badge variant="secondary">Borrador</Badge>
                    )}
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
