-- Tuwaiq Impact | أثر طويق
-- Core schema. One school, one administrator role.
--
-- All application data access happens server-side through a privileged
-- Postgres connection. Row Level Security is enabled on every table with no
-- policies for the public API roles, so the Supabase anon/authenticated keys
-- can never read or write these tables directly.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.project_status as enum ('draft', 'published');
create type public.media_kind as enum ('image', 'video', 'document', 'link');
create type public.category_kind as enum ('project', 'activity');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Normalises text for search: lower-case, unify Arabic letter variants,
-- strip tatweel and Arabic diacritics.
create or replace function public.ti_normalize(t text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    translate(lower(coalesce(t, '')), 'أإآٱةىـ', 'ااااهي'),
    '[ً-ْٰ]', '', 'g'
  )
$$;

create or replace function public.ti_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  -- Comma-separated search aliases, e.g. "ai, machine learning".
  keywords text not null default '',
  icon text not null default 'sparkles',
  -- Restricted to brand-safe accents so categories never break the identity.
  accent text not null default 'teal'
    check (accent in ('teal', 'deep-teal', 'purple', 'violet', 'graphite', 'slate')),
  kind public.category_kind not null default 'project',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_touch before update on public.categories
  for each row execute function public.ti_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Students (records only — students never authenticate)
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text,
  name_ar text,
  grade smallint check (grade between 1 and 12),
  -- Development/demo records are flagged so they can be purged before launch.
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_name_required check (
    coalesce(nullif(trim(name_en), ''), nullif(trim(name_ar), '')) is not null
  )
);

create trigger students_touch before update on public.students
  for each row execute function public.ti_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(trim(title)) > 0),
  description text,
  category_id uuid not null references public.categories (id) on delete restrict,
  grade smallint check (grade between 1 and 12),
  class_name text,
  academic_year text,
  supervisor text,
  award text,
  points integer not null default 10 check (points between 0 and 100000),
  status public.project_status not null default 'draft',
  is_featured boolean not null default false,
  published_at timestamptz,
  view_count integer not null default 0,
  cover_media_id uuid,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Featured always implies published.
  constraint projects_featured_requires_published check (not is_featured or status = 'published')
);

create trigger projects_touch before update on public.projects
  for each row execute function public.ti_touch_updated_at();

create index projects_public_idx on public.projects (status, deleted_at, published_at desc);
create index projects_category_idx on public.projects (category_id);
create index projects_featured_idx on public.projects (is_featured) where is_featured;
create index projects_year_idx on public.projects (academic_year);

create table public.project_students (
  project_id uuid not null references public.projects (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  position smallint not null default 0,
  primary key (project_id, student_id)
);

create index project_students_student_idx on public.project_students (student_id);

-- ---------------------------------------------------------------------------
-- Media & attachments
-- ---------------------------------------------------------------------------

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.media_kind not null,
  position integer not null default 0,
  caption text,
  -- Original upload, stored untouched at full quality.
  storage_path text,
  -- Optimised variants for fast page rendering (images: large + thumb,
  -- videos: thumb holds the poster frame).
  preview_path text,
  thumb_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric(8, 2),
  url text,
  created_at timestamptz not null default now(),
  constraint project_media_source check (
    (kind = 'link' and url is not null) or (kind <> 'link' and storage_path is not null)
  ),
  constraint project_media_video_length check (
    kind <> 'video' or duration_seconds is null or duration_seconds <= 300
  ),
  constraint project_media_link_scheme check (url is null or url ~* '^https?://')
);

create index project_media_project_idx on public.project_media (project_id, position);

alter table public.projects
  add constraint projects_cover_media_fk
  foreign key (cover_media_id) references public.project_media (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Views (deduplicated per anonymous visitor per day)
-- ---------------------------------------------------------------------------

create table public.project_views (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_hash text not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (project_id, visitor_hash, viewed_on)
);

create index project_views_recent_idx on public.project_views (viewed_on, project_id);

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------

create table public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 of the session token; the raw token only lives in an httpOnly cookie.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text
);

create index admin_sessions_expiry_idx on public.admin_sessions (expires_at);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_created_idx on public.activity_logs (created_at desc);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lock down the public API surface
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.students enable row level security;
alter table public.projects enable row level security;
alter table public.project_students enable row level security;
alter table public.project_media enable row level security;
alter table public.project_views enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke execute on all functions in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke execute on all functions in schema public from authenticated;
  end if;
end
$$;
