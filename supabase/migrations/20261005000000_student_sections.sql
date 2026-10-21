-- Student sections ("الشعبة"): 1, 2 or 3 within a grade.
--
-- Additive and safe for existing data:
--  * a nullable column, so existing students simply have no section (shown
--    as "not set" until an admin edits them); no row is rewritten or touched;
--  * student codes, sessions and all other tables are unaffected.
-- Access model unchanged: RLS stays enabled on students with no public policies.

alter table public.students add column if not exists section smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'students_section_check' and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_section_check check (section is null or section between 1 and 3);
  end if;
end
$$;
