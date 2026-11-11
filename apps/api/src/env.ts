export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SITES: R2Bucket;
  SANDBOX: DurableObjectNamespace;
  BUILDS: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  ROOT_DOMAIN: string;
}

export interface AppVariables {
  tenantId: string;
  userId: string;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
