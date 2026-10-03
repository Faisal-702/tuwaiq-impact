-- Suggestions submitted by visitors through the public "Suggestions" form.
--
-- Additive and idempotent: creates a new table only; no existing table or
-- data is touched.
--
-- Access model (same as the rest of the schema):
--  * Visitors submit through a validated server action that inserts with the
--    server's privileged connection.
--  * Row Level Security is enabled with NO policies for the public API roles,
--    and their grants are revoked: the Supabase anon/authenticated keys can
--    neither read nor write this table directly (no public SELECT, no direct
--    inserts that would bypass server-side validation).
--  * Only the admin dashboard (server-side, admin session required) reads it.

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  -- Same internal grade convention as students/projects (10 / 11 / 12).
  grade smallint not null check (grade in (10, 11, 12)),
  suggestion text not null check (char_length(trim(suggestion)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists suggestions_created_idx on public.suggestions (created_at desc);

alter table public.suggestions enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.suggestions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.suggestions from authenticated;
  end if;
end
$$;
