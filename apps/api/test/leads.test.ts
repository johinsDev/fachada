import { createExecutionContext, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { call, signupTenant } from "./helpers";

function postLead(origin: string, body: Record<string, unknown>) {
  return app.request(
    "/public/leads",
    {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    },
    env,
    createExecutionContext(),
  );
}

const lead = { name: "Ana Pérez", phone: "300 123 4567", consent: true, projectSlug: "torre" };

describe("public leads", () => {
  it("stores a lead from the tenant's site", async () => {
    const { cookie, tenant } = await signupTenant();
    const res = await postLead(`https://${tenant.slug}.fachada.dev`, lead);
    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      `https://${tenant.slug}.fachada.dev`,
    );
    const rows = await (await call("/leads", cookie)).json<{ name: string; is_test: number }[]>();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Ana Pérez", is_test: 0 });
  });

  it("marks a lead from the tenant's preview as a test", async () => {
    const { cookie, tenant } = await signupTenant();
    await postLead(`https://4321-t-${tenant.slug}-tok3n.fachada.dev`, lead);
    expect(await (await call("/leads", cookie)).json()).toEqual([]);
    const all = await (await call("/leads?includeTests=1", cookie)).json<{ is_test: number }[]>();
    expect(all[0]?.is_test).toBe(1);
  });

  it("refuses an unknown origin and a lead without consent", async () => {
    const { tenant } = await signupTenant();
    expect((await postLead("https://evil.com", lead)).status).toBe(403);
    expect(
      (await postLead(`https://${tenant.slug}.fachada.dev`, { ...lead, consent: false })).status,
    ).toBe(400);
  });

  it("does not show a tenant's leads to another", async () => {
    const a = await signupTenant();
    const b = await signupTenant();
    await postLead(`https://${a.tenant.slug}.fachada.dev`, lead);
    expect(await (await call("/leads", b.cookie)).json()).toEqual([]);
  });

  it("exports the filtered leads as CSV", async () => {
    const { cookie, tenant } = await signupTenant();
    await postLead(`https://${tenant.slug}.fachada.dev`, lead);
    await postLead(`https://${tenant.slug}.fachada.dev`, {
      ...lead,
      name: "Luis",
      projectSlug: "otro",
    });
    const res = await call("/leads/export.csv?project=torre", cookie);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    const lines = text.replace(/^﻿/, "").trim().split("\n");
    expect(lines[0]).toBe("fecha,proyecto,nombre,telefono,email,mensaje");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Ana Pérez");
  });
});
