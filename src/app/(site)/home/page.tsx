import { ArrowRight, FolderSearch, Search, Star, Trophy } from "lucide-react";
import Link from "@/components/ui/link";
import { Hero } from "@/components/home/hero";
import { Partners } from "@/components/home/partners";
import { StatsBar } from "@/components/home/stats-bar";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { FeaturedProjectCard, ProjectCard } from "@/components/projects/project-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getI18n } from "@/i18n/server";
import { CategoryIcon } from "@/lib/categories";
import {
  getFeaturedProjects,
  getHomeStats,
  getLeaderboard,
  getPublicCategories,
  searchProjects,
} from "@/server/queries/public";
import { requireViewer } from "@/server/auth";

export default async function HomePage() {
  const { t, locale } = await getI18n();
  // The session check and the page's queries run concurrently; nothing is
  // rendered unless the check passes (requireViewer redirects otherwise).
  const [, stats, featured, latest, categories, leaders] = await Promise.all([
    requireViewer(),
    getHomeStats(),
    getFeaturedProjects(3),
    searchProjects({ sort: "newest", limit: 6 }),
    getPublicCategories(),
    getLeaderboard(null, 5),
  ]);
  const activeCategories = categories.filter((c) => (c.project_count ?? 0) > 0).slice(0, 8);

  return (
    <>
      <Hero t={t} />
      <StatsBar stats={stats} t={t} locale={locale} />
      <Partners t={t} locale={locale} />

      {/* Featured */}
      <section aria-labelledby="featured-title" className="container-page pt-24 sm:pt-28">
        <Reveal>
          <SectionHeading
            id="featured-title"
            eyebrow={t.home.featuredEyebrow}
            title={t.home.featuredTitle}
            body={t.home.featuredBody}
            action={
              featured.length > 0 ? (
                <Link href="/projects" className="group inline-flex items-center gap-1.5 font-medium text-purple">
                  {t.common.viewAll}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
                </Link>
              ) : null
            }
          />
        </Reveal>
        <div className="mt-10">
          {featured.length === 0 ? (
            <EmptyState icon={Star} title={t.home.featuredEmpty} body={t.home.featuredEmptyBody} />
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 0.06}>
                  <FeaturedProjectCard project={p} t={t} locale={locale} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Student projects */}
      <section aria-labelledby="feed-title" className="mt-24 sm:mt-28">
        <div className="relative overflow-hidden bg-canvas py-20 sm:py-24">
          <div aria-hidden className="hairline-gradient absolute inset-x-0 top-0 h-px" />
          <div className="container-page">
            <Reveal>
              <SectionHeading id="feed-title" eyebrow={t.home.feedEyebrow} title={t.home.feedTitle} body={t.home.feedBody} />
            </Reveal>
            <Reveal delay={0.05}>
              <form action="/projects" role="search" className="mt-8 max-w-2xl">
                <label htmlFor="home-search" className="sr-only">
                  {t.projects.searchLabel}
                </label>
                <div className="group relative">
                  <Search aria-hidden className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-purple" />
                  <input
                    id="home-search"
                    name="q"
                    type="search"
                    dir="auto"
                    placeholder={t.projects.searchPlaceholder}
                    className="h-14 w-full rounded-2xl border border-line bg-white ps-14 pe-32 text-[1.0625rem] text-ink shadow-soft placeholder:text-[#9aa1ad] transition focus:border-purple/50 focus:outline-none focus:ring-4 focus:ring-purple/10"
                  />
                  <button type="submit" className={buttonClasses("primary", "sm") + " absolute end-2.5 top-1/2 -translate-y-1/2 !h-10 !px-4"}>
                    {t.common.search}
                  </button>
                </div>
              </form>
              {activeCategories.length > 0 ? (
                <ul className="scrollbar-none -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label={t.projects.categoriesLabel}>
                  {activeCategories.map((c) => {
                    return (
                      <li key={c.id} className="shrink-0">
                        <Link
                          href={`/projects?category=${c.slug}`}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm text-ink-soft ring-1 ring-line transition hover:text-ink hover:ring-[#cfd3da]"
                        >
                          <CategoryIcon name={c.icon} className="size-4 text-teal-deep" aria-hidden />
                          {locale === "ar" ? c.name_ar : c.name_en}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </Reveal>

            <div className="mt-10">
              {latest.items.length === 0 ? (
                <EmptyState icon={FolderSearch} title={t.projects.noneYetTitle} body={t.projects.noneYetBody} className="bg-white" />
              ) : (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {latest.items.map((p, i) => (
                    <Reveal as="li" key={p.id} delay={(i % 3) * 0.05}>
                      <ProjectCard project={p} t={t} locale={locale} />
                    </Reveal>
                  ))}
                </ul>
              )}
            </div>
            {latest.total > 0 ? (
              <div className="mt-12 flex justify-center">
                <Link href="/projects" className={buttonClasses("secondary", "lg")}>
                  {t.home.feedCta}
                  <ArrowRight className="size-[1.125rem] rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Leaderboard preview */}
      <section aria-labelledby="leaders-title" className="container-page pt-24 sm:pt-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-5">
            <SectionHeading
              id="leaders-title"
              eyebrow={t.home.leaderboardEyebrow}
              title={t.home.leaderboardTitle}
              body={t.home.leaderboardBody}
            />
            <Link href="/leaderboard" className={buttonClasses("primary", "md") + " mt-8"}>
              {t.home.leaderboardCta}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </Reveal>
          <Reveal className="lg:col-span-6 lg:col-start-7" delay={0.08}>
            {leaders.length === 0 ? (
              <EmptyState icon={Trophy} title={t.leaderboard.emptyTitle} body={t.leaderboard.emptyBody} />
            ) : (
              <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-lift ring-1 ring-line-soft">
                <div className="flex items-center justify-between border-b border-line-soft px-6 py-4">
                  <p className="font-semibold text-ink">{t.leaderboard.overall}</p>
                  <Trophy className="size-5 text-[#c9a13b]" aria-hidden />
                </div>
                <LeaderboardList rows={leaders} t={t} locale={locale} />
              </div>
            )}
          </Reveal>
        </div>
      </section>
    </>
  );
}
