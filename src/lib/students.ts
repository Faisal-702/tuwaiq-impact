/** Sections ("الشعبة") a student can belong to within a grade. */
export const STUDENT_SECTIONS = [1, 2, 3] as const;
export type StudentSection = (typeof STUDENT_SECTIONS)[number];

/** Most names accepted in one bulk add. */
export const BULK_MAX_STUDENTS = 500;
export const STUDENT_NAME_MAX_LENGTH = 120;

/**
 * Comparison key for spotting duplicate names: case-insensitive, Arabic
 * letter variants unified (أ/إ/آ/ٱ → ا, ة → ه, ى → ي), diacritics and tatweel
 * removed, whitespace collapsed. Mirrors the database's ti_normalize().
 */
export function normalizeStudentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ـً-ْٰ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedNameList = {
  /** Unique names in paste order (the students that would be created). */
  names: string[];
  /** Lines repeated in the list (each listed once), ignored on submit. */
  duplicates: string[];
  /** Lines longer than STUDENT_NAME_MAX_LENGTH. */
  tooLong: string[];
};

/** Splits pasted text into student names: one per line, trimmed, blank lines ignored. */
export function parseNameList(text: string): ParsedNameList {
  const seen = new Set<string>();
  const dupSeen = new Set<string>();
  const names: string[] = [];
  const duplicates: string[] = [];
  const tooLong: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (name.length > STUDENT_NAME_MAX_LENGTH) {
      tooLong.push(name);
      continue;
    }
    const key = normalizeStudentName(name);
    if (seen.has(key)) {
      if (!dupSeen.has(key)) {
        dupSeen.add(key);
        duplicates.push(name);
      }
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { names, duplicates, tooLong };
}
