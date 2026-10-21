import { ChevronLeft, CirclePlus, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { DotMotif } from "@/components/brand/wordmark";
import { MyProjectsDashboard, type MyNotification } from "@/components/my-projects/dashboard";
import { buttonClasses } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { requireViewer } from "@/server/auth";
import { isProfileComplete } from "@/server/profiles";
import { listMyActivity, listMyProjects, type MyProject } from "@/server/queries/my-projects";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.myProjects.metaTitle };
}

/** A project not updated for this many days gets a gentle reminder. */
const STALE_DAYS = 60;

/** Helpful, data-based notices only (no invented alerts, no funding pressure). */
function notificationsFor(projects: MyProject[], now: Date, profileComplete: boolean): MyNotification[] {
  const out: MyNotification[] = [];
  // A new project needs a complete profile: say so first.
  if (!profileComplete) out.push({ kind: "profile" });
  for (const p of projects) if (p.hasPendingEdit) out.push({ kind: "pending", projectId: p.id, title: p.title });
  for (const p of projects) if (p.status === "draft") out.push({ kind: "hidden", projectId: p.id, title: p.title });
  for (const p of projects) if (p.hasTarget && p.funding.remaining <= 0) out.push({ kind: "funded", projectId: p.id, title: p.title });
  // One reminder for the project that has waited longest.
  const stale = projects
    .map((p) => ({ p, days: Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / 86_400_000) }))
    .filter((x) => x.days >= STALE_DAYS)
    .sort((a, b) => b.days - a.days)[0];
  if (stale) out.push({ kind: "stale", projectId: stale.p.id, title: stale.p.title, days: stale.days });
  return out;
}

/**
 * "مشاريعي": the signed-in student's own projects. Everything shown comes
 * from the database for this student (session-checked on the server).
 */
export default async function MyProjectsPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const m = t.myProjects;

  if (viewer.kind !== "student") {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl rounded-[1.5rem] bg-white p-8 text-center shadow-soft ring-1 ring-line-soft" data-testid="admin-notice">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lavender-soft text-purple">
            <ShieldAlert className="size-7" strokeWidth={1.8} aria-hidden />
          </span>
          <h1 className="mt-5 text-xl font-bold text-ink">{m.title}</h1>
          <p className="mt-2 leading-relaxed text-muted">{t.submit.adminBody}</p>
          <Link href="/admin/projects" className={`${buttonClasses("primary", "md")} mt-6`}>
            {t.admin.nav.manageProjects}
          </Link>
        </div>
      </div>
    );
  }

  const studentId = viewer.student.studentId;
  const [projects, activity, profileComplete] = await Promise.all([
    listMyProjects(studentId),
    listMyActivity(studentId, 30),
    isProfileComplete(studentId),
  ]);
  const now = new Date();

  return (
    <div className="relative isolate pb-16" data-testid="my-projects-page">
      {/* Soft header background: light wave and the education dots. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[22rem] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#eef6fe] via-[#f6f8fd] to-transparent" />
        <div className="absolute -top-40 start-[18%] h-[26rem] w-[60rem] rounded-[50%] bg-white/70 blur-[2px]" />
        <DotMotif className="absolute start-[56%] top-6 hidden w-[17rem] -rotate-6 opacity-75 xl:block" />
      </div>

      <div className="container-page max-w-[96rem]">
        <header className="flex flex-col gap-5 pb-6 pt-7 sm:flex-row sm:items-end sm:pt-9">
          <div className="min-w-0 sm:order-2">
            <nav aria-label={m.breadcrumb} className="text-sm text-[#5b6070]">
              <ol className="flex items-center gap-2">
                <li>
                  <Link href="/home" className="transition-colors hover:text-[#5c3bfc]">
                    {m.breadcrumbHome}
                  </Link>
                </li>
                <li aria-hidden>
                  <ChevronLeft className="size-3.5 ltr:rotate-180" />
                </li>
                <li aria-current="page" className="font-medium text-[#2a3652]">
                  {m.title}
                </li>
              </ol>
            </nav>
            <h1 className="mt-2 text-[2rem] font-bold leading-tight text-[#1f2140] sm:text-[2.375rem]">{m.title}</h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#5b6070]">{m.intro}</p>
          </div>
          <Link
            href="/add-project"
            className="inline-flex h-[3.25rem] shrink-0 items-center justify-center gap-2.5 rounded-xl bg-[#5c3bfc] px-7 text-[0.9375rem] font-bold text-white shadow-[0_16px_30px_-16px_rgb(92_59_252/0.95)] transition hover:bg-[#4c2ee0] sm:order-1 sm:min-w-[13rem]"
            data-testid="add-new-project"
          >
            <CirclePlus className="size-5" aria-hidden />
            {m.addNew}
          </Link>
        </header>

        <MyProjectsDashboard projects={projects} activity={activity} notifications={notificationsFor(projects, now, profileComplete)} now={now.toISOString()} />
      </div>
    </div>
  );
}
