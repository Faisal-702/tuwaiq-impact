import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "./db";
import { env } from "./env";

export const ADMIN_COOKIE = "ti_admin_session";
export const ENTRY_COOKIE = "ti_entry";
const SESSION_HOURS = 12;

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time comparison of the submitted code with the server-side secret. */
export function isValidAccessCode(code: string): boolean {
  const submitted = sha256(code.trim());
  const expected = sha256(env.adminAccessCode);
  return timingSafeEqual(submitted, expected);
}

export async function createAdminSession(): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  await sql`
    insert into admin_sessions (token_hash, expires_at, user_agent)
    values (${tokenHash}, ${expiresAt}, ${userAgent})`;
  // Opportunistic cleanup of expired sessions.
  await sql`delete from admin_sessions where expires_at < now() - interval '7 days'`;

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  store.set(ENTRY_COOKIE, "1", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function setGuestEntry(): Promise<void> {
  const store = await cookies();
  store.set(ENTRY_COOKIE, "1", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Returns the active admin session (validated against the database), or null. */
export const getAdminSession = cache(async (): Promise<{ id: string } | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 100) return null;
  const tokenHash = sha256(token).toString("hex");
  const rows = await sql<{ id: string }[]>`
    update admin_sessions
       set last_seen_at = now()
     where token_hash = ${tokenHash}
       and revoked_at is null
       and expires_at > now()
    returning id`;
  return rows[0] ?? null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

/** Guards admin pages and server actions. Redirects to the entry page if not authorised. */
export async function requireAdmin(): Promise<{ id: string }> {
  const session = await getAdminSession();
  if (!session) redirect("/welcome?mode=admin&expired=1");
  return session;
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    await sql`update admin_sessions set revoked_at = now() where token_hash = ${sha256(token).toString("hex")}`;
  }
  store.delete(ADMIN_COOKIE);
}

export async function revokeAllAdminSessions(): Promise<void> {
  await sql`update admin_sessions set revoked_at = now() where revoked_at is null`;
  (await cookies()).delete(ADMIN_COOKIE);
}
