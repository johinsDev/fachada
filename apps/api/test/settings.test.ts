import { describe, expect, it } from "vitest";
import { call, signupTenant } from "./helpers";

describe("settings", () => {
  it("lists the seven sample integrations", async () => {
    const { cookie } = await signupTenant();
    const list = await (
      await call("/settings/integrations", cookie)
    ).json<{ id: string; status: string }[]>();
    expect(list.map((i) => i.id).sort()).toEqual([
      "gtm",
      "hubspot",
      "meta-lead-ads",
      "salesforce",
      "sinco",
      "whatsapp-bot",
      "zapier",
    ]);
    expect(list.every((i) => i.status === "disconnected")).toBe(true);
  });

  it("connects HubSpot and masks its token", async () => {
    const { cookie } = await signupTenant();
    const res = await call("/settings/integrations/hubspot/connect", cookie, {
      method: "POST",
      body: JSON.stringify({ accessToken: "pat-na1-1234567890abcd" }),
    });
    expect(res.status).toBe(200);
    const list = await (
      await call("/settings/integrations", cookie)
    ).json<{ id: string; status: string; config: Record<string, string> }[]>();
    const hubspot = list.find((i) => i.id === "hubspot")!;
    expect(hubspot.status).toBe("connected");
    expect(hubspot.config.accessToken).toBe("••••abcd");
  });

  it("rejects an invalid domain and returns the CNAME for a valid one", async () => {
    const { cookie } = await signupTenant();
    const bad = await call("/settings/domain", cookie, {
      method: "PUT",
      body: JSON.stringify({ hostname: "no es dominio" }),
    });
    expect(bad.status).toBe(400);
    const ok = await call("/settings/domain", cookie, {
      method: "PUT",
      body: JSON.stringify({ hostname: "www.miconstructora.com" }),
    });
    expect(await ok.json()).toEqual({
      hostname: "www.miconstructora.com",
      status: "pending",
      dns: { type: "CNAME", name: "www", target: "sitios.fachada.dev" },
    });
  });

  it("saves company settings", async () => {
    const { cookie } = await signupTenant();
    const body = {
      name: "Constructora Sol",
      logoUrl: null,
      whatsapp: "+57 300 1234567",
      colors: { primary: "#112233", accent: "#ddeeff" },
    };
    expect(
      (await call("/settings/company", cookie, { method: "PUT", body: JSON.stringify(body) }))
        .status,
    ).toBe(200);
    expect(await (await call("/settings/company", cookie)).json()).toEqual(body);
  });
});
