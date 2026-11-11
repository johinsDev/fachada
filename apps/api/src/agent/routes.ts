import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { requireSession } from "../auth/session";
import { scoped } from "../db/tenant";
import type { AppEnv, Env } from "../env";
import { makeRuntime } from "../runtime";
import { draftKey } from "../site/keys";
import { previewSource } from "../site/routes";
import { buildSiteData, getTenant } from "../site/site-data";
import { systemPrompt } from "./system-prompt";
import { siteToolHandlers, siteTools } from "./tools";

export const AGENT_MODEL = "claude-sonnet-5-5";

async function saveChat(env: Env, tenantId: string, messages: UIMessage[]) {
  const db = scoped(env.DB, tenantId);
  await db.run("DELETE FROM chat_messages WHERE tenant_id = ?");
  const now = Date.now();
  for (const [i, message] of messages.entries()) {
    await db.run(
      "INSERT INTO chat_messages (tenant_id, id, role, content_json, created_at) VALUES (?, ?, ?, ?, ?)",
      message.id || crypto.randomUUID(),
      message.role,
      JSON.stringify(message),
      now + i,
    );
  }
}

export const agentRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get("/", async (c) => {
    const rows = await scoped(c.env.DB, c.var.tenantId).all<{ content_json: string }>(
      "SELECT content_json FROM chat_messages WHERE tenant_id = ? ORDER BY created_at",
    );
    return c.json(rows.map((r) => JSON.parse(r.content_json) as UIMessage));
  })
  .post("/", async (c) => {
    const { messages } = await c.req.json<{ messages: UIMessage[] }>();
    const tenant = await getTenant(c.env, c.var.tenantId);
    const runtime = makeRuntime(c.env);

    // The agent edits the live preview workspace; open it if the sandbox was asleep.
    if (!(await runtime.isAwake(tenant.slug))) {
      await runtime.openPreview(
        tenant.slug,
        await previewSource(c.env, tenant.id, tenant.active_version_id),
        tenant.template,
        await buildSiteData(c.env, tenant.id),
      );
    }

    const handlers = siteToolHandlers(runtime, tenant.slug);
    const anthropic = createAnthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
    const result = streamText({
      model: anthropic(AGENT_MODEL),
      instructions: systemPrompt(tenant.name, tenant.template),
      messages: await convertToModelMessages(messages),
      tools: siteTools(handlers),
      stopWhen: isStepCount(25),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: messages,
        onEnd: ({ messages: finished }) => {
          c.executionCtx.waitUntil(
            (async () => {
              await saveChat(c.env, tenant.id, finished);
              // The draft survives the sandbox going to sleep; publishing builds from it.
              if (handlers.touched().length) {
                await c.env.SITES.put(draftKey(tenant.id), await runtime.snapshot(tenant.slug));
              }
            })(),
          );
        },
      }),
    });
  });
