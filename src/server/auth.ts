import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "./db";
import { env } from "./env";

import { ADMIN_COOKIE, STUDENT_COOKIE } from "@/lib/routes";

/** Hard upper limit for one session (admin or student), even with continuous activity. */
const SESSION_MAX_HOURS = 12;
/** A session that sees no requests for this long is no longer valid. */
const SESSION_IDLE_MINUTES = 120;

/**
 * Session cookies are browser-session cookies (no Expires / Max-Age): they are
 * discarded when the browser is closed, so every new visit starts at /welcome
 * and the administrator's password or the student code must be entered again.
 */
const sessionCookie = () =>
  ({ httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/" }) as const;

const sha256 = (value: string) => createHash("sha256").update(value).digest();

const newToken = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token).toString("hex") };
};
const validTokenShape = (token: string | undefined): token is string =>
  Boolean(token && token.length >= 20 && token.length <= 100);

/** Opens a dashboard session for an administrator verified against Supabase Auth. */
export async function createAdminSession(admin: { userId: string; email: string }): Promise<void> {
  // One role per browser: signing in as admin ends any student session.
  await destroyStudentSession();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_HOURS * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  await sql`
    insert into admin_sessions (token_hash, expires_at, user_agent, auth_user_id, email)
    values (${tokenHash}, ${expiresAt}, ${userAgent}, ${admin.userId}, ${admin.email})`;
  // Opportunistic cleanup of expired sessions.
  await sql`delete from admin_sessions where expires_at < now() - interval '7 days'`;

  (await cookies()).set(ADMIN_COOKIE, token, sessionCookie());
}

/** Returns the active admin session (validated against the database), or null. */
export const getAdminSession = cache(async (): Promise<{ id: string } | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!validTokenShape(token)) return null;
  const tokenHash = sha256(token).toString("hex");
  const rows = await sql<{ id: string }[]>`
    update admin_sessions
       set last_seen_at = now()
     where token_hash = ${tokenHash}
       and revoked_at is null
       and expires_at > now()
       and last_seen_at > now() - make_interval(mins => ${SESSION_IDLE_MINUTES})
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

/** Logout: ends the admin and student sessions of this browser; the next page is /welcome. */
export async function signOutCompletely(): Promise<void> {
  await destroyAdminSession();
  await destroyStudentSession();
}

export async function revokeAllAdminSessions(): Promise<void> {
  await sql`update admin_sessions set revoked_at = now() where revoked_at is null`;
  (await cookies()).delete(ADMIN_COOKIE);
}

// ---------------------------------------------------------------------------
// Student sessions (separate from admin sessions; never grant admin rights)
// ---------------------------------------------------------------------------

export type StudentSession = {
  id: string;
  studentId: string;
  name_en: string | null;
  name_ar: string | null;
};

/** Creates a session for a student whose code was verified server-side. */
export async function createStudentSession(studentId: string): Promise<void> {
  // One role per browser: a student signing in ends any admin session here.
  await destroyAdminSession();
  await destroyStudentSession();
  const { token, tokenHash } = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_HOURS * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await sql`
    insert into student_sessions (student_id, token_hash, expires_at, user_agent)
    values (${studentId}, ${tokenHash}, ${expiresAt}, ${userAgent})`;
  await sql`delete from student_sessions where expires_at < now() - interval '7 days'`;
  (await cookies()).set(STUDENT_COOKIE, token, sessionCookie());
}

/** Returns the active student session (validated against the database), or null. */
export const getStudentSession = cache(async (): Promise<StudentSession | null> => {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!validTokenShape(token)) return null;
  const tokenHash = sha256(token).toString("hex");
  const rows = await sql<StudentSession[]>`
    with s as (
      update student_sessions
         set last_seen_at = now()
       where token_hash = ${tokenHash}
         and revoked_at is null
         and expires_at > now()
         and last_seen_at > now() - make_interval(mins => ${SESSION_IDLE_MINUTES})
      returning id, student_id
    )
    select s.id, s.student_id as "studentId", st.name_en, st.name_ar
      from s join students st on st.id = s.student_id`;
  return rows[0] ?? null;
});

export async function destroyStudentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(STUDENT_COOKIE)?.value;
  if (token) {
    await sql`update student_sessions set revoked_at = now() where token_hash = ${sha256(token).toString("hex")}`;
  }
  store.delete(STUDENT_COOKIE);
}

/** Ends every session of one student (used when their code is regenerated or removed). */
export async function revokeStudentSessions(studentId: string): Promise<void> {
  await sql`update student_sessions set revoked_at = now() where student_id = ${studentId} and revoked_at is null`;
}

// ---------------------------------------------------------------------------
// Viewers of the student-facing platform: an admin or a signed-in student
// ---------------------------------------------------------------------------

export type Viewer = { kind: "admin" } | { kind: "student"; student: StudentSession };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (await getAdminSession()) return { kind: "admin" };
  const student = await getStudentSession();
  return student ? { kind: "student", student } : null;
});

/**
 * Guards every student-facing page. Without a valid admin or student session
 * the visitor is sent back to the entry page.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/welcome");
  return viewer;
}
