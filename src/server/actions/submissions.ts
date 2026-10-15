"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cleanSupervisors,
  COVER_MAX_BYTES,
  COVER_MIME,
  EVIDENCE_MAX_FILES,
  EVIDENCE_RULES,
  evidenceMime,
  normalizeNationalId,
  normalizeSaudiPhone,
  parseAmount,
  projectField,
  sanitizeAnswers,
  sanitizeExtraSupervisors,
  SUMMARY_MAX,
  SUPERVISOR_MAX_LENGTH,
  SUPERVISORS_MAX,
  validateSubmission,
  type AnswerKey,
  type EvidenceFile,
  type FieldError,
  type StepField,
  type SubmissionAnswers,
} from "@/lib/submission";
import { VARIANT_MIME } from "@/lib/media-rules";
import { logActivity } from "../activity";
import { getStudentSession } from "../auth";
import { sql } from "../db";
import { saveProfileFromAnswers } from "../profiles";
import { isSafeObjectPath, mediaUrl, privateStorage, storage } from "../storage";
import {
  ensureDraft,
  ensureEditDraft,
  getEditDraft,
  getOwnedProject,
  getStudentDraft,
  loadDraftView,
  type DraftView,
  type StoredCover,
  type StoredEvidence,
  type SubmissionRow,
} from "../submissions";
import { uniqueSlug } from "./shared";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Submissions belong to the signed-in student; the session is the only identity used. */
async function requireStudentId(): Promise<string | null> {
  const session = await getStudentSession();
  return session?.studentId ?? null;
}

const fail = (error: string) => ({ ok: false as const, error });

/**
 * Which form an action works on: the new-project draft (no target), or the
 * pending changes to one of the student's submitted projects (target = the
 * project id). Ownership is checked against the session for edits.
 */
type Target = string | null | undefined;
const validTarget = (target: Target) => (typeof target === "string" && /^[0-9a-f-]{36}$/i.test(target) ? target : null);

async function findRow(studentId: string, target: Target): Promise<SubmissionRow | null> {
  const projectId = validTarget(target);
  return projectId ? getEditDraft(studentId, projectId) : getStudentDraft(studentId);
}

async function ensureRow(studentId: string, target: Target): Promise<SubmissionRow | null> {
  if (target != null && !validTarget(target)) return null;
  const projectId = validTarget(target);
  return projectId ? ensureEditDraft(studentId, projectId) : ensureDraft(studentId);
}

/** Answers + extra supervisors as stored in the row (drafts keep empty supervisor inputs). */
function storedAnswers(answers: unknown, extraSupervisors: unknown) {
  return { ...sanitizeAnswers(answers), extraSupervisors: sanitizeExtraSupervisors({ extraSupervisors }) };
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export async function loadSubmissionDraft(): Promise<Result<DraftView>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  return { ok: true, data: (await loadDraftView(studentId)).view };
}

/**
 * Saves the answers given so far (any step). Values are trimmed to their
 * limits. Valid personal details are also kept in the student's profile so
 * the next project starts with them.
 */
export async function saveSubmissionDraft(
  answers: unknown,
  extraSupervisors?: unknown,
  target?: Target,
): Promise<Result<{ updatedAt: string }>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const row = await ensureRow(studentId, target);
  if (!row) return fail("not_found");
  const clean = storedAnswers(answers, extraSupervisors);
  const [saved] = await sql<{ updated_at: Date }[]>`
    update project_submissions set answers = ${sql.json(clean)}
     where id = ${row.id} and status = ${row.status}
    returning updated_at`;
  if (!saved) return fail("not_found");
  await saveProfileFromAnswers(studentId, clean).catch(() => console.error("Could not save the student profile"));
  return { ok: true, data: { updatedAt: new Date(saved.updated_at).toISOString() } };
}

/** Deletes the draft (or the pending changes) and the files uploaded only for it ("إلغاء"). */
export async function discardSubmissionDraft(target?: Target): Promise<Result> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const row = await findRow(studentId, target);
  if (!row) return { ok: true, data: undefined };
  const [deleted] = await sql<{ cover: StoredCover | null; evidence: StoredEvidence[] }[]>`
    delete from project_submissions where id = ${row.id} and status in ('draft', 'editing')
    returning cover, evidence`;
  if (deleted) {
    if (deleted.cover) await removeCoverFiles(deleted.cover);
    await removeEvidenceFiles((deleted.evidence ?? []).map((e) => e.path));
  }
  return { ok: true, data: undefined };
}

