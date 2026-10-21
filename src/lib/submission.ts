/**
 * The student project submission questionnaire ("إضافة مشروع"), shared by
 * the browser (step-by-step feedback) and the server (enforcement).
 */

import { normalizeAdminCode } from "./admin-code";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Project fields ("مجال المشروع"), exactly as offered in the original form
 * (some overlap on purpose). Each maps to one of the platform's categories
 * so the existing category chips keep working; the field itself is shown
 * on the project card and can be filtered on.
 */
export const PROJECT_FIELDS = [
  { key: "technology", ar: "التقنية والبرمجيات", en: "Technology & Software", category: "programming" },
  { key: "ai", ar: "الذكاء الاصطناعي", en: "Artificial Intelligence", category: "artificial-intelligence" },
  { key: "iot", ar: "إنترنت الأشياء", en: "Internet of Things", category: "innovation" },
  { key: "electronics", ar: "الإلكترونيات والهندسة", en: "Electronics & Engineering", category: "innovation" },
  { key: "ai-ml", ar: "الذكاء الاصطناعي وتعلم الآلة", en: "AI & Machine Learning", category: "artificial-intelligence" },
  { key: "data-science", ar: "علم البيانات وتحليل البيانات", en: "Data Science & Analytics", category: "artificial-intelligence" },
  { key: "cybersecurity", ar: "الأمن السيبراني", en: "Cybersecurity", category: "cybersecurity" },
  { key: "software-apps", ar: "تطوير البرمجيات والتطبيقات", en: "Software & App Development", category: "programming" },
  { key: "web-mobile", ar: "تطوير تطبيقات الويب والجوال", en: "Web & Mobile App Development", category: "programming" },
  { key: "software-engineering", ar: "هندسة البرمجيات", en: "Software Engineering", category: "programming" },
  { key: "cloud", ar: "الحوسبة السحابية", en: "Cloud Computing", category: "programming" },
  { key: "networks", ar: "الشبكات وأنظمة الحاسب", en: "Networks & Computer Systems", category: "programming" },
  { key: "robotics", ar: "الروبوتات والميكاترونكس", en: "Robotics & Mechatronics", category: "robotics" },
  { key: "iot-devices", ar: "إنترنت الأشياء IoT", en: "Internet of Things (IoT)", category: "innovation" },
  { key: "drones", ar: "الطائرات بدون طيار والدرونز", en: "Drones & UAVs", category: "robotics" },
  { key: "games-xr", ar: "تطوير الألعاب والواقع الافتراضي والمعزز", en: "Game Development, VR & AR", category: "programming" },
  { key: "ui-ux", ar: "التصميم الرقمي وتجربة المستخدم UI/UX", en: "Digital Design & UX (UI/UX)", category: "media" },
  { key: "design-3d", ar: "التصميم الرقمي والطباعة ثلاثية الأبعاد", en: "Digital Design & 3D Printing", category: "innovation" },
  { key: "smart-cities", ar: "المدن الذكية والتقنيات المستدامة", en: "Smart Cities & Sustainable Technology", category: "innovation" },
  { key: "entrepreneurship", ar: "الابتكار وريادة الأعمال التقنية", en: "Innovation & Tech Entrepreneurship", category: "innovation" },
  { key: "product-management", ar: "إدارة المنتجات والمشاريع التقنية", en: "Technical Product & Project Management", category: "innovation" },
  { key: "other", ar: "أخرى", en: "Other", category: "innovation" },
] as const;

export type ProjectFieldKey = (typeof PROJECT_FIELDS)[number]["key"];
export const FIELD_KEYS = PROJECT_FIELDS.map((f) => f.key) as ProjectFieldKey[];

export function projectField(key: string | null | undefined) {
  return PROJECT_FIELDS.find((f) => f.key === key) ?? null;
}

/** The label shown publicly for a project's field ("Other" shows the student's text). */
export function fieldLabel(key: string | null | undefined, other: string | null | undefined, locale: "ar" | "en") {
  const field = projectField(key);
  if (!field) return null;
  if (field.key === "other" && other?.trim()) return other.trim();
  return locale === "ar" ? field.ar : field.en;
}

/**
 * The competition the student wants to enter the project for ("المسابقة
 * التي ترغب بالمشاركة فيها"). Separate from the project field and the
 * category. Stored as these stable keys (projects.competition); "other"
 * keeps the student's own competition name (projects.competition_other).
 */
export const COMPETITIONS = [
  { key: "saif", ar: "سيف", en: "SAIF" },
  { key: "ibdaa", ar: "إبداع", en: "Ibdaa" },
  { key: "robotics", ar: "الروبوتات", en: "Robotics" },
  { key: "hackathons", ar: "الهاكاثونات", en: "Hackathons" },
  { key: "programming", ar: "مسابقات البرمجة", en: "Programming Competitions" },
  { key: "other", ar: "أخرى", en: "Other" },
] as const;

