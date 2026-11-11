import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { sessionQuery } from "@/lib/session";
import { LandingPage } from "@/routes/landing";
import { LoginPage } from "@/routes/login";
import { LeadsPage } from "@/routes/leads";
import { Placeholder } from "@/routes/placeholder";
import { ProjectFormPage } from "@/routes/project-form";
import { ProjectsPage } from "@/routes/projects";
import { CompanySettingsPage, DomainSettingsPage, IntegrationsPage } from "@/routes/settings";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.fetchQuery(sessionQuery)) throw redirect({ to: "/sitio" });
  },
  component: LandingPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entrar",
  component: LoginPage,
});

/** Everything behind a session lives under this pathless layout. */
export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery);
    if (!session) throw redirect({ to: "/entrar" });
    return { session };
  },
  component: AppShell,
});

const page = <TPath extends string>(path: TPath, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => appRoute, path, component });

export const routes = {
  proyectos: page("/proyectos", ProjectsPage),
  proyecto: page("/proyectos/$id", ProjectFormPage),
  leads: page("/leads", LeadsPage),
  sitio: page("/sitio", () => <Placeholder title="Sitio" />),
  empresa: page("/ajustes/empresa", CompanySettingsPage),
  dominio: page("/ajustes/dominio", DomainSettingsPage),
  integraciones: page("/ajustes/integraciones", IntegrationsPage),
};

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  appRoute.addChildren([
    routes.proyectos,
    routes.proyecto,
    routes.leads,
    routes.sitio,
    routes.empresa,
    routes.dominio,
    routes.integraciones,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
