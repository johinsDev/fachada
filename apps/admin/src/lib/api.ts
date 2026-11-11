import { hc } from "hono/client";
import type { AppType } from "../../../api/src/index";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "https://api.fachada.dev";

export const api = hc<AppType>(API_URL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** Unwraps a Hono client response: JSON on success, ApiError otherwise. */
export async function unwrap(
  res: Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
): Promise<unknown> {
  const r = await res;
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(r.status, body.error ?? `http_${r.status}`);
  }
  return r.json();
}

export const formatCOP = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(value);
