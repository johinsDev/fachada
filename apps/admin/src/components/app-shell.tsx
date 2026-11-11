import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ExternalLink,
  Globe,
  LayoutTemplate,
  LogOut,
  Plug,
  Settings2,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

const MAIN = [
  { to: "/sitio", label: "Sitio", icon: LayoutTemplate },
  { to: "/proyectos", label: "Proyectos", icon: Building2 },
  { to: "/leads", label: "Leads", icon: Users },
] as const;

const SETTINGS = [
  { to: "/ajustes/empresa", label: "Empresa", icon: Settings2 },
  { to: "/ajustes/dominio", label: "Dominio", icon: Globe },
  { to: "/ajustes/integraciones", label: "Integraciones", icon: Plug },
] as const;

export function AppShell() {
  const session = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function logout() {
    await api.auth.logout.$post();
    queryClient.setQueryData(["session"], null);
    navigate({ to: "/entrar" });
  }

  const item = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Users }) => (
    <SidebarMenuItem key={to}>
      <SidebarMenuButton asChild isActive={pathname.startsWith(to)}>
        <Link to={to}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-4">
          <Logo />
          <div className="mt-3 rounded-lg border px-3 py-2">
            <p className="truncate text-sm font-medium">{session.tenant.name}</p>
            <a
              href={session.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 truncate text-xs"
            >
              {session.siteUrl.replace("https://", "")}
              <ExternalLink className="size-3" />
            </a>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{MAIN.map(item)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Ajustes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{SETTINGS.map(item)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout}>
                <LogOut />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Logo />
        </header>
        <div className="mx-auto w-full max-w-6xl p-6 md:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
