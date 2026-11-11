// Platform file. For the demo, photos load straight from media.fachada.dev (and
// Unsplash resizes by query). Cloudflare Image Transformations can come back here.
const WIDTHS = [400, 640, 960, 1280, 1920];

export function cfImage(url: string, width: number): string {
  return withWidth(url, width);
}

export function srcset(url: string, widths: number[] = WIDTHS): string {
  return widths.map((w) => `${cfImage(url, w)} ${w}w`).join(", ");
}

/** Unsplash and similar hosts resize by query; elsewhere the URL is returned unchanged. */
function withWidth(url: string, width: number): string {
  if (url.includes("images.unsplash.com")) return `${url}?w=${width}&q=75&auto=format`;
  return url;
}
