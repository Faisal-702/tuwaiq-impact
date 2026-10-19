# Athar Platform | منصة أثر

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
| `SUPABASE_PRIVATE_BUCKET` | Private bucket for students' supporting files. Defaults to `project-submissions` (created by the submissions migration). |

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
- **Verification code (second step)**: after a correct password, the administrator enters a personal **8-digit verification code**. No dashboard session exists until the code is accepted.
  - On an administrator's first sign-in (no code yet), this step asks them to create the code (entered twice). Codes made of one repeated digit or consecutive digits (`11111111`, `12345678`, `98765432`) are refused.
  - Codes are stored only as salted scrypt hashes (`admin_verification_codes`). The state between the two steps is a random token in an `httpOnly` cookie (`ti_admin_challenge`), stored as a SHA-256 hash in `admin_login_challenges` and valid for 10 minutes.
  - After 5 wrong codes, the password must be entered again. Wrong codes also count towards the per-client limit (10 per 15 minutes), and towards a per-account limit (10 per 15 minutes across all clients).
  - **Settings → Verification codes**: each administrator can change their own code (the current code is required) and reset another administrator's code, so that the other administrator creates a new code at their next sign-in.
  - If the only administrator forgets their code, remove it in the Supabase SQL editor; a new code is then created at the next sign-in: `delete from admin_verification_codes where email = 'name@example.com';`
- **Sessions**: on success, a random 256-bit token is created. Only its SHA-256 hash is stored, in `admin_sessions`. The browser holds the token in an `httpOnly`, `SameSite=Lax` **browser-session cookie** (`Secure` in production), so closing the browser ends the admin session and the password and verification code must be entered again.
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
- **Partnership applications**: anyone can apply at `/partners` without signing in. The server action validates every answer again (Saudi mobile, email, required organisation fields, allowed options, lengths; also table `check` constraints). It drops honeypot submissions and stores a retried or double-clicked application once (per-form token, plus same email and proposal within a day). It accepts at most 5 applications per network address per hour and 3 per email address per day (counted in the database; the address is kept only as a salted hash). Answers are never written to the logs. The `partner_applications` table has RLS enabled and the `anon`/`authenticated` grants revoked: the public cannot list or read applications, and only the admin **Partners** page (admin session re-checked in every query) shows them.
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

`categories`, `students`, `projects` (with the public `summary`, `requested_amount`, `field` and `field_other` from submissions), `project_students` (group projects), `project_media` (images, video, documents, links), `project_views` (anonymous, deduplicated per visitor per day), `admin_sessions`, `activity_logs`, `settings`, `suggestions` (student suggestions: name, grade 10/11/12, text up to 500 characters), `student_access_codes` (one 8-digit code per student), `student_sessions`, `student_login_attempts`, `project_submissions` (student questionnaires, drafts and pending edits, private), `partner_applications` (partnership requests from the public form, private), `student_profiles` (a student's saved personal details, private), `project_support_entries` (manually recorded support, with reversals), `student_project_activity` (a student's own history). `projects.supervisors` holds every supervisor / teacher a student entered, in order (private: never read by public pages).
- Students have an optional `section` (الشعبة: 1, 2 or 3; empty = not set). **Students → Add students in bulk** creates many students at once (one name per line, same grade and section for all) in a single transaction: blank lines are ignored, repeated lines count once, and names already in that grade and section are skipped.

- Projects use **soft delete** (`deleted_at`) → **Trash** → restore, or delete permanently (which also removes the stored media).
- Default project points are `10`, configurable in **Settings** and per project.

### Project submissions (إضافة مشروع)

