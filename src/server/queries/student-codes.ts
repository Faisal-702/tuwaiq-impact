import "server-only";
import { requireAdmin } from "../auth";
import { sql } from "../db";

export type StudentCodeRow = {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  grade: number | null;
  code: string | null;
  code_updated_at: string | null;
};

/**
 * Admin-only (re-checked here so no caller can expose codes): every student
 * record with its access code, if any.
 */
export async function listStudentCodes(): Promise<StudentCodeRow[]> {
  await requireAdmin();
  const rows = await sql<StudentCodeRow[]>`
    select s.id, s.name_en, s.name_ar, s.grade, c.code, c.updated_at as code_updated_at
      from students s
      left join student_access_codes c on c.student_id = s.id
     order by s.grade nulls last, coalesce(nullif(trim(s.name_ar), ''), s.name_en)`;
  return rows.map((r) => ({ ...r, code_updated_at: r.code_updated_at ? new Date(r.code_updated_at).toISOString() : null }));
}
