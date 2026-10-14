import "server-only";
import type { OrganizationCategory, PartnerType, StoredInterestField, SupportType } from "@/lib/partners";
import { requireAdmin } from "../auth";
import { sql } from "../db";

export type PartnerApplication = {
  id: string;
  partner_type: PartnerType;
  full_name: string;
  organization_name: string | null;
  organization_category: OrganizationCategory | null;
  organization_category_other: string | null;
  job_title: string | null;
  phone: string;
  email: string;
  city: string;
  support_types: SupportType[];
  support_other: string | null;
  interest_fields: StoredInterestField[];
  interest_other: string | null;
  proposal: string;
  consent_at: string;
  locale: "ar" | "en";
  created_at: string;
};

export type PartnerListRow = Omit<
  PartnerApplication,
  "proposal" | "consent_at" | "locale" | "interest_fields" | "interest_other" | "support_other" | "job_title" | "city"
>;

export type PartnerFilters = {
  q?: string;
  type?: PartnerType;
  category?: OrganizationCategory;
  support?: SupportType;
  /** Inclusive dates (YYYY-MM-DD), Riyadh time. */
  from?: string;
  to?: string;
};

const TZ = "Asia/Riyadh";
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function where(f: PartnerFilters) {
  const q = f.q?.trim();
  const pattern = q ? `%${escapeLike(q)}%` : null;
  return sql`
    ${pattern ? sql`and (full_name ilike ${pattern} or coalesce(organization_name, '') ilike ${pattern} or email ilike ${pattern})` : sql``}
    ${f.type ? sql`and partner_type = ${f.type}` : sql``}
    ${f.category ? sql`and organization_category = ${f.category}` : sql``}
    ${f.support ? sql`and ${f.support} = any(support_types)` : sql``}
    ${f.from ? sql`and created_at >= (${f.from}::date)::timestamp at time zone ${TZ}` : sql``}
    ${f.to ? sql`and created_at < ((${f.to}::date + 1))::timestamp at time zone ${TZ}` : sql``}`;
}

const iso = (value: string | Date) => new Date(value).toISOString();

/** Admin-only (re-checked here so no caller can expose it). Newest first. */
export async function listPartnerApplications(filters: PartnerFilters, page: number, pageSize: number) {
  await requireAdmin();
  const size = Math.min(Math.max(Math.trunc(pageSize) || 10, 1), 100);
  const offset = (Math.max(Math.trunc(page) || 1, 1) - 1) * size;
  const [rows, [{ total, overall }]] = await Promise.all([
    sql<PartnerListRow[]>`
      select id, partner_type, full_name, organization_name, organization_category, organization_category_other, phone, email, support_types, created_at
        from partner_applications
       where true ${where(filters)}
       order by created_at desc, id desc
       limit ${size} offset ${offset}`,
    sql<{ total: number; overall: number }[]>`
      select (select count(*)::int from partner_applications where true ${where(filters)}) as total,
             (select count(*)::int from partner_applications) as overall`,
  ]);
  return {
    items: rows.map((r) => ({ ...r, created_at: iso(r.created_at) })),
    total,
    /** Applications in the table regardless of the filters. */
    all: overall,
  };
}

/** Admin-only. One application with every answer. */
export async function getPartnerApplication(id: string): Promise<PartnerApplication | null> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql<PartnerApplication[]>`
    select id, partner_type, full_name, organization_name, organization_category, organization_category_other, job_title,
           phone, email, city, support_types, support_other, interest_fields, interest_other, proposal, consent_at, locale, created_at
      from partner_applications
     where id = ${id}`;
  return row ? { ...row, created_at: iso(row.created_at), consent_at: iso(row.consent_at) } : null;
}
