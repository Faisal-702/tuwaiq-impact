-- Student project submissions (the "إضافة مشروع" questionnaire).
--
-- Additive and backward compatible:
--  * projects gains four nullable public columns shown on the discovery
--    cards: the student's 300-character summary, the requested amount (SAR)
--    and the selected project field (plus free text when "other"). Existing
--    rows keep NULL and render as before.
--  * project_submissions keeps every questionnaire answer, including private
--    identity data (national ID, phone, email), drafts and the list of
--    private supporting files. Public queries never read this table.
--  * A private storage bucket holds supporting files (Supabase only).
-- Access model unchanged: RLS enabled, no public policies, grants revoked.

alter table public.projects add column if not exists summary text;
alter table public.projects add column if not exists requested_amount numeric(12, 2);
alter table public.projects add column if not exists field text;
alter table public.projects add column if not exists field_other text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_summary_length') then
    alter table public.projects
      add constraint projects_summary_length check (summary is null or char_length(summary) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_requested_amount_range') then
    alter table public.projects
      add constraint projects_requested_amount_range
      check (requested_amount is null or requested_amount between 0 and 10000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_field_lengths') then
    alter table public.projects
      add constraint projects_field_lengths
      check ((field is null or char_length(field) <= 40) and (field_other is null or char_length(field_other) <= 80));
  end if;
end
$$;

create index if not exists projects_field_idx on public.projects (field);

create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  -- The signed-in student who owns the submission (from the student session).
  student_id uuid references public.students (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  -- All questionnaire answers (private). Validated by the application.
  answers jsonb not null default '{}'::jsonb,
  -- Public cover image (public media bucket); copied to project_media on submit.
  cover jsonb,
  -- Private supporting files: [{ path, name, mime, size, kind }].
  evidence jsonb not null default '[]'::jsonb,
  project_id uuid references public.projects (id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_submissions_submitted_at check (status <> 'submitted' or submitted_at is not null),
  constraint project_submissions_evidence_array check (jsonb_typeof(evidence) = 'array')
);

-- One open draft per student.
create unique index if not exists project_submissions_one_draft
  on public.project_submissions (student_id) where status = 'draft';
create index if not exists project_submissions_student_idx
  on public.project_submissions (student_id, created_at desc);
create index if not exists project_submissions_project_idx
  on public.project_submissions (project_id);

drop trigger if exists project_submissions_touch on public.project_submissions;
create trigger project_submissions_touch before update on public.project_submissions
  for each row execute function public.ti_touch_updated_at();

alter table public.project_submissions enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.project_submissions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.project_submissions from authenticated;
  end if;
end
$$;

-- Private bucket for supporting files (images, videos, documents). Not
-- public: files are only reachable through short-lived signed URLs that the
-- server issues to administrators. 50 MB per file; types are restricted.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'project-submissions',
      'project-submissions',
      false,
      52428800,
      array[
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
