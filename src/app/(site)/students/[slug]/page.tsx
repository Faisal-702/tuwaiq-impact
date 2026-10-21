import { ArrowLeft, Award, FolderKanban, Star, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/projects/project-card";
import { StudentMonogram } from "@/components/students/student-monogram";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import { formatDate, formatNumber, gradeLabel, localName } from "@/i18n/format";
import { getStudentProfile } from "@/server/queries/public";
import { getViewer, requireViewer } from "@/server/auth";

export async function generateMetadata(props: PageProps<"/students/[slug]">): Promise<Metadata> {
  if (!(await getViewer())) return {};
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const profile = await getStudentProfile(decodeURIComponent(slug));
  return profile ? { title: localName(profile.student, locale) } : {};
}

export default async function StudentPage(props: PageProps<"/students/[slug]">) {
  const { slug } = await props.params;
  const { t, locale } = await getI18n();
  // The session check and the page's queries run concurrently; nothing is
  // rendered unless the check passes (requireViewer redirects otherwise).
  const [, profile] = await Promise.all([requireViewer(), getStudentProfile(decodeURIComponent(slug))]);
  if (!profile) notFound();
  const { student, rank, projects, achievements } = profile;
  const name = localName(student, locale);
  const other = locale === "ar" ? student.name_en : student.name_ar;

  const stats = [
    { label: t.students.projectsCount, value: formatNumber(student.projects, locale), icon: FolderKanban },
    { label: t.students.totalPoints, value: formatNumber(student.points, locale), icon: Star },
    { label: t.students.rank, value: rank ? `#${formatNumber(rank, locale)}` : "—", icon: Trophy },
  ];

  return (
    <div className="container-page pb-8 pt-8 sm:pt-10">
      <Link href="/students" className="group inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink">
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 rtl:-scale-x-100" aria-hidden />
        {t.students.backToStudents}
      </Link>

      <Reveal y={10}>
        <header className="relative mt-6 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-mint-soft via-white to-lavender-soft p-7 ring-1 ring-line-soft sm:p-10">
          <div aria-hidden className="dot-grid absolute -end-10 -top-10 h-48 w-72 opacity-20 [mask-image:radial-gradient(closest-side,#000,transparent)]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <StudentMonogram name={name} size="lg" className="bg-white" />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl rtl:tracking-normal">{name}</h1>
              {other && other !== name ? (
                <p dir="auto" className="mt-1 text-lg text-muted">
                  {other}
                </p>
              ) : null}
              {student.grade ? <p className="mt-2 text-ink-soft">{gradeLabel(student.grade, t.grades)}</p> : null}
            </div>
          </div>
          <dl className="relative mt-8 grid grid-cols-3 gap-3 sm:max-w-xl">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/85 px-4 py-4 ring-1 ring-line-soft backdrop-blur">
                <dt className="flex items-center gap-1.5 text-xs text-muted sm:text-sm">
                  <s.icon className="size-3.5 text-teal-deep" aria-hidden />
                  {s.label}
                </dt>
                <dd className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </header>
      </Reveal>

      <div className="mt-14 grid gap-12 lg:grid-cols-12">
        <section aria-labelledby="history-heading" className="lg:col-span-8">
          <h2 id="history-heading" className="text-2xl font-bold tracking-tight text-ink">
            {t.students.projectHistory}
          </h2>
          {projects.length === 0 ? (
            <p className="mt-4 text-muted">{t.students.noProjects}</p>
          ) : (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} t={t} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside aria-labelledby="achievements-heading" className="lg:col-span-4">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-soft ring-1 ring-line-soft lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
            <h2 id="achievements-heading" className="flex items-center gap-2 font-semibold text-ink">
              <Award className="size-4.5 text-[#b88a1b]" aria-hidden />
              {t.students.achievements}
            </h2>
            {achievements.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{t.students.noAchievements}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {achievements.map((a) => (
                  <li key={a.projectSlug} className="rounded-xl bg-[#fdf9ef] p-4 ring-1 ring-inset ring-[#efdfb4]/60">
                    <p dir="auto" className="font-medium text-ink">
                      {a.award}
                    </p>
                    <Link href={`/projects/${a.projectSlug}`} dir="auto" className="mt-1 block text-sm text-muted hover:text-purple">
                      {a.projectTitle}
                    </Link>
                    {a.date ? <p className="mt-1 text-xs text-muted">{formatDate(a.date, locale)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