/** Removes private files, except those another form still lists (e.g. the published project's). */
async function removeEvidenceFiles(paths: string[]) {
  if (!paths.length) return;
  const used = await sql<{ p: string }[]>`
    select e->>'path' as p from project_submissions ps, jsonb_array_elements(ps.evidence) e
     where e->>'path' = any(${paths})`;
  const keep = new Set(used.map((r) => r.p));
  const remove = paths.filter((p) => !keep.has(p));
  if (remove.length) await privateStorage().remove(remove).catch(() => console.error("Could not remove supporting files"));
}

async function removeCoverFiles(cover: StoredCover) {
  const paths = [cover.storage_path, cover.preview_path, cover.thumb_path].filter((p): p is string => !!p && isSafeObjectPath(p));
  // Never delete media that a project or another form still uses.
  const used = await sql<{ p: string }[]>`
    select unnest(array[storage_path, preview_path, thumb_path]) as p from project_media
     where storage_path = any(${paths}) or preview_path = any(${paths}) or thumb_path = any(${paths})
    union
    select unnest(array[cover->>'storage_path', cover->>'preview_path', cover->>'thumb_path']) from project_submissions
     where cover->>'storage_path' = any(${paths})`;
  const keep = new Set(used.map((r) => r.p));
  const remove = paths.filter((p) => !keep.has(p));
  if (remove.length) await storage().remove(remove).catch(() => console.error("Could not remove cover files"));
}

// ---------------------------------------------------------------------------
// Cover image (public once the project is published)
// ---------------------------------------------------------------------------

type UploadTarget = { path: string; url: string; headers: Record<string, string> };

const coverSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(120),
  size: z.number().int().positive(),
  variants: z.array(z.enum(["large", "thumb"])).max(2),
});

/**
 * Issues direct-upload targets for the cover image: the original plus the
 * optimised WebP variants generated in the browser (same layout as project
 * media). Replaces any previous cover of the form.
 */
export async function prepareCoverUpload(
  input: z.input<typeof coverSchema>,
  target?: Target,
): Promise<Result<{ original: Omit<UploadTarget, "path">; variants: Record<string, Omit<UploadTarget, "path">> }>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const parsed = coverSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { contentType, size, variants, fileName } = parsed.data;
  if (!(COVER_MIME as readonly string[]).includes(contentType)) return fail("type");
  if (size > COVER_MAX_BYTES) return fail("size");

  const row = await ensureRow(studentId, target);
  if (!row) return fail("not_found");
  const now = new Date();
  const dir = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const driver = storage();
  const originalPath = `${dir}/original.${ext}`;
  const original = await driver.createUploadTarget(originalPath, contentType);
  const out: Record<string, Omit<UploadTarget, "path">> = {};
  const paths: Record<string, string> = {};
  for (const v of variants) {
    paths[v] = `${dir}/${v}.webp`;
    out[v] = await driver.createUploadTarget(paths[v], VARIANT_MIME);
  }
  const cover: StoredCover = {
    storage_path: originalPath,
    preview_path: paths.large ?? null,
    thumb_path: paths.thumb ?? null,
    file_name: fileName.slice(0, 200),
    mime_type: contentType,
    size_bytes: size,
    width: null,
    height: null,
    uploaded: false,
  };
  await sql`update project_submissions set cover = ${sql.json(cover)} where id = ${row.id} and status = ${row.status}`;
  if (row.cover) await removeCoverFiles(row.cover);
  return { ok: true, data: { original, variants: out } };
}

