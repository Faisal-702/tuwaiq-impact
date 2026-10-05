import "server-only";
import { cache } from "react";
import { sql } from "../db";
import { mediaUrl } from "../storage";
import type {
  Category,
  ContentTypeFilter,
  HomeStats,
  LeaderboardRow,
  ProjectCardData,
  ProjectDetail,
  ProjectMedia,
  ProjectSort,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

/** A project is publicly visible when it is published and not in the trash. */
const PUBLIC = sql`p.status = 'published' and p.deleted_at is null`;

type CardRow = Omit<ProjectCardData, "cover"> & {
  cover_thumb: string | null;
  cover_original: string | null;
  cover_kind: string | null;
  cover_width: number | null;
  cover_height: number | null;
  total?: number;
};

const CARD_COLUMNS = sql`
  p.id, p.slug, p.title, p.description, p.grade, p.points, p.view_count, p.is_featured, p.award,
  p.published_at,
  json_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_ar', c.name_ar,
                    'icon', c.icon, 'accent', c.accent) as category,
  coalesce((
    select json_agg(json_build_object('id', s.id, 'slug', s.slug, 'name_en', s.name_en, 'name_ar', s.name_ar)
                    order by ps.position, coalesce(s.name_en, s.name_ar))
      from project_students ps join students s on s.id = ps.student_id
     where ps.project_id = p.id), '[]'::json) as students,
  cov.thumb_path as cover_thumb, cov.storage_path as cover_original, cov.kind::text as cover_kind,
  cov.width as cover_width, cov.height as cover_height`;

const COVER_JOIN = sql`
  left join lateral (
    select m.thumb_path, m.storage_path, m.kind, m.width, m.height
      from project_media m
     where m.project_id = p.id
       and (m.kind = 'image' or (m.kind = 'video' and m.thumb_path is not null))
     order by (m.id = p.cover_media_id) desc nulls last, (m.kind = 'image') desc, m.position asc
     limit 1
  ) cov on true`;

function toCard(row: CardRow): ProjectCardData {
  const coverPath =
    row.cover_thumb ?? (row.cover_kind === "image" ? row.cover_original : null);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    grade: row.grade,
    points: row.points,
    view_count: row.view_count,
    is_featured: row.is_featured,
    award: row.award,
    published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
    category: row.category,
    students: row.students,
    cover: coverPath
      ? { url: mediaUrl(coverPath)!, width: row.cover_width, height: row.cover_height }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set(["grade", "class", "الصف", "صف"]);

function normalizeQuery(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْٰـ]/g, "")
    .split(/[\s,،]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
    .slice(0, 6);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every token must match the project's title, students, category (names,
 * slug and aliases) or grade. Latin tokens match at word starts so that
 * "AI" finds Artificial Intelligence without matching "Faisal".
 */
function searchFragment(q: string | undefined) {
  const tokens = q ? normalizeQuery(q) : [];
  if (tokens.length === 0) return sql``;
  const doc = sql`ti_normalize(concat_ws(' ', p.title, c.name_en, c.name_ar, c.keywords, replace(c.slug, '-', ' '),
    (select string_agg(concat_ws(' ', s.name_en, s.name_ar), ' ')
       from project_students ps join students s on s.id = ps.student_id where ps.project_id = p.id)))`;
  return tokens.reduce((acc, token) => {
    const isArabic = /[؀-ۿ]/.test(token);
    const numeric = /^\d{1,2}$/.test(token) ? Number(token) : null;
    // Short Latin tokens ("ai", "3d") must match a whole word; longer ones match word prefixes.
    const pattern = "\\m" + escapeRegex(token) + (token.length <= 2 ? "\\M" : "");
    // Arabic words often carry prefixes (e.g. "ال"), so longer Arabic tokens match anywhere.
    const arabicWord = `(^|[^\u0600-\u06FFa-z0-9])${escapeRegex(token)}([^\u0600-\u06FFa-z0-9]|$)`;
    const textMatch = isArabic
      ? token.length <= 2
        ? sql`${doc} ~ ${arabicWord}`
        : sql`strpos(${doc}, ${token}) > 0`
      : sql`${doc} ~ ${pattern}`;
    const gradeMatch = numeric !== null ? sql` or p.grade = ${numeric}` : sql``;
    return sql`${acc} and (${textMatch}${gradeMatch})`;
  }, sql``);
}

export type ProjectQuery = {
  q?: string;
  category?: string;
  grade?: number;
  year?: string;
  type?: ContentTypeFilter;
  student?: string;
  sort?: ProjectSort;
  limit?: number;
  offset?: number;
};

function contentTypeFragment(type: ContentTypeFilter | undefined) {
  if (!type) return sql``;
  if (type === "text") {
    return sql`and not exists (select 1 from project_media m where m.project_id = p.id)`;
  }
  return sql`and exists (select 1 from project_media m where m.project_id = p.id and m.kind = ${type})`;
}

function orderFragment(sort: ProjectSort | undefined) {
  switch (sort) {
    case "views":
      return sql`order by p.view_count desc, p.published_at desc nulls last`;
    case "points":
      return sql`order by p.points desc, p.published_at desc nulls last`;
    case "active":
      return sql`order by (select count(*) from project_views v
                            where v.project_id = p.id and v.viewed_on > current_date - 30) desc,
                          p.view_count desc, p.published_at desc nulls last`;
    default:
      return sql`order by p.published_at desc nulls last, p.created_at desc`;
  }
}

export async function searchProjects(query: ProjectQuery): Promise<{ items: ProjectCardData[]; total: number }> {
  const limit = Math.min(Math.max(query.limit ?? 12, 1), 96);
  const offset = Math.max(query.offset ?? 0, 0);
  const rows = await sql<CardRow[]>`
    select ${CARD_COLUMNS}, count(*) over()::int as total
      from projects p
      join categories c on c.id = p.category_id
      ${COVER_JOIN}
     where ${PUBLIC}
       ${query.category ? sql`and c.slug = ${query.category}` : sql``}
       ${query.grade ? sql`and p.grade = ${query.grade}` : sql``}
       ${query.year ? sql`and p.academic_year = ${query.year}` : sql``}
       ${query.student
         ? sql`and exists (select 1 from project_students ps join students s on s.id = ps.student_id
                            where ps.project_id = p.id and s.slug = ${query.student})`
         : sql``}
       ${contentTypeFragment(query.type)}
       ${searchFragment(query.q)}
     ${orderFragment(query.sort)}
     limit ${limit} offset ${offset}`;
  return { items: rows.map(toCard), total: rows[0]?.total ?? 0 };
}

export async function getFeaturedProjects(limit = 3): Promise<ProjectCardData[]> {
  const rows = await sql<CardRow[]>`
    select ${CARD_COLUMNS}
      from projects p
      join categories c on c.id = p.category_id
      ${COVER_JOIN}
     where ${PUBLIC} and p.is_featured
     order by p.published_at desc nulls last
     limit ${limit}`;
  return rows.map(toCard);
}

export async function getRelatedProjects(projectId: string, categoryId: string, limit = 3) {
  const rows = await sql<CardRow[]>`
    select ${CARD_COLUMNS}
      from projects p
      join categories c on c.id = p.category_id
      ${COVER_JOIN}
     where ${PUBLIC} and p.category_id = ${categoryId} and p.id <> ${projectId}
     order by p.is_featured desc, p.published_at desc nulls last
     limit ${limit}`;
  return rows.map(toCard);
}

// ---------------------------------------------------------------------------
// Stats & filters
// ---------------------------------------------------------------------------

export const getHomeStats = cache(async (): Promise<HomeStats> => {
  const [row] = await sql<HomeStats[]>`
    select
      count(*) filter (where c.kind = 'project')::int as projects,
      count(*) filter (where c.kind = 'activity')::int as activities,
      count(*) filter (where nullif(trim(p.award), '') is not null)::int as awards,
      (select count(distinct ps.student_id)::int
         from project_students ps join projects p2 on p2.id = ps.project_id
        where p2.status = 'published' and p2.deleted_at is null) as students
      from projects p
      join categories c on c.id = p.category_id
     where ${PUBLIC}`;
  return row ?? { projects: 0, students: 0, awards: 0, activities: 0 };
});

export const getPublicCategories = cache(async (): Promise<Category[]> => {
  return sql<Category[]>`
    select c.id, c.slug, c.name_en, c.name_ar, c.icon, c.accent, c.keywords, c.kind, c.sort_order,
           c.archived_at,
           (select count(*)::int from projects p where p.category_id = c.id and ${PUBLIC}) as project_count
      from categories c
     where c.archived_at is null
     order by c.sort_order, c.name_en`;
});

export async function getFilterOptions() {
  const [grades, years, students] = await Promise.all([
    sql<{ grade: number }[]>`
      select distinct p.grade from projects p where ${PUBLIC} and p.grade is not null order by p.grade`,
    sql<{ year: string }[]>`
      select distinct p.academic_year as year from projects p
       where ${PUBLIC} and nullif(trim(p.academic_year), '') is not null order by 1 desc`,
    sql<{ slug: string; name_en: string | null; name_ar: string | null }[]>`
      select distinct s.slug, s.name_en, s.name_ar
        from students s
        join project_students ps on ps.student_id = s.id
        join projects p on p.id = ps.project_id
       where ${PUBLIC}
       order by s.name_en nulls last, s.name_ar`,
  ]);
  return {
    grades: grades.map((g) => g.grade),
    years: years.map((y) => y.year),
    students,
  };
}

// ---------------------------------------------------------------------------
// Project detail
// ---------------------------------------------------------------------------

type DetailRow = CardRow & {
  class_name: string | null;
  academic_year: string | null;
  supervisor: string | null;
  status: "draft" | "published";
  cover_media_id: string | null;
  category_id: string;
  created_at: string;
  updated_at: string;
};

export function mapMedia(row: Omit<ProjectMedia, "original_url" | "preview_url" | "thumb_url">): ProjectMedia {
  return {
    ...row,
    size_bytes: row.size_bytes === null ? null : Number(row.size_bytes),
    duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    original_url: mediaUrl(row.storage_path),
    preview_url: mediaUrl(row.preview_path),
    thumb_url: mediaUrl(row.thumb_path),
  };
}

async function loadDetail(where: ReturnType<typeof sql>): Promise<(ProjectDetail & { category_id: string }) | null> {
  const [row] = await sql<DetailRow[]>`
    select ${CARD_COLUMNS}, p.class_name, p.academic_year, p.supervisor, p.status, p.cover_media_id,
           p.category_id, p.created_at, p.updated_at
      from projects p
      join categories c on c.id = p.category_id
      ${COVER_JOIN}
     where ${where}
     limit 1`;
  if (!row) return null;
  const [students, media] = await Promise.all([
    sql<{ id: string; slug: string; name_en: string | null; name_ar: string | null; grade: number | null }[]>`
      select s.id, s.slug, s.name_en, s.name_ar, s.grade
        from project_students ps join students s on s.id = ps.student_id
       where ps.project_id = ${row.id}
       order by ps.position, coalesce(s.name_en, s.name_ar)`,
    sql<Omit<ProjectMedia, "original_url" | "preview_url" | "thumb_url">[]>`
      select id, kind, position, caption, file_name, mime_type, size_bytes, width, height,
             duration_seconds, url, storage_path, preview_path, thumb_path
        from project_media where project_id = ${row.id}
       order by position, created_at`,
  ]);
  const card = toCard(row);
  return {
    ...card,
    students,
    class_name: row.class_name,
    academic_year: row.academic_year,
    supervisor: row.supervisor,
    status: row.status,
    cover_media_id: row.cover_media_id,
    category_id: row.category_id,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    media: media.map(mapMedia),
  };
}

export const getPublicProject = cache(async (slug: string) => {
  return loadDetail(sql`${PUBLIC} and p.slug = ${slug}`);
});

/** Admin preview: any status, not in trash. Caller must have verified admin access. */
export async function getProjectForPreview(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return loadDetail(sql`p.id = ${id} and p.deleted_at is null`);
}

// ---------------------------------------------------------------------------
// Students & leaderboard
// ---------------------------------------------------------------------------

export type StudentListItem = {
  id: string;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  grade: number | null;
  projects: number;
  points: number;
};

export async function getPublicStudents(opts: { q?: string; grade?: number }): Promise<StudentListItem[]> {
  const tokens = opts.q ? normalizeQuery(opts.q) : [];
  const nameDoc = sql`ti_normalize(concat_ws(' ', s.name_en, s.name_ar))`;
  const nameFilter = tokens.reduce((acc, token) => {
    const isArabic = /[؀-ۿ]/.test(token);
    if (isArabic && token.length > 2) return sql`${acc} and strpos(${nameDoc}, ${token}) > 0`;
    const pattern = isArabic
      ? `(^|[^\u0600-\u06FFa-z0-9])${escapeRegex(token)}([^\u0600-\u06FFa-z0-9]|$)`
      : "\\m" + escapeRegex(token) + (token.length <= 2 ? "\\M" : "");
    return sql`${acc} and ${nameDoc} ~ ${pattern}`;
  }, sql``);
  return sql<StudentListItem[]>`
    select s.id, s.slug, s.name_en, s.name_ar, s.grade,
           count(p.id)::int as projects, coalesce(sum(p.points), 0)::int as points
      from students s
      join project_students ps on ps.student_id = s.id
      join projects p on p.id = ps.project_id and ${PUBLIC}
     where true
       ${opts.grade ? sql`and s.grade = ${opts.grade}` : sql``}
       ${nameFilter}
     group by s.id
     order by coalesce(s.name_en, s.name_ar)`;
}

export const getLeaderboard = cache(async (year: string | null, limit = 10): Promise<LeaderboardRow[]> => {
  return sql<LeaderboardRow[]>`
    select * from (
      select rank() over (order by sum(p.points) desc)::int as rank,
             s.id, s.slug, s.name_en, s.name_ar, s.grade,
             sum(p.points)::int as points, count(p.id)::int as projects
        from students s
        join project_students ps on ps.student_id = s.id
        join projects p on p.id = ps.project_id and ${PUBLIC}
       where ${year ? sql`p.academic_year = ${year}` : sql`true`}
       group by s.id
    ) ranked
    order by rank, projects desc, coalesce(name_en, name_ar)
    limit ${limit}`;
});

export async function getLeaderboardYears(): Promise<string[]> {
  const rows = await sql<{ year: string }[]>`
    select distinct p.academic_year as year
      from projects p join project_students ps on ps.project_id = p.id
     where ${PUBLIC} and nullif(trim(p.academic_year), '') is not null
     order by 1 desc`;
  return rows.map((r) => r.year);
}

/**
 * A student's public profile. Cached per request (the page and its metadata
 * both need it), and its three queries all key on the slug, so they run
 * concurrently: one round trip instead of three.
 */
export const getStudentProfile = cache(async (slug: string) => {
  const [[student], [rankRow], projectRows] = await Promise.all([
    sql<
    {
      id: string;
      slug: string;
      name_en: string | null;
      name_ar: string | null;
      grade: number | null;
      points: number;
      projects: number;
      featured: number;
    }[]
  >`
    select s.id, s.slug, s.name_en, s.name_ar, s.grade,
           coalesce(sum(p.points), 0)::int as points, count(p.id)::int as projects,
           count(p.id) filter (where p.is_featured)::int as featured
      from students s
      join project_students ps on ps.student_id = s.id
      join projects p on p.id = ps.project_id and ${PUBLIC}
     where s.slug = ${slug}
     group by s.id`,
    sql<{ rank: number }[]>`
    select rank from (
      select s.slug, rank() over (order by sum(p.points) desc)::int as rank
        from students s
        join project_students ps on ps.student_id = s.id
        join projects p on p.id = ps.project_id and ${PUBLIC}
       group by s.id) r
     where r.slug = ${slug}`,
    sql<CardRow[]>`
    select ${CARD_COLUMNS}
      from projects p
      join categories c on c.id = p.category_id
      ${COVER_JOIN}
     where ${PUBLIC}
       and exists (
         select 1 from project_students ps join students s on s.id = ps.student_id
          where ps.project_id = p.id and s.slug = ${slug})
     order by p.published_at desc nulls last`,
  ]);
  if (!student) return null;
  const projects = projectRows.map(toCard);

  const achievements = projects
    .filter((p) => p.award && p.award.trim().length > 0)
    .map((p) => ({ award: p.award!, projectTitle: p.title, projectSlug: p.slug, date: p.published_at }));

  return { student, rank: rankRow?.rank ?? null, projects, achievements };
});

// ---------------------------------------------------------------------------
// Quick search (header)
// ---------------------------------------------------------------------------

export async function quickSearch(q: string) {
  const [projects, students] = await Promise.all([
    searchProjects({ q, limit: 5 }),
    getPublicStudents({ q }),
  ]);
  return {
    projects: projects.items.map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      students: p.students,
    })),
    students: students.slice(0, 5),
  };
}
