import "server-only";
import { sql } from "../db";
import { mediaUrl } from "../storage";
import type { Category, ProjectMedia } from "@/lib/types";
import { mapMedia } from "./public";

/*
 * Admin-only queries. Every caller must have passed requireAdmin().
 */

const LIVE = sql`p.deleted_at is null`;
const PUBLIC = sql`p.status = 'published' and p.deleted_at is null`;

export async function getOverview() {
  const [counts] = await sql<{ total: number; published: number; featured: number; drafts: number; students: number }[]>`
    select count(*)::int as total,
           count(*) filter (where p.status = 'published')::int as published,
           count(*) filter (where p.is_featured)::int as featured,
           count(*) filter (where p.status = 'draft')::int as drafts,
           (select count(*)::int from students) as students
      from projects p where ${LIVE}`;

  const byCategory = await sql<{ name_en: string; name_ar: string; count: number }[]>`
    select c.name_en, c.name_ar, count(p.id)::int as count
      from categories c join projects p on p.category_id = c.id and ${PUBLIC}
     group by c.id
     order by count desc, c.sort_order`;

  const byMonth = await sql<{ month: string; count: number }[]>`
    with months as (
      select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as month
    )
    select to_char(m.month, 'YYYY-MM-01') as month,
           (select count(*)::int from projects p
             where ${PUBLIC} and date_trunc('month', p.published_at) = m.month) as count
      from months m order by m.month`;

  return { counts, byCategory, byMonth };
}

export type AdminActivity = {
  id: number;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function listActivity(opts: { action?: string; limit?: number; offset?: number } = {}) {
  const limit = opts.limit ?? 30;
  const rows = await sql<(AdminActivity & { total: number })[]>`
    select id, action, target_type, target_id, target_label, details, created_at, count(*) over()::int as total
      from activity_logs
     where ${opts.action ? sql`action = ${opts.action}` : sql`true`}
     order by created_at desc, id desc
     limit ${limit} offset ${opts.offset ?? 0}`;
  return { items: rows, total: rows[0]?.total ?? 0 };
}

export type AdminProjectRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  is_featured: boolean;
  is_demo: boolean;
  points: number;
  view_count: number;
  updated_at: string;
  deleted_at: string | null;
  category_en: string;
  category_ar: string;
  category_icon: string;
  category_accent: string;
  students: { name_en: string | null; name_ar: string | null }[];
  thumb: string | null;
};

const ADMIN_ROW = sql`
  p.id, p.slug, p.title, p.status, p.is_featured, p.is_demo, p.points, p.view_count, p.updated_at, p.deleted_at,
  c.name_en as category_en, c.name_ar as category_ar, c.icon as category_icon, c.accent as category_accent,
  coalesce((select json_agg(json_build_object('name_en', s.name_en, 'name_ar', s.name_ar) order by ps.position)
              from project_students ps join students s on s.id = ps.student_id where ps.project_id = p.id), '[]') as students,
  (select coalesce(m.thumb_path, m.storage_path) from project_media m
    where m.project_id = p.id and (m.kind = 'image' or (m.kind = 'video' and m.thumb_path is not null))
    order by (m.id = p.cover_media_id) desc nulls last, m.position limit 1) as thumb_path`;

function mapAdminRow(row: AdminProjectRow & { thumb_path: string | null }): AdminProjectRow {
  return { ...row, thumb: mediaUrl(row.thumb_path) };
}

export async function listAdminProjects(opts: { status?: "draft" | "published" | "featured"; q?: string }) {
  const statusFilter =
    opts.status === "featured"
      ? sql`and p.is_featured`
      : opts.status
        ? sql`and p.status = ${opts.status}`
        : sql``;
  const q = opts.q?.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const search = q
    ? sql`and (ti_normalize(p.title) like ${"%" + q.toLowerCase() + "%"}
              or exists (select 1 from project_students ps join students s on s.id = ps.student_id
                          where ps.project_id = p.id
                            and ti_normalize(concat_ws(' ', s.name_en, s.name_ar)) like ${"%" + q.toLowerCase() + "%"}))`
    : sql``;
  const rows = await sql<(AdminProjectRow & { thumb_path: string | null })[]>`
    select ${ADMIN_ROW}
      from projects p join categories c on c.id = p.category_id
     where ${LIVE} ${statusFilter} ${search}
     order by p.updated_at desc`;
  return rows.map(mapAdminRow);
}

