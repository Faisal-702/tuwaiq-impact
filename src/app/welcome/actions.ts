"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { verifyAdminCredentials } from "@/server/admin-auth";
import { createAdminSession, createStudentSession } from "@/server/auth";
import { verifyStudentCode } from "@/server/student-codes";
import { HOME_PATH } from "@/lib/routes";
import { safeNextPath } from "@/lib/safe-next";
import { normalizeStudentCode } from "@/lib/student-codes";

export type AdminLoginState = {
  error: "required" | "invalid" | "locked" | "unavailable" | null;
  attempt: number;
  /** Echoed back so the email field keeps its value after a failed attempt. */
  email: string;
};
export type StudentLoginState = { error: "required" | "invalid" | "locked" | null; attempt: number };

/** Small constant delay on failures to slow down guessing. */
const failureDelay = () => new Promise((resolve) => setTimeout(resolve, 450));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Administrator login: email + password of a user registered in Supabase Auth
 * (Authentication → Users), verified on the server only. Errors are generic.
 */
export async function adminLogin(prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const fail = (error: AdminLoginState["error"]) => ({ error, attempt: prev.attempt + 1, email });

  if (!email || !password) return fail("required");
  if (!EMAIL_RE.test(email) || password.length > 200) {
    await failureDelay();
    return fail("invalid");
  }

  const result = await verifyAdminCredentials(email, password);
  if (!result.ok) {
    if (result.reason !== "unavailable") await failureDelay();
    return fail(result.reason);
  }

  await createAdminSession({ userId: result.userId, email: result.email });
  await logActivity({ action: "admin.signed_in", targetType: "session", targetLabel: result.email });
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
