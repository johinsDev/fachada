import * as v from "valibot";
import { PROJECT_STATUSES, TEMPLATE_IDS } from "./site-data";

const optionalNumber = v.nullish(v.pipe(v.number(), v.minValue(0)));
const hexColor = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/));

export const SignupSchema = v.object({
  companyName: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(80)),
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  password: v.pipe(v.string(), v.minLength(8)),
  template: v.picklist(TEMPLATE_IDS),
});
export type SignupInput = v.InferOutput<typeof SignupSchema>;

export const LoginSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  password: v.string(),
});

export const ProjectInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(120)),
  slug: v.pipe(v.string(), v.regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/)),
  city: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(60)),
  status: v.picklist(PROJECT_STATUSES),
  priceFromCOP: optionalNumber,
  areaMin: optionalNumber,
  areaMax: optionalNumber,
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  description: v.optional(v.pipe(v.string(), v.maxLength(5000)), ""),
  published: v.optional(v.boolean(), false),
});
export type ProjectInput = v.InferOutput<typeof ProjectInputSchema>;

export const LeadInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(120)),
  phone: v.pipe(
    v.string(),
    v.transform((s) => s.replace(/\D/g, "")),
    v.minLength(7),
    v.maxLength(20),
  ),
  email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
  projectSlug: v.optional(v.string()),
  message: v.optional(v.pipe(v.string(), v.maxLength(1000))),
  consent: v.literal(true),
});
export type LeadInput = v.InferOutput<typeof LeadInputSchema>;

export const CompanySettingsSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(80)),
  logoUrl: v.nullish(v.pipe(v.string(), v.url())),
  whatsapp: v.nullish(v.pipe(v.string(), v.regex(/^\+?[0-9 ]{7,20}$/))),
  colors: v.object({ primary: hexColor, accent: hexColor }),
});
export type CompanySettings = v.InferOutput<typeof CompanySettingsSchema>;
