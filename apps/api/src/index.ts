import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { agentRoutes } from "./agent/routes";
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
const isAdminOrigin = (origin: string | undefined) =>
  origin === ADMIN_ORIGIN || Boolean(origin?.startsWith("http://localhost:"));

/**
 * Every <slug>.fachada.dev is same-site with the API, so cookies alone do not stop a
 * tenant page from driving another user's admin. A browser always sends Origin on a
 * cross-origin write: refuse any write whose Origin is not the admin.
 */
const adminOriginOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origin = c.req.header("origin");
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && origin && !isAdminOrigin(origin)) {
    return c.json({ error: "forbidden_origin" }, 403);
  }
  await next();
};

const app = new Hono<AppEnv>()
  // Public endpoints answer CORS themselves: their allowed origin depends on the tenant.
  .route("/public", publicRoutes)
  .use(
    "*",
    cors({ origin: (origin) => (isAdminOrigin(origin) ? origin : null), credentials: true }),
  )
  .use("*", adminOriginOnly)
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", authRoutes)
  .route("/projects", projectRoutes)
  .route("/leads", leadRoutes)
  .route("/settings", settingsRoutes)
  .route("/site/chat", agentRoutes)
  .route("/site", siteRoutes);

export type AppType = typeof app;
export { app };
export { SiteSandbox } from "./runtime/site-sandbox";
export { BuildCoordinator } from "./site/build-coordinator";

/**
 * The request a preview forwards to the container: plain HTTP (TLS ends at the edge) and
 * without credentials, because the dev server runs code the tenant's agent wrote.
 */
export function previewRequest(request: Request): Request {
  const url = new URL(request.url);
  url.protocol = "http:";
  const forwarded = new Request(url, request);
  forwarded.headers.delete("cookie");
  forwarded.headers.delete("authorization");
  return forwarded;
}

export default {
  async fetch(request, env, ctx) {
    const { hostname } = new URL(request.url);
    // The bare domain has no site of its own: send it to the landing.
    if (hostname === env.ROOT_DOMAIN)
      return Response.redirect(`https://app.${env.ROOT_DOMAIN}/`, 302);
    const host = parseHost(new URL(request.url).host, env.ROOT_DOMAIN);
    if (host.kind === "preview") {
      return env.SANDBOX.getByName(`t-${host.slug}`).fetch(previewRequest(request));
    }
    if (host.kind === "site" && (request.method === "GET" || request.method === "HEAD")) {
      return serveSite(env, host.slug, new URL(request.url).pathname);
    }
    if (host.kind === "media") return serveMedia(env, new URL(request.url).pathname);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
