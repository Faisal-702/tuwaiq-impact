import "server-only";
import { sql } from "../db";
import { slugify } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Generates a unique ASCII slug for the given table. */
export async function uniqueSlug(
  table: "projects" | "students" | "categories",
  source: string | null | undefined,
  fallbackPrefix: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(source ?? "") || `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const rows = await sql`
      select 1 from ${sql(table)} where slug = ${candidate} ${excludeId ? sql`and id <> ${excludeId}` : sql``} limit 1`;
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export const isArabicText = (value: string) => /[؀-ۿ]/.test(value);
