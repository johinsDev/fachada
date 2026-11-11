import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./auth/routes";
import type { AppEnv } from "./env";
import { parseHost } from "./hosts";
import { publicRoutes } from "./leads/public";
import { leadRoutes } from "./leads/routes";
import { projectRoutes } from "./projects/routes";
import { serveMedia, serveSite } from "./serve/site";
import { settingsRoutes } from "./settings/routes";
import { siteRoutes } from "./site/routes";

const ADMIN_ORIGIN = "https://app.fachada.dev";

const app = new Hono<AppEnv>()
  // Public endpoints answer CORS themselves: their allowed origin depends on the tenant.
  .route("/public", publicRoutes)
  .use(
    "*",
    cors({
      origin: (origin) =>
        origin === ADMIN_ORIGIN || origin?.startsWith("http://localhost:") ? origin : null,
      credentials: true,
    }),
  )
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", authRoutes)
  .route("/projects", projectRoutes)
  .route("/leads", leadRoutes)
  .route("/settings", settingsRoutes)
  .route("/site", siteRoutes);

export type AppType = typeof app;
export { app };
export { SiteSandbox } from "./runtime/site-sandbox";
export { BuildCoordinator } from "./site/build-coordinator";

export default {
  async fetch(request, env, ctx) {
    const host = parseHost(new URL(request.url).host, env.ROOT_DOMAIN);
    if (host.kind === "preview") {
      // The container serves plain HTTP; Cloudflare terminates TLS at the edge.
      const url = new URL(request.url);
      url.protocol = "http:";
      return env.SANDBOX.getByName(`t-${host.slug}`).fetch(new Request(url, request));
    }
    if (host.kind === "site" && (request.method === "GET" || request.method === "HEAD")) {
      return serveSite(env, host.slug, new URL(request.url).pathname);
    }
    if (host.kind === "media") return serveMedia(env, new URL(request.url).pathname);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
