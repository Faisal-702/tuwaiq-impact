"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { verifyAdminCredentials } from "@/server/admin-auth";
import {
  checkChallengeCode,
  clearAdminChallenge,
  createVerificationCode,
  getAdminChallenge,
  startAdminChallenge,
  touchVerificationCodeEmail,
} from "@/server/admin-verification";
import { createAdminSession, createStudentSession } from "@/server/auth";
import { verifyStudentCode } from "@/server/student-codes";
import { HOME_PATH } from "@/lib/routes";
import { safeNextPath } from "@/lib/safe-next";
import { isAdminCodeFormat, isWeakAdminCode, normalizeAdminCode } from "@/lib/admin-code";
import { normalizeStudentCode } from "@/lib/student-codes";

/**
 * Administrator sign-in has two steps: "credentials" (email + password), then
 * the personal 8-digit verification code ("verify"), or creating that code on
 * the first sign-in ("setup").
 */
export type AdminStep = "credentials" | "verify" | "setup";
export type AdminLoginState = {
  step: AdminStep;
  error:
    | "required"
    | "invalid"
    | "locked"
    | "unavailable"
    | "code_required"
    | "code_invalid"
    | "code_format"
    | "code_weak"
    | "code_mismatch"
    | "restart"
    | null;
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
 * (Authentication → Users), verified on the server only, followed by the
 * administrator's verification code. Errors are generic.
 */
export async function adminLogin(prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  // The "back" button adds a second intent value next to the form's hidden one.
  const intents = formData.getAll("intent").map(String);
  if (intents.includes("back")) {
    await clearAdminChallenge();
    return { step: "credentials", error: null, attempt: prev.attempt + 1, email: prev.email };
  }
  if (intents.includes("code")) return adminCodeStep(prev, formData);

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  const fail = (error: AdminLoginState["error"]): AdminLoginState => ({ step: "credentials", error, attempt: prev.attempt + 1, email });

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

  // The password is right: no session yet, the verification code comes next.
  const step = await startAdminChallenge({ userId: result.userId, email: result.email });
  return { step, error: null, attempt: prev.attempt + 1, email: result.email };
}

async function adminCodeStep(prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const next = safeNextPath(formData.get("next"));
  const code = normalizeAdminCode(String(formData.get("code") ?? "").slice(0, 40));
  const challenge = await getAdminChallenge();
  const restart = (error: AdminLoginState["error"]): AdminLoginState => ({
    step: "credentials",
    error,
    attempt: prev.attempt + 1,
    email: challenge?.email ?? prev.email,
  });
  if (!challenge) return restart("restart");
  const fail = (error: AdminLoginState["error"]): AdminLoginState => ({
    step: challenge.purpose,
    error,
    attempt: prev.attempt + 1,
    email: challenge.email,
  });

  if (!code) return fail("code_required");
  if (!isAdminCodeFormat(code)) return fail("code_format");

  if (challenge.purpose === "setup") {
    const confirm = normalizeAdminCode(String(formData.get("confirm") ?? "").slice(0, 40));
    if (isWeakAdminCode(code)) return fail("code_weak");
    if (confirm !== code) return fail("code_mismatch");
    // Someone set a code for this account in the meantime: sign in again.
    if (!(await createVerificationCode(challenge, code))) {
      await clearAdminChallenge();
      return restart("restart");
    }
    await logActivity({ action: "admin.verification_code_set", targetType: "session", targetLabel: challenge.email });
  } else {
    const check = await checkChallengeCode(challenge, code);
    if (!check.ok) {
      await failureDelay();
      if (check.reason === "invalid") return fail("code_invalid");
      return restart(check.reason);
    }
    await touchVerificationCodeEmail(challenge.userId, challenge.email);
  }

  await clearAdminChallenge();
  await createAdminSession({ userId: challenge.userId, email: challenge.email });
  await logActivity({ action: "admin.signed_in", targetType: "session", targetLabel: challenge.email });
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
