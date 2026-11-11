import type { BuildCoordinator } from "./site/build-coordinator";
import type { SiteSandbox } from "./runtime/site-sandbox";

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SITES: R2Bucket;
  SANDBOX: DurableObjectNamespace<SiteSandbox>;
  BUILDS: DurableObjectNamespace<BuildCoordinator>;
  ANTHROPIC_API_KEY: string;
  ROOT_DOMAIN: string;
  /** Basic Auth password for admin.fachada.dev (user "johan"); unset = closed. */
  SUPER_ADMIN_PASSWORD?: string;
  /** "1" in tests: use the in-memory site runtime instead of containers. */
  FAKE_RUNTIME?: string;
}

export interface AppVariables {
  tenantId: string;
  userId: string;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
