import type { Env } from "../env";
import { CloudflareRuntime } from "./cloudflare-runtime";
import { FakeRuntime } from "./fake-runtime";
import type { SiteRuntime } from "./site-runtime";

export function makeRuntime(env: Env): SiteRuntime {
  return env.FAKE_RUNTIME === "1" ? new FakeRuntime() : new CloudflareRuntime(env);
}

export type { SiteRuntime } from "./site-runtime";
