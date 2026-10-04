"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "../activity";
import { requireAdmin } from "../auth";
import { sql } from "../db";
import { issueCodeIfMissing, issueMissingCodes, removeCode, replaceCode } from "../student-codes";
import type { ActionResult } from "./shared";

const id = z.string().uuid();
const PAGE = "/admin/student-codes";

async function studentLabel(studentId: string) {
  const [row] = await sql<{ label: string }[]>`
    select coalesce(nullif(trim(name_ar), ''), name_en) as label from students where id = ${studentId}`;
  return row?.label ?? null;
}

/** Admin: creates a code for a student who has none (never overwrites). */
export async function generateStudentCode(studentId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id.safeParse(studentId).success) return { ok: false, error: "invalid" };
  const created = await issueCodeIfMissing(studentId);
  if (!created) return { ok: false, error: "exists" };
  // The code itself is never written to the activity log.
  await logActivity({ action: "student.code_generated", targetType: "student", targetId: studentId, targetLabel: await studentLabel(studentId) });
  revalidatePath(PAGE);
  return { ok: true };
}

/** Admin: replaces a student's code; the old code stops working immediately. */
export async function regenerateStudentCode(studentId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id.safeParse(studentId).success) return { ok: false, error: "invalid" };
  if (!(await replaceCode(studentId))) return { ok: false, error: "not_found" };
  await logActivity({ action: "student.code_regenerated", targetType: "student", targetId: studentId, targetLabel: await studentLabel(studentId) });
  revalidatePath(PAGE);
  return { ok: true };
}

/** Admin: removes a student's code (and ends their sessions). */
export async function removeStudentCode(studentId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id.safeParse(studentId).success) return { ok: false, error: "invalid" };
  await removeCode(studentId);
  await logActivity({ action: "student.code_removed", targetType: "student", targetId: studentId, targetLabel: await studentLabel(studentId) });
  revalidatePath(PAGE);
  return { ok: true };
}

/** Admin: issues codes to every student without one. Existing codes are kept. */
export async function generateMissingStudentCodes(): Promise<ActionResult<{ created: number; existing: number }>> {
  await requireAdmin();
  const result = await issueMissingCodes();
  if (result.created > 0) {
    await logActivity({ action: "student.codes_generated", targetType: "student", details: { created: result.created } });
  }
  revalidatePath(PAGE);
  return { ok: true, data: result };
}