/** Marks the cover as uploaded once the server can see the file. */
export async function confirmCoverUpload(
  input: { width?: number | null; height?: number | null },
  target?: Target,
): Promise<Result<DraftView["cover"]>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const row = await findRow(studentId, target);
  const cover = row?.cover;
  if (!row || !cover) return fail("not_found");
  const driver = storage();
  if (!(await driver.exists(cover.storage_path))) return fail("missing");
  const dim = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100000 ? n : null);
  const next: StoredCover = {
    ...cover,
    preview_path: cover.preview_path && (await driver.exists(cover.preview_path)) ? cover.preview_path : null,
    thumb_path: cover.thumb_path && (await driver.exists(cover.thumb_path)) ? cover.thumb_path : null,
    width: dim(input.width),
    height: dim(input.height),
    uploaded: true,
  };
  await sql`update project_submissions set cover = ${sql.json(next)} where id = ${row.id} and status = ${row.status}`;
  return { ok: true, data: { thumbUrl: mediaUrl(next.thumb_path ?? next.storage_path), fileName: next.file_name, uploaded: true } };
}

export async function removeCoverImage(target?: Target): Promise<Result> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const row = target ? await ensureRow(studentId, target) : await findRow(studentId, target);
  if (!row) return { ok: true, data: undefined };
  const [old] = await sql<{ cover: StoredCover | null }[]>`
    update project_submissions ps set cover = null
      from (select id, cover from project_submissions where id = ${row.id} for update) old
     where ps.id = old.id
    returning old.cover`;
  if (old?.cover) await removeCoverFiles(old.cover);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Supporting files (private)
// ---------------------------------------------------------------------------

const evidenceSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(160),
  size: z.number().int().positive(),
});

export async function prepareEvidenceUpload(
  input: z.input<typeof evidenceSchema>,
  target?: Target,
): Promise<Result<{ file: EvidenceFile; url: string; headers: Record<string, string> }>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const mime = evidenceMime(parsed.data.fileName, parsed.data.contentType);
  const rule = mime ? EVIDENCE_RULES[mime] : null;
  if (!mime || !rule) return fail("type");
  if (parsed.data.size > rule.max) return fail("size");

  const row = await ensureRow(studentId, target);
  if (!row) return fail("not_found");
  const id = randomUUID();
  const entry: StoredEvidence = {
    id,
    path: `submissions/${row.id}/${id}.${rule.ext}`,
    name: parsed.data.fileName.replace(/[\r\n\t]/g, " ").slice(0, 200),
    mime,
    size: parsed.data.size,
    kind: rule.kind,
    uploaded: false,
  };
  // Atomic append, refused once the form holds the maximum number of files.
  const [appended] = await sql<{ id: string }[]>`
    update project_submissions set evidence = evidence || ${sql.json([entry])}
     where id = ${row.id} and status = ${row.status} and jsonb_array_length(evidence) < ${EVIDENCE_MAX_FILES}
    returning id`;
  if (!appended) return fail("count");
  const upload = await privateStorage().createUploadTarget(entry.path, mime);
  const { path: _path, ...file } = entry;
  void _path;
  return { ok: true, data: { file, ...upload } };
}

export async function confirmEvidenceUpload(id: string, target?: Target): Promise<Result<EvidenceFile>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const row = await findRow(studentId, target);
  const entry = row?.evidence.find((e) => e.id === id);
  if (!row || !entry) return fail("not_found");
  if (!(await privateStorage().exists(entry.path))) return fail("missing");
  await sql`
    update project_submissions
       set evidence = (select coalesce(jsonb_agg(case when e->>'id' = ${id} then e || '{"uploaded":true}'::jsonb else e end), '[]'::jsonb)
                         from jsonb_array_elements(evidence) e)
     where id = ${row.id} and status = ${row.status}`;
  const { path: _path, ...file } = entry;
  void _path;
  return { ok: true, data: { ...file, uploaded: true } };
}

export async function removeEvidence(id: string, target?: Target): Promise<Result> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const row = target ? await ensureRow(studentId, target) : await findRow(studentId, target);
  const entry = row?.evidence.find((e) => e.id === id);
  if (!row || !entry) return fail("not_found");
  await sql`
    update project_submissions
       set evidence = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(evidence) e where e->>'id' <> ${id})
     where id = ${row.id} and status = ${row.status}`;
  // A file of the published project stays until the changes are saved.
  await removeEvidenceFiles([entry.path]);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Submit (new project)
// ---------------------------------------------------------------------------

/** Submissions allowed per student per 24 hours. */
const DAILY_LIMIT = 5;

