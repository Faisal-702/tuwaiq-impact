import "server-only";
import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { isStudentCodeFormat } from "@/lib/student-codes";
import { revokeStudentSessions } from "./auth";
import { sql } from "./db";
import { env } from "./env";

/** Cryptographically secure 8-digit code without a leading zero (10000000–99999999). */
export const randomStudentCode = () => String(randomInt(10_000_000, 100_000_000));

const MAX_ATTEMPTS = 25;
const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";

/**
 * Gives a student a code only if they have none. Returns false when the
 * student already has a code (or no longer exists). Retries on the (rare)
 * collision with another student's code; the unique constraint is the
 * source of truth, so concurrent requests can never produce duplicates.
 */
export async function issueCodeIfMissing(studentId: string): Promise<boolean> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const rows = await sql`
      insert into student_access_codes (student_id, code)
      select id, ${randomStudentCode()} from students where id = ${studentId}
      on conflict do nothing
      returning student_id`;
    if (rows.length > 0) return true;
    // Nothing inserted: either the student already has a code / does not
    // exist (stop), or the random code collided (try another).
    const [state] = await sql<{ has_code: boolean; student_exists: boolean }[]>`
      select exists (select 1 from student_access_codes where student_id = ${studentId}) as has_code,
             exists (select 1 from students where id = ${studentId}) as student_exists`;
    if (!state.student_exists || state.has_code) return false;
  }
  throw new Error("Could not generate a unique student code");
}

/** Replaces a student's code. The old code stops working immediately, and their sessions end. */
export async function replaceCode(studentId: string): Promise<boolean> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const rows = await sql`
        update student_access_codes set code = ${randomStudentCode()}, updated_at = now()
         where student_id = ${studentId}
        returning student_id`;
      if (rows.length === 0) return issueCodeIfMissing(studentId);
      await revokeStudentSessions(studentId);
      return true;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Could not generate a unique student code");
}

export async function removeCode(studentId: string): Promise<boolean> {
  const rows = await sql`delete from student_access_codes where student_id = ${studentId} returning student_id`;
  await revokeStudentSessions(studentId);
  return rows.length > 0;
}

/** Bulk: issues codes only to students without one; existing codes are never overwritten. */
export async function issueMissingCodes(): Promise<{ created: number; existing: number }> {
  const missing = await sql<{ id: string }[]>`
    select s.id from students s
     where not exists (select 1 from student_access_codes c where c.student_id = s.id)
     order by s.grade nulls last, s.created_at`;
  let created = 0;
  for (const { id } of missing) if (await issueCodeIfMissing(id)) created++;
  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from student_access_codes`;
  return { created, existing: total - created };
}

// ---------------------------------------------------------------------------
// Student login (server-side validation + throttling of failed attempts)
// ---------------------------------------------------------------------------

/** Failed attempts allowed per client within the window before logins are paused. */
export const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MINUTES = 15;

async function clientHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${env.sessionSecret}|student-login|${ip}`).digest("hex");
}

export type StudentCodeCheck = { ok: true; studentId: string } | { ok: false; reason: "invalid" | "locked" };

export async function verifyStudentCode(code: string): Promise<StudentCodeCheck> {
  const client = await clientHash();
  const [{ failures }] = await sql<{ failures: number }[]>`
    select count(*)::int as failures from student_login_attempts
     where client_hash = ${client}
       and created_at > now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})`;
  if (failures >= LOGIN_MAX_FAILURES) return { ok: false, reason: "locked" };

  if (isStudentCodeFormat(code)) {
    const [row] = await sql<{ student_id: string }[]>`
      select c.student_id from student_access_codes c
        join students s on s.id = c.student_id
       where c.code = ${code}`;
    if (row) return { ok: true, studentId: row.student_id };
  }

  await sql`insert into student_login_attempts (client_hash) values (${client})`;
  if (Math.random() < 0.05) {
    await sql`delete from student_login_attempts where created_at < now() - interval '1 day'`;
  }
  return { ok: false, reason: failures + 1 >= LOGIN_MAX_FAILURES ? "locked" : "invalid" };
}
