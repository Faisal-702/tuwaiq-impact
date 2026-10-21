/** Rules shared by the suggestion form (early feedback) and the server (enforcement). */
export const SUGGESTION_MAX_LENGTH = 500;
export const SUGGESTION_NAME_MAX_LENGTH = 120;
/** Same internal grade convention as students and projects. */
export const SUGGESTION_GRADES = [10, 11, 12] as const;
export type SuggestionGrade = (typeof SUGGESTION_GRADES)[number];