export type SubmitResult =
  | { ok: true; data: { title: string } }
  | { ok: false; error: string; fields?: Partial<Record<StepField, FieldError>>; recorded?: number };

/** Answers as stored with a published project (normalised; dates of acknowledgment). */
function normalizedAnswers(answers: SubmissionAnswers, supervisors: string[]) {
  return {
    ...answers,
    studentName: answers.studentName.trim(),
    nationalId: normalizeNationalId(answers.nationalId),
    phone: normalizeSaudiPhone(answers.phone) ?? answers.phone,
    email: answers.email.trim().toLowerCase(),
    toolsCost: String(parseAmount(answers.toolsCost)),
    requestedAmount: String(parseAmount(answers.requestedAmount)),
    competitionName: answers.competition === "yes" ? answers.competitionName.trim() : "",
    fieldOther: answers.field === "other" ? answers.fieldOther.trim() : "",
    summary: answers.summary.trim().slice(0, SUMMARY_MAX),
    title: answers.title.trim(),
    supervisor: supervisors[0] ?? answers.supervisor.trim(),
    extraSupervisors: supervisors.slice(1),
    acknowledged: true,
    acknowledgedAt: new Date().toISOString(),
  };
}

/** Validates the stored answers + supervisors; returns the clean values or the field errors. */
async function validateRow(row: SubmissionRow, acknowledged: boolean) {
  const answers = sanitizeAnswers(row.answers);
  const supervisors = cleanSupervisors(answers.supervisor, sanitizeExtraSupervisors(row.answers));
  const cover = row.cover;
  const coverReady = Boolean(cover?.uploaded && (await storage().exists(cover.storage_path)));
  const errors = validateSubmission(answers, { hasCover: coverReady, acknowledged });
  if (supervisors.length === 0 && !errors.supervisor) errors.supervisor = "required";
  if (supervisors.some((s) => s.length > SUPERVISOR_MAX_LENGTH) || supervisors.length > SUPERVISORS_MAX) errors.supervisor = "tooLong";
  return { answers, supervisors, cover, errors };
}

async function categoryFor(fieldKey: string) {
  const field = projectField(fieldKey)!;
  const [category] = await sql<{ id: string }[]>`
    select id from categories
     where archived_at is null
     order by (slug = ${field.category}) desc, (slug = 'innovation') desc, (kind = 'project') desc, sort_order
     limit 1`;
  return { field, categoryId: category?.id ?? null };
}

/**
 * Validates every answer again on the server, then publishes the project:
 * creates the public project (title, summary, field, grade, requested
 * amount, supervisors, cover image, linked student) and keeps the full
 * questionnaire, including private identity data and supporting files, in
 * the submission. No approval step: the project is published at once.
 */
