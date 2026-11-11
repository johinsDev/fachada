import type { Env } from "../env";

/** Called after a tenant signs up. Implemented in the builds task. */
export async function onTenantCreated(_env: Env, _tenantId: string): Promise<void> {}

/** Called after any change to the data a site renders. Implemented in the builds task. */
export async function onSiteDataChanged(_env: Env, _tenantId: string): Promise<void> {}