Signed-in students add their own projects at `/add-project` (the homepage's primary button). It needs a complete **student profile** (see *Student profile* below). The form has three sections — project details, classification & budget, attachments & acknowledgment — split into short screens (at most five questions each). Personal details are not asked: they come from the profile.

- **Drafts.** Answers autosave a few seconds after typing, on every step change, and on **Save as draft**. One open draft per student, tied to the student session (never to a submitted ID). **Cancel** deletes the draft and its files. Opening the page never writes anything.
- **Validation** runs in the browser for each screen and again on the server at submit: required answers, amounts in SAR (no negatives, up to 2 decimals), and the 300-character **project summary** (also a database constraint).
- **Competition** («المسابقة التي ترغب بالمشاركة فيها», right under «مجال المشروع»): required at submit. The choices are SAIF, Ibdaa, Robotics, Hackathons, Programming Competitions and Other; **Other** asks for the competition's name (required, at most 80 characters, trimmed). Keys are stored as `saif | ibdaa | robotics | hackathons | programming | other` in the questionnaire (`targetCompetition`, `targetCompetitionOther`) and on the project (`projects.competition`, `projects.competition_other`). Drafts may leave it empty. A custom name is dropped when another choice is picked. The competition is separate from the project field and category. The older question «هل سبق أن شاركت بمشروعك في أي مسابقة…» (past participation) is unchanged.
- **Submitting** publishes the project immediately: title, summary, project field, competition, grade (from the profile), requested amount, cover image and the student link. **There is no approval step.** This is the existing behaviour, and it is unchanged. The student's profile details are copied into the stored questionnaire at that moment, so administrators see who submitted it. The project field maps to one of the existing categories, so category chips keep working. Points start at 0.
- **Students only create projects.** Administrators have no **Add Project** (sidebar, dashboard and suggestions buttons removed; `/admin/projects/new` leads to Manage Projects; `saveProject` refuses to create). **Manage Projects** (`/admin/projects`) lists every submitted student project, newest first, in two columns: the student's name (from their student account) and **Preview Project**. Drafts and pending edits are not listed. The preview (`/admin/projects/submissions/[id]`) is read only: it shows the project, the competition (with the custom name), the team, supervisors, requirements, previous competitions, the cover and the supporting files. It never shows the national ID, mobile or email. Administrators can still move a project to drafts or feature it from the project editor (Students → student → project).
- **Privacy.** Every answer, including national ID, mobile number, email, supervisor and supporting files, is kept in `project_submissions` (RLS on, grants revoked). Public queries never read that table. Administrators see the full form under **Edit project → Submission form**. Supporting files live in a private bucket (`project-submissions`; locally `.data/private`). They are downloaded through `/api/admin/submission-files`, which checks the admin session on every request.
- **Explore Projects** is for signed-in students only. It covers `/projects`, the project pages `/projects/[slug]` and project results from `/api/search`. A visitor is sent to `/welcome?next=…` and returns there after signing in. An administrator is sent to Manage Projects; the explore link is hidden for them and project search returns no projects. Only published projects are shown, as before; drafts and unsubmitted forms never are. The cards show only the cover, title, project field, competition, students, grade, the exact summary and the funding indicator (requested, recorded, remaining and a progress bar; see *My Projects* below). They are not links and have no payment or donation actions. Search also matches the summary and field. The filters dialog has a **Project field** filter. The **المسابقة / Competition** chips (All + the six competitions) filter on `projects.competition` and combine with search, category, the dialog filters and sorting. Older projects without a competition show no badge and appear only under All.

### Landing page and partners (الشركاء)

- **`/` is the public landing page** (no sign-in), built after the approved reference (`docs/references/landing-reference-athar.webp`; the lower sections follow the earlier `landing-reference.webp`). It has the language switch, **Partners** and **Sign in** buttons, the hero, *Why Athar Platform?*, *How does the platform work?* and *For partners*. **Sign in** opens the existing entry page (`/welcome`, unchanged). Signed-out visits to other pages still go to `/welcome`.
  - **Header** (shared with `/partners`): the official Ministry of Education logo, a hairline divider and the school's name **ثانوية الموهوبين التقنية** as text only (no Tuwaiq Academy logo in the header; it stays in the footer).
  - **Typography:** the landing page and its header use **Cairo** (self-hosted in `src/app/fonts/cairo/`, SIL Open Font License; class `font-landing`); English keeps Inter for Latin text. The rest of the platform is unchanged.
  - **The أثـ — ـر wordmark** (`src/components/brand/athar-wordmark.tsx`) is drawn as SVG paths made from Cairo's own letters. The word is split between ث and ر, with a short bar between, and a gradient runs from deep indigo to teal. It reads as «أثر» for screen readers (`role="img"`), looks the same in every browser, and stays sharp at any size. `scripts/build-athar-wordmark.py` regenerates it (Python with fonttools, brotli and uharfbuzz; not part of the build).
  - **In English the wordmark reads `Atha-r`.** It is the same kind of SVG, made from Cairo's own Latin letters at the same weight and scale; `scripts/build-athar-wordmark-en.py` regenerates it. Its ascenders and stems match the Arabic alef, and its hyphen is as thick as the Arabic bar. The gradient runs from indigo at the start of the word to teal. Both versions share one height and baseline, so switching language does not move the headline. The landing page picks the version from the language cookie on the server, so it is right on first load and after a reload, and it changes in place when the language is switched. Screen readers hear "Athar".
  - **Back to Home on the sign-in page (`/welcome`).** A link to `/` sits in the start corner: top right in Arabic («العودة للرئيسية», arrow pointing right) and top left in English ("Back to Home", arrow pointing left). The language switch stays where it was, in the opposite corner. The landing page is public, so the link works with or without a session and never redirects back to `/welcome`.
  - **Proportions on large screens (≥1280px):** the header, hero, artwork and *Why* section are sized in one proportional unit, `--lu` (one pixel of the 1672px-wide reference: `100vw / 1672`, capped at 1.2px; the `lp-*` rules in `globals.css`). So 1366, 1440, 1672 and 1920px screens all show the reference's composition, instead of the artwork growing with the window while the text stays the same size. A few small texts keep a readable minimum size. Mobile and tablet keep their own stacked layout.
  - **Hero artwork:** `public/images/landing/athar-hero-approved.webp`, the approved artwork exactly as supplied (1672×941, WebP, 235 KB; never edited, filtered or re-encoded in the repository). It replaces the earlier `landing-hero.webp`, which is no longer used.
    - **Large screens (1280px and up):** shown at the approved reference's framing, which is 0.8× its size in reference px (1338×753), from the hero's start edge and 25px above it (`.lp-hero-art`). On 1× screens the browser only ever scales it down (at most 1606px wide). It is served as the original file (`unoptimized`). On these screens the optimizer would only re-encode it at the same size (AVIF), so it would add loss and save nothing. It is preloaded only for large screens (`preload(…, { media: "(min-width: 1280px)" })`); the `<img>` itself is `loading="lazy"`, so phones never download it. Its right part fades out with a CSS mask into the light area behind the text. A light wash (`.lp-hero-wash`) softens the sky behind the header. In English (LTR) the fade starts earlier, and a soft light corner sits behind the school's logo and name, because the photo is not mirrored.
    - **Smaller screens:** the card under the text uses the image optimizer at quality 90 with `sizes`, so a phone gets a downscaled 640–1200px copy (25–61 KB) instead of the full file.
    - **High-DPI screens:** on 2× screens at 1672px the photo is enlarged about 1.6×, because the source is 1672px wide. For full sharpness there, replace the file with a ≥2676px-wide export of the same artwork. Nothing else needs to change.
  - The colours are the reference's, sampled into the theme (`indigo`, `indigo-ink`, `navy`, `copy`). The *For partners* section uses the same palette as the upper sections: an indigo button and purple, light-blue and mint icons, with no dark green.
- **`/partners`** is the public partnership application. It has a visible **العودة للرئيسية** link, and the logos also lead home. The form has four sections:
  - **A, applicant:** partner type, full name. Organizations also give the organization name, the representative's position and the organization type, plus *specify* when it is "Other".
  - **B, contact:** email, Saudi mobile number, city.
  - **C, partnership:**
    - type of support and fields of interest, each a dropdown multi-select with the choices shown inside the field (the fields list is searchable); "Other" asks for words
    - how they would like to contribute
  - **D, declaration:** the declaration checkbox.

  Errors are announced and linked to their fields, and the first one gets the focus.
- **Admin → Partners** (directly below *Student Codes*) follows `docs/references/partners-admin-reference.webp`. It lists the applications newest first. It has filters (period, partnership type, organization type) and search (name, organization, email), with pages of 10, 20 or 50. **View** (`/admin/partners/[id]`) shows every answer, including the "Other" texts, the submission and consent times, and copy, email and call actions. There are no statuses and no approval workflow.

**Database migrations.** The feature needs two migrations, applied in order:
- `supabase/migrations/20261014000000_partner_applications.sql` creates the table with its indexes, enables RLS and revokes the public grants.
- `supabase/migrations/20261015000000_partner_applications_details.sql` adds the three "Other" text columns and the approved list of fields of interest. It keeps the first list's values allowed and adds the new "other" rule as `NOT VALID`, so rows stored earlier stay valid.

Both are additive and idempotent, and neither touches other tables or existing data. Review them, then apply them yourself: `DATABASE_URL=… npm run db:migrate` (applies only migrations not yet recorded in `_ti_migrations`), or paste the files, in order, into the Supabase SQL editor. Until they are applied, submitting the form shows a generic error and the admin Partners page fails to load; every other page keeps working.

### My Projects (مشاريعي)

Signed-in students manage their own projects at `/my-projects`, built after the approved reference. The account menu (top corner) shows the student's name, **مشاريعي** and **تسجيل الخروج**; the mobile menu has the same link.

- **Ownership.** A student owns a project when their submitted questionnaire (`project_submissions`, written with the student session's id) points at it and the project is not in the Trash. Ownership is never inferred from names. Projects that only an administrator linked to a student (Admin → Edit project → Students) have no questionnaire, so they stay admin-managed and are not listed here.
- **Page.** It has the header with **إضافة مشروع جديد** (the existing form) and four statistics (projects, total remaining, distinct supervisors, last change). It has search, a field filter, a project-type filter (from the questionnaire) and sorting. Each project card shows the cover, title, field, summary, supervisors, the funding figures and bar, and the actions **عرض التفاصيل**, **تعديل المشروع** and **إضافة رصيد**. The sidebar shows the support summary (donut), the latest activity and notices taken from the student's data (pending edits, a hidden project, a fully supported project, a project not updated for 60 days). Every figure comes from the database; nothing is invented.
- **Editing** reuses the project form, pre-filled with the current published values, supervisors, amount, cover and files. Changes autosave to a separate *edit draft* (`status = 'editing'`, one per student and project), so the public project does not change until **Save changes**. Saving updates the same project row (same id and link), keeps the support history, and records which fields changed. The requested amount can not go below the support already recorded. **Cancel** discards the edit draft only. There is no approval step: projects publish at once, as before.
- **Add support (إضافة رصيد)** records support the student received *outside* the platform. It is not a payment and no money moves. Rules:
  - amounts are SAR, more than 0, at most 2 decimals, and at most the remaining amount
  - each entry is checked and summed under a row lock on the project, so parallel requests can never go past the target
  - the dialog's token makes a double click or a retried request count once
  - a mistaken entry is **reversed** with a reason, not deleted: it stays in the history, struck through, and every reversal is logged
  - administrators see all entries, reversals included, under **Edit project → Recorded support**
- **Funding figures** use one helper (`src/lib/funding.ts`) everywhere: My Projects, Explore Projects cards and the project page.
  - *remaining* = max(0, requested − recorded)
  - *percent* = min(100, recorded ÷ requested × 100)
  - *recorded* = the sum of entries that were not reversed
- **Profile.** Personal details are kept on the separate profile page (see *Student profile* below). While the profile is incomplete, the notices show **أكمل ملفك الشخصي** first.
- **Several supervisors.** The question reads **اسم المشرف / المعلم**; **+ إضافة مشرف / معلم آخر** adds more inputs (each removable), up to 20. They are stored in order in `projects.supervisors` and shown on the student's own cards and edit form, and to administrators in the submission form. Like before, they stay **private**: public pages show only the supervisor an administrator sets in the project editor. Older projects with one supervisor keep working.

### Student profile (الملف الشخصي)

Each student keeps their personal details once, on **`/profile`** (account menu → **الملف الشخصي**, also in the mobile menu): full name, national ID / Iqama, mobile number, email, grade and section. All six are required.

- **Status.** The page shows whether the profile is **مكتمل** (complete) or **غير مكتمل** (incomplete), how many fields are done, and which required fields are missing. Completeness is computed by the database (`student_profiles.is_complete`, a generated column), so every part of the platform uses the same rule.
- **Incomplete profile → no new project.** `/add-project`, the homepage button and My Projects' **إضافة مشروع جديد** all lead to `/profile?required=project`. That page explains **يجب استكمال بياناتك الشخصية أولًا**. After a successful save it continues to the project form. The rule is enforced at three levels:
  - **page:** the add-project page redirects before showing the form
  - **server:** every action that starts or submits a new project (saving the draft, uploads, submitting) checks the profile and returns `profile_incomplete`; the form then sends the student to the profile
  - **database:** a trigger on `project_submissions` refuses a new draft, or a draft turning into a submitted project, for a student whose profile is incomplete
- **Complete profile.** The project form has no personal questions. It shows the profile details (**تعديل الملف الشخصي** leads back) and, on the review screen, the details that will be linked.
- **Linked to the projects.** Every project a student submits is tied to their account (`project_submissions.student_id`, the profile's key). The profile details at that moment are stored with it, and the project's grade comes from the profile.
- **Saved in the database** (not in the browser): signing in on another device shows the same profile.
- **Validation** runs in the browser and again on the server: Saudi national ID with its check digit (Arabic-Indic digits accepted), Saudi mobile in any common form (stored as `05XXXXXXXX`), email (stored in lower case), grade 10/11/12, section 1–3. The table's own checks reject malformed values too.
- **Privacy.** The profile is read and saved only for the signed-in student (the session decides, never a value sent by the browser). It never appears on public pages and is never written to logs. Administrators see the details stored with each submitted project.
- **Existing data.** Existing projects, submissions and drafts are kept. Editing an existing project is not blocked by an incomplete profile, and it keeps the details stored with that project. Projects created by administrators are not affected. Students who already submitted a project get a profile filled from their own latest submission; only valid values are copied, and only into empty fields.

### Database migrations (My Projects and Student profile)

These features need two new migrations, applied **in this order**:

| File | What it does |
|---|---|
| `supabase/migrations/20261016000000_student_projects.sql` | Creates `student_profiles`, `project_support_entries` and `student_project_activity` (RLS on, public grants revoked). Adds the nullable, private `projects.supervisors`, filled from each project's existing supervisor only where it is empty (public pages never read it). Widens the `project_submissions` status check to also allow `editing`, and adds two indexes. |
| `supabase/migrations/20261017000000_student_profile_required.sql` | Adds `student_profiles.is_complete` (computed). Creates profiles for students who already submitted a project, from their own latest submission (valid values only, empty fields only). Adds the trigger that refuses a new project for an incomplete profile. |

Both are additive and idempotent (safe to run twice). They delete nothing and change no existing value: they only fill new, empty columns and create profile rows.

> **Do not run `npm run db:migrate` against production.** Some earlier migrations (the partner ones) were applied by hand, so `_ti_migrations` may not list them, and the runner would re-run old files (the first one fails on its enum types). Apply these files on their own instead.

1. **Check the prerequisites** in the Supabase SQL editor. Every row should read `true`; if one is `false`, apply the migration named next to it first, on its own:

   ```sql
   select 'projects table (20261001000000)' as needs, to_regclass('public.projects') is not null as ok
   union all select 'project_submissions (20261011000000)', to_regclass('public.project_submissions') is not null
   union all select 'projects.summary / requested_amount (20261011000000)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'requested_amount')
   union all select 'partner_applications (20261014000000)', to_regclass('public.partner_applications') is not null
   union all select 'partner "other" columns (20261015000000)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'partner_applications' and column_name = 'support_other')
   union all select 'not yet applied: student_profiles absent (20261016000000)', to_regclass('public.student_profiles') is null
   union all select 'not yet applied: is_complete absent (20261017000000)', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'is_complete');
   ```

   The partner rows only confirm the database is up to date; these migrations do not depend on them. A "not yet applied" row reads `false` when that migration was already applied, which is harmless because the files are idempotent.
2. **Apply** `20261016000000_student_projects.sql`: paste the whole file into the SQL editor and run it once.
3. **Apply** `20261017000000_student_profile_required.sql` the same way. It needs the first one.
4. **Optionally record them** so the migration runner knows about them:
   ```sql
   insert into public._ti_migrations (name) values
     ('20261016000000_student_projects.sql'), ('20261017000000_student_profile_required.sql')
   on conflict do nothing;
   ```

Apply them **before** deploying these branches. Without them, these pages fail to load or save, because they read the new tables and columns: `/my-projects`, the edit pages, **إضافة رصيد**, Explore Projects, the project pages, the profile page and the project form.

### Database migration (competitions)

`supabase/migrations/20261019000000_student_competitions.sql` adds two nullable columns to `projects`: `competition`, checked against the six keys, and `competition_other`, required with `other` (1–80 characters once trimmed) and `NULL` for every other choice. It adds a partial index, and a trigger that refuses to turn a draft into a submitted project without a valid competition. It is additive and idempotent: nothing is deleted, and existing projects keep `NULL` (no competition is guessed). Drafts, stored rows and edits of submitted projects are not affected. It needs `20261011000000_project_submissions.sql`.

1. **Check** in the Supabase SQL editor (both rows should read `true`):
   ```sql
   select 'project_submissions (20261011000000)' as needs, to_regclass('public.project_submissions') is not null as ok
   union all select 'not yet applied: projects.competition absent (20261019000000)', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'competition');
   ```
2. **Apply** the file: paste it whole into the SQL editor and run it once.
3. **Optionally record it:** `insert into public._ti_migrations (name) values ('20261019000000_student_competitions.sql') on conflict do nothing;`

Apply it **before** deploying this branch. Explore Projects, project pages and project submission read and write the new columns.

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

### Performance

Every page is rendered per request: sessions are checked in the database and data is not cached. So navigation speed mostly depends on how many sequential round trips each request makes to the database, and on the database's distance from the server.

- **One round trip per query.** With `prepare: false` (required by the transaction pooler), postgres.js sent each query with parameters in two round trips. `patches/postgres+3.4.9.patch`, applied on install by `patch-package`, sends it in one (see `patches/README.md`).
- **Session checks are reads.** `last_seen_at` is refreshed at most once a minute, so concurrent requests don't queue on a write to the same row. Layout and page queries run concurrently with the session check; nothing is rendered unless the check passes.
- **Independent queries run in parallel** (`Promise.all`), for example the overview, analytics, student profile and leaderboard pages.
- **Instant navigation.** `app/admin/loading.tsx` and `app/(site)/loading.tsx` show a light placeholder while a page's data loads. Links (`@/components/ui/link`) prefetch on hover, focus or touch, not as soon as they scroll into view. Viewport prefetching rendered every visible link's page on the server in the background, a dozen or more renders per page view.
- **No double renders after actions.** Server actions call `revalidatePath`, which already refreshes the current page, so components don't call `router.refresh()` afterwards.
- **Warm connections.** Idle database connections are kept for 4 minutes (they were closed after 20 s), so the first click after a pause doesn't reconnect, which costs TCP, TLS and authentication round trips.
- **Deployment:** run the server functions in the same region as the Supabase project (on Netlify: the functions region in the site configuration, where the plan allows it). Every round trip is paid at that distance.

**Loading indicator.** The Lottie animation in `public/lottie/loading.json` is the site's single loading indicator (`src/components/ui/loading-animation.tsx`). It plays through lottie-web's light SVG build, about 47 KB gzipped, which is loaded on demand in its own chunk and warmed up when the browser is idle. Two places show it, and both fade it in only after about 450 ms, so fast transitions never flash it:

- `loading.tsx`, through `PageLoading`, while a route's data loads.
- `NavigationLoader`, a small centered card, while a link click waits for a page that has no route loading state yet. Links report this pending phase through `useLinkStatus`.

With `prefers-reduced-motion`, a still frame is shown instead. If the animation cannot be loaded, a plain spinner replaces it. `npm run test:loading` checks all this. It simulates slow pages in the browser.

To measure locally with a simulated remote database, run `DELAY=75 npm run perf:latency-proxy` (150 ms round trip in front of the local Postgres on :6432). Start the app with `DATABASE_URL=postgresql://…@127.0.0.1:6432/…?sslmode=require`, then run `BASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… npm run perf:measure`. It reports page loads, sidebar and header navigation and a server action. With `PG_LOG` set to the Postgres log file and `log_min_duration_statement = 0`, it also reports the number of SQL statements for each.

## Development / demo data

`npm run demo:seed` inserts clearly labelled **demo** records ("Demo Student A", "Demo: …", "Sample award (demo data)") with generated placeholder media. Every demo row is flagged `is_demo = true`.

Remove them before launch with either:
- `npm run demo:purge`, or
- **Admin → Settings → Remove demo data**.

## Verification

```bash
npm run lint && npm run typecheck && npm run build
# Functional end-to-end checks against a running server (dev or `next start`):
BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… QA_IMAGE=/path/to/large.jpg npm run test:e2e
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

`npm run test:session` (same `BASE_URL` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_VERIFICATION_CODE` variables) checks the entry and session rules:
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

`npm run test:student-codes` (same `BASE_URL` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_VERIFICATION_CODE` variables; uses the demo students and changes their codes) checks:
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

`npm run test:project-submission` (same variables; reads `DATABASE_URL` from `.env.local` when present; uses *Demo Student C* and *Demo Student D*) checks the student submission form and Explore Projects:
- the hero button, every question on every screen, validation messages, Previous/Next keeping answers
- the 300-character summary and counter, conditional questions, draft save and resume, cancel
- cover and supporting-file uploads (including a rejected file type), the acknowledgment and the review screen
- the stored project and submission rows, the Explore Projects card (no links or donation actions), search, field filter, category chip and count
- that no private answer appears in any public page or RSC payload, admin-only file downloads, the admin's view of the form, and hiding the project

It removes the project and submissions it created. Set `QA_SHOTS=<dir>` to save screenshots.

`npm run test:partners` (same variables; needs `DATABASE_URL`, read from `.env.local` when present) checks the landing page and partnerships end to end:
- `/` is public and shows the logos, hero, the three sections and the CTAs. The partners button uses the brand indigo. **Sign in** opens `/welcome`, every Partners button opens `/partners`, and `/partners` leads back home. AR ⇄ EN switches in place.
- the form: accessible errors and focus, conditional organization fields, "Other" fields that appear only when chosen, the dropdown multi-selects (21 searchable fields of interest), phone and email validation, an organization and an individual stored with normalised values, a double click stored once, the honeypot and the per-address limit
- privacy: `/admin/partners` and the details page redirect when signed out, no submitted data on public pages, RLS on, no `anon`/`authenticated` access, and the database refuses "Other" without words
- admin: the sidebar item sits right below Student Codes; the row, details and copy button; search, every filter including the date picker; pagination and page size; AR ⇄ EN
- no sideways scrolling at mobile, tablet and desktop widths

Its test rows are named "QA Partner …" and are removed at the start and the end.

`npm run test:my-projects` (same variables; needs `DATABASE_URL`) checks My Projects end to end with two demo students:
- the account menu (name, مشاريعي, sign out) on desktop and mobile; the empty state
- the profile completed once (adding the first project asks for it), the same profile on another device, corrections kept. Another student never sees it.
- several supervisors added and removed, stored in order and kept off public pages; publishing with no approval step
- the list, totals, search, filters and sorting; another student's projects never listed or editable (404)
- **إضافة رصيد**:
  - invalid, zero, negative and over-target amounts refused
  - 30 SAR on 500 gives 470 remaining and 6%; then 70 more gives 100, 400 and 20%
  - a double click is stored once, and parallel requests never pass the target
  - another student can not add support
  - a reversal keeps the audit trail
  - the figures persist across sessions
- the same figures on Explore Projects and the project page
- editing:
  - the form is pre-filled
  - the amount can not go below the recorded support
  - saving keeps the same project, its support history and a single cover
  - a legacy single-supervisor project still edits
- the admin's support entries and supervisors; admin delete still works
- signed-out redirects, English (LTR), mobile and tablet without sideways scrolling, no browser errors

Its rows are named "QA MyProj …" and are removed at the start and the end (`KEEP_QA_DATA=1` keeps them for a look). Set `QA_SHOTS=<dir>` to save screenshots.

`npm run test:student-profile` (same variables; needs `DATABASE_URL`) checks the student profile end to end with two demo students:
- the account menu order (name, الملف الشخصي, مشاريعي, تسجيل الخروج) on desktop and mobile
- an incomplete profile:
  - shows the status and every missing field
  - `/add-project`, the homepage button and My Projects lead to the profile with the message, and no draft is created
- every field required and validated, with accessible errors and focus on the first one; values are normalised when saved
- enforcement:
  - the server refuses an invalid profile sent directly
  - the server refuses to save a new draft while the profile is incomplete
  - the server refuses to submit when the profile became incomplete
  - the database refuses a new draft or submission for an incomplete profile
- a complete profile:
  - the form has no personal questions
  - the submitted project is linked to the student, carries the profile details and takes its grade from the profile
  - the details never appear on the public project page
- the same profile on another device; another student never sees it
- editing an existing project still works with an incomplete profile
- signed-out redirect, administrators' notice, English (LTR), mobile and tablet without sideways scrolling, no browser errors

Its projects are named "QA Profile …"; it removes them and both students' profiles at the start and the end.

`npm run test:student-competitions` (same variables; needs `DATABASE_URL`) checks competitions, Manage Projects and students-only Explore Projects with *Demo Student E*, *F* and *G*:
- the form:
  - the competition dropdown sits right under the project field, with its six options
  - it is required, with its own message
  - **Other** reveals a required name field
  - the choice and the custom name survive Save as draft, a reload, Previous and Next; a stale custom name is dropped
- submitting stores `saif`, or `other` with the trimmed name, on the project and in the questionnaire; the database refuses a submission without a valid competition
- Manage Projects:
  - no Add Project, search, tabs or old columns, and no Add Project in the sidebar
  - exactly two columns, with one row per submitted project and the student names from their accounts; drafts are not listed
  - `/admin/projects/new` leads back to Manage Projects
- the preview shows the real submission (title, student, field, custom competition, summary, problem, tools, supervisor, cover), read only, without national ID, mobile or email
- access:
  - administrators are sent from Explore Projects and project pages to Manage Projects and get no projects from search
  - visitors are redirected to sign-in (and come back to the filtered page afterwards), and the search API returns 401
- Explore Projects:
  - All and each competition (SAIF, Ibdaa, Robotics, Hackathons, Programming Competitions, Other with the custom name)
  - combined with search and category, with the page reset on change
  - the empty state with Show all competitions
  - older projects show no badge
- English labels, mobile without sideways scrolling, no browser errors

It removes the projects, drafts and profiles it created.

`npm run test:language-switch` (same variables) checks switching between English and Arabic on the entry page, student pages and admin pages:
- text, direction, `lang` and the tab title switch in place, without reloading and without a half-switched state (also on a slow server, where the loading indicator shows)
- typed input is kept; switching five times in a row stays consistent
- navigating afterwards (including to pages prefetched in the old language), reloading and opening a new tab keep the choice

`npm run test:admin-login` checks the administrator sign-in:
- the email and password fields in English and Arabic
- generic errors for wrong passwords and unknown emails
- a successful sign-in with no Supabase token in the browser
- throttling of repeated failures
- the verification code step: no session before the code; wrong, malformed and empty codes; Arabic-Indic digits; reload; "Back to sign in"; 5 wrong codes; per-account throttling; changing the code in Settings
- with the mock (below) and `DATABASE_URL`: creating the code on a first sign-in (weak and mismatching codes refused, stored hashed) and resetting another administrator's code

All suites sign in as administrator with `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_VERIFICATION_CODE` (8 digits). If that administrator has no code yet, the first sign-in of a run creates it with this value. Without a Supabase project, run `npm run mock:supabase-auth` and start the app against it:

```bash
SUPABASE_URL=http://127.0.0.1:54399 SUPABASE_ANON_KEY=mock-anon-key npm run dev
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Tuwaiq-Admin-2026 ADMIN_VERIFICATION_CODE=29473816 MOCK_AUTH_URL=http://127.0.0.1:54399 npm run test:admin-login
```

The other end-to-end suites sign in as a demo student through the same flow (`tests/e2e/lib/student.mjs`), so they also need `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_VERIFICATION_CODE`.

## Project structure

```
src/
  app/(public)/      landing page (/) and partnership application (/partners), no sign-in
  app/(site)/        student pages (home, projects, students, leaderboard, about)
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