export type CompetitionKey = (typeof COMPETITIONS)[number]["key"];
export const COMPETITION_KEYS = COMPETITIONS.map((c) => c.key) as CompetitionKey[];
/** Longest custom competition name (also checked by the database). */
export const COMPETITION_OTHER_MAX = 80;

export function competition(key: string | null | undefined) {
  return COMPETITIONS.find((c) => c.key === key) ?? null;
}

/** The label shown for a project's competition ("Other" shows the student's own name). */
export function competitionLabel(key: string | null | undefined, other: string | null | undefined, locale: "ar" | "en") {
  const c = competition(key);
  if (!c) return null;
  if (c.key === "other" && other?.trim()) return other.trim();
  return locale === "ar" ? c.ar : c.en;
}

/** School grades offered on the form, as stored by the platform (10 = أولى ثانوي). */
export const SUBMISSION_GRADES = [10, 11, 12] as const;
export const SUBMISSION_SECTIONS = [1, 2, 3] as const;
export const PROJECT_TYPES = ["individual", "group", "other"] as const;
export const YES_NO = ["yes", "no"] as const;
export const PROJECT_STATUSES = ["complete", "incomplete"] as const;

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export type SubmissionAnswers = {
  studentName: string;
  nationalId: string;
  phone: string;
  email: string;
  grade: string;
  section: string;
  projectType: string;
  participants: string;
  title: string;
  description: string;
  goals: string;
  idea: string;
  competition: string;
  competitionName: string;
  summary: string;
  field: string;
  fieldOther: string;
  targetCompetition: string;
  targetCompetitionOther: string;
  problem: string;
  tools: string;
  toolsCost: string;
  requestedAmount: string;
  projectStatus: string;
  supervisor: string;
};

export type AnswerKey = keyof SubmissionAnswers;

/** Maximum lengths (characters). The summary limit is part of the product spec. */
export const SUMMARY_MAX = 300;
export const ANSWER_LIMITS: Record<AnswerKey, number> = {
  studentName: 120,
  nationalId: 20,
  phone: 20,
  email: 254,
  grade: 2,
  section: 1,
  projectType: 12,
  participants: 1000,
  title: 150,
  description: 1500,
  goals: 2000,
  idea: 2000,
  competition: 3,
  competitionName: 150,
  summary: SUMMARY_MAX,
  field: 40,
  fieldOther: 80,
  targetCompetition: 12,
  targetCompetitionOther: COMPETITION_OTHER_MAX,
  problem: 2000,
  tools: 2000,
  toolsCost: 20,
  requestedAmount: 20,
  projectStatus: 12,
  supervisor: 120,
};

export const ANSWER_KEYS = Object.keys(ANSWER_LIMITS) as AnswerKey[];

export const EMPTY_ANSWERS: SubmissionAnswers = Object.fromEntries(ANSWER_KEYS.map((k) => [k, ""])) as SubmissionAnswers;

/**
 * Keeps only known keys, as strings, within their length limits (used for
 * drafts, which may be incomplete; full validation happens on submit).
 */
