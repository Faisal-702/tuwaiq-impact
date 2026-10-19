import "server-only";
import { sql } from "./db";
import { mediaUrl } from "./storage";
import {
  cleanSupervisors,
  EMPTY_ANSWERS,
  sanitizeAnswers,
  sanitizeExtraSupervisors,
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
  /** draft: a new project; submitted: published; editing: pending changes to a submitted project. */
  status: "draft" | "submitted" | "editing";
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
  /** Supervisors after the first one (the first is answers.supervisor). */
  extraSupervisors: string[];
  cover: { thumbUrl: string | null; fileName: string; uploaded: boolean } | null;
  evidence: EvidenceFile[];
  updatedAt: string;
};

export async function getStudentDraft(studentId: string): Promise<SubmissionRow | null> {
  const [row] = await sql<SubmissionRow[]>`
    select * from project_submissions where student_id = ${studentId} and status = 'draft'`;
  return row ?? null;
}

/**
 * The form as the student last left it, or a fresh pre-filled one. Viewing
 * the page never writes: a draft row is created on the first save or upload.
 */
export async function loadDraftView(studentId: string): Promise<{ view: DraftView; stored: boolean }> {
  const row = await getStudentDraft(studentId);
  if (row) return { view: draftView(row), stored: true };
  return {
    view: { answers: { ...EMPTY_ANSWERS }, extraSupervisors: [], cover: null, evidence: [], updatedAt: new Date().toISOString() },
    stored: false,
  };
}

/**
 * Returns the student's open draft, creating it when there is none. Personal
 * details are not part of the form: they come from the student profile.
 */
export async function ensureDraft(studentId: string): Promise<SubmissionRow> {
  const existing = await getStudentDraft(studentId);
  if (existing) return existing;
  await sql`
    insert into project_submissions (student_id, answers)
    values (${studentId}, ${sql.json(EMPTY_ANSWERS)})
    on conflict (student_id) where status = 'draft' do nothing`;
  const created = await getStudentDraft(studentId);
  if (!created) throw new Error("Could not create submission draft");
  return created;
}

export function draftView(row: SubmissionRow): DraftView {
  const cover = row.cover;
  return {
    answers: sanitizeAnswers(row.answers),
    extraSupervisors: sanitizeExtraSupervisors(row.answers),
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
// Editing a submitted project
// ---------------------------------------------------------------------------
// The student's pending changes live in their own row (status 'editing'),
// so autosave never changes the published project; "Save changes" applies
// them. Ownership is the submitted questionnaire of the session's student.

type OwnedProject = {
  submission: SubmissionRow;
  project: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    requested_amount: number | null;
    field: string | null;
    field_other: string | null;
    supervisors: string[] | null;
    supervisor: string | null;
    status: "draft" | "published";
    cover: StoredCover | null;
    cover_media_id: string | null;
  };
};

/** The student's submitted project (null when it is not theirs or is in the trash). */
export async function getOwnedProject(studentId: string, projectId: string): Promise<OwnedProject | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [row] = await sql<(OwnedProject["project"] & { submission: SubmissionRow })[]>`
    select p.id, p.slug, p.title, p.summary, p.requested_amount::float8 as requested_amount, p.field, p.field_other,
           p.supervisors, p.supervisor, p.status, p.cover_media_id,
           case when m.id is null then null else json_build_object(
             'storage_path', m.storage_path, 'preview_path', m.preview_path, 'thumb_path', m.thumb_path,
             'file_name', coalesce(m.file_name, 'cover'), 'mime_type', coalesce(m.mime_type, 'image/jpeg'),
             'size_bytes', coalesce(m.size_bytes, 0), 'width', m.width, 'height', m.height, 'uploaded', true) end as cover,
           to_json(ps.*) as submission
      from project_submissions ps
      join projects p on p.id = ps.project_id and p.deleted_at is null
      left join project_media m on m.id = p.cover_media_id and m.kind = 'image'
     where ps.student_id = ${studentId} and ps.project_id = ${projectId} and ps.status = 'submitted'
     order by ps.submitted_at desc
     limit 1`;
  if (!row) return null;
  const { submission, ...project } = row;
  return { submission: { ...submission, evidence: submission.evidence ?? [] }, project };
}

