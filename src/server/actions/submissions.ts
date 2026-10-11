"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
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
  SUMMARY_MAX,
  validateSubmission,
  type EvidenceFile,
  type FieldError,
  type StepField,
} from "@/lib/submission";
import { VARIANT_MIME } from "@/lib/media-rules";
import { logActivity } from "../activity";
import { getStudentSession } from "../auth";
import { sql } from "../db";
import { isSafeObjectPath, mediaUrl, privateStorage, storage } from "../storage";
import { ensureDraft, getStudentDraft, loadDraftView, type DraftView, type StoredCover, type StoredEvidence } from "../submissions";
import { uniqueSlug } from "./shared";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Submissions belong to the signed-in student; the session is the only identity used. */
async function requireStudentId(): Promise<string | null> {
  const session = await getStudentSession();
  return session?.studentId ?? null;
}

const fail = (error: string) => ({ ok: false as const, error });

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export async function loadSubmissionDraft(): Promise<Result<DraftView>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  return { ok: true, data: (await loadDraftView(studentId)).view };
}

/** Saves the answers given so far (any step). Values are trimmed to their limits. */
export async function saveSubmissionDraft(answers: unknown): Promise<Result<{ updatedAt: string }>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const draft = await ensureDraft(studentId);
  const clean = sanitizeAnswers(answers);
  const [row] = await sql<{ updated_at: Date }[]>`
    update project_submissions set answers = ${sql.json(clean)}
     where id = ${draft.id} and status = 'draft'
    returning updated_at`;
  if (!row) return fail("not_found");
  return { ok: true, data: { updatedAt: new Date(row.updated_at).toISOString() } };
}

/** Deletes the draft and the files uploaded for it ("إلغاء"). */
export async function discardSubmissionDraft(): Promise<Result> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const [row] = await sql<{ cover: StoredCover | null; evidence: StoredEvidence[] }[]>`
    delete from project_submissions where student_id = ${studentId} and status = 'draft'
    returning cover, evidence`;
  if (row) await removeDraftFiles(row.cover, row.evidence);
  return { ok: true, data: undefined };
}

async function removeDraftFiles(cover: StoredCover | null, evidence: StoredEvidence[]) {
  if (cover) await removeCoverFiles(cover);
  const paths = (evidence ?? []).map((e) => e.path);
  if (paths.length) await privateStorage().remove(paths).catch(() => console.error("Could not remove draft files"));
}

async function removeCoverFiles(cover: StoredCover) {
  const paths = [cover.storage_path, cover.preview_path, cover.thumb_path].filter((p): p is string => !!p && isSafeObjectPath(p));
  // Never delete media that a project uses.
  const used = await sql<{ p: string }[]>`
    select unnest(array[storage_path, preview_path, thumb_path]) as p from project_media
     where storage_path = any(${paths}) or preview_path = any(${paths}) or thumb_path = any(${paths})`;
  const keep = new Set(used.map((r) => r.p));
  const remove = paths.filter((p) => !keep.has(p));
  if (remove.length) await storage().remove(remove).catch(() => console.error("Could not remove cover files"));
}

// ---------------------------------------------------------------------------
// Cover image (public once the project is published)
// ---------------------------------------------------------------------------

type Target = { path: string; url: string; headers: Record<string, string> };

const coverSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(120),
  size: z.number().int().positive(),
  variants: z.array(z.enum(["large", "thumb"])).max(2),
});

/**
 * Issues direct-upload targets for the cover image: the original plus the
 * optimised WebP variants generated in the browser (same layout as project
 * media). Replaces any previous cover of the draft.
 */
export async function prepareCoverUpload(input: z.input<typeof coverSchema>): Promise<
  Result<{ original: Omit<Target, "path">; variants: Record<string, Omit<Target, "path">> }>
> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const parsed = coverSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { contentType, size, variants, fileName } = parsed.data;
  if (!(COVER_MIME as readonly string[]).includes(contentType)) return fail("type");
  if (size > COVER_MAX_BYTES) return fail("size");

  const draft = await ensureDraft(studentId);
  const now = new Date();
  const dir = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const driver = storage();
  const originalPath = `${dir}/original.${ext}`;
  const original = await driver.createUploadTarget(originalPath, contentType);
  const out: Record<string, Omit<Target, "path">> = {};
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
  const [previous] = await sql<{ cover: StoredCover | null }[]>`
    select cover from project_submissions where id = ${draft.id}`;
  await sql`update project_submissions set cover = ${sql.json(cover)} where id = ${draft.id} and status = 'draft'`;
  if (previous?.cover) await removeCoverFiles(previous.cover);
  return { ok: true, data: { original, variants: out } };
}

/** Marks the cover as uploaded once the server can see the file. */
export async function confirmCoverUpload(input: { width?: number | null; height?: number | null }): Promise<Result<DraftView["cover"]>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const draft = await getStudentDraft(studentId);
  const cover = draft?.cover;
  if (!draft || !cover) return fail("not_found");
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
  await sql`update project_submissions set cover = ${sql.json(next)} where id = ${draft.id} and status = 'draft'`;
  return { ok: true, data: { thumbUrl: mediaUrl(next.thumb_path ?? next.storage_path), fileName: next.file_name, uploaded: true } };
}

