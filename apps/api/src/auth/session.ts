import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env";

/**
 * Host-only (`__Host-` prefix: no Domain, Secure, Path=/) and SameSite=Strict, so the
 * session never reaches tenant sites or previews on <slug>.fachada.dev, and a tenant
 * page cannot plant its own session cookie for the API.
 */
export const SESSION_COOKIE = "fs_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function createSession(c: Context<AppEnv>, userId: string, tenantId: string) {
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, userId, tenantId, Date.now() + THIRTY_DAYS * 1000)
    .run();
  setCookie(c, SESSION_COOKIE, id, {
    prefix: "host",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function destroySession(c: Context<AppEnv>) {
  const id = getCookie(c, SESSION_COOKIE, "host");
  if (id) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  deleteCookie(c, SESSION_COOKIE, { prefix: "host", path: "/", secure: true });
}

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = getCookie(c, SESSION_COOKIE, "host");
  if (!id) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(
    "SELECT user_id, tenant_id, expires_at FROM sessions WHERE id = ?",
  )
    .bind(id)
    .first<{ user_id: string; tenant_id: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", row.user_id);
  c.set("tenantId", row.tenant_id);
  await next();
};
