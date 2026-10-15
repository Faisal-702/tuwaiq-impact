"use server";

import { revalidatePath } from "next/cache";
import type { FieldError } from "@/lib/submission";
import { normalizeProfile, sanitizeProfile, validateProfile, type ProfileField } from "@/lib/profile";
import { getStudentSession } from "../auth";
import { sql } from "../db";

export type SaveProfileResult =
  | { ok: true; data: { complete: boolean; updatedAt: string } }
  | { ok: false; error: "unauthorized" | "validation" | "server"; fields?: Partial<Record<ProfileField, FieldError>> };

/**
 * Saves the signed-in student's profile. Every field is validated again here
 * (and by the table's checks), so only a complete, valid profile is stored.
 * The values are never logged.
 */
export async function saveProfile(input: unknown): Promise<SaveProfileResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const values = sanitizeProfile(input);
  const errors = validateProfile(values);
  if (Object.keys(errors).length > 0) return { ok: false, error: "validation", fields: errors };
  const p = normalizeProfile(values);
  try {
    const [row] = await sql<{ is_complete: boolean; updated_at: Date }[]>`
      insert into student_profiles (student_id, full_name, national_id, phone, email, grade, section)
      values (${session.studentId}, ${p.full_name}, ${p.national_id}, ${p.phone}, ${p.email}, ${p.grade}, ${p.section})
      on conflict (student_id) do update set
        full_name = excluded.full_name, national_id = excluded.national_id, phone = excluded.phone,
        email = excluded.email, grade = excluded.grade, section = excluded.section
      returning is_complete, updated_at`;
    revalidatePath("/", "layout");
    return { ok: true, data: { complete: row.is_complete, updatedAt: new Date(row.updated_at).toISOString() } };
  } catch (error) {
    console.error("Could not save the student profile", (error as { code?: string })?.code ?? "unknown");
    return { ok: false, error: "server" };
  }
}
