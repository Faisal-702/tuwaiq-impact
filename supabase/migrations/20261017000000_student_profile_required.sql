-- Student profile (الملف الشخصي) as its own page, required before adding a
-- project.
--
-- Personal details (full name, national ID, mobile, email, grade, section)
-- are no longer asked in the project form: the student keeps them once in
-- student_profiles. A student whose profile is incomplete can not start or
-- submit a new project. The server checks this first; this migration makes
-- the database refuse it too, so the rule can not be bypassed.
--
-- Requires 20261016000000_student_projects.sql (student_profiles).
--
-- Additive and idempotent (safe to run more than once, and safe to paste
-- into the Supabase SQL editor on its own). Nothing is deleted. Existing
-- projects, submissions and drafts are kept as they are; editing an
-- existing project is not affected.

-- ---------------------------------------------------------------------------
-- 1. Completeness, computed by the database
-- ---------------------------------------------------------------------------
-- Every field is required. Their formats are already checked by the
-- table's constraints (10-digit national ID, 05XXXXXXXX mobile, ...).

alter table public.student_profiles
  add column if not exists is_complete boolean generated always as (
    full_name is not null and btrim(full_name) <> ''
    and national_id is not null
    and phone is not null
    and email is not null
    and grade is not null
    and section is not null
  ) stored;

-- ---------------------------------------------------------------------------
-- 2. Profiles for students who already submitted a project
-- ---------------------------------------------------------------------------
-- Their details are in their own latest submitted questionnaire (matched by
-- the student id, never by name). Only values that pass the table's checks
-- are copied, and only into fields that are still empty, so nothing a
-- student saved is overwritten. Students left with an incomplete profile
-- simply complete it on the profile page.

insert into public.student_profiles as sp (student_id, full_name, national_id, phone, email, grade, section)
select student_id,
       case when char_length(name) between 1 and 120 then name end,
       case when national_id ~ '^[12][0-9]{9}$' then national_id end,
       case when phone ~ '^05[0-9]{8}$' then phone end,
       case when char_length(email) between 5 and 254 and position('@' in email) > 1 then email end,
       case when grade in ('10', '11', '12') then grade::smallint end,
       case when section in ('1', '2', '3') then section::smallint end
  from (
    select distinct on (ps.student_id)
           ps.student_id,
           btrim(regexp_replace(coalesce(ps.answers->>'studentName', ''), '\s+', ' ', 'g')) as name,
           btrim(coalesce(ps.answers->>'nationalId', '')) as national_id,
           btrim(coalesce(ps.answers->>'phone', '')) as phone,
           lower(btrim(coalesce(ps.answers->>'email', ''))) as email,
           btrim(coalesce(ps.answers->>'grade', '')) as grade,
           btrim(coalesce(ps.answers->>'section', '')) as section
      from public.project_submissions ps
      join public.students s on s.id = ps.student_id
     where ps.status = 'submitted'
     order by ps.student_id, ps.submitted_at desc nulls last, ps.created_at desc
  ) latest
on conflict (student_id) do update set
  full_name = coalesce(sp.full_name, excluded.full_name),
  national_id = coalesce(sp.national_id, excluded.national_id),
  phone = coalesce(sp.phone, excluded.phone),
  email = coalesce(sp.email, excluded.email),
  grade = coalesce(sp.grade, excluded.grade),
  section = coalesce(sp.section, excluded.section)
where sp.full_name is null or sp.national_id is null or sp.phone is null
   or sp.email is null or sp.grade is null or sp.section is null;

-- ---------------------------------------------------------------------------
-- 3. No new project without a complete profile
-- ---------------------------------------------------------------------------
-- Refuses a new draft and the submission of a draft (draft → submitted) for
-- a student whose profile is incomplete. Rows already stored, edits of
-- submitted projects ('editing') and projects created by administrators
-- (which have no submission) are not affected.

create or replace function public.ti_require_complete_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.student_id is not null
     and new.status in ('draft', 'submitted')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not exists (
       select 1 from public.student_profiles p
        where p.student_id = new.student_id and p.is_complete
     ) then
    raise exception 'student profile incomplete'
      using errcode = 'P0001', hint = 'profile_incomplete';
  end if;
  return new;
end
$$;

revoke all on function public.ti_require_complete_profile() from public;

drop trigger if exists project_submissions_require_profile on public.project_submissions;
create trigger project_submissions_require_profile
  before insert or update of status on public.project_submissions
  for each row execute function public.ti_require_complete_profile();
