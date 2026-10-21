import { FolderKanban, FolderSearch, SearchX, Trophy, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { ExploreProjectCard } from "@/components/projects/explore-card";
import { ExplorerShell } from "@/components/projects/explorer-shell";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber, projectCount } from "@/i18n/format";
import { COMPETITION_KEYS, FIELD_KEYS } from "@/lib/submission";
import type { ContentTypeFilter, ProjectSort } from "@/lib/types";
import { getFilterOptions, getHomeStats, getPublicCategories, searchProjects } from "@/server/queries/public";
import { requireStudentViewer } from "@/server/auth";

const PAGE_SIZE = 12;
const SORTS = new Set(["newest", "views", "points", "active"]);
const COMPETITION_SET = new Set<string>(COMPETITION_KEYS);
const TYPES = new Set(["image", "video", "document", "link", "text"]);

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.projects.title, description: t.projects.intro };
}

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();

  const q = str(sp.q)?.slice(0, 100);
  const category = str(sp.category);
  const field = (FIELD_KEYS as string[]).includes(str(sp.field) ?? "") ? str(sp.field) : undefined;
  const competition = COMPETITION_SET.has(str(sp.competition) ?? "") ? str(sp.competition) : undefined;
  const gradeNum = Number(str(sp.grade));
  const grade = Number.isInteger(gradeNum) && gradeNum > 0 && gradeNum <= 12 ? gradeNum : undefined;
  const year = str(sp.year);
  const type = TYPES.has(str(sp.type) ?? "") ? (str(sp.type) as ContentTypeFilter) : undefined;
  const student = str(sp.student);
  const sort = SORTS.has(str(sp.sort) ?? "") ? (str(sp.sort) as ProjectSort) : "newest";
  const page = Math.min(Math.max(Number(str(sp.page)) || 1, 1), 50);

  // Explore Projects is for signed-in students only. Visitors sign in first
  // (and come back here); administrators review projects in the dashboard.
  const here = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") here.set(k, v);
  await requireStudentViewer(here.size ? `/projects?${here}` : "/projects");
  const [results, categories, options, stats] = await Promise.all([
    searchProjects({ q, category, field, competition, grade, year, type, student, sort, limit: page * PAGE_SIZE }),
    getPublicCategories(),
    getFilterOptions(),
    getHomeStats(),
  ]);
  const filtered = Boolean(q || category || field || competition || grade || year || type || student);
  const allCompetitions = new URLSearchParams(here);
  allCompetitions.delete("competition");
  allCompetitions.delete("page");
  const totalPublic = stats.projects + stats.activities;

  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") nextParams.set(k, v);
  nextParams.set("page", String(page + 1));

  return (
    <div className="container-page pb-8 pt-10 sm:pt-14">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div>
          <SectionHeading as="h1" eyebrow={t.projects.eyebrow} title={t.projects.title} body={t.projects.intro} />
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-soft ring-1 ring-line-soft lg:hidden">
            <FolderKanban className="size-4 text-purple" aria-hidden />
            <span className="text-muted">{t.projects.countLabel}:</span>
            <span className="font-bold text-ink" data-testid="projects-count">{formatNumber(totalPublic, locale)}</span>
          </p>
        </div>
        <div className="relative hidden h-56 lg:block">
          <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-lavender-soft via-white to-mint-soft ring-1 ring-line-soft">
            {/* eslint-disable-next-line @next/next/no-img-element -- static decorative art */}
            <img src="/images/entry-scene-left.webp" alt="" className="absolute inset-0 size-full object-cover object-[50%_72%]" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/10 to-white/70 rtl:bg-gradient-to-r" />
          </div>
          <div className="absolute -start-5 top-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-line-soft">
            <span className="grid size-10 place-items-center rounded-xl bg-lavender-soft text-purple">
              <FolderKanban className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-xs text-muted">{t.projects.countLabel}</span>
              <span className="block text-lg font-bold text-ink" data-testid="projects-count-desktop">{formatNumber(totalPublic, locale)}</span>
            </span>
          </div>
          <div className="absolute start-10 bottom-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-line-soft">
            <span className="grid size-10 place-items-center rounded-xl bg-mint-soft text-teal-deep">
              <UsersRound className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-xs text-muted">{t.home.stats.students}</span>
              <span className="block text-lg font-bold text-ink">{formatNumber(stats.students, locale)}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="mt-10">
        <ExplorerShell
          options={{
            categories: categories.map((c) => ({ slug: c.slug, name_en: c.name_en, name_ar: c.name_ar, icon: c.icon })),
            ...options,
          }}
        >
          <p className="mb-5 text-sm text-muted" aria-live="polite" data-testid="results-count">
            {projectCount(results.total, locale)}
          </p>
          {results.items.length === 0 ? (
            competition ? (
              <EmptyState
                icon={Trophy}
                title={t.projects.competitionEmptyTitle}
                body={t.projects.competitionEmptyBody}
                action={
                  <Link
                    href={allCompetitions.size ? `/projects?${allCompetitions}` : "/projects"}
                    scroll={false}
                    className={buttonClasses("secondary", "md")}
                    data-testid="show-all-competitions"
                  >
                    {t.projects.showAllCompetitions}
                  </Link>
                }
              />
            ) : filtered ? (
              <EmptyState icon={SearchX} title={t.projects.emptyTitle} body={t.projects.emptyBody} />
            ) : (
              <EmptyState icon={FolderSearch} title={t.projects.noneYetTitle} body={t.projects.noneYetBody} />
            )
          ) : (
            <>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.items.map((p) => (
                  <li key={p.id}>
                    <ExploreProjectCard project={p} t={t} locale={locale} />
                  </li>
                ))}
              </ul>
              {results.items.length < results.total ? (
                <div className="mt-12 flex flex-col items-center gap-3">
                  <p className="text-sm text-muted">
                    {fmt(t.common.showing, {
                      shown: formatNumber(results.items.length, locale),
                      total: formatNumber(results.total, locale),
                    })}
                  </p>
                  <Link href={`/projects?${nextParams}`} scroll={false} className={buttonClasses("secondary", "md")}>
                    {t.common.loadMore}
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </ExplorerShell>
      </div>
    </div>
  );
}
