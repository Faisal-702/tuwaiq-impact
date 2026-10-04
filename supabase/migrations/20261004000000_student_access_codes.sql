-- Student access codes: students sign in to the platform with a personal
-- 8-digit code issued by the school (replaces unrestricted guest access).
--
-- Additive and idempotent: creates new tables only; the existing `students`
-- table and all existing data are left untouched.
--
-- Access model (same as the rest of the schema):
--  * Codes are generated, read and validated only by server code using the
--    privileged database connection (admin pages behind the admin session,
--    and the server-side student login).
--  * Row Level Security is enabled with NO policies for the public API roles,
--    and their grants are revoked: the Supabase anon/authenticated keys can
--    neither read nor write these tables.

-- One active code per student. Kept in its own table so student queries can
-- never select codes by accident.
create table if not exists public.student_access_codes (
  student_id uuid primary key references public.students (id) on delete cascade,
  code text not null unique check (code ~ '^[0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Student sessions (separate from admin_sessions). Only the SHA-256 of the
-- session token is stored; the raw token lives in an httpOnly cookie.
create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text
);

create index if not exists student_sessions_student_idx on public.student_sessions (student_id);
create index if not exists student_sessions_expiry_idx on public.student_sessions (expires_at);

-- Failed student-code attempts, keyed by a salted hash of the client address
-- (no raw IPs stored). Used to slow down guessing.
create table if not exists public.student_login_attempts (
  id bigint generated always as identity primary key,
  client_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_login_attempts_client_idx
  on public.student_login_attempts (client_hash, created_at desc);

alter table public.student_access_codes enable row level security;
alter table public.student_sessions enable row level security;
alter table public.student_login_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.student_access_codes, public.student_sessions, public.student_login_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.student_access_codes, public.student_sessions, public.student_login_attempts from authenticated;
  end if;
end
$$;
