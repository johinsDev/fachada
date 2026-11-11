import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { FakeRuntime } from "../src/runtime/fake-runtime";
import { runBuild } from "../src/site/build-service";
import { onSiteDataChanged } from "../src/site/hooks";
import { draftKey, distKey } from "../src/site/keys";
import { call, signupTenant } from "./helpers";

async function versions(tenantId: string) {
  const { results } = await env.DB.prepare(
    "SELECT id, status, build_log FROM site_versions WHERE tenant_id = ? ORDER BY created_at",
  )
    .bind(tenantId)
    .all<{ id: string; status: string; build_log: string | null }>();
  return results;
}

async function activeVersion(tenantId: string) {
  const row = await env.DB.prepare("SELECT active_version_id FROM tenants WHERE id = ?")
    .bind(tenantId)
    .first<{ active_version_id: string | null }>();
  return row?.active_version_id ?? null;
}

describe("runBuild", () => {
  it("publishes the signup build and activates it", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    const result = await runBuild(env, runtime, tenant.id, ["signup"]);
    expect(result.status).toBe("ready");
    expect(await activeVersion(tenant.id)).toBe(result.versionId);
    const index = await env.SITES.get(distKey(tenant.id, result.versionId, "index.html"));
    expect(await index?.text()).toContain("<h1>");
  });

  it("keeps the previous version live when a build fails", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    const good = await runBuild(env, runtime, tenant.id, ["signup"]);
    runtime.failNextBuild = "src/pages/index.astro: Unexpected token";
    const bad = await runBuild(env, runtime, tenant.id, ["publish"]);
    expect(bad.status).toBe("failed");
    expect(await activeVersion(tenant.id)).toBe(good.versionId);
    const failed = (await versions(tenant.id)).find((v) => v.id === bad.versionId);
    expect(failed?.build_log).toContain("Unexpected token");
  });

  it("builds a publish from the AI draft and clears the draft", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    await runBuild(env, runtime, tenant.id, ["signup"]);
    await env.SITES.put(draftKey(tenant.id), new TextEncoder().encode("draft-source"));
    await runBuild(env, runtime, tenant.id, ["publish"]);
    expect(runtime.lastBuildSource).toEqual({ kind: "tar", text: "draft-source" });
    expect(await env.SITES.head(draftKey(tenant.id))).toBeNull();
  });
});

describe("runBuild robustness", () => {
  it("keeps a draft that changed while the publish was building", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    await runBuild(env, runtime, tenant.id, ["signup"]);
    await env.SITES.put(draftKey(tenant.id), "draft-1");
    runtime.duringBuild = async () => {
      await env.SITES.put(draftKey(tenant.id), "draft-2");
    };
    await runBuild(env, runtime, tenant.id, ["publish"]);
    expect(await (await env.SITES.get(draftKey(tenant.id)))?.text()).toBe("draft-2");
  });

  it("marks the version failed when publishing the files throws", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    runtime.extraFiles = [{ path: "x".repeat(2000), bytes: new Uint8Array([1]) }];
    const result = await runBuild(env, runtime, tenant.id, ["signup"]);
    expect(result.status).toBe("failed");
    expect((await versions(tenant.id)).every((v) => v.status !== "building")).toBe(true);
  });
});

describe("build coordinator", () => {
  it("groups several enqueued changes into one build", async () => {
    const { tenant } = await signupTenant();
    const stub = env.BUILDS.getByName(tenant.id);
    await stub.enqueue(tenant.id, "data");
    await stub.enqueue(tenant.id, "data");
    await stub.enqueue(tenant.id, "data");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await versions(tenant.id)).toHaveLength(1);
  });
});

describe("onSiteDataChanged", () => {
  it("does not wake a sleeping sandbox but still queues a build", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    await onSiteDataChanged(env, tenant.id, runtime);
    expect(runtime.siteDataWrites).toEqual([]);
    const pending = await runInDurableObject(env.BUILDS.getByName(tenant.id), (_i, state) =>
      state.storage.get<string[]>("pending"),
    );
    expect(pending).toContain("data");
  });

  it("writes the new data into an awake sandbox for an instant preview", async () => {
    const { tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    runtime.awake.add(tenant.slug);
    await onSiteDataChanged(env, tenant.id, runtime);
    expect(runtime.siteDataWrites.map((w) => w.slug)).toEqual([tenant.slug]);
  });
});

describe("site routes", () => {
  it("reports a build stuck for more than 15 minutes as failed", async () => {
    const { cookie, tenant } = await signupTenant();
    await env.DB.prepare(
      "INSERT INTO site_versions (id, tenant_id, template, status, reason, created_at) VALUES (?, ?, 'pro', 'building', 'data', ?)",
    )
      .bind(crypto.randomUUID(), tenant.id, Date.now() - 16 * 60_000)
      .run();
    const site = await (await call("/site", cookie)).json<{ latest: { status: string } }>();
    expect(site.latest.status).toBe("failed");
  });

  it("refuses to roll back to a failed version", async () => {
    const { cookie, tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    await runBuild(env, runtime, tenant.id, ["signup"]);
    runtime.failNextBuild = "boom";
    const bad = await runBuild(env, runtime, tenant.id, ["data"]);
    const res = await call(`/site/versions/${bad.versionId}/activate`, cookie, { method: "POST" });
    expect(res.status).toBe(409);
  });

  it("rolling back to another template's version switches the tenant's template", async () => {
    const { cookie, tenant } = await signupTenant();
    const runtime = new FakeRuntime();
    const pro = await runBuild(env, runtime, tenant.id, ["signup"]);
    await env.DB.prepare("UPDATE tenants SET template = 'galias' WHERE id = ?")
      .bind(tenant.id)
      .run();
    await runBuild(env, runtime, tenant.id, ["template"]);
    await env.SITES.put(draftKey(tenant.id), "galias-draft");
    const res = await call(`/site/versions/${pro.versionId}/activate`, cookie, { method: "POST" });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT template FROM tenants WHERE id = ?")
      .bind(tenant.id)
      .first<{ template: string }>();
    expect(row?.template).toBe("pro");
    expect(await env.SITES.head(draftKey(tenant.id))).toBeNull();
  });

  it("switching template discards the AI draft", async () => {
    const { cookie, tenant } = await signupTenant();
    await env.SITES.put(draftKey(tenant.id), "draft");
    const res = await call("/site/template", cookie, {
      method: "POST",
      body: JSON.stringify({ template: "galias" }),
    });
    expect(res.status).toBe(200);
    expect(await env.SITES.head(draftKey(tenant.id))).toBeNull();
    const row = await env.DB.prepare("SELECT template FROM tenants WHERE id = ?")
      .bind(tenant.id)
      .first<{ template: string }>();
    expect(row?.template).toBe("galias");
  });
});
