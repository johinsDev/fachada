import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./auth/routes";
import type { AppEnv } from "./env";

const ADMIN_ORIGIN = "https://app.fachada.dev";

const app = new Hono<AppEnv>()
  .use(
    "*",
    cors({
      origin: (origin) =>
        origin === ADMIN_ORIGIN || origin?.startsWith("http://localhost:") ? origin : null,
      credentials: true,
    }),
  )
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", authRoutes);

export type AppType = typeof app;
export { app };

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<AppEnv["Bindings"]>;
