import { normalizeStudentCode } from "./student-codes";

/** Administrator verification codes are exactly 8 digits. */
export const ADMIN_CODE_LENGTH = 8;

/** Same input rules as student codes: Arabic-Indic digits, spaces and dashes are accepted. */
export const normalizeAdminCode = (raw: string) => normalizeStudentCode(raw);

export const isAdminCodeFormat = (code: string) => /^[0-9]{8}$/.test(code);

/**
 * Codes that are too easy to guess: one repeated digit (11111111) or a run of
 * consecutive digits in either direction (12345678, 98765432).
 */
export function isWeakAdminCode(code: string): boolean {
  if (/^(\d)\1+$/.test(code)) return true;
  const steps = new Set<number>();
  for (let i = 1; i < code.length; i++) steps.add(Number(code[i]) - Number(code[i - 1]));
  return steps.size === 1 && (steps.has(1) || steps.has(-1));
}
