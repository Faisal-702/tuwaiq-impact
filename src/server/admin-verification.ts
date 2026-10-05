import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import { env } from "./env";
import { ADMIN_LOGIN_MAX_FAILURES, accountHash, clientHash, recentFailures, recordAttemptFailure } from "./admin-auth";

/**
 * Second sign-in step for administrators: a personal 8-digit verification
 * code, asked for after the email + password were verified. The code is stored
 * only as a salted scrypt hash. An administrator without a code creates one
 * at this step on their first sign-in.
 */

export const ADMIN_CHALLENGE_COOKIE = "ti_admin_challenge";
/** Time allowed between the password step and the code step. */
const CHALLENGE_MINUTES = 10;
/** Wrong codes allowed for one password sign-in before it has to be repeated. */
const CHALLENGE_MAX_FAILURES = 5;

export type ChallengePurpose = "verify" | "setup";
export type AdminChallenge = { tokenHash: string; userId: string; email: string; purpose: ChallengePurpose; failures: number };

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;

function scrypt(password: BinaryLike, salt: BinaryLike, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashAdminCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(code, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function codeMatches(code: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(code, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const challengeCookie = () =>
  ({ httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/", maxAge: CHALLENGE_MINUTES * 60 }) as const;

export async function hasVerificationCode(userId: string): Promise<boolean> {
  const rows = await sql`select 1 from admin_verification_codes where auth_user_id = ${userId}`;
  return rows.length > 0;
}

/** Called once the email + password are verified: the code step comes next. */
export async function startAdminChallenge(admin: { userId: string; email: string }): Promise<ChallengePurpose> {
  await clearAdminChallenge();
  const purpose: ChallengePurpose = (await hasVerificationCode(admin.userId)) ? "verify" : "setup";
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60 * 1000);
  await sql`
    insert into admin_login_challenges (token_hash, auth_user_id, email, purpose, expires_at)
    values (${sha256(token)}, ${admin.userId}, ${admin.email}, ${purpose}, ${expiresAt})`;
  await sql`delete from admin_login_challenges where expires_at < now()`;
  (await cookies()).set(ADMIN_CHALLENGE_COOKIE, token, challengeCookie());
  return purpose;
}

/** The pending code step of this browser, or null (none, expired or used). */
export async function getAdminChallenge(): Promise<AdminChallenge | null> {
  const token = (await cookies()).get(ADMIN_CHALLENGE_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 100) return null;
  const rows = await sql<AdminChallenge[]>`
    select token_hash as "tokenHash", auth_user_id as "userId", email, purpose, failures
      from admin_login_challenges
     where token_hash = ${sha256(token)} and expires_at > now()`;
  return rows[0] ?? null;
}

export async function clearAdminChallenge(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_CHALLENGE_COOKIE)?.value;
  if (token) await sql`delete from admin_login_challenges where token_hash = ${sha256(token)}`;
  store.delete(ADMIN_CHALLENGE_COOKIE);
}

export type CodeCheck = { ok: true } | { ok: false; reason: "invalid" | "locked" | "restart" };

/** Throttle shared by the code step and the settings page: per client and per account. */
async function codeThrottle(userId: string) {
  const keys = [await clientHash(), accountHash(userId)];
  const failures = Math.max(...(await Promise.all(keys.map(recentFailures))));
  return {
    locked: failures >= ADMIN_LOGIN_MAX_FAILURES,
    fail: async (): Promise<"invalid" | "locked"> => {
      await recordAttemptFailure(...keys);
      return failures + 1 >= ADMIN_LOGIN_MAX_FAILURES ? "locked" : "invalid";
    },
  };
}

/** Checks the code entered at the sign-in step against the stored hash. */
export async function checkChallengeCode(challenge: AdminChallenge, code: string): Promise<CodeCheck> {
  const throttle = await codeThrottle(challenge.userId);
  if (throttle.locked) {
    await clearAdminChallenge();
    return { ok: false, reason: "locked" };
  }
  const [row] = await sql<{ code_hash: string }[]>`
    select code_hash from admin_verification_codes where auth_user_id = ${challenge.userId}`;
  // The code was reset by another administrator in the meantime: start over.
  if (!row) {
    await clearAdminChallenge();
    return { ok: false, reason: "restart" };
  }
  if (await codeMatches(code, row.code_hash)) return { ok: true };

  const reason = await throttle.fail();
  const [updated] = await sql<{ failures: number }[]>`
    update admin_login_challenges set failures = failures + 1
     where token_hash = ${challenge.tokenHash} returning failures`;
  if (reason === "locked" || !updated || updated.failures >= CHALLENGE_MAX_FAILURES) {
    await clearAdminChallenge();
    return { ok: false, reason: reason === "locked" ? "locked" : "restart" };
  }
  return { ok: false, reason: "invalid" };
}

/** First sign-in: stores the administrator's new code. False if one already exists. */
export async function createVerificationCode(admin: { userId: string; email: string }, code: string): Promise<boolean> {
  const hash = await hashAdminCode(code);
  const rows = await sql`
    insert into admin_verification_codes (auth_user_id, email, code_hash)
    values (${admin.userId}, ${admin.email}, ${hash})
    on conflict (auth_user_id) do nothing
    returning auth_user_id`;
  return rows.length > 0;
}

/** Keeps the email shown in Settings in step with Supabase Auth. */
export async function touchVerificationCodeEmail(userId: string, email: string): Promise<void> {
  await sql`update admin_verification_codes set email = ${email} where auth_user_id = ${userId} and email <> ${email}`;
}

/** Settings: an administrator changes their own code (the current code is required). */
export async function changeVerificationCode(userId: string, current: string, next: string): Promise<CodeCheck> {
  const throttle = await codeThrottle(userId);
  if (throttle.locked) return { ok: false, reason: "locked" };
  const [row] = await sql<{ code_hash: string }[]>`
    select code_hash from admin_verification_codes where auth_user_id = ${userId}`;
  if (!row) return { ok: false, reason: "restart" };
  if (!(await codeMatches(current, row.code_hash))) return { ok: false, reason: await throttle.fail() };
  const hash = await hashAdminCode(next);
  await sql`update admin_verification_codes set code_hash = ${hash}, updated_at = now() where auth_user_id = ${userId}`;
  return { ok: true };
}

export type VerificationCodeRow = { userId: string; email: string; updatedAt: Date };

export async function listVerificationCodes(): Promise<VerificationCodeRow[]> {
  return sql<VerificationCodeRow[]>`
    select auth_user_id as "userId", email, updated_at as "updatedAt"
      from admin_verification_codes order by email`;
}

/** Removes an administrator's code: they create a new one at their next sign-in. */
export async function resetVerificationCode(userId: string): Promise<string | null> {
  const [row] = await sql<{ email: string }[]>`
    delete from admin_verification_codes where auth_user_id = ${userId} returning email`;
  await sql`delete from admin_login_challenges where auth_user_id = ${userId}`;
  return row?.email ?? null;
}
