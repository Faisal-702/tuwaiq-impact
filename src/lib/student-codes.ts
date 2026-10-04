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
/** Section order inside each grade. */
export const PRINT_SECTION_ORDER = [1, 2, 3] as const;

export type PrintGroup<T> = {
  /** 10/11/12, or null for students with any other (or no) grade. */
  grade: number | null;
  /** 1/2/3, or null for students without a section. */
  section: number | null;
  /**
   * For a section-less group: true when the same grade also has section
   * groups (so its heading says "no section" instead of just the grade).
   */
  mixed: boolean;
  rows: (T & { code: string })[];
};

/**
 * Groups students that have a code for printing: by grade (PRINT_GRADE_ORDER),
 * then by section (PRINT_SECTION_ORDER), then students of that grade without
 * a section. Students with any other (or no) grade follow in a final group,
 * so nobody is silently left off the sheet. Empty groups are omitted and the
 * order of students inside a group is preserved.
 */
export function groupCodesForPrint<T extends { grade: number | null; section?: number | null; code: string | null }>(
  rows: T[],
): PrintGroup<T>[] {
  const withCode = rows.filter((r): r is T & { code: string } => Boolean(r.code));
  const knownGrades = new Set<number>(PRINT_GRADE_ORDER);
  const knownSections = new Set<number>(PRINT_SECTION_ORDER);
  const groups: PrintGroup<T>[] = [];

  for (const grade of PRINT_GRADE_ORDER) {
    const inGrade = withCode.filter((r) => r.grade === grade);
    const sectioned = PRINT_SECTION_ORDER.map((section) => ({
      grade,
      section,
      mixed: false,
      rows: inGrade.filter((r) => r.section === section),
    })).filter((g) => g.rows.length > 0);
    groups.push(...sectioned);
    const rest = inGrade.filter((r) => r.section == null || !knownSections.has(r.section));
    if (rest.length > 0) groups.push({ grade, section: null, mixed: sectioned.length > 0, rows: rest });
  }

  const other = withCode.filter((r) => r.grade === null || !knownGrades.has(r.grade));
  if (other.length > 0) groups.push({ grade: null, section: null, mixed: false, rows: other });
  return groups;
}