export async function listTrash() {
  const rows = await sql<(AdminProjectRow & { thumb_path: string | null })[]>`
    select ${ADMIN_ROW}
      from projects p join categories c on c.id = p.category_id
     where p.deleted_at is not null
     order by p.deleted_at desc`;
  return rows.map(mapAdminRow);
}

export async function getStatusCounts() {
  const [row] = await sql<{ all: number; draft: number; published: number; featured: number; trash: number }[]>`
    select count(*) filter (where deleted_at is null)::int as all,
           count(*) filter (where deleted_at is null and status = 'draft')::int as draft,
           count(*) filter (where deleted_at is null and status = 'published')::int as published,
           count(*) filter (where deleted_at is null and is_featured)::int as featured,
           count(*) filter (where deleted_at is not null)::int as trash
      from projects`;
  return row;
}

export type EditableProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category_id: string;
  grade: number | null;
  class_name: string | null;
  academic_year: string | null;
  supervisor: string | null;
  award: string | null;
  points: number;
  status: "draft" | "published";
  is_featured: boolean;
  cover_media_id: string | null;
  updated_at: string;
  students: { id: string; name_en: string | null; name_ar: string | null }[];
  media: ProjectMedia[];
};

export async function getProjectForEdit(id: string): Promise<EditableProject | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [project] = await sql<Omit<EditableProject, "students" | "media">[]>`
    select id, slug, title, description, category_id, grade, class_name, academic_year, supervisor, award, points,
           status, is_featured, cover_media_id, updated_at::text as updated_at
      from projects where id = ${id} and deleted_at is null`;
  if (!project) return null;
  const [students, media] = await Promise.all([
    sql<{ id: string; name_en: string | null; name_ar: string | null }[]>`
      select s.id, s.name_en, s.name_ar from project_students ps join students s on s.id = ps.student_id
       where ps.project_id = ${id} order by ps.position`,
    sql<Omit<ProjectMedia, "original_url" | "preview_url" | "thumb_url">[]>`
      select id, kind, position, caption, file_name, mime_type, size_bytes, width, height, duration_seconds, url,
             storage_path, preview_path, thumb_path
        from project_media where project_id = ${id} order by position, created_at`,
  ]);
  return { ...project, students, media: media.map(mapMedia) };
}

export async function listAllStudents() {
  return sql<{ id: string; name_en: string | null; name_ar: string | null; grade: number | null }[]>`
    select id, name_en, name_ar, grade from students order by coalesce(name_en, name_ar)`;
}

export async function listCategoriesAdmin(): Promise<Category[]> {
  return sql<Category[]>`
    select c.id, c.slug, c.name_en, c.name_ar, c.icon, c.accent, c.keywords, c.kind, c.sort_order, c.archived_at,
           (select count(*)::int from projects p where p.category_id = c.id and p.deleted_at is null) as project_count
      from categories c
     order by (c.archived_at is not null), c.sort_order, c.name_en`;
}

export type AdminStudentRow = {
  id: string;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  grade: number | null;
  section: number | null;
  is_demo: boolean;
  projects: number;
  published: number;
  points: number;
};

export async function listStudentsAdmin(q?: string): Promise<AdminStudentRow[]> {
  const term = q?.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  return sql<AdminStudentRow[]>`
    select s.id, s.slug, s.name_en, s.name_ar, s.grade, s.section, s.is_demo,
           count(p.id)::int as projects,
           count(p.id) filter (where p.status = 'published')::int as published,
           coalesce(sum(p.points) filter (where p.status = 'published'), 0)::int as points
      from students s
      left join project_students ps on ps.student_id = s.id
      left join projects p on p.id = ps.project_id and p.deleted_at is null
     where ${term ? sql`ti_normalize(concat_ws(' ', s.name_en, s.name_ar)) like ${"%" + term + "%"}` : sql`true`}
     group by s.id
     order by coalesce(s.name_en, s.name_ar)`;
}

