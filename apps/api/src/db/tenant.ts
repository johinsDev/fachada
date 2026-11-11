export class TenantScopeError extends Error {
  constructor(sql: string) {
    super(`Query is not scoped by tenant_id: ${sql}`);
    this.name = "TenantScopeError";
  }
}

/**
 * Query helper that binds the tenant id as the FIRST parameter and refuses SQL
 * that does not mention `tenant_id`, so a forgotten filter fails loudly.
 */
export function scoped(db: D1Database, tenantId: string) {
  const prepare = (sql: string, params: unknown[]) => {
    if (!/\btenant_id\b/.test(sql)) throw new TenantScopeError(sql);
    return db.prepare(sql).bind(tenantId, ...params);
  };
  return {
    async all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
      const { results } = await prepare(sql, params).all<T>();
      return results;
    },
    async first<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
      return prepare(sql, params).first<T>();
    },
    async run(sql: string, ...params: unknown[]): Promise<D1Result> {
      return prepare(sql, params).run();
    },
  };
}

export type Scoped = ReturnType<typeof scoped>;
