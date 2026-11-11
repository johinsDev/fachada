import { describe, expect, it } from "vitest";
import { PathNotAllowedError, resolveSitePath } from "../src/agent/paths";

describe("resolveSitePath", () => {
  it("accepts files under src/ and public/", () => {
    expect(resolveSitePath("src/pages/index.astro")).toBe("src/pages/index.astro");
    expect(resolveSitePath("./public/fonts/x.woff2")).toBe("public/fonts/x.woff2");
    expect(resolveSitePath("src/components/../pages/a.astro")).toBe("src/pages/a.astro");
  });

  it.each([
    "../secret",
    "/etc/passwd",
    "package.json",
    "astro.config.mjs",
    "src/../package.json",
    "node_modules/x",
    "src/data/site.json",
    "src/lib/site.ts",
    "src/lib/image.ts",
    "",
  ])("refuses %s", (path) => {
    expect(() => resolveSitePath(path)).toThrow(PathNotAllowedError);
  });
});
