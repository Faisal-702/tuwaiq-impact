/** Student access codes are exactly 8 digits. */
export const STUDENT_CODE_LENGTH = 8;

/**
 * Normalises what a student typed: Arabic-Indic / Persian digits become ASCII
 * digits and spaces or dashes are ignored ("٤٨٢٧ ١٩٣٦" → "48271936").
 */
export function normalizeStudentCode(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-‐-―]/g, "");
}

export const isStudentCodeFormat = (code: string) => /^[0-9]{8}$/.test(code);

/** Print order for the codes sheet: first, second, then third secondary year. */
export const PRINT_GRADE_ORDER = [10, 11, 12] as const;

/**
 * Groups students that have a code for printing, in PRINT_GRADE_ORDER.
 * Students with any other (or no) grade follow in a final group (grade null),
 * so nobody is silently left off the sheet. Empty groups are omitted.
 */
export function groupCodesForPrint<T extends { grade: number | null; code: string | null }>(
  rows: T[],
): { grade: number | null; rows: (T & { code: string })[] }[] {
  const withCode = rows.filter((r): r is T & { code: string } => Boolean(r.code));
  const known = new Set<number>(PRINT_GRADE_ORDER);
  const groups: { grade: number | null; rows: (T & { code: string })[] }[] = PRINT_GRADE_ORDER.map((g) => ({
    grade: g,
    rows: withCode.filter((r) => r.grade === g),
  }));
  groups.push({ grade: null, rows: withCode.filter((r) => r.grade === null || !known.has(r.grade)) });
  return groups.filter((g) => g.rows.length > 0);
}
