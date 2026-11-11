import type { SiteData, TemplateId } from "@fachada/shared";

/** Where a site's source comes from: a saved tar (a version or the AI draft) or the template seed. */
export type SourceRef = { kind: "tar"; bytes: Uint8Array } | { kind: "seed" };

export interface BuiltFile {
  path: string;
  bytes: Uint8Array;
}

export type BuildResult =
  { ok: true; files: BuiltFile[]; source: Uint8Array } | { ok: false; output: string };

/**
 * Everything the API needs from a tenant's sandbox. The live preview works on one
 * directory and builds on another, so a rebuild never touches unpublished AI edits.
 */
export interface SiteRuntime {
  isAwake(slug: string): Promise<boolean>;
  /** Keeps an open preview from going to sleep while the admin is looking at it. */
  touch(slug: string): Promise<void>;

  /** Loads the source into the preview workspace, writes site.json and starts `astro dev`. */
  openPreview(
    slug: string,
    src: SourceRef,
    template: TemplateId,
    data: SiteData,
  ): Promise<{ url: string }>;
  /** Rewrites site.json in the running preview (HMR picks it up). */
  writeSiteData(slug: string, data: SiteData): Promise<void>;

  listFiles(slug: string, dir: string): Promise<string[]>;
  readFile(slug: string, path: string): Promise<string>;
  writeFile(slug: string, path: string, content: string): Promise<void>;
  deleteFile(slug: string, path: string): Promise<void>;
  /** `astro check` + `astro build` on the preview workspace, without publishing. */
  check(slug: string): Promise<{ ok: boolean; output: string }>;
  /** Tar of the preview workspace without node_modules, dist or .astro. */
  snapshot(slug: string): Promise<Uint8Array>;

  /** Builds a fresh copy of the source in the build workspace. */
  build(slug: string, src: SourceRef, template: TemplateId, data: SiteData): Promise<BuildResult>;
}
