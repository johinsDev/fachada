import { tool } from "ai";
import { z } from "zod";
import type { SiteRuntime } from "../runtime/site-runtime";
import { resolveSitePath } from "./paths";

type ToolResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: error instanceof Error ? error.message : String(error),
});

/** Plain handlers behind the agent's tools (testable without a model). */
export function siteToolHandlers(runtime: SiteRuntime, slug: string) {
  const touched = new Set<string>();
  return {
    touched: () => [...touched],
    async listFiles({ dir = "src" }: { dir?: string } = {}): Promise<
      ToolResult<{ files: string[] }>
    > {
      try {
        const base =
          dir === "public" || dir.startsWith("public/") || dir.startsWith("src") ? dir : "src";
        return { ok: true, files: await runtime.listFiles(slug, base) };
      } catch (error) {
        return fail(error);
      }
    },
    async readFile({ path }: { path: string }): Promise<ToolResult<{ content: string }>> {
      try {
        // Reading the platform files is fine; only writing them is not.
        const safe = path.replace(/^\.\//, "");
        if (safe.includes("..") || safe.startsWith("/")) resolveSitePath(path);
        return { ok: true, content: await runtime.readFile(slug, safe) };
      } catch (error) {
        return fail(error);
      }
    },
    async writeFile({ path, content }: { path: string; content: string }): Promise<ToolResult> {
      try {
        const safe = resolveSitePath(path);
        await runtime.writeFile(slug, safe, content);
        touched.add(safe);
        return { ok: true };
      } catch (error) {
        return fail(error);
      }
    },
    async deleteFile({ path }: { path: string }): Promise<ToolResult> {
      try {
        const safe = resolveSitePath(path);
        await runtime.deleteFile(slug, safe);
        touched.add(safe);
        return { ok: true };
      } catch (error) {
        return fail(error);
      }
    },
    async checkBuild(): Promise<{ ok: boolean; output: string }> {
      return runtime.check(slug);
    },
  };
}

export function siteTools(handlers: ReturnType<typeof siteToolHandlers>) {
  return {
    listFiles: tool({
      description:
        "Lista los archivos del sitio dentro de un directorio (src por defecto, o public).",
      inputSchema: z.object({ dir: z.string().optional().describe("src, src/pages, public…") }),
      execute: (input) => handlers.listFiles(input),
    }),
    readFile: tool({
      description: "Lee un archivo del sitio. Rutas relativas, p. ej. src/pages/index.astro.",
      inputSchema: z.object({ path: z.string() }),
      execute: (input) => handlers.readFile(input),
    }),
    writeFile: tool({
      description:
        "Crea o reemplaza un archivo completo bajo src/ o public/. Escribe siempre el contenido entero.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: (input) => handlers.writeFile(input),
    }),
    deleteFile: tool({
      description: "Borra un archivo bajo src/ o public/.",
      inputSchema: z.object({ path: z.string() }),
      execute: (input) => handlers.deleteFile(input),
    }),
    checkBuild: tool({
      description:
        "Corre astro check y astro build sobre el sitio sin publicarlo. Úsalo antes de terminar y corrige hasta que pase.",
      inputSchema: z.object({}),
      execute: () => handlers.checkBuild(),
    }),
  };
}
