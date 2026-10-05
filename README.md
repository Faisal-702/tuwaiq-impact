# Tuwaiq Impact | أثر طويق

Official platform of **Technical Talented High School** (ثانوية الموهوبين التقنية) for showcasing student projects, achievements and innovation.

English is the default language; Arabic is fully supported with right-to-left layout.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS 4 (design tokens in `src/app/globals.css`) |
| Motion | `motion` (Framer Motion) — restrained fades and reveals; honours *reduced motion* |
| Database | Supabase PostgreSQL, accessed **server-side only** via `postgres` |
| Media | Supabase Storage, with direct-to-storage signed uploads |
| UI primitives | Radix UI (dialogs, menus, tabs, switch), lucide icons, sonner toasts |
| Fonts | Inter + IBM Plex Sans Arabic (self-hosted via Fontsource) |

## Getting started

```bash
cp .env.example .env.local      # then fill in the values
npm install
npm run db:migrate              # applies supabase/migrations/*.sql
npm run dev
```

Open http://localhost:3000. Every visit starts at the entry page (`/welcome`), which has two modes: **Student Login** (the default; students enter their personal 8-digit code) and **Admin Access**. There is no guest access. The platform homepage is at `/home`; `/` always redirects to `/welcome`.

To let students in, sign in as admin and open **Admin → Student Codes**. Generate a code for each student, or click **Generate Codes for All**, then print the sheet with **Print Codes**.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string. On serverless hosts, use the **transaction pooler** (port 6543). |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key, used server-side to verify administrator email + password with Supabase Auth (falls back to `SUPABASE_SERVICE_ROLE_KEY`). Requires `SUPABASE_URL`. |
| `ADMIN_EMAILS` | Optional comma-separated allowlist of administrator emails. When empty, any user in the project's Supabase Auth can sign in to the dashboard. |
| `SESSION_SECRET` | Long random string (`openssl rand -hex 32`) used to sign upload URLs and anonymise view counts. |
| `STORAGE_DRIVER` | `supabase` (production) or `local` (development only — stores files in `.data/uploads`). |
| `SUPABASE_URL` | Your project URL, e.g. `https://xyz.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key. Used only on the server for issuing signed upload URLs and deleting media. |
| `SUPABASE_STORAGE_BUCKET` | Defaults to `project-media` (created by the storage migration). |

No variable is prefixed with `NEXT_PUBLIC_`, so none of them reach browser code.

## Deploying with Supabase

1. Create a Supabase project.
2. Apply the migrations: either `DATABASE_URL=… npm run db:migrate` (direct connection, port 5432) or `supabase db push`. This creates the schema, the initial categories and the `project-media` storage bucket.
3. Configure the environment variables on your host (e.g. Vercel) and deploy.
4. **Upload size:** the Supabase Free plan caps each file at 50 MB. Original 4K videos (up to 5 minutes) need a paid plan with a raised *global file size limit* (Storage → Settings).

## Architecture notes

### Security

- **Admin access**: administrators sign in with the **email and password of a user registered in Supabase** (Authentication → Users).
  - The password is checked on the server against Supabase Auth (password grant). The temporary Supabase session is revoked right away, and the dashboard uses its own httpOnly session (below). No Supabase token or key reaches the browser.
  - Errors are generic ("Incorrect email or password."). After 10 failures within 15 minutes from one client (salted hash of its address in `admin_login_attempts`), sign-in pauses for that client.
  - To add, remove or reset an administrator, use Supabase → Authentication → Users. **Disable public sign-ups** there (Authentication → Sign In / Providers → "Allow new users to sign up"), or set `ADMIN_EMAILS`, so that nobody can create their own account.
- **Sessions**: on success, a random 256-bit token is created. Only its SHA-256 hash is stored, in `admin_sessions`. The browser holds the token in an `httpOnly`, `SameSite=Lax` **browser-session cookie** (`Secure` in production), so closing the browser ends the admin session and the code must be entered again.
  - Server-side, a session also ends after 2 hours without activity, or 12 hours at most.
  - **Sign out** revokes the session, clears the session cookies, and returns to `/welcome`. One role per browser: a student login ends any admin session there, and vice versa.
  - Sessions can be revoked for everyone from **Settings → Sign out all sessions**.
  - A previous login never skips the entry page: `/` and `/welcome` always show the entry page.
  - Note: browsers set to restore the previous session on startup (e.g. Chrome's "Continue where you left off") also restore session cookies; the 2-hour idle limit still applies.
- **Route protection**:
  - `src/proxy.ts` redirects early when the session cookie is missing.
  - The admin layout re-verifies the session against the database (`requireAdmin()`).
  - **Every server action** independently calls `requireAdmin()`, so hiding UI is never the only protection.
- **Database**: all queries run on the server. Row Level Security is enabled on every table with **no** policies for the `anon` / `authenticated` roles, and their grants are revoked. The public Supabase API therefore cannot read or write any table.
- **Student access codes**:
  - Each student can have one active code: 8 random digits from a cryptographically secure generator, unique across students and enforced by a unique constraint (collisions are retried).
  - Codes live in their own table (`student_access_codes`), never in `students`. They are only read by admin-only server code (Admin → Student Codes). They never appear in student-facing pages, client bundles, URLs, cookies or the activity log.
  - Student login is validated on the server only, with generic errors ("Incorrect student code."). Failed attempts are recorded per client (salted hash of the address). After 10 failures within 15 minutes, that client's logins are paused, even with a valid code.
  - A successful login creates a student session, stored like admin sessions: a token hash in `student_sessions`, held in an httpOnly browser-session cookie `ti_student_sid`. Limits are 2 hours idle and 12 hours at most.
  - Regenerating or removing a code immediately invalidates the old code and ends that student's sessions.
  - Students never get admin rights. Admin pages and actions keep requiring the admin session.
- **Student-facing routes** (`/home`, `/projects`, `/students`, `/leaderboard`, `/about`, `/present`, detail pages):
  - the proxy redirects to `/welcome` when no session cookie is present
  - every page also verifies the student or admin session against the database (`requireViewer()`)
  - so do the search and view-counter APIs and the suggestion action
- **Suggestions**: signed-in students submit through a server action that validates the input (zod, also enforced by table `check` constraints), drops honeypot submissions and rate-limits each visitor (best-effort, per server instance). The `suggestions` table has no public policies or grants, so submissions can only be read on the admin **Suggestions** page.
- **Uploads**: the server validates MIME type, size and video length, then issues short-lived signed upload URLs for unguessable paths (`media/<yyyy>/<mm>/<uuid>/…`). SVG and HTML uploads are not accepted.
- **User content** is rendered as plain text (never as HTML). External links accept only `http(s)` and open with `rel="noopener noreferrer"`.
- Redirect targets after sign-in are restricted to same-site relative paths.

### Media pipeline

- Originals are uploaded **untouched**, at full quality (including 4K images and videos).
- The browser generates optimised WebP variants before upload:
  - `large` (≤ 2560 px) for the gallery and lightbox
  - `thumb` (≤ 800 px) for cards
  - a poster frame for each video
- Pages load only these variants; the lightbox offers **Open original**.
- Video duration is read client-side; uploads longer than 5 minutes are rejected. The database also enforces the limit.
- Videos never autoplay. The custom player supports play/pause, timeline, volume and full screen. If a browser can't play a format, the player offers a download instead.

### Data model (`supabase/migrations`)

`categories`, `students`, `projects`, `project_students` (group projects), `project_media` (images, video, documents, links), `project_views` (anonymous, deduplicated per visitor per day), `admin_sessions`, `activity_logs`, `settings`, `suggestions` (student suggestions: name, grade 10/11/12, text up to 500 characters), `student_access_codes` (one 8-digit code per student), `student_sessions`, `student_login_attempts`.
- Students have an optional `section` (الشعبة: 1, 2 or 3; empty = not set). **Students → Add students in bulk** creates many students at once (one name per line, same grade and section for all) in a single transaction: blank lines are ignored, repeated lines count once, and names already in that grade and section are skipped.

- Projects use **soft delete** (`deleted_at`) → **Trash** → restore, or delete permanently (which also removes the stored media).
- Default project points are `10`, configurable in **Settings** and per project.

### Homepage statistics

All four figures come from published projects in the database:

| Statistic | What it counts |
| --- | --- |
| Projects | Published entries in *project*-type categories |
| Participating Students | Distinct students in published entries |
| Awards | Published entries with an award recorded |
| Activities | Published entries in *activity*-type categories (e.g. Volunteering, National Day) |

Administrators choose each category's type.

### Search

Search covers student names (English and Arabic), project titles, categories (including keyword aliases such as `ai`) and grade.

- Latin terms match at word starts. One- and two-letter terms must match whole words, so `AI` finds Artificial Intelligence but not *Air* or *Faisal*.
- Arabic text is normalised: أ/إ/آ → ا, ة → ه, ى → ي, and diacritics are stripped.

## Development / demo data

`npm run demo:seed` inserts clearly labelled **demo** records ("Demo Student A", "Demo: …", "Sample award (demo data)") with generated placeholder media. Every demo row is flagged `is_demo = true`.

Remove them before launch with either:
- `npm run demo:purge`, or
- **Admin → Settings → Remove demo data**.

## Verification

```bash
npm run lint && npm run typecheck && npm run build
# Functional end-to-end checks against a running server (dev or `next start`):
BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… QA_IMAGE=/path/to/large.jpg npm run test:e2e
```

`tests/e2e/verify.mjs` walks through the full functional checklist in a real browser. It covers:

- entry, student and admin flows, and admin-route protection
- English/Arabic and RTL
- search, filters and sorting
- gallery, video player and PDF preview
- creating students, categories and projects with uploads
- draft, preview, publish and featured states
- points and leaderboard, trash, restore and permanent delete
- activity log, mobile navigation and Presentation Mode

It fails on any console or hydration error. Records it creates are prefixed with `QA`.

`npm run test:session` (same `BASE_URL` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` variables) checks the entry and session rules:
- `/` → `/welcome`, student login, admin login, and direct `/admin` without a session
- logout, and closing and reopening the browser
- returning after a previous admin login

