import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env";

export const SESSION_COOKIE = "fs_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function cookieDomain(c: Context<AppEnv>): string | undefined {
  const host = new URL(c.req.url).hostname;
  return host.endsWith(`.${c.env.ROOT_DOMAIN}`) ? `.${c.env.ROOT_DOMAIN}` : undefined;
}

export async function createSession(c: Context<AppEnv>, userId: string, tenantId: string) {
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, userId, tenantId, Date.now() + THIRTY_DAYS * 1000)
    .run();
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: THIRTY_DAYS,
    domain: cookieDomain(c),
  });
}

export async function destroySession(c: Context<AppEnv>) {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/", domain: cookieDomain(c) });
}

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = getCookie(c, SESSION_COOKIE);
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
