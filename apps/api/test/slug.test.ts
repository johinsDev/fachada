import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "../src/tenants/slug";
import { seedTenant } from "./helpers";

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/;

describe("slugify", () => {
  it("strips accents and symbols", () => {
    expect(slugify("Constructora Ñandú & Cía")).toBe("constructora-nandu-cia");
  });
  it("never yields the preview prefix", () => {
    expect(slugify("P Constructora")).not.toMatch(/^p-/);
  });
  it("always yields a valid DNS label", () => {
    for (const name of ["  ---Hola---  ", "Ñ", "!!!", "A".repeat(90), "Torre 5 (Sur)"]) {
      expect(slugify(name)).toMatch(DNS_LABEL);
    }
  });
});

describe("uniqueSlug", () => {
  it("disambiguates reserved slugs", async () => {
    expect(await uniqueSlug(env.DB, "API")).toBe("api-2");
  });
  it("disambiguates taken slugs", async () => {
    await seedTenant("t-demo-slug", "demo-slug");
    expect(await uniqueSlug(env.DB, "Demo Slug")).toBe("demo-slug-2");
  });
});
