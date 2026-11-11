import { API_URL, ApiError } from "./api";

/** Multipart uploads go through fetch: the typed client only covers JSON routes. */
export async function uploadFile<T>(path: string, file: File, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `http_${res.status}`);
  }
  return (await res.json()) as T;
}
