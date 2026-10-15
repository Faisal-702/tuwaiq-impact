"use server";

import { revalidatePath } from "next/cache";
import type { TransactionSql } from "postgres";
import { funding, SUPPORT_NOTE_MAX, type Funding } from "@/lib/funding";
import { parseAmount } from "@/lib/submission";
import { getStudentSession } from "../auth";
import { sql } from "../db";
import { listMySupportEntries, type SupportEntry } from "../queries/my-projects";

/*
 * Manual support tracking: the student records money they report having
 * received for their own project. This is not a payment system and nothing
 * here claims a payment was made or verified. Totals are always computed on
 * the server from the entries; mistakes are reversed, never edited.
 */

export type SupportResult =
  | { ok: true; data: { funding: Funding; entries: SupportEntry[] } }
  | { ok: false; error: "unauthorized" | "not_found" | "amount" | "no_target" | "over_remaining" | "note" | "already_reversed" | "server"; remaining?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_RE = /^[0-9a-f-]{36}$/i;
const cleanNote = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

async function studentId() {
  return (await getStudentSession())?.studentId ?? null;
}

/** Locks the student's project row (serialises concurrent support changes) and returns its totals. */
async function lockOwnedProject(tx: TransactionSql, student: string, projectId: string) {
  const [project] = await tx<{ id: string; requested: number | null }[]>`
    select p.id, p.requested_amount::float8 as requested
      from projects p
     where p.id = ${projectId} and p.deleted_at is null
       and exists (select 1 from project_submissions ps
                    where ps.project_id = p.id and ps.student_id = ${student} and ps.status = 'submitted')
       for update of p`;
  if (!project) return null;
  const [{ recorded }] = await tx<{ recorded: number }[]>`
    select coalesce(sum(amount), 0)::float8 as recorded from project_support_entries
     where project_id = ${projectId} and reversed_at is null`;
  return { ...project, recorded };
}

async function result(student: string, projectId: string): Promise<SupportResult> {
  const [row] = await sql<{ requested: number | null; recorded: number }[]>`
    select p.requested_amount::float8 as requested,
           coalesce((select sum(amount) from project_support_entries e where e.project_id = p.id and e.reversed_at is null), 0)::float8 as recorded
      from projects p where p.id = ${projectId}`;
  const entries = (await listMySupportEntries(student, projectId)) ?? [];
  return { ok: true, data: { funding: funding(row?.requested, row?.recorded), entries } };
}

/** The support history and totals of one of the student's projects. */
export async function getSupport(projectId: string): Promise<SupportResult> {
  const student = await studentId();
  if (!student) return { ok: false, error: "unauthorized" };
  if (typeof projectId !== "string" || !ID_RE.test(projectId)) return { ok: false, error: "not_found" };
  const entries = await listMySupportEntries(student, projectId);
  if (!entries) return { ok: false, error: "not_found" };
  return result(student, projectId);
}

/**
 * Records support the student received. The amount must be positive, have
 * at most two decimals and not exceed what remains of the requested amount.
 * A retried submission (same token) is stored once.
 */
export async function addSupport(input: { projectId: string; amount: string; note?: string; token: string }): Promise<SupportResult> {
  const student = await studentId();
  if (!student) return { ok: false, error: "unauthorized" };
  const projectId = typeof input?.projectId === "string" && ID_RE.test(input.projectId) ? input.projectId : null;
  const token = typeof input?.token === "string" && UUID_RE.test(input.token) ? input.token.toLowerCase() : null;
  if (!projectId || !token) return { ok: false, error: "not_found" };
  const amount = parseAmount(String(input.amount ?? ""));
  if (amount === null || amount <= 0) return { ok: false, error: "amount" };
  const note = cleanNote(input.note);
  if (note.length > SUPPORT_NOTE_MAX) return { ok: false, error: "note" };

  try {
    const outcome = await sql.begin(async (tx) => {
      const project = await lockOwnedProject(tx, student, projectId);
      if (!project) return { error: "not_found" as const };
      // A retry of an entry already stored succeeds without adding it again.
      const [existing] = await tx<{ id: string }[]>`select id from project_support_entries where client_token = ${token}`;
      if (existing) return { error: null };
      const totals = funding(project.requested, project.recorded);
      if (totals.requested <= 0) return { error: "no_target" as const };
      if (amount > totals.remaining) return { error: "over_remaining" as const, remaining: totals.remaining };
      await tx`
        insert into project_support_entries (project_id, amount, note, recorded_by, recorded_by_student_id, client_token)
        values (${projectId}, ${amount}, ${note || null}, 'student', ${student}, ${token})`;
      await tx`
        insert into student_project_activity (student_id, project_id, kind, amount)
        values (${student}, ${projectId}, 'support_added', ${amount})`;
      return { error: null };
    });
    if (outcome.error) return { ok: false, error: outcome.error, remaining: "remaining" in outcome ? outcome.remaining : undefined };
  } catch (error) {
    // A concurrent duplicate of the same token lands here (unique index): already stored.
    if ((error as { code?: string })?.code !== "23505") {
      console.error("Could not record support", (error as { code?: string })?.code ?? "unknown");
      return { ok: false, error: "server" };
    }
  }
  revalidatePath("/", "layout");
  return result(student, projectId);
}

/**
 * Reverses a mistaken entry: it stays in the history, marked with when, by
 * whom and why, and no longer counts towards the total.
 */
export async function reverseSupport(input: { projectId: string; entryId: string; reason?: string }): Promise<SupportResult> {
  const student = await studentId();
  if (!student) return { ok: false, error: "unauthorized" };
  const projectId = typeof input?.projectId === "string" && ID_RE.test(input.projectId) ? input.projectId : null;
  const entryId = typeof input?.entryId === "string" && ID_RE.test(input.entryId) ? input.entryId : null;
  if (!projectId || !entryId) return { ok: false, error: "not_found" };
  const reason = cleanNote(input.reason);
  if (reason.length > SUPPORT_NOTE_MAX) return { ok: false, error: "note" };

  try {
    const outcome = await sql.begin(async (tx) => {
      const project = await lockOwnedProject(tx, student, projectId);
      if (!project) return "not_found" as const;
      const [entry] = await tx<{ amount: number; reversed_at: Date | null }[]>`
        select amount::float8 as amount, reversed_at from project_support_entries
         where id = ${entryId} and project_id = ${projectId} for update`;
      if (!entry) return "not_found" as const;
      if (entry.reversed_at) return "already_reversed" as const;
      await tx`
        update project_support_entries
           set reversed_at = now(), reversed_by_student_id = ${student}, reversal_reason = ${reason || null}
         where id = ${entryId}`;
      await tx`
        insert into student_project_activity (student_id, project_id, kind, amount)
        values (${student}, ${projectId}, 'support_reversed', ${entry.amount})`;
      return null;
    });
    if (outcome) return { ok: false, error: outcome };
  } catch (error) {
    console.error("Could not reverse support", (error as { code?: string })?.code ?? "unknown");
    return { ok: false, error: "server" };
  }
  revalidatePath("/", "layout");
  return result(student, projectId);
}
