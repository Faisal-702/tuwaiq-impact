import { FolderSearch, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/projects/project-card";
import { ExplorerShell } from "@/components/projects/explorer-shell";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n/format";
import type { ContentTypeFilter, ProjectSort } from "@/lib/types";
import { getFilterOptions, getPublicCategories, searchProjects } from "@/server/queries/public";
import { requireViewer } from "@/server/auth";

const PAGE_SIZE = 12;
const SORTS = new Set(["newest", "views", "points", "active"]);
const TYPES = new Set(["image", "video", "document", "link", "text"]);

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.projects.title, description: t.projects.intro };
}

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export default async function ProjectsPage(props: PageProps<"/projects">) {
  await requireViewer();
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();

  const q = str(sp.q)?.slice(0, 100);
  const category = str(sp.category);
  const gradeNum = Number(str(sp.grade));
  const grade = Number.isInteger(gradeNum) && gradeNum > 0 && gradeNum <= 12 ? gradeNum : undefined;
  const year = str(sp.year);
  const type = TYPES.has(str(sp.type) ?? "") ? (str(sp.type) as ContentTypeFilter) : undefined;
  const student = str(sp.student);
  const sort = SORTS.has(str(sp.sort) ?? "") ? (str(sp.sort) as ProjectSort) : "newest";
  const page = Math.min(Math.max(Number(str(sp.page)) || 1, 1), 50);

  const [results, categories, options] = await Promise.all([
    searchProjects({ q, category, grade, year, type, student, sort, limit: page * PAGE_SIZE }),
    getPublicCategories(),
    getFilterOptions(),
  ]);
  const filtered = Boolean(q || category || grade || year || type || student);

  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") nextParams.set(k, v);
  nextParams.set("page", String(page + 1));

  return (
    <div className="container-page pb-8 pt-10 sm:pt-14">
      <SectionHeading as="h1" eyebrow={t.projects.eyebrow} title={t.projects.title} body={t.projects.intro} />
      <div className="mt-10">
        <ExplorerShell
          options={{
            categories: categories.map((c) => ({ slug: c.slug, name_en: c.name_en, name_ar: c.name_ar, icon: c.icon })),
            ...options,
          }}
        >
          <p className="mb-5 text-sm text-muted" aria-live="polite">
            {results.total === 1
              ? t.projects.resultsOne
              : fmt(t.projects.results, { count: formatNumber(results.total, locale) })}
          </p>
          {results.items.length === 0 ? (
            filtered ? (
              <EmptyState icon={SearchX} title={t.projects.emptyTitle} body={t.projects.emptyBody} />
            ) : (
              <EmptyState icon={FolderSearch} title={t.projects.noneYetTitle} body={t.projects.noneYetBody} />
            )
          ) : (
            <>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.items.map((p) => (
                  <li key={p.id}>
                    <ProjectCard project={p} t={t} locale={locale} showViews />
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
