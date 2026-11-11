import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bot, Building2, Globe, Plug, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { TemplatePicker, type TemplateId } from "@/components/template-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const FEATURES = [
  {
    icon: Building2,
    title: "Proyectos y precios",
    text: "Carga tus proyectos una vez; el sitio se actualiza solo.",
  },
  {
    icon: Users,
    title: "Leads en un solo lugar",
    text: "Cada formulario llega al admin, con filtro y exportación.",
  },
  {
    icon: Bot,
    title: "Edita hablando",
    text: "Pide cambios en español y míralos en vivo antes de publicar.",
  },
  {
    icon: Plug,
    title: "Integraciones",
    text: "HubSpot, Sinco, WhatsApp y Meta Lead Ads, listos para conectar.",
  },
  {
    icon: Globe,
    title: "Tu dominio",
    text: "Empieza en un subdominio y apunta tu dominio cuando quieras.",
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState<TemplateId>("pro");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const res = await api.auth.signup.$post({
        json: {
          companyName: String(form.get("companyName")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          template,
        },
      });
      if (res.status === 409) {
        toast.error("Ya existe una cuenta con ese correo. Entra con tu contraseña.");
        return;
      }
      if (!res.ok) {
        toast.error("Revisa los datos: la contraseña debe tener al menos 8 caracteres.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/sitio" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(ellipse_at_top,_var(--color-muted),_transparent_60%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Button variant="ghost" asChild>
          <Link to="/entrar">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-12 px-6 pt-8 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <section>
          <p className="text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <Sparkles className="size-3.5" /> Para constructoras e inmobiliarias
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            El sitio de tu constructora, listo en un minuto.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">
            Escribe el nombre de tu empresa, elige una plantilla y recibe tu sitio de proyectos
            publicado, con un admin para tus proyectos y tus leads. Después lo ajustas pidiéndoselo
            a la IA.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="text-muted-foreground text-sm">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Crea tu sitio</CardTitle>
            <CardDescription>Gratis mientras pruebas. Sin tarjeta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nombre de la constructora</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  required
                  minLength={2}
                  placeholder="Constructora Andina"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Plantilla</Label>
                <TemplatePicker value={template} onChange={setTemplate} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Creando…" : "Crear mi sitio"}
                <ArrowRight />
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
