"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdminCodeFormat, isWeakAdminCode, normalizeAdminCode } from "@/lib/admin-code";
import { logActivity } from "../activity";
import { changeVerificationCode, resetVerificationCode } from "../admin-verification";
import { requireAdmin, revokeAllAdminSessions, signOutCompletely } from "../auth";
import { sql } from "../db";
import { storage } from "../storage";
import type { ActionResult } from "./shared";

const settingsSchema = z.object({
  defaultPoints: z.number().int().min(0).max(100000),
  currentAcademicYear: z.string().trim().max(40),
});

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { defaultPoints, currentAcademicYear } = parsed.data;
  await sql`
    insert into settings (key, value) values
      ('default_points', ${sql.json(defaultPoints)}),
      ('current_academic_year', ${sql.json(currentAcademicYear || null)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  await logActivity({ action: "settings.updated", targetType: "settings", details: parsed.data });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await signOutCompletely();
  redirect("/welcome");
}

export async function signOutEverywhere(): Promise<void> {
  await requireAdmin();
  await logActivity({ action: "admin.sessions_revoked", targetType: "session" });
  await revokeAllAdminSessions();
  redirect("/welcome");
}

export type ChangeCodeError = "unsupported" | "format" | "weak" | "mismatch" | "invalid" | "locked";

/** An administrator changes their own verification code; the current code is required. */
export async function changeMyVerificationCode(input: {
  current: string;
  next: string;
  confirm: string;
}): Promise<{ ok: true } | { ok: false; error: ChangeCodeError }> {
  const session = await requireAdmin();
  if (!session.authUserId || !session.email) return { ok: false, error: "unsupported" };
  const current = normalizeAdminCode(String(input.current ?? "").slice(0, 40));
  const next = normalizeAdminCode(String(input.next ?? "").slice(0, 40));
  const confirm = normalizeAdminCode(String(input.confirm ?? "").slice(0, 40));
  if (!isAdminCodeFormat(current) || !isAdminCodeFormat(next)) return { ok: false, error: "format" };
  if (isWeakAdminCode(next)) return { ok: false, error: "weak" };
  if (confirm !== next) return { ok: false, error: "mismatch" };
  const result = await changeVerificationCode(session.authUserId, current, next);
  if (!result.ok) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { ok: false, error: result.reason === "locked" ? "locked" : result.reason === "restart" ? "unsupported" : "invalid" };
  }
  await logActivity({ action: "admin.verification_code_changed", targetType: "session", targetLabel: session.email });
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Removes another administrator's code; they create a new one at their next sign-in. */
export async function resetAdminVerificationCode(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!z.uuid().safeParse(userId).success || userId === session.authUserId) return { ok: false, error: "invalid" };
  const email = await resetVerificationCode(userId);
  if (!email) return { ok: false, error: "not_found" };
  await logActivity({ action: "admin.verification_code_reset", targetType: "session", targetLabel: email });
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Removes every record flagged as development/demo data, including its media. */
export async function purgeDemoData(): Promise<ActionResult<{ projects: number; students: number }>> {
  await requireAdmin();
  const media = await sql<{ storage_path: string | null; preview_path: string | null; thumb_path: string | null }[]>`
    select m.storage_path, m.preview_path, m.thumb_path
      from project_media m join projects p on p.id = m.project_id where p.is_demo`;
  const projects = await sql`delete from projects where is_demo returning id`;
  const students = await sql`
    delete from students s where s.is_demo
       and not exists (select 1 from project_students ps where ps.student_id = s.id)
    returning id`;
  const paths = media.flatMap((m) => [m.storage_path, m.preview_path, m.thumb_path]).filter((p): p is string => !!p);
  await storage().remove(paths).catch((e) => console.error("Media cleanup failed", e));
  await logActivity({
    action: "demo.purged",
    targetType: "demo",
    details: { projects: projects.length, students: students.length },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { projects: projects.length, students: students.length } };
}