`npm run test:suggestions` (same variables; reads `DATABASE_URL` from `.env.local` when present) checks the Suggestions feature:
- the nav item and form in English and Arabic, on desktop and mobile
- required fields, the grade dropdown and the 500-character limit
- server-side rejection of invalid payloads, and the rate limit
- stored rows, RLS and grants on the table
- the admin page, its sidebar position, and that students cannot open it

It removes only the rows it created.

`npm run test:student-codes` (same `BASE_URL` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` variables; uses the demo students and changes their codes) checks:
- the Student Login page (English and Arabic)
- valid and invalid codes, throttling of repeated failures, and Arabic-Indic digits
- redirects of every student-facing route without a session, including old guest and forged cookies
- the student session cookie, sign-out and token revocation
- that students cannot open admin pages or run admin actions
- generate, regenerate (old code stops working, new code works), remove and bulk generation (existing codes are never overwritten)
- unique 8-digit codes, search and filters
- the print sheet grouped first → second → third secondary year

`npm run test:student-sections` (same variables; reads `DATABASE_URL` from `.env.local` when present) checks:
- the section field on add/edit
- bulk add: blank lines, duplicates, re-submitting the same list, and 120 names at once
- the Section column and filter on Student Codes, combined with the other filters
- print grouping by grade and section, which follows the active filters

It removes only the students it created.

`npm run test:admin-login` checks the administrator sign-in:
- the email and password fields in English and Arabic
- generic errors for wrong passwords and unknown emails
- a successful sign-in with no Supabase token in the browser
- throttling of repeated failures

All suites sign in as administrator with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Without a Supabase project, run `npm run mock:supabase-auth` and start the app against it:

```bash
SUPABASE_URL=http://127.0.0.1:54399 SUPABASE_ANON_KEY=mock-anon-key npm run dev
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Tuwaiq-Admin-2026 MOCK_AUTH_URL=http://127.0.0.1:54399 npm run test:admin-login
```

The other end-to-end suites sign in as a demo student through the same flow (`tests/e2e/lib/student.mjs`), so they also need `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Project structure

```
src/
  app/(site)/        public pages (home, projects, students, leaderboard, about)
  app/welcome/       entry page + sign-in server actions
  app/admin/         administrator dashboard (server-guarded)
  app/present/       Presentation Mode
  app/api/, media/   search, view tracking, local upload/media routes
  components/        UI, brand, home, projects, admin, presentation
  i18n/              EN/AR dictionaries, server + client helpers
  server/            db, auth, storage drivers, queries, server actions
supabase/migrations/ schema, seed categories, storage bucket
scripts/             migrate, demo seed/purge (+ demo assets)
docs/references/     the supplied visual references
```

## Brand assets

- `public/brand/moe-logo.png` and `public/brand/tuwaiq-academy-logo.png` are the supplied official logos. Only their transparent margins were trimmed; the logos are otherwise unaltered and are always displayed at their native aspect ratio. The original files are in `docs/references/`.
- `public/images/hero-students.webp` is the supplied homepage artwork, unmodified.
- `public/images/entry-scene-*.webp` are the side scenes of the supplied login reference (building and Riyadh skyline). The baked-in card, logos and language pill were removed so the live UI can sit on top.
- The site header shows the Ministry of Education logo with the school's name as text in a soft pill (`src/components/brand/school-brand.tsx`); there is no second logo.
- Homepage **Our Partners / شركاؤنا** cards (`src/components/home/partners.tsx`): Tuwaiq Academy uses its official logo. Abdul Latif Jameel, SDAIA and ETEC show a neutral monogram placeholder until their official logos are added. Each card's arrow opens the partner's official website. To add one, place the file in `public/brand/partners/`, import it in `partners.tsx` and set it as that partner's `logo` (set `logoHasName: true` if the artwork already includes the name).
