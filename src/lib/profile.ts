import {
  isValidEmail,
  isValidNationalId,
  normalizeNationalId,
  normalizeSaudiPhone,
  SUBMISSION_GRADES,
  SUBMISSION_SECTIONS,
  type FieldError,
} from "./submission";

/*
 * The student profile (الملف الشخصي): personal details kept once per student
 * and used for every project. Every field is required; a profile is
 * complete when all of them are set and valid. The same rule is computed by
 * the database (student_profiles.is_complete), which refuses a new project
 * for an incomplete profile.
 */

export const PROFILE_FIELDS = ["fullName", "nationalId", "phone", "email", "grade", "section"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileValues = Record<ProfileField, string>;

export const FULL_NAME_MAX = 120;
export const EMAIL_MAX = 254;

export const EMPTY_PROFILE: ProfileValues = { fullName: "", nationalId: "", phone: "", email: "", grade: "", section: "" };

const filled = (v: string) => v.trim().length > 0;
const oneOf = (v: string, options: readonly number[]) => options.map(String).includes(v.trim());
export const cleanName = (v: string) => v.replace(/\s+/g, " ").trim();

/** Keeps the known fields only, as strings within a sane length. */
export function sanitizeProfile(input: unknown): ProfileValues {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...EMPTY_PROFILE };
  for (const key of PROFILE_FIELDS) {
    const value = source[key];
    if (typeof value === "string") out[key] = value.slice(0, key === "email" ? EMAIL_MAX : key === "fullName" ? FULL_NAME_MAX * 2 : 40);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = String(value);
  }
  return out;
}

/** Errors by field (empty when the profile is complete and valid). */
export function validateProfile(v: ProfileValues): Partial<Record<ProfileField, FieldError>> {
  const errors: Partial<Record<ProfileField, FieldError>> = {};
  const name = cleanName(v.fullName);
  if (!name) errors.fullName = "required";
  else if (name.length > FULL_NAME_MAX) errors.fullName = "tooLong";
  if (!filled(v.nationalId)) errors.nationalId = "required";
  else if (!isValidNationalId(v.nationalId)) errors.nationalId = "nationalId";
  if (!filled(v.phone)) errors.phone = "required";
  else if (!normalizeSaudiPhone(v.phone)) errors.phone = "phone";
  if (!filled(v.email)) errors.email = "required";
  else if (!isValidEmail(v.email)) errors.email = "email";
  if (!oneOf(v.grade, SUBMISSION_GRADES)) errors.grade = filled(v.grade) ? "choice" : "required";
  if (!oneOf(v.section, SUBMISSION_SECTIONS)) errors.section = filled(v.section) ? "choice" : "required";
  return errors;
}

/** The values as stored (call only after validateProfile returned no errors). */
export function normalizeProfile(v: ProfileValues) {
  return {
    full_name: cleanName(v.fullName),
    national_id: normalizeNationalId(v.nationalId),
    phone: normalizeSaudiPhone(v.phone)!,
    email: v.email.trim().toLowerCase(),
    grade: Number(v.grade.trim()),
    section: Number(v.section.trim()),
  };
}

/** Required fields that are still missing or invalid. */
export const missingProfileFields = (v: ProfileValues): ProfileField[] => {
  const errors = validateProfile(v);
  return PROFILE_FIELDS.filter((f) => errors[f]);
};
