import "server-only";
import {
  isValidEmail,
  isValidNationalId,
  normalizeNationalId,
  normalizeSaudiPhone,
  SUBMISSION_GRADES,
  SUBMISSION_SECTIONS,
  type SubmissionAnswers,
} from "@/lib/submission";
import { sql } from "./db";

/**
 * The student's saved personal details, used to pre-fill the first step of
 * the project form on any device. Private: read and written only for the
 * student of the current session (callers pass the session's student id).
 */
export type StudentProfile = {
  full_name: string | null;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  grade: number | null;
  section: number | null;
};

export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  const [row] = await sql<StudentProfile[]>`
    select full_name, national_id, phone, email, grade, section from student_profiles where student_id = ${studentId}`;
  return row ?? null;
}

/**
 * Saves the personal answers that are complete and valid (others are left as
 * they were), so the next project starts with them. Returns true when
 * something was stored. Never logs the values.
 */
export async function saveProfileFromAnswers(studentId: string, a: SubmissionAnswers): Promise<boolean> {
  const name = a.studentName.replace(/\s+/g, " ").trim();
  const values = {
    full_name: name && name.length <= 120 ? name : null,
    national_id: a.nationalId.trim() && isValidNationalId(a.nationalId) ? normalizeNationalId(a.nationalId) : null,
    phone: normalizeSaudiPhone(a.phone),
    email: a.email.trim() && isValidEmail(a.email) ? a.email.trim().toLowerCase() : null,
    grade: (SUBMISSION_GRADES as readonly number[]).includes(Number(a.grade)) ? Number(a.grade) : null,
    section: (SUBMISSION_SECTIONS as readonly number[]).includes(Number(a.section)) ? Number(a.section) : null,
  };
  if (Object.values(values).every((v) => v === null)) return false;
  await sql`
    insert into student_profiles (student_id, full_name, national_id, phone, email, grade, section)
    values (${studentId}, ${values.full_name}, ${values.national_id}, ${values.phone}, ${values.email}, ${values.grade}, ${values.section})
    on conflict (student_id) do update set
      full_name = coalesce(excluded.full_name, student_profiles.full_name),
      national_id = coalesce(excluded.national_id, student_profiles.national_id),
      phone = coalesce(excluded.phone, student_profiles.phone),
      email = coalesce(excluded.email, student_profiles.email),
      grade = coalesce(excluded.grade, student_profiles.grade),
      section = coalesce(excluded.section, student_profiles.section)`;
  return true;
}
