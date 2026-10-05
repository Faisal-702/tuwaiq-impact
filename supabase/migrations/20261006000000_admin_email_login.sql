-- Administrator sign-in with email + password (Supabase Auth users).
--
-- Additive and safe for existing data:
--  * admin_sessions gains two nullable columns recording which Supabase Auth
--    user opened the session (existing sessions keep NULL);
--  * a new table records failed administrator sign-in attempts, keyed by a
--    salted hash of the client address (no raw IPs stored), to slow down
--    password guessing.
-- Access model unchanged: RLS enabled, no public policies, grants revoked.

alter table public.admin_sessions add column if not exists auth_user_id uuid;
alter table public.admin_sessions add column if not exists email text;

create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  client_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_client_idx
  on public.admin_login_attempts (client_hash, created_at desc);

alter table public.admin_login_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.admin_login_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.admin_login_attempts from authenticated;
  end if;
end
$$;
