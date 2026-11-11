import { Hono } from "hono";
import type { AppEnv } from "./env";

const app = new Hono<AppEnv>().get("/health", (c) => c.json({ ok: true }));

export type AppType = typeof app;
export { app };

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<AppEnv["Bindings"]>;
