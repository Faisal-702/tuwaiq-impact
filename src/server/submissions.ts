import "server-only";
import { sql } from "./db";
import { mediaUrl } from "./storage";
import {
  EMPTY_ANSWERS,
  sanitizeAnswers,
  type EvidenceFile,
  type SubmissionAnswers,
} from "@/lib/submission";

/** Cover image of a submission (public media bucket, same layout as project media). */
export type StoredCover = {
  storage_path: string;
  preview_path: string | null;
  thumb_path: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  uploaded: boolean;
};

/** A private supporting file (private bucket). `path` never leaves the server. */
export type StoredEvidence = EvidenceFile & { path: string };

export type SubmissionRow = {
  id: string;
  student_id: string | null;
  status: "draft" | "submitted";
  answers: Record<string, unknown>;
  cover: StoredCover | null;
  evidence: StoredEvidence[];
  project_id: string | null;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/** What the student's browser receives for their draft: no storage paths. */
export type DraftView = {
  answers: SubmissionAnswers;
  cover: { thumbUrl: string | null; fileName: string; uploaded: boolean } | null;
  evidence: EvidenceFile[];
  updatedAt: string;
};

export async function getStudentDraft(studentId: string): Promise<SubmissionRow | null> {
  const [row] = await sql<SubmissionRow[]>`
    select * from project_submissions where student_id = ${studentId} and status = 'draft'`;
  return row ?? null;
}

/** Answers pre-filled from what the platform already knows about the student. */
async function draftPrefill(studentId: string): Promise<SubmissionAnswers> {
  const [student] = await sql<{ name_ar: string | null; name_en: string | null; grade: number | null; section: number | null }[]>`
    select name_ar, name_en, grade, section from students where id = ${studentId}`;
  return {
    ...EMPTY_ANSWERS,
    studentName: student?.name_ar ?? student?.name_en ?? "",
    grade: student?.grade && [10, 11, 12].includes(student.grade) ? String(student.grade) : "",
    section: student?.section ? String(student.section) : "",
  };
}

/**
 * The form as the student last left it, or a fresh pre-filled one. Viewing
 * the page never writes: a draft row is created on the first save or upload.
 */
export async function loadDraftView(studentId: string): Promise<{ view: DraftView; stored: boolean }> {
  const row = await getStudentDraft(studentId);
  if (row) return { view: draftView(row), stored: true };
  return { view: { answers: await draftPrefill(studentId), cover: null, evidence: [], updatedAt: new Date().toISOString() }, stored: false };
}

/**
 * Returns the student's open draft, creating it (pre-filled with what the
 * platform already knows about the student) when there is none.
 */
export async function ensureDraft(studentId: string): Promise<SubmissionRow> {
  const existing = await getStudentDraft(studentId);
  if (existing) return existing;
  const prefill = await draftPrefill(studentId);
  await sql`
    insert into project_submissions (student_id, answers)
    values (${studentId}, ${sql.json(prefill)})
    on conflict (student_id) where status = 'draft' do nothing`;
  const created = await getStudentDraft(studentId);
  if (!created) throw new Error("Could not create submission draft");
  return created;
}

export function draftView(row: SubmissionRow): DraftView {
  const cover = row.cover;
  return {
    answers: sanitizeAnswers(row.answers),
    cover: cover
      ? {
          thumbUrl: cover.uploaded ? mediaUrl(cover.thumb_path ?? cover.storage_path) : null,
          fileName: cover.file_name,
          uploaded: cover.uploaded,
        }
      : null,
    evidence: (row.evidence ?? []).map(({ id, name, mime, size, kind, uploaded }) => ({ id, name, mime, size, kind, uploaded })),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Administrators
// ---------------------------------------------------------------------------

export type AdminSubmissionView = {
  id: string;
  submittedAt: string | null;
  answers: SubmissionAnswers & { acknowledgedAt?: string };
  studentRecord: { name_ar: string | null; name_en: string | null } | null;
  evidence: (EvidenceFile & { href: string | null })[];
};

/**
 * The full questionnaire behind a project, including private identity data
 * and supporting files. Callers must have passed requireAdmin().
 */
export async function getSubmissionForProject(projectId: string): Promise<AdminSubmissionView | null> {
  const [row] = await sql<(SubmissionRow & { name_ar: string | null; name_en: string | null; has_student: boolean })[]>`
    select ps.*, s.name_ar, s.name_en, (s.id is not null) as has_student
      from project_submissions ps
      left join students s on s.id = ps.student_id
     where ps.project_id = ${projectId} and ps.status = 'submitted'
     order by ps.submitted_at desc
     limit 1`;
  if (!row) return null;
  const raw = row.answers as Record<string, unknown>;
  return {
    id: row.id,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    answers: { ...sanitizeAnswers(raw), acknowledgedAt: typeof raw.acknowledgedAt === "string" ? raw.acknowledgedAt : undefined },
    studentRecord: row.has_student ? { name_ar: row.name_ar, name_en: row.name_en } : null,
    // Links go through an admin-only route that checks the session and then
    // serves the file (or redirects to a fresh short-lived signed URL).
    evidence: (row.evidence ?? [])
      .filter((e) => e.uploaded)
      .map((e) => ({
        id: e.id,
        name: e.name,
        mime: e.mime,
        size: e.size,
        kind: e.kind,
        uploaded: true,
        href: `/api/admin/submission-files?${new URLSearchParams({ path: e.path })}`,
      })),
  };
}

/** The supporting file recorded under this private path, if any (download route guard). */
export async function findEvidenceByPath(path: string): Promise<StoredEvidence | null> {
  const [row] = await sql<{ e: StoredEvidence }[]>`
    select e from project_submissions ps, jsonb_array_elements(ps.evidence) e
     where e->>'path' = ${path} and (e->>'uploaded')::boolean
     limit 1`;
  return row?.e ?? null;
}
