import type { SiteData, TemplateId } from "@fachada/shared";
import type { Env } from "../env";
import type { BuildResult, SiteRuntime, SourceRef } from "./site-runtime";

/** SiteRuntime over the per-tenant SiteSandbox Durable Object. */
export class CloudflareRuntime implements SiteRuntime {
  constructor(private env: Env) {}

  private box(slug: string) {
    return this.env.SANDBOX.getByName(`t-${slug}`);
  }

  isAwake(slug: string) {
    return this.box(slug).isAwake();
  }
  touch(slug: string) {
    return this.box(slug).touch();
  }
  openPreview(slug: string, src: SourceRef, template: TemplateId, data: SiteData) {
    return this.box(slug).openPreview(slug, src, template, data);
  }
  writeSiteData(slug: string, data: SiteData) {
    return this.box(slug).writeSiteData(data);
  }
  listFiles(slug: string, dir: string) {
    return this.box(slug).listFiles(dir);
  }
  readFile(slug: string, path: string) {
    return this.box(slug).readFile(path);
  }
  writeFile(slug: string, path: string, content: string) {
    return this.box(slug).writeFile(path, content);
  }
  deleteFile(slug: string, path: string) {
    return this.box(slug).deleteFile(path);
  }
  check(slug: string) {
    return this.box(slug).check();
  }
  snapshot(slug: string) {
    return this.box(slug).snapshot();
  }
  build(slug: string, src: SourceRef, template: TemplateId, data: SiteData): Promise<BuildResult> {
    return this.box(slug).build(src, template, data);
  }
}
