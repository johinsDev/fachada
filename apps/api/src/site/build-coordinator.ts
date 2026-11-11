import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { makeRuntime } from "../runtime";
import { type BuildReason, runBuild } from "./build-service";

const DEBOUNCE_MS = 5_000;

/**
 * One per tenant. Groups the changes that arrive within a few seconds into a single build
 * and runs builds one at a time, because a build outlasts the request that asked for it.
 */
export class BuildCoordinator extends DurableObject<Env> {
  async enqueue(tenantId: string, reason: BuildReason): Promise<void> {
    const pending = (await this.ctx.storage.get<BuildReason[]>("pending")) ?? [];
    if (!pending.includes(reason)) pending.push(reason);
    await this.ctx.storage.put({ pending, tenantId });
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + DEBOUNCE_MS);
    }
  }

  async alarm(): Promise<void> {
    const reasons = (await this.ctx.storage.get<BuildReason[]>("pending")) ?? [];
    const tenantId = await this.ctx.storage.get<string>("tenantId");
    if (!reasons.length || !tenantId) return;
    await this.ctx.storage.delete("pending");
    await runBuild(this.env, makeRuntime(this.env), tenantId, reasons);
    // Changes that arrived during the build are already queued with their own alarm.
  }
}