export async function getEditDraft(studentId: string, projectId: string): Promise<SubmissionRow | null> {
  const [row] = await sql<SubmissionRow[]>`
    select * from project_submissions where student_id = ${studentId} and project_id = ${projectId} and status = 'editing'`;
  return row ?? null;
}

/** The answers as they are published now (the admin may have adjusted the public fields). */
function editStartingPoint(owned: OwnedProject) {
  const { submission, project } = owned;
  const answers = sanitizeAnswers(submission.answers);
  const supervisors = project.supervisors?.length ? project.supervisors : [answers.supervisor || project.supervisor || ""].filter(Boolean);
  return {
    answers: {
      ...answers,
      title: project.title,
      summary: project.summary ?? answers.summary,
      requestedAmount: project.requested_amount === null ? answers.requestedAmount : String(project.requested_amount),
      field: project.field ?? answers.field,
      fieldOther: project.field === "other" ? (project.field_other ?? "") : answers.fieldOther,
      supervisor: supervisors[0] ?? answers.supervisor,
      extraSupervisors: supervisors.slice(1),
    },
    cover: project.cover,
    evidence: submission.evidence ?? [],
  };
}

/** The edit form: pending changes when there are any, else the published project. Never writes. */
export async function loadEditView(
  studentId: string,
  projectId: string,
): Promise<{ view: DraftView; stored: boolean; project: OwnedProject["project"] } | null> {
  const owned = await getOwnedProject(studentId, projectId);
  if (!owned) return null;
  const pending = await getEditDraft(studentId, projectId);
  if (pending) return { view: draftView(pending), stored: true, project: owned.project };
  const start = editStartingPoint(owned);
  const view = draftView({
    ...owned.submission,
    status: "editing",
    answers: start.answers,
    cover: start.cover,
    evidence: start.evidence,
    updated_at: new Date(),
  });
  return { view, stored: false, project: owned.project };
}

/** Returns the pending-changes row, creating it from the published project the first time. */
export async function ensureEditDraft(studentId: string, projectId: string): Promise<SubmissionRow | null> {
  const existing = await getEditDraft(studentId, projectId);
  if (existing) return existing;
  const owned = await getOwnedProject(studentId, projectId);
  if (!owned) return null;
  const start = editStartingPoint(owned);
  await sql`
    insert into project_submissions (student_id, project_id, status, answers, cover, evidence)
    values (${studentId}, ${projectId}, 'editing', ${sql.json(start.answers)}, ${start.cover ? sql.json(start.cover) : null},
            ${sql.json(start.evidence as never)})
    on conflict (student_id, project_id) where status = 'editing' do nothing`;
  return getEditDraft(studentId, projectId);
}

// ---------------------------------------------------------------------------
// Administrators
// ---------------------------------------------------------------------------

export type AdminSubmissionView = {
  id: string;
  submittedAt: string | null;
  answers: SubmissionAnswers & { acknowledgedAt?: string };
  /** Every supervisor / teacher given on the form. */
  supervisors: string[];
  studentRecord: { name_ar: string | null; name_en: string | null } | null;
  evidence: (EvidenceFile & { href: string | null })[];
};

/**
 * The full questionnaire behind a project, including private identity data
 * and supporting files. Callers must have passed requireAdmin().
 */
export async function getSubmissionForProject(projectId: string): Promise<AdminSubmissionView | null> {
  const [row] = await sql<AdminRow[]>`
    select ps.*, s.name_ar, s.name_en, (s.id is not null) as has_student
      from project_submissions ps
      left join students s on s.id = ps.student_id
     where ps.project_id = ${projectId} and ps.status = 'submitted'
     order by ps.submitted_at desc
     limit 1`;
  return row ? toAdminView(row) : null;
}

