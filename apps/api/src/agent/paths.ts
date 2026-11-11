export class PathNotAllowedError extends Error {
  constructor(path: string, reason: string) {
    super(`No puedes tocar "${path}": ${reason}`);
    this.name = "PathNotAllowedError";
  }
}

/** Files the platform owns inside src/: the data the site renders and its readers. */
const PLATFORM_FILES = new Set(["src/data/site.json", "src/lib/site.ts", "src/lib/image.ts"]);

/**
 * Normalises a path the agent sends and allows only src/ and public/, minus the
 * platform files. Throws PathNotAllowedError otherwise.
 */
export function resolveSitePath(input: string): string {
  if (!input || input.startsWith("/")) {
    throw new PathNotAllowedError(input, "usa una ruta relativa dentro de src/ o public/");
  }
  const parts: string[] = [];
  for (const part of input.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new PathNotAllowedError(input, "sale del sitio");
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  const path = parts.join("/");
  if (!(path.startsWith("src/") || path.startsWith("public/"))) {
    throw new PathNotAllowedError(
      input,
      "solo se puede editar src/ y public/ (package.json y astro.config son de la plataforma)",
    );
  }
  if (PLATFORM_FILES.has(path)) {
    throw new PathNotAllowedError(
      input,
      "es un archivo de la plataforma; los datos se editan en el admin",
    );
  }
  return path;
}
