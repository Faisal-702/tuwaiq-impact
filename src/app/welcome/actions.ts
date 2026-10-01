"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { createAdminSession, isValidAccessCode, setGuestEntry } from "@/server/auth";
import { safeNextPath } from "@/lib/safe-next";

export type AdminLoginState = { error: "required" | "invalid" | null; attempt: number };

export async function adminLogin(prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const code = String(formData.get("code") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (code.trim().length === 0) return { error: "required", attempt: prev.attempt + 1 };

  if (code.length > 64 || !isValidAccessCode(code)) {
    // Small constant delay to slow down guessing (no lockout by design).
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { error: "invalid", attempt: prev.attempt + 1 };
  }

  await createAdminSession();
  await logActivity({ action: "admin.signed_in", targetType: "session" });
  redirect(next && next.startsWith("/admin") ? next : "/admin");
}

export async function enterAsGuest(formData: FormData): Promise<void> {
  await setGuestEntry();
  const next = safeNextPath(formData.get("next"));
  redirect(next && !next.startsWith("/admin") ? next : "/");
}