export async function getStudentAdmin(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [student] = await listStudentsAdminById(id);
  if (!student) return null;
  const projects = await sql<(AdminProjectRow & { thumb_path: string | null })[]>`
    select ${ADMIN_ROW}
      from projects p join categories c on c.id = p.category_id
     where p.deleted_at is null
       and exists (select 1 from project_students ps where ps.project_id = p.id and ps.student_id = ${id})
     order by p.updated_at desc`;
  return { student, projects: projects.map(mapAdminRow) };
}

async function listStudentsAdminById(id: string) {
  return sql<AdminStudentRow[]>`
    select s.id, s.slug, s.name_en, s.name_ar, s.grade, s.section, s.is_demo,
           count(p.id)::int as projects,
           count(p.id) filter (where p.status = 'published')::int as published,
           coalesce(sum(p.points) filter (where p.status = 'published'), 0)::int as points
      from students s
      left join project_students ps on ps.student_id = s.id
      left join projects p on p.id = ps.project_id and p.deleted_at is null
     where s.id = ${id}
     group by s.id`;
}

export async function getAnalytics() {
  const [totals] = await sql<{ total_views: number; views_30: number; avg_points: number; media_items: number }[]>`
    select (select coalesce(sum(view_count), 0)::int from projects p where ${LIVE}) as total_views,
           (select count(*)::int from project_views v where v.viewed_on > current_date - 30) as views_30,
           (select coalesce(round(avg(points)), 0)::int from projects p where ${PUBLIC}) as avg_points,
           (select count(*)::int from project_media m join projects p on p.id = m.project_id where ${LIVE}) as media_items`;

  const viewsByDay = await sql<{ day: string; count: number }[]>`
    with days as (select generate_series(current_date - 29, current_date, interval '1 day')::date as day)
    select to_char(d.day, 'YYYY-MM-DD') as day,
           (select count(*)::int from project_views v where v.viewed_on = d.day) as count
      from days d order by d.day`;

  const topViewed = await sql<{ id: string; slug: string; title: string; view_count: number }[]>`
    select p.id, p.slug, p.title, p.view_count from projects p where ${PUBLIC}
     order by p.view_count desc, p.published_at desc limit 5`;

  const byGrade = await sql<{ grade: number | null; count: number }[]>`
    select p.grade, count(*)::int as count from projects p where ${PUBLIC}
     group by p.grade order by p.grade nulls last`;

  const contentMix = await sql<{ kind: string; count: number }[]>`
    select m.kind::text as kind, count(distinct m.project_id)::int as count
      from project_media m join projects p on p.id = m.project_id
     where ${PUBLIC}
     group by m.kind order by count desc`;

  return { totals, viewsByDay, topViewed, byGrade, contentMix };
}

export async function getSettings() {
  const rows = await sql<{ key: string; value: unknown }[]>`select key, value from settings`;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    defaultPoints: typeof map.default_points === "number" ? map.default_points : 10,
    currentAcademicYear: typeof map.current_academic_year === "string" ? map.current_academic_year : null,
  };
}

export async function getDemoCounts() {
  const [row] = await sql<{ students: number; projects: number }[]>`
    select (select count(*)::int from students where is_demo) as students,
           (select count(*)::int from projects where is_demo) as projects`;
  return row;
}

export async function listAcademicYears() {
  const rows = await sql<{ year: string }[]>`
    select distinct academic_year as year from projects
     where nullif(trim(academic_year), '') is not null order by 1 desc`;
  return rows.map((r) => r.year);
}

export async function listProjectPoints(year: string | null) {
  return sql<{ id: string; slug: string; title: string; points: number; academic_year: string | null; students: string }[]>`
    select p.id, p.slug, p.title, p.points, p.academic_year,
           coalesce((select string_agg(coalesce(s.name_en, s.name_ar), ', ' order by ps.position)
                       from project_students ps join students s on s.id = ps.student_id
                      where ps.project_id = p.id), '') as students
      from projects p
     where ${PUBLIC} ${year ? sql`and p.academic_year = ${year}` : sql``}
     order by p.points desc, p.published_at desc`;
}
