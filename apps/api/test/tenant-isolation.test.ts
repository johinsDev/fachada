import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { scoped, TenantScopeError } from "../src/db/tenant";
import { seedTenant } from "./helpers";

describe("scoped", () => {
  beforeEach(async () => {
    await seedTenant("a");
    await seedTenant("b");
    await env.DB.prepare(
      "INSERT OR IGNORE INTO projects (id, tenant_id, slug, name, city, status, description, published, updated_at) VALUES ('p1', 'a', 'torre', 'Torre', 'Cali', 'planos', '', 1, 0)",
    ).run();
  });

  it("does not return another tenant's rows", async () => {
    const rows = await scoped(env.DB, "b").all("SELECT * FROM projects WHERE tenant_id = ?");
    expect(rows).toEqual([]);
  });

  it("returns the tenant's own rows", async () => {
    const rows = await scoped(env.DB, "a").all<{ id: string }>(
      "SELECT * FROM projects WHERE tenant_id = ?",
    );
    expect(rows.map((r) => r.id)).toEqual(["p1"]);
  });

  it("refuses SQL that does not filter by tenant_id", async () => {
    await expect(scoped(env.DB, "a").all("SELECT * FROM projects")).rejects.toBeInstanceOf(
      TenantScopeError,
    );
  });
});
