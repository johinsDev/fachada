import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const res = await api.auth.login.$post({
        json: { email: String(form.get("email")), password: String(form.get("password")) },
      });
      if (!res.ok) {
        toast.error("Correo o contraseña incorrectos.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/sitio" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted/40 grid min-h-svh place-items-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 inline-block">
          <Logo />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Administra tu sitio, tus proyectos y tus leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
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
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Entrando…" : "Entrar"}
              </Button>
            </form>
            <p className="text-muted-foreground mt-4 text-center text-sm">
              ¿No tienes cuenta?{" "}
              <Link to="/" className="text-foreground underline">
                Crea tu sitio
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
