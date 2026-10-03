import "server-only";
import { requireAdmin } from "../auth";
import { sql } from "../db";

export type SuggestionRow = {
  id: string;
  name: string;
  grade: number;
  suggestion: string;
  created_at: string;
};

/** Admin-only (re-checked here so no caller can expose it). Newest first. */
export async function listSuggestions(opts: { grade?: number; limit?: number }) {
  await requireAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 1000);
  const rows = await sql<(SuggestionRow & { total: number })[]>`
    select id, name, grade, suggestion, created_at, count(*) over()::int as total
      from suggestions
     where ${opts.grade ? sql`grade = ${opts.grade}` : sql`true`}
     order by created_at desc, id desc
     limit ${limit}`;
  return {
    items: rows.map((r): SuggestionRow => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      suggestion: r.suggestion,
      created_at: new Date(r.created_at).toISOString(),
    })),
    total: rows[0]?.total ?? 0,
  };
}