type AdminRow = SubmissionRow & { name_ar: string | null; name_en: string | null; has_student: boolean };

function toAdminView(row: AdminRow): AdminSubmissionView {
  const raw = row.answers as Record<string, unknown>;
  return {
    id: row.id,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    answers: { ...sanitizeAnswers(raw), acknowledgedAt: typeof raw.acknowledgedAt === "string" ? raw.acknowledgedAt : undefined },
    supervisors: cleanSupervisors(sanitizeAnswers(raw).supervisor, sanitizeExtraSupervisors(raw)),
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

/** A row of the administrators' "Manage Projects" list: one per submitted student project. */
export type StudentSubmissionRow = {
  id: string;
  /** The student's name from their student account (the session that submitted the project). */
  studentName: { name_ar: string | null; name_en: string | null } | null;
  /** The name copied from the student's profile when the project was submitted (when the account is gone). */
  profileName: string;
  title: string;
  submittedAt: string | null;
};

/**
 * Every project a student has submitted through the project form, newest
 * first. Drafts and pending edits are not listed; projects created by
 * administrators (no submission) are not either. Callers must have passed
 * requireAdmin().
 */
export async function listStudentSubmissions(): Promise<StudentSubmissionRow[]> {
  const rows = await sql<
    { id: string; name_ar: string | null; name_en: string | null; has_student: boolean; profile_name: string | null; title: string | null; submitted_at: Date | null }[]
  >`
    select ps.id, s.name_ar, s.name_en, (s.id is not null) as has_student,
           ps.answers->>'studentName' as profile_name, ps.answers->>'title' as title, ps.submitted_at
      from project_submissions ps
      left join students s on s.id = ps.student_id
     where ps.status = 'submitted'
     order by ps.submitted_at desc nulls last, ps.created_at desc`;
  return rows.map((r) => ({
    id: r.id,
    studentName: r.has_student ? { name_ar: r.name_ar, name_en: r.name_en } : null,
    profileName: (r.profile_name ?? "").trim(),
    title: (r.title ?? "").trim(),
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
  }));
}

/** Answers never shown in the project preview (identity and contact details). */
const PREVIEW_HIDDEN = ["nationalId", "phone", "email"] as const;

export type AdminSubmissionPreview = Omit<AdminSubmissionView, "answers"> & {
  answers: Omit<AdminSubmissionView["answers"], (typeof PREVIEW_HIDDEN)[number]>;
  profileName: string;
  coverUrl: string | null;
};

/**
 * A submitted project as the student sent it, for the administrators'
 * read-only preview: everything the form collected about the project, the
 * student's name, grade and section, the cover and the supporting files, but
 * not their national ID, mobile or email. Callers must have passed requireAdmin().
 */
export async function getSubmissionPreview(submissionId: string): Promise<AdminSubmissionPreview | null> {
  if (!/^[0-9a-f-]{36}$/.test(submissionId)) return null;
  const [row] = await sql<AdminRow[]>`
    select ps.*, s.name_ar, s.name_en, (s.id is not null) as has_student
      from project_submissions ps
      left join students s on s.id = ps.student_id
     where ps.id = ${submissionId} and ps.status = 'submitted'`;
  if (!row) return null;
  const view = toAdminView(row);
  const answers = { ...view.answers } as Record<string, unknown>;
  for (const key of PREVIEW_HIDDEN) delete answers[key];
  const cover = row.cover?.uploaded ? row.cover : null;
  return {
    ...view,
    answers: answers as AdminSubmissionPreview["answers"],
    profileName: view.answers.studentName.trim(),
    coverUrl: cover ? mediaUrl(cover.preview_path ?? cover.storage_path) : null,
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
