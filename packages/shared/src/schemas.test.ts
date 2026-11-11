import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import { LeadInputSchema, SignupSchema } from "./index";

describe("LeadInputSchema", () => {
  test("rejects a lead without consent", () => {
    expect(
      v.safeParse(LeadInputSchema, { name: "Ana", phone: "3001234567", consent: false }).success,
    ).toBe(false);
  });
  test("rejects a 5-digit phone", () => {
    expect(
      v.safeParse(LeadInputSchema, { name: "Ana", phone: "30012", consent: true }).success,
    ).toBe(false);
  });
  test("accepts a minimal valid lead", () => {
    expect(
      v.safeParse(LeadInputSchema, { name: "Ana", phone: "3001234567", consent: true }).success,
    ).toBe(true);
  });
});

describe("SignupSchema", () => {
  test("rejects an unknown template", () => {
    const r = v.safeParse(SignupSchema, {
      companyName: "Demo",
      email: "a@b.co",
      password: "12345678",
      template: "otra",
    });
    expect(r.success).toBe(false);
  });
});