export async function removeCoverImage(): Promise<Result> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const [row] = await sql<{ cover: StoredCover | null }[]>`
    update project_submissions ps set cover = null
      from (select id, cover from project_submissions where student_id = ${studentId} and status = 'draft' for update) old
     where ps.id = old.id
    returning old.cover`;
  if (row?.cover) await removeCoverFiles(row.cover);
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
): Promise<Result<{ file: EvidenceFile; url: string; headers: Record<string, string> }>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const mime = evidenceMime(parsed.data.fileName, parsed.data.contentType);
  const rule = mime ? EVIDENCE_RULES[mime] : null;
  if (!mime || !rule) return fail("type");
  if (parsed.data.size > rule.max) return fail("size");

  const draft = await ensureDraft(studentId);
  const id = randomUUID();
  const entry: StoredEvidence = {
    id,
    path: `submissions/${draft.id}/${id}.${rule.ext}`,
    name: parsed.data.fileName.replace(/[\r\n\t]/g, " ").slice(0, 200),
    mime,
    size: parsed.data.size,
    kind: rule.kind,
    uploaded: false,
  };
  // Atomic append, refused once the draft holds the maximum number of files.
  const [row] = await sql<{ id: string }[]>`
    update project_submissions set evidence = evidence || ${sql.json([entry])}
     where id = ${draft.id} and status = 'draft' and jsonb_array_length(evidence) < ${EVIDENCE_MAX_FILES}
    returning id`;
  if (!row) return fail("count");
  const target = await privateStorage().createUploadTarget(entry.path, mime);
  const { path: _path, ...file } = entry;
  void _path;
  return { ok: true, data: { file, ...target } };
}

export async function confirmEvidenceUpload(id: string): Promise<Result<EvidenceFile>> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const draft = await getStudentDraft(studentId);
  const entry = draft?.evidence.find((e) => e.id === id);
  if (!draft || !entry) return fail("not_found");
  if (!(await privateStorage().exists(entry.path))) return fail("missing");
  await sql`
    update project_submissions
       set evidence = (select coalesce(jsonb_agg(case when e->>'id' = ${id} then e || '{"uploaded":true}'::jsonb else e end), '[]'::jsonb)
                         from jsonb_array_elements(evidence) e)
     where id = ${draft.id} and status = 'draft'`;
  const { path: _path, ...file } = entry;
  void _path;
  return { ok: true, data: { ...file, uploaded: true } };
}

export async function removeEvidence(id: string): Promise<Result> {
  const studentId = await requireStudentId();
  if (!studentId) return fail("unauthorized");
  const draft = await getStudentDraft(studentId);
  const entry = draft?.evidence.find((e) => e.id === id);
  if (!draft || !entry) return fail("not_found");
  await sql`
    update project_submissions
       set evidence = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(evidence) e where e->>'id' <> ${id})
     where id = ${draft.id} and status = 'draft'`;
  await privateStorage().remove([entry.path]).catch(() => console.error("Could not remove a supporting file"));
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/** Submissions allowed per student per 24 hours. */
const DAILY_LIMIT = 5;

export type SubmitResult =
  | { ok: true; data: { title: string } }
  | { ok: false; error: string; fields?: Partial<Record<StepField, FieldError>> };

/**
 * Validates every answer again on the server, then publishes the project:
 * creates the public project (title, summary, field, grade, requested
 * amount, cover image, linked student) and keeps the full questionnaire,
 * including private identity data and supporting files, in the submission.
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

  const answers = sanitizeAnswers(draft.answers);
  const cover = draft.cover;
  const coverReady = Boolean(cover?.uploaded && (await storage().exists(cover.storage_path)));
  const errors = validateSubmission(answers, { hasCover: coverReady, acknowledged: input.acknowledged === true });
  if (Object.keys(errors).length > 0 || !cover) return { ok: false, error: "validation", fields: errors };

  // Keep only supporting files that actually arrived.
  const evidence: StoredEvidence[] = [];
  for (const e of draft.evidence ?? []) {
    if (e.uploaded && (await privateStorage().exists(e.path))) evidence.push(e);
  }

  const summary = answers.summary.trim().slice(0, SUMMARY_MAX);
  const title = answers.title.trim();
  const field = projectField(answers.field)!;
  const normalized = {
    ...answers,
    studentName: answers.studentName.trim(),
    nationalId: normalizeNationalId(answers.nationalId),
    phone: normalizeSaudiPhone(answers.phone) ?? answers.phone,
    email: answers.email.trim().toLowerCase(),
    toolsCost: String(parseAmount(answers.toolsCost)),
    requestedAmount: String(parseAmount(answers.requestedAmount)),
    competitionName: answers.competition === "yes" ? answers.competitionName.trim() : "",
    fieldOther: answers.field === "other" ? answers.fieldOther.trim() : "",
    summary,
    title,
    acknowledged: true,
    acknowledgedAt: new Date().toISOString(),
  };

  const [category] = await sql<{ id: string }[]>`
    select id from categories
     where archived_at is null
     order by (slug = ${field.category}) desc, (slug = 'innovation') desc, (kind = 'project') desc, sort_order
     limit 1`;
  if (!category) return fail("no_category");
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
                              status, published_at, requested_amount, field, field_other)
        values (${slug}, ${title}, ${summary}, ${summary}, ${category.id}, ${Number(answers.grade)}, ${academicYear}, 0,
                'published', now(), ${parseAmount(answers.requestedAmount)}, ${field.key},
                ${field.key === "other" ? normalized.fieldOther : null})
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

  // Activity log: the project only — never personal data.
  await logActivity({ action: "project.submitted", targetType: "project", targetId: projectId, targetLabel: title });
  revalidatePath("/", "layout");
  return { ok: true, data: { title } };
}
