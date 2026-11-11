import type { Env } from "../env";
import { makeRuntime } from "../runtime";
import type { SiteRuntime } from "../runtime/site-runtime";
import { buildSiteData, getTenant } from "./site-data";

/** Called after a tenant signs up: builds and publishes the first version of its site. */
export async function onTenantCreated(env: Env, tenantId: string): Promise<void> {
  await env.BUILDS.getByName(tenantId).enqueue(tenantId, "signup");
}

/**
 * Called after any change to the data a site renders. An awake preview gets the new
 * site.json right away (instant preview); the published site is rebuilt in the background.
 */
export async function onSiteDataChanged(
  env: Env,
  tenantId: string,
  runtime: SiteRuntime = makeRuntime(env),
): Promise<void> {
  const tenant = await getTenant(env, tenantId);
  if (await runtime.isAwake(tenant.slug)) {
    await runtime.writeSiteData(tenant.slug, await buildSiteData(env, tenantId));
  }
  await env.BUILDS.getByName(tenantId).enqueue(tenantId, "data");
}
