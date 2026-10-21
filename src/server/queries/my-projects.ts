import "server-only";
import { funding, type Funding } from "@/lib/funding";
import type { CategoryRef } from "@/lib/types";
import { requireAdmin } from "../auth";
import { sql } from "../db";
import { mediaUrl } from "../storage";

/*
 * The signed-in student's own projects. Every function takes the student id
 * from the caller, which must come from the verified student session (never
 * from the browser). Ownership = the student's submitted questionnaire.
 */

export type MyProject = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  field: string | null;
  field_other: string | null;
  category: CategoryRef;
  /** draft = hidden from the platform by an administrator (not an approval state). */
  status: "draft" | "published";
  cover: { url: string; width: number | null; height: number | null } | null;
  supervisors: string[];
  projectType: string | null;
  /** "complete" | "incomplete", from the form. */
  projectStatus: string | null;
  funding: Funding;
  hasTarget: boolean;
  submittedAt: string;
  /** Latest change to the project or to its recorded support. */
  updatedAt: string;
  hasPendingEdit: boolean;
};

type Row = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  field: string | null;
  field_other: string | null;
  category: CategoryRef;
  status: "draft" | "published";
  cover_thumb: string | null;
  cover_original: string | null;
  cover_width: number | null;
  cover_height: number | null;
  supervisors: string[];
  project_type: string | null;
  project_status: string | null;
  requested_amount: number | null;
  recorded: number;
  submitted_at: Date;
  updated_at: Date;
  has_pending_edit: boolean;
};

/** Sum of the support recorded for a project (reversed entries excluded). */
export const RECORDED_SUPPORT = (projectAlias: string) =>
  sql`coalesce((select sum(e.amount) from project_support_entries e
                 where e.project_id = ${sql(projectAlias)}.id and e.reversed_at is null), 0)::float8`;

export async function listMyProjects(studentId: string): Promise<MyProject[]> {
  const rows = await sql<Row[]>`
    select distinct on (p.id)
           p.id, p.slug, p.title, p.summary, p.field, p.field_other, p.status,
           json_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_ar', c.name_ar,
                             'icon', c.icon, 'accent', c.accent) as category,
           cov.thumb_path as cover_thumb, cov.storage_path as cover_original, cov.width as cover_width, cov.height as cover_height,
           coalesce(p.supervisors, case when coalesce(trim(p.supervisor), '') <> '' then array[p.supervisor] end, '{}'::text[]) as supervisors,
           ps.answers->>'projectType' as project_type, ps.answers->>'projectStatus' as project_status,
           p.requested_amount::float8 as requested_amount,
           ${RECORDED_SUPPORT("p")} as recorded,
           ps.submitted_at,
           greatest(p.updated_at, coalesce((select max(coalesce(e.reversed_at, e.created_at)) from project_support_entries e
                                              where e.project_id = p.id), p.updated_at)) as updated_at,
           exists (select 1 from project_submissions x
                    where x.student_id = ps.student_id and x.project_id = p.id and x.status = 'editing') as has_pending_edit
      from project_submissions ps
      join projects p on p.id = ps.project_id and p.deleted_at is null
      join categories c on c.id = p.category_id
      left join lateral (
        select m.thumb_path, m.storage_path, m.width, m.height
          from project_media m
         where m.project_id = p.id and m.kind = 'image'
         order by (m.id = p.cover_media_id) desc nulls last, m.position asc
         limit 1
      ) cov on true
     where ps.student_id = ${studentId} and ps.status = 'submitted'
     order by p.id, ps.submitted_at desc
     limit 500`;
  return rows
    .map((r): MyProject => {
      const coverPath = r.cover_thumb ?? r.cover_original;
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        field: r.field,
        field_other: r.field_other,
        category: r.category,
        status: r.status,
        cover: coverPath ? { url: mediaUrl(coverPath)!, width: r.cover_width, height: r.cover_height } : null,
        supervisors: r.supervisors.filter((s) => s && s.trim()),
        projectType: r.project_type,
        projectStatus: r.project_status,
        funding: funding(r.requested_amount, r.recorded),
        hasTarget: (r.requested_amount ?? 0) > 0,
        submittedAt: new Date(r.submitted_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
        hasPendingEdit: r.has_pending_edit,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export type MyActivity = {
  id: string;
  kind: "created" | "edited" | "cover_changed" | "support_added" | "support_reversed";
  projectId: string;
  projectTitle: string;
  amount: number | null;
  fields: string[];
  at: string;
};

/** The student's recent actions on their (non-deleted) projects, newest first. */
export async function listMyActivity(studentId: string, limit = 30): Promise<MyActivity[]> {
  const rows = await sql<(Omit<MyActivity, "at"> & { at: Date })[]>`
    select * from (
      select ps.id::text as id, 'created' as kind, p.id as "projectId", p.title as "projectTitle",
             null::float8 as amount, '{}'::text[] as fields, ps.submitted_at as at
        from project_submissions ps join projects p on p.id = ps.project_id and p.deleted_at is null
       where ps.student_id = ${studentId} and ps.status = 'submitted'
      union all
      select a.id::text, a.kind, p.id, p.title, a.amount::float8, coalesce(a.fields, '{}'::text[]), a.created_at
        from student_project_activity a join projects p on p.id = a.project_id and p.deleted_at is null
       where a.student_id = ${studentId}
    ) t
    order by at desc
    limit ${Math.min(Math.max(limit, 1), 100)}`;
  return rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
}

export type SupportEntry = {
  id: string;
  amount: number;
  note: string | null;
  recordedBy: "student" | "admin";
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
};

type EntryRow = Omit<SupportEntry, "createdAt" | "reversedAt"> & { createdAt: Date; reversedAt: Date | null; studentName?: string | null };

const entryColumns = sql`
  e.id, e.amount::float8 as amount, e.note, e.recorded_by as "recordedBy", e.created_at as "createdAt",
  e.reversed_at as "reversedAt", e.reversal_reason as "reversalReason"`;

const toEntry = (r: EntryRow): SupportEntry => ({
  id: r.id,
  amount: r.amount,
  note: r.note,
  recordedBy: r.recordedBy,
  createdAt: new Date(r.createdAt).toISOString(),
  reversedAt: r.reversedAt ? new Date(r.reversedAt).toISOString() : null,
  reversalReason: r.reversalReason,
});

/** Support history of one of the student's projects (null when the project is not theirs). */
export async function listMySupportEntries(studentId: string, projectId: string): Promise<SupportEntry[] | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [owned] = await sql<{ id: string }[]>`
    select p.id from project_submissions ps join projects p on p.id = ps.project_id and p.deleted_at is null
     where ps.student_id = ${studentId} and ps.project_id = ${projectId} and ps.status = 'submitted' limit 1`;
  if (!owned) return null;
  const rows = await sql<EntryRow[]>`
    select ${entryColumns} from project_support_entries e where e.project_id = ${projectId} order by e.created_at desc limit 200`;
  return rows.map(toEntry);
}

/** Admin-only (re-checked here): every support entry of a project, with who recorded it. */
export async function listSupportEntriesForAdmin(projectId: string): Promise<(SupportEntry & { studentName: string | null })[]> {
  await requireAdmin();
  const rows = await sql<EntryRow[]>`
    select ${entryColumns}, coalesce(s.name_ar, s.name_en) as "studentName"
      from project_support_entries e left join students s on s.id = e.recorded_by_student_id
     where e.project_id = ${projectId}
     order by e.created_at desc
     limit 500`;
  return rows.map((r) => ({ ...toEntry(r), studentName: r.studentName ?? null }));
}
