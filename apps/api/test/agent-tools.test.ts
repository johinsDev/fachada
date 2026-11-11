import { describe, expect, it } from "vitest";
import { siteToolHandlers } from "../src/agent/tools";
import { FakeRuntime } from "../src/runtime/fake-runtime";

describe("site tools", () => {
  it("refuses to write package.json and tells the model why", async () => {
    const runtime = new FakeRuntime();
    const tools = siteToolHandlers(runtime, "demo");
    const result = await tools.writeFile({ path: "package.json", content: "{}" });
    expect(result).toMatchObject({ ok: false });
    expect(String((result as { error: string }).error)).toContain("package.json");
    expect(runtime.files.get("demo")?.has("package.json") ?? false).toBe(false);
  });

  it("writes and reads a file under src/", async () => {
    const runtime = new FakeRuntime();
    const tools = siteToolHandlers(runtime, "demo");
    expect(await tools.writeFile({ path: "src/pages/x.astro", content: "<h1>x</h1>" })).toEqual({
      ok: true,
    });
    expect(await tools.readFile({ path: "src/pages/x.astro" })).toEqual({
      ok: true,
      content: "<h1>x</h1>",
    });
    expect(tools.touched()).toEqual(["src/pages/x.astro"]);
  });

  it("reports a failing build with its log", async () => {
    const runtime = new FakeRuntime();
    runtime.failNextBuild = "src/pages/index.astro:3 Unexpected }";
    const result = await siteToolHandlers(runtime, "demo").checkBuild();
    expect(result).toEqual({ ok: false, output: "src/pages/index.astro:3 Unexpected }" });
  });
});
