import { describe, expect, it } from "vitest";
import { parseHost } from "../src/hosts";

describe("parseHost", () => {
  it("recognises a tenant site", () => {
    expect(parseHost("demo.fachada.dev", "fachada.dev")).toEqual({ kind: "site", slug: "demo" });
  });
  it("recognises a tenant preview", () => {
    expect(parseHost("p-demo.fachada.dev", "fachada.dev")).toEqual({
      kind: "preview",
      slug: "demo",
    });
  });
  it("keeps hyphens of the tenant slug in a preview", () => {
    expect(parseHost("p-mi-constructora-2.fachada.dev", "fachada.dev")).toEqual({
      kind: "preview",
      slug: "mi-constructora-2",
    });
  });
  it("recognises platform hosts", () => {
    expect(parseHost("app.fachada.dev", "fachada.dev")).toEqual({ kind: "app" });
    expect(parseHost("api.fachada.dev", "fachada.dev")).toEqual({ kind: "api" });
  });
  it("rejects foreign hosts", () => {
    expect(parseHost("evil.com", "fachada.dev")).toEqual({ kind: "unknown" });
    expect(parseHost("a.b.fachada.dev", "fachada.dev")).toEqual({ kind: "unknown" });
  });
});