export async function submitProject(input: { acknowledged: boolean }): Promise<SubmitResult> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const draft = await getStudentDraft(studentId);
  if (!draft) return fail("not_found");

  const [{ recent }] = await sql<{ recent: number }[]>`
    select count(*)::int as recent from project_submissions
     where student_id = ${studentId} and status = 'submitted' and submitted_at > now() - interval '1 day'`;
  if (recent >= DAILY_LIMIT) return fail("limit");

  const { answers, supervisors, cover, errors } = await validateRow(draft, input.acknowledged === true);
  if (Object.keys(errors).length > 0 || !cover) return { ok: false, error: "validation", fields: errors };

  // Keep only supporting files that actually arrived.
  const evidence: StoredEvidence[] = [];
  for (const e of draft.evidence ?? []) {
    if (e.uploaded && (await privateStorage().exists(e.path))) evidence.push(e);
  }

  const normalized = normalizedAnswers(answers, supervisors);
  const { title, summary } = normalized;
  const { field, categoryId } = await categoryFor(answers.field);
  if (!categoryId) return fail("no_category");
  const [yearRow] = await sql<{ value: unknown }[]>`select value from settings where key = 'current_academic_year'`;
  const academicYear = typeof yearRow?.value === "string" && yearRow.value.trim() ? yearRow.value.trim() : null;

  let projectId: string;
  try {
    const slug = await uniqueSlug("projects", title, "project");
    projectId = await sql.begin(async (tx) => {
      // Lock the draft so a double click cannot submit it twice.
      const [locked] = await tx<{ id: string }[]>`
        select id from project_submissions where id = ${draft.id} and status = 'draft' for update`;
      if (!locked) throw new Error("already_submitted");
      const [project] = await tx<{ id: string }[]>`
        insert into projects (slug, title, description, summary, category_id, grade, academic_year, points,
                              status, published_at, requested_amount, field, field_other, supervisors)
        values (${slug}, ${title}, ${summary}, ${summary}, ${categoryId}, ${Number(answers.grade)}, ${academicYear}, 0,
                'published', now(), ${parseAmount(answers.requestedAmount)}, ${field.key},
                ${field.key === "other" ? normalized.fieldOther : null}, ${supervisors})
        returning id`;
      const [media] = await tx<{ id: string }[]>`
        insert into project_media (project_id, kind, position, storage_path, preview_path, thumb_path,
                                   file_name, mime_type, size_bytes, width, height)
        values (${project.id}, 'image', 0, ${cover.storage_path}, ${cover.preview_path}, ${cover.thumb_path},
                ${cover.file_name}, ${cover.mime_type}, ${cover.size_bytes}, ${cover.width}, ${cover.height})
        returning id`;
      await tx`update projects set cover_media_id = ${media.id} where id = ${project.id}`;
      await tx`insert into project_students (project_id, student_id, position) values (${project.id}, ${studentId}, 0)`;
      await tx`
        update project_submissions
           set status = 'submitted', submitted_at = now(), project_id = ${project.id},
               answers = ${sql.json(normalized)}, evidence = ${sql.json(evidence)}
         where id = ${draft.id}`;
      return project.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "already_submitted") return fail("not_found");
    console.error("Project submission failed", error instanceof Error ? error.message : "unknown");
    return fail("server");
  }

  // Remove supporting files that never finished uploading.
  const kept = new Set(evidence.map((e) => e.path));
  const dropped = (draft.evidence ?? []).filter((e) => !kept.has(e.path)).map((e) => e.path);
  if (dropped.length) await privateStorage().remove(dropped).catch(() => {});

  await saveProfileFromAnswers(studentId, answers).catch(() => console.error("Could not save the student profile"));
  // Activity log: the project only — never personal data.
  await logActivity({ action: "project.submitted", targetType: "project", targetId: projectId, targetLabel: title });
  revalidatePath("/", "layout");
  return { ok: true, data: { title } };
}

// ---------------------------------------------------------------------------
// Save changes to a submitted project
// ---------------------------------------------------------------------------

/** Answers whose change is recorded in the student's activity (personal details are not listed). */
const TRACKED: AnswerKey[] = [
  "projectType", "participants", "title", "description", "goals", "idea", "competition", "competitionName", "summary",
  "field", "fieldOther", "problem", "tools", "toolsCost", "requestedAmount", "projectStatus", "supervisor",
];

/**
 * Applies the student's pending changes to their published project: the
 * public fields (title, summary, field, grade, requested amount, supervisors,
 * cover) and the full questionnaire. The project keeps its id, address,
 * points and recorded support; nothing else is overwritten. The requested
 * amount can not go below the support already recorded.
 */
