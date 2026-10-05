import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "./db";
import { env } from "./env";

/** Failed attempts allowed per client within the window before sign-in is paused. */
export const ADMIN_LOGIN_MAX_FAILURES = 10;
const ADMIN_LOGIN_WINDOW_MINUTES = 15;

export type AdminCredentialCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "invalid" | "locked" | "unavailable" };

async function clientHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${env.sessionSecret}|admin-login|${ip}`).digest("hex");
}

async function recordFailure(client: string, failures: number): Promise<AdminCredentialCheck> {
  await sql`insert into admin_login_attempts (client_hash) values (${client})`;
  if (Math.random() < 0.05) await sql`delete from admin_login_attempts where created_at < now() - interval '1 day'`;
  return { ok: false, reason: failures + 1 >= ADMIN_LOGIN_MAX_FAILURES ? "locked" : "invalid" };
}

type SupabaseTokenResponse = { access_token?: string; user?: { id?: string; email?: string } };

/**
 * Verifies an administrator's email + password against Supabase Auth
 * (password grant), on the server only. The Supabase session is revoked
 * right away: the dashboard uses its own httpOnly session (admin_sessions).
 * Errors stay generic and never reveal whether an account exists.
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<AdminCredentialCheck> {
  const client = await clientHash();
  const [{ failures }] = await sql<{ failures: number }[]>`
    select count(*)::int as failures from admin_login_attempts
     where client_hash = ${client}
       and created_at > now() - make_interval(mins => ${ADMIN_LOGIN_WINDOW_MINUTES})`;
  if (failures >= ADMIN_LOGIN_MAX_FAILURES) return { ok: false, reason: "locked" };

  const allowlist = env.adminEmails;
  if (allowlist.length > 0 && !allowlist.includes(email)) return recordFailure(client, failures);

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: env.supabaseAuthKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Supabase Auth unreachable", error);
    return { ok: false, reason: "unavailable" };
  }

  // Wrong email/password, unconfirmed or banned user → generic "invalid".
  if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
    return recordFailure(client, failures);
  }
  if (!res.ok) {
    console.error("Supabase Auth sign-in failed", res.status);
    return { ok: false, reason: "unavailable" };
  }

  const body = (await res.json().catch(() => ({}))) as SupabaseTokenResponse;
  const userId = body.user?.id;
  const userEmail = body.user?.email?.toLowerCase();
  if (!userId || !userEmail || (allowlist.length > 0 && !allowlist.includes(userEmail))) {
    return recordFailure(client, failures);
  }

  // Best effort: end the Supabase session we just created (it is not used).
  if (body.access_token) {
    void fetch(`${env.supabaseUrl}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: env.supabaseAuthKey, authorization: `Bearer ${body.access_token}` },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  }
  return { ok: true, userId, email: userEmail };
}
