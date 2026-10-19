-- The competition a student project is entered for ("المسابقة التي ترغب
-- بالمشاركة فيها"), chosen on the student project form right under the
-- project field, and the competition filter of the students' Explore
-- Projects page.
--
-- The competition is its own property, separate from the project's
-- category and field (a project can be "Artificial Intelligence" and be
-- entered for SAIF). It is stored like the project field: a stable key, plus
-- the student's own text when the key is 'other':
--   saif | ibdaa | robotics | hackathons | programming | other
--
-- Additive and idempotent (safe to run more than once, and safe to paste
-- into the Supabase SQL editor on its own). Nothing is deleted or rewritten:
--  * projects gains two nullable columns. Existing projects keep NULL (no
--    competition is guessed for them); they stay visible under "All" and
--    never appear under a specific competition.
--  * A trigger makes the database refuse to submit a new project (draft →
--    submitted) without a valid competition, as the server already does.
--    Rows already stored, drafts and edits of submitted projects are not
--    affected.
-- Access model unchanged: RLS enabled, no policies for the public API roles;
-- only the server reads and writes, after checking the session.

-- ---------------------------------------------------------------------------
-- 1. The competition on the project (what the Explore Projects page filters on)
-- ---------------------------------------------------------------------------

alter table public.projects add column if not exists competition text;
alter table public.projects add column if not exists competition_other text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_competition_key') then
    alter table public.projects
      add constraint projects_competition_key
      check (competition is null or competition in ('saif', 'ibdaa', 'robotics', 'hackathons', 'programming', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_competition_other') then
    -- The student's own competition name: only with 'other', never empty, at most 80 characters.
    alter table public.projects
      add constraint projects_competition_other
      check (
        competition_other is null
        or (competition = 'other' and char_length(btrim(competition_other)) between 1 and 80)
      );
  end if;
end
$$;

create index if not exists projects_competition_idx on public.projects (competition) where competition is not null;

-- ---------------------------------------------------------------------------
-- 2. No new project submission without a competition
-- ---------------------------------------------------------------------------
-- The form keeps the answer in the questionnaire as targetCompetition (and
-- targetCompetitionOther for 'other'). Checked only when a draft becomes a
-- submitted project.

create or replace function public.ti_require_competition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  choice text := new.answers->>'targetCompetition';
  other text := btrim(coalesce(new.answers->>'targetCompetitionOther', ''));
begin
  if new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (
       choice is null
       or choice not in ('saif', 'ibdaa', 'robotics', 'hackathons', 'programming', 'other')
       or (choice = 'other' and char_length(other) not between 1 and 80)
     ) then
    raise exception 'competition required'
      using errcode = 'P0001', hint = 'competition_required';
  end if;
  return new;
end
$$;

revoke all on function public.ti_require_competition() from public;

-- Named to fire after project_submissions_require_profile (triggers on the
-- same event run in name order): an incomplete profile is reported first.
drop trigger if exists project_submissions_require_competition on public.project_submissions;
drop trigger if exists project_submissions_validate_competition on public.project_submissions;
create trigger project_submissions_validate_competition
  before insert or update of status on public.project_submissions
  for each row execute function public.ti_require_competition();