export async function saveProjectEdit(input: { projectId: string; acknowledged: boolean }): Promise<SubmitResult> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const projectId = validTarget(input?.projectId);
  if (!projectId) return fail("not_found");
  const owned = await getOwnedProject(studentId, projectId);
  const pending = owned ? await getEditDraft(studentId, projectId) : null;
  if (!owned || !pending) return fail("not_found");

  const { answers, supervisors, cover, errors } = await validateRow(pending, input.acknowledged === true);
  if (Object.keys(errors).length > 0 || !cover) return { ok: false, error: "validation", fields: errors };
  const requested = parseAmount(answers.requestedAmount)!;

  const evidence: StoredEvidence[] = [];
  for (const e of pending.evidence ?? []) {
    if (e.uploaded && (await privateStorage().exists(e.path))) evidence.push(e);
  }
  const normalized = normalizedAnswers(answers, supervisors);
  const { field, categoryId } = await categoryFor(answers.field);
  if (!categoryId) return fail("no_category");

  const before = sanitizeAnswers(owned.submission.answers);
  const beforeSupervisors = owned.project.supervisors ?? [];
  const changed = TRACKED.filter((k) => String(before[k] ?? "").trim() !== String(normalized[k] ?? "").trim());
  if (beforeSupervisors.join("\n") !== supervisors.join("\n") && !changed.includes("supervisor")) changed.push("supervisor");
  const coverChanged = owned.project.cover?.storage_path !== cover.storage_path;

  let oldCover: StoredCover | null = null;
  try {
    await sql.begin(async (tx) => {
      // Lock the project and the pending changes: one save at a time, never twice.
      const [project] = await tx<{ id: string; cover_media_id: string | null }[]>`
        select id, cover_media_id from projects where id = ${projectId} and deleted_at is null for update`;
      const [locked] = await tx<{ id: string }[]>`
        select id from project_submissions where id = ${pending.id} and status = 'editing' for update`;
      if (!project || !locked) throw new Error("not_found");
      const [{ recorded }] = await tx<{ recorded: number }[]>`
        select coalesce(sum(amount), 0)::float8 as recorded from project_support_entries
         where project_id = ${projectId} and reversed_at is null`;
      if (requested < recorded) throw Object.assign(new Error("below_recorded"), { recorded });

      let coverMediaId = project.cover_media_id;
      if (coverChanged) {
        const [media] = await tx<{ id: string }[]>`
          insert into project_media (project_id, kind, position, storage_path, preview_path, thumb_path,
                                     file_name, mime_type, size_bytes, width, height)
          values (${projectId}, 'image', 0, ${cover.storage_path}, ${cover.preview_path}, ${cover.thumb_path},
                  ${cover.file_name}, ${cover.mime_type}, ${cover.size_bytes}, ${cover.width}, ${cover.height})
          returning id`;
        coverMediaId = media.id;
        if (project.cover_media_id) {
          const [previous] = await tx<StoredCover[]>`
            delete from project_media where id = ${project.cover_media_id} and project_id = ${projectId}
            returning storage_path, preview_path, thumb_path, file_name, mime_type, size_bytes, width, height, true as uploaded`;
          oldCover = previous ?? null;
        }
      }
      await tx`
        update projects
           set title = ${normalized.title}, description = ${normalized.summary}, summary = ${normalized.summary},
               category_id = ${categoryId}, grade = ${Number(answers.grade)}, requested_amount = ${requested},
               field = ${field.key}, field_other = ${field.key === "other" ? normalized.fieldOther : null},
               supervisors = ${supervisors}, cover_media_id = ${coverMediaId}
         where id = ${projectId}`;
      await tx`
        update project_submissions set answers = ${sql.json(normalized)}, evidence = ${sql.json(evidence)}
         where id = ${owned.submission.id} and status = 'submitted'`;
      await tx`delete from project_submissions where id = ${pending.id}`;
      if (changed.length) {
        await tx`
          insert into student_project_activity (student_id, project_id, kind, fields)
          values (${studentId}, ${projectId}, 'edited', ${changed})`;
      }
      if (coverChanged) {
        await tx`insert into student_project_activity (student_id, project_id, kind) values (${studentId}, ${projectId}, 'cover_changed')`;
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "below_recorded") {
      return { ok: false, error: "below_recorded", fields: { requestedAmount: "amount" }, recorded: (error as Error & { recorded: number }).recorded };
    }
    if (error instanceof Error && error.message === "not_found") return fail("not_found");
    console.error("Saving project changes failed", error instanceof Error ? error.message : "unknown");
    return fail("server");
  }

  // Files the project no longer uses (old cover, removed or unfinished supporting files).
  if (oldCover) await removeCoverFiles(oldCover);
  const kept = new Set(evidence.map((e) => e.path));
  const dropped = [...(owned.submission.evidence ?? []), ...(pending.evidence ?? [])].map((e) => e.path).filter((p) => !kept.has(p));
  await removeEvidenceFiles([...new Set(dropped)]);

  await saveProfileFromAnswers(studentId, answers).catch(() => console.error("Could not save the student profile"));
  await logActivity({ action: "project.edited", targetType: "project", targetId: projectId, targetLabel: normalized.title, details: { by: "student" } });
  revalidatePath("/", "layout");
  return { ok: true, data: { title: normalized.title } };
}
