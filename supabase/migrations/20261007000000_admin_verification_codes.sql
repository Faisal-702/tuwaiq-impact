-- Second sign-in step for administrators: a personal 8-digit verification code.
--
-- Additive and safe for existing data (two new tables, nothing altered):
--  * admin_verification_codes keeps one code per Supabase Auth user, stored
--    only as a salted scrypt hash (never the code itself);
--  * admin_login_challenges holds the short-lived state between the
--    email + password step and the code step (token stored as SHA-256 hash).
-- Access model unchanged: RLS enabled, no public policies, grants revoked.

create table if not exists public.admin_verification_codes (
  auth_user_id uuid primary key,
  email text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_login_challenges (
  token_hash text primary key,
  auth_user_id uuid not null,
  email text not null,
  purpose text not null check (purpose in ('verify', 'setup')),
  failures int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_challenges_expires_idx
  on public.admin_login_challenges (expires_at);

alter table public.admin_verification_codes enable row level security;
alter table public.admin_login_challenges enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.admin_verification_codes from anon;
    revoke all on table public.admin_login_challenges from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.admin_verification_codes from authenticated;
    revoke all on table public.admin_login_challenges from authenticated;
  end if;
end
$$;
