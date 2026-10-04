"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { createAdminSession, createStudentSession, isValidAccessCode } from "@/server/auth";
import { verifyStudentCode } from "@/server/student-codes";
import { HOME_PATH } from "@/lib/routes";
import { safeNextPath } from "@/lib/safe-next";
import { normalizeStudentCode } from "@/lib/student-codes";

export type AdminLoginState = { error: "required" | "invalid" | null; attempt: number };
export type StudentLoginState = { error: "required" | "invalid" | "locked" | null; attempt: number };

/** Small constant delay on failures to slow down guessing. */
const failureDelay = () => new Promise((resolve) => setTimeout(resolve, 450));

export async function adminLogin(prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const code = String(formData.get("code") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (code.trim().length === 0) return { error: "required", attempt: prev.attempt + 1 };

  if (code.length > 64 || !isValidAccessCode(code)) {
    // Small constant delay to slow down guessing (no lockout by design).
    await failureDelay();
    return { error: "invalid", attempt: prev.attempt + 1 };
  }

  await createAdminSession();
  await logActivity({ action: "admin.signed_in", targetType: "session" });
  redirect(next && next.startsWith("/admin") ? next : "/admin");
}

/**
 * Student login: the code is checked on the server only. Errors are generic
 * ("incorrect code") and never reveal whether a particular student exists.
 */
export async function studentLogin(prev: StudentLoginState, formData: FormData): Promise<StudentLoginState> {
  const raw = String(formData.get("code") ?? "").slice(0, 64);
  const next = safeNextPath(formData.get("next"));
  const code = normalizeStudentCode(raw);

  if (code.length === 0) return { error: "required", attempt: prev.attempt + 1 };

  const result = await verifyStudentCode(code);
  if (!result.ok) {
    await failureDelay();
    return { error: result.reason, attempt: prev.attempt + 1 };
  }

  await createStudentSession(result.studentId);
  // Students always land on the platform, never the dashboard.
  redirect(next && !next.startsWith("/admin") ? next : HOME_PATH);
}
