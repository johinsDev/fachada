import { describe, expect, it } from "vitest";
import { previewRequest } from "../src/index";
import { call, signupTenant } from "./helpers";

describe("cross-site requests to session routes", () => {
  it("refuses a mutating request whose Origin is a tenant site", async () => {
    const { cookie, tenant } = await signupTenant();
    const res = await call("/site/publish", cookie, {
      method: "POST",
      headers: { origin: `https://${tenant.slug}.fachada.dev` },
    });
    expect(res.status).toBe(403);
    const chat = await call("/site/chat", cookie, {
      method: "POST",
      headers: { origin: "https://otra.fachada.dev", "content-type": "text/plain" },
      body: JSON.stringify({ messages: [] }),
    });
    expect(chat.status).toBe(403);
  });

  it("lets the admin origin through", async () => {
    const { cookie } = await signupTenant();
    const res = await call("/site/publish", cookie, {
      method: "POST",
      headers: { origin: "https://app.fachada.dev" },
    });
    expect(res.status).toBe(202);
  });

  it("still serves reads from any origin", async () => {
    const { cookie } = await signupTenant();
    const res = await call("/projects", cookie, {
      headers: { origin: "https://otra.fachada.dev" },
    });
    expect(res.status).toBe(200);
  });
});

describe("previewRequest", () => {
  it("strips credentials and switches to http before reaching the container", () => {
    const req = previewRequest(
      new Request("https://p-demo.fachada.dev/x?y=1", {
        headers: {
          cookie: "__Host-fs_session=abc",
          authorization: "Bearer t",
          accept: "text/html",
        },
      }),
    );
    expect(req.url).toBe("http://p-demo.fachada.dev/x?y=1");
    expect(req.headers.get("cookie")).toBeNull();
    expect(req.headers.get("authorization")).toBeNull();
    expect(req.headers.get("accept")).toBe("text/html");
  });
});
