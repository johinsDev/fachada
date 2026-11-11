import { Hono } from "hono";
import { requireSession } from "../auth/session";
import { scoped } from "../db/tenant";
import type { AppEnv } from "../env";

export interface LeadRow {
  id: string;
  project_slug: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  is_test: number;
  created_at: number;
}

async function listLeads(
  c: { env: AppEnv["Bindings"]; var: AppEnv["Variables"] },
  query: {
    project?: string;
    includeTests?: string;
  },
) {
  const where = ["tenant_id = ?"];
  const params: unknown[] = [];
  if (query.project) {
    where.push("project_slug = ?");
    params.push(query.project);
  }
  if (!query.includeTests) where.push("is_test = 0");
  return scoped(c.env.DB, c.var.tenantId).all<LeadRow>(
    `SELECT id, project_slug, name, phone, email, message, is_test, created_at FROM leads
     WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 1000`,
    ...params,
  );
}

const csvCell = (value: unknown) => {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const leadRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get("/", async (c) => c.json(await listLeads(c, c.req.query())))
  .get("/export.csv", async (c) => {
    const rows = await listLeads(c, c.req.query());
    const lines = [
      "fecha,proyecto,nombre,telefono,email,mensaje",
      ...rows.map((r) =>
        [new Date(r.created_at).toISOString(), r.project_slug, r.name, r.phone, r.email, r.message]
          .map(csvCell)
          .join(","),
      ),
    ];
    return c.body(`﻿${lines.join("\n")}\n`, 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="leads.csv"',
    });
  });