export function sanitizeAnswers(input: unknown): SubmissionAnswers {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...EMPTY_ANSWERS };
  for (const key of ANSWER_KEYS) {
    const value = source[key];
    if (typeof value === "string") out[key] = value.slice(0, ANSWER_LIMITS[key]);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = String(value).slice(0, ANSWER_LIMITS[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Supervisors / teachers
// ---------------------------------------------------------------------------
// The first supervisor is the form's "supervisor" answer (required). Any
// further supervisors are kept in the answers as "extraSupervisors".

export const SUPERVISOR_MAX_LENGTH = 120;
/** Upper bound for all supervisors of one project (a safety limit, not a design limit). */
export const SUPERVISORS_MAX = 20;

/** Additional supervisor inputs as typed (drafts keep empty inputs the student added). */
export function sanitizeExtraSupervisors(input: unknown): string[] {
  const list = (input && typeof input === "object" ? (input as Record<string, unknown>).extraSupervisors : undefined) ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, SUPERVISORS_MAX - 1)
    .map((v) => (typeof v === "string" ? v.slice(0, SUPERVISOR_MAX_LENGTH) : ""));
}

/** The final list: trimmed, empty entries dropped, repeated names kept once. */
export function cleanSupervisors(first: string, extra: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [first, ...extra]) {
    const name = raw.replace(/\s+/g, " ").trim().slice(0, SUPERVISOR_MAX_LENGTH);
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= SUPERVISORS_MAX) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Arabic-Indic / Persian digits → ASCII; spaces and dashes removed. */
const digitsOnly = (raw: string) => normalizeAdminCode(raw).replace(/[^\d+]/g, "");

/** Saudi national ID / Iqama: 10 digits starting with 1 or 2, with a valid check digit. */
export function isValidNationalId(raw: string): boolean {
  const id = digitsOnly(raw);
  if (!/^[12]\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(id[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
export const normalizeNationalId = (raw: string) => digitsOnly(raw);

/** Saudi mobile numbers in any common form → "05XXXXXXXX", or null. */
export function normalizeSaudiPhone(raw: string): string | null {
  let n = digitsOnly(raw);
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00966")) n = n.slice(5);
  else if (n.startsWith("966")) n = n.slice(3);
  if (/^5\d{8}$/.test(n)) n = `0${n}`;
  return /^05\d{8}$/.test(n) ? n : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (raw: string) => EMAIL_RE.test(raw.trim()) && raw.trim().length <= 254;

/** Arabic-Indic and Persian digits → ASCII (nothing else is removed). */
const asciiDigits = (raw: string) =>
  raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * Money in SAR: digits (Arabic-Indic accepted), thousands separators, up to
 * 2 decimals. Anything else, including a minus sign, is rejected.
 */
export function parseAmount(raw: string): number | null {
  const n = asciiDigits(raw).replace(/[,،٬\s]/g, "").replace(/٫/g, ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(n)) return null;
  const value = Number(n);
  return Number.isFinite(value) && value >= 0 && value <= 10_000_000 ? value : null;
}

// ---------------------------------------------------------------------------
// Steps & validation
// ---------------------------------------------------------------------------

/** Pseudo-fields validated outside the answers (files, acknowledgment). */
export type StepField = AnswerKey | "cover" | "evidence" | "acknowledged";

/**
 * Sections of the project form. Personal details are not part of it: they
 * come from the student profile (الملف الشخصي), see lib/profile.ts.
 */
export const SUBMISSION_SECTIONS_LIST = ["details", "classification", "attachments"] as const;
export type SubmissionSection = (typeof SUBMISSION_SECTIONS_LIST)[number];

export type SubmissionStep = { id: string; section: SubmissionSection; fields: StepField[] };

/**
 * The stored questionnaire as administrators read it: the student's details
 * (copied from the profile when the project was submitted) come first.
 */
export const QUESTIONNAIRE_SECTIONS = ["student", ...SUBMISSION_SECTIONS_LIST] as const;
export type QuestionnaireSection = (typeof QUESTIONNAIRE_SECTIONS)[number];
export const PERSONAL_FIELDS: AnswerKey[] = ["studentName", "nationalId", "phone", "email", "grade", "section"];

/** At most ~5 questions per screen; every question of the form is here. */
export const SUBMISSION_STEPS: SubmissionStep[] = [
  { id: "details-1", section: "details", fields: ["projectType", "participants", "title", "description"] },
  { id: "details-2", section: "details", fields: ["goals", "idea"] },
  { id: "details-3", section: "details", fields: ["competition", "competitionName", "summary"] },
  { id: "classification-1", section: "classification", fields: ["field", "fieldOther", "targetCompetition", "targetCompetitionOther", "problem", "tools"] },
  { id: "classification-2", section: "classification", fields: ["toolsCost", "requestedAmount"] },
  { id: "attachments-1", section: "attachments", fields: ["projectStatus", "supervisor", "cover"] },
  { id: "attachments-2", section: "attachments", fields: ["evidence"] },
  { id: "attachments-3", section: "attachments", fields: ["acknowledged"] },
];

export type FieldError = "required" | "nationalId" | "phone" | "email" | "amount" | "choice" | "tooLong" | "acknowledge";

export type ValidationContext = { hasCover: boolean; acknowledged: boolean };

const filled = (v: string) => v.trim().length > 0;
const oneOf = (v: string, options: readonly (string | number)[]) => options.map(String).includes(v);

/** Validates the given fields (all fields when omitted). Returns errors by field. */
export function validateSubmission(
  answers: SubmissionAnswers,
  context: ValidationContext,
  fields: StepField[] = SUBMISSION_STEPS.flatMap((s) => s.fields),
): Partial<Record<StepField, FieldError>> {
  const errors: Partial<Record<StepField, FieldError>> = {};
  const a = answers;
  const requireText = (key: AnswerKey) => {
    if (!filled(a[key])) errors[key] = "required";
    else if (a[key].length > ANSWER_LIMITS[key]) errors[key] = "tooLong";
  };
  for (const field of fields) {
    switch (field) {
      case "studentName":
      case "title":
      case "description":
      case "goals":
      case "idea":
      case "problem":
      case "tools":
      case "supervisor":
      case "summary":
        requireText(field);
        break;
      case "nationalId":
        if (!filled(a.nationalId)) errors.nationalId = "required";
        else if (!isValidNationalId(a.nationalId)) errors.nationalId = "nationalId";
        break;
      case "phone":
        if (!filled(a.phone)) errors.phone = "required";
        else if (!normalizeSaudiPhone(a.phone)) errors.phone = "phone";
        break;
      case "email":
        if (!filled(a.email)) errors.email = "required";
        else if (!isValidEmail(a.email)) errors.email = "email";
        break;
      case "grade":
        if (!oneOf(a.grade, SUBMISSION_GRADES)) errors.grade = filled(a.grade) ? "choice" : "required";
        break;
      case "section":
        if (!oneOf(a.section, SUBMISSION_SECTIONS)) errors.section = filled(a.section) ? "choice" : "required";
        break;
      case "projectType":
        if (!oneOf(a.projectType, PROJECT_TYPES)) errors.projectType = "required";
        break;
      case "participants":
        // "إن وجدوا": required only for a group project.
        if (a.projectType === "group" && !filled(a.participants)) errors.participants = "required";
        else if (a.participants.length > ANSWER_LIMITS.participants) errors.participants = "tooLong";
        break;
      case "competition":
        if (!oneOf(a.competition, YES_NO)) errors.competition = "required";
        break;
      case "competitionName":
        if (a.competition === "yes") requireText("competitionName");
        break;
      case "field":
        if (!oneOf(a.field, FIELD_KEYS)) errors.field = "required";
        break;
      case "fieldOther":
        if (a.field === "other") requireText("fieldOther");
        break;
      case "targetCompetition":
        if (!oneOf(a.targetCompetition, COMPETITION_KEYS)) errors.targetCompetition = "required";
        break;
      case "targetCompetitionOther":
        if (a.targetCompetition === "other") {
          if (!filled(a.targetCompetitionOther)) errors.targetCompetitionOther = "required";
          else if (a.targetCompetitionOther.trim().length > COMPETITION_OTHER_MAX) errors.targetCompetitionOther = "tooLong";
        }
        break;
      case "toolsCost":
      case "requestedAmount":
        if (!filled(a[field])) errors[field] = "required";
        else if (parseAmount(a[field]) === null) errors[field] = "amount";
        break;
      case "projectStatus":
        if (!oneOf(a.projectStatus, PROJECT_STATUSES)) errors.projectStatus = "required";
        break;
      case "cover":
        if (!context.hasCover) errors.cover = "required";
        break;
      case "evidence":
        break; // optional
      case "acknowledged":
        if (!context.acknowledged) errors.acknowledged = "acknowledge";
        break;
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Cover image: shown on the public cards. */
export const COVER_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const COVER_MAX_BYTES = 15 * 1024 * 1024;

/** Supporting files (private): images, short videos and documents. */
export const EVIDENCE_RULES: Record<string, { kind: "image" | "video" | "document"; ext: string; max: number }> = {
  "image/jpeg": { kind: "image", ext: "jpg", max: 15 * 1024 * 1024 },
  "image/png": { kind: "image", ext: "png", max: 15 * 1024 * 1024 },
  "image/webp": { kind: "image", ext: "webp", max: 15 * 1024 * 1024 },
  "video/mp4": { kind: "video", ext: "mp4", max: 50 * 1024 * 1024 },
  "video/webm": { kind: "video", ext: "webm", max: 50 * 1024 * 1024 },
  "video/quicktime": { kind: "video", ext: "mov", max: 50 * 1024 * 1024 },
  "application/pdf": { kind: "document", ext: "pdf", max: 25 * 1024 * 1024 },
  "application/msword": { kind: "document", ext: "doc", max: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "document", ext: "docx", max: 25 * 1024 * 1024 },
  "application/vnd.ms-powerpoint": { kind: "document", ext: "ppt", max: 25 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { kind: "document", ext: "pptx", max: 25 * 1024 * 1024 },
};
export const EVIDENCE_MAX_FILES = 10;

const EVIDENCE_EXT: Record<string, string> = Object.fromEntries(Object.entries(EVIDENCE_RULES).map(([m, r]) => [r.ext, m]));
EVIDENCE_EXT.jpeg = "image/jpeg";

/** Trusted MIME type for a supporting file, from its declared type or extension. */
export function evidenceMime(fileName: string, declared: string | null | undefined): string | null {
  if (declared && EVIDENCE_RULES[declared]) return declared;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EVIDENCE_EXT[ext] ?? null;
}

export const EVIDENCE_ACCEPT = [...Object.keys(EVIDENCE_RULES), ...Object.values(EVIDENCE_RULES).map((r) => `.${r.ext}`), ".jpeg"].join(",");
export const COVER_ACCEPT = [...COVER_MIME, ".jpg", ".jpeg", ".png", ".webp"].join(",");

export type EvidenceFile = { id: string; name: string; mime: string; size: number; kind: "image" | "video" | "document"; uploaded: boolean };
export type CoverInfo = { thumbUrl: string | null; fileName: string | null; uploaded: boolean };
