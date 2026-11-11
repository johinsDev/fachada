// Platform file. Photos go through Cloudflare Image Transformations in production;
// in `astro dev` (the live preview) they load as-is.
const WIDTHS = [400, 640, 960, 1280, 1920];

export function cfImage(url: string, width: number): string {
  if (import.meta.env.DEV) return withWidth(url, width);
  return `https://fachada.dev/cdn-cgi/image/width=${width},quality=75,format=auto/${url}`;
}

export function srcset(url: string, widths: number[] = WIDTHS): string {
  return widths.map((w) => `${cfImage(url, w)} ${w}w`).join(", ");
}

/** Unsplash and similar hosts resize by query; elsewhere the URL is returned unchanged. */
function withWidth(url: string, width: number): string {
  if (url.includes("images.unsplash.com")) return `${url}?w=${width}&q=75&auto=format`;
  return url;
}
