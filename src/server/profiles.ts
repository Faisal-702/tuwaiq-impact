import "server-only";
import { EMPTY_PROFILE, missingProfileFields, type ProfileField, type ProfileValues } from "@/lib/profile";
import { sql } from "./db";

/**
 * The student's profile (الملف الشخصي). Private: read and written only for the
 * student of the current session (callers pass the session's student id).
 * Never logged.
 */
export type StudentProfile = {
  full_name: string | null;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  grade: number | null;
  section: number | null;
  /** Computed by the database: every required field is set. */
  is_complete: boolean;
  updated_at: Date;
};

export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  const [row] = await sql<StudentProfile[]>`
    select full_name, national_id, phone, email, grade, section, is_complete, updated_at
      from student_profiles where student_id = ${studentId}`;
  return row ?? null;
}

/** Whether the student may add a project (the database computes completeness). */
export async function isProfileComplete(studentId: string): Promise<boolean> {
  const [row] = await sql<{ is_complete: boolean }[]>`select is_complete from student_profiles where student_id = ${studentId}`;
  return row?.is_complete === true;
}

export const profileToValues = (p: StudentProfile | null): ProfileValues =>
  p
    ? {
        fullName: p.full_name ?? "",
        nationalId: p.national_id ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        grade: p.grade ? String(p.grade) : "",
        section: p.section ? String(p.section) : "",
      }
    : { ...EMPTY_PROFILE };

export type ProfileStatus = {
  /** What the form shows: the saved values, or what the school's record already says. */
  values: ProfileValues;
  saved: boolean;
  complete: boolean;
  missing: ProfileField[];
  updatedAt: string | null;
};

/**
 * The profile page's starting point. Fields not saved yet are suggested from
 * the student record (name, grade, section) but only count once saved.
 */
export async function loadProfileStatus(studentId: string): Promise<ProfileStatus> {
  const [[student], profile] = await Promise.all([
    sql<{ name_ar: string | null; name_en: string | null; grade: number | null; section: number | null }[]>`
      select name_ar, name_en, grade, section from students where id = ${studentId}`,
    getStudentProfile(studentId),
  ]);
  const saved = profileToValues(profile);
  const values: ProfileValues = {
    ...saved,
    fullName: saved.fullName || student?.name_ar || student?.name_en || "",
    grade: saved.grade || (student?.grade && [10, 11, 12].includes(student.grade) ? String(student.grade) : ""),
    section: saved.section || (student?.section && [1, 2, 3].includes(student.section) ? String(student.section) : ""),
  };
  return {
    values,
    saved: Boolean(profile),
    complete: profile?.is_complete === true,
    missing: missingProfileFields(saved),
    updatedAt: profile ? new Date(profile.updated_at).toISOString() : null,
  };
}
