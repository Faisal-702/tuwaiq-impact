import { Award, Eye, Star } from "lucide-react";
import Link from "next/link";
import { CategoryChip } from "@/components/ui/chip";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber, gradeLabel, localName } from "@/i18n/format";
import type { ProjectCardData } from "@/lib/types";
import { cn, excerpt } from "@/lib/utils";
import { ProjectCover } from "./project-cover";

function studentLine(project: ProjectCardData, locale: Locale) {
  const names = project.students.map((s) => localName(s, locale));
  if (names.length <= 2) return names.join(locale === "ar" ? " و" : " & ");
  return `${names.slice(0, 2).join(locale === "ar" ? "، " : ", ")} +${names.length - 2}`;
}

/** Information-light card used in grids. */
export function ProjectCard({
  project,
  t,
  locale,
  showViews,
}: {
  project: ProjectCardData;
  t: Dictionary;
  locale: Locale;
  showViews?: boolean;
}) {
  const category = locale === "ar" ? project.category.name_ar : project.category.name_en;
  return (
    <article className="group relative h-full">
      <Link
        href={`/projects/${project.slug}`}
        className="flex h-full flex-col rounded-[1.25rem] bg-white p-2.5 ring-1 ring-line-soft transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-lift hover:ring-line focus-visible:-translate-y-1"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[0.9rem] bg-canvas">
          <ProjectCover project={project} />
          {project.is_featured ? (
            <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-purple-ink shadow-sm backdrop-blur">
              <Star className="size-3 fill-purple text-purple" aria-hidden />
              {t.projects.featured}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
          <div className="flex items-center justify-between gap-3">
            <CategoryChip name={category} icon={project.category.icon} accent={project.category.accent} size="xs" />
            {project.published_at ? (
              <time dateTime={project.published_at} className="shrink-0 text-xs text-muted">
                {formatDate(project.published_at, locale, "short")}
              </time>
            ) : null}
          </div>
          <h3 dir="auto" className="mt-3 line-clamp-2 text-[1.0625rem] font-semibold leading-snug text-ink">
            {project.title}
          </h3>
          <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-sm text-muted">
            <p className="min-w-0 truncate">
              <span className="text-ink-soft">{studentLine(project, locale)}</span>
              {project.grade ? <span> · {gradeLabel(project.grade, t.grades)}</span> : null}
            </p>
            {showViews ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                <Eye className="size-3.5" aria-hidden />
                {formatNumber(project.view_count, locale)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

/** Larger card for the homepage spotlight. */
export function FeaturedProjectCard({
  project,
  t,
  locale,
  className,
}: {
  project: ProjectCardData;
  t: Dictionary;
  locale: Locale;
  className?: string;
}) {
  const category = locale === "ar" ? project.category.name_ar : project.category.name_en;
  return (
    <article className={cn("group relative h-full", className)}>
      <Link
        href={`/projects/${project.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-line-soft shadow-soft transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-lift focus-visible:-translate-y-1"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-canvas">
          <ProjectCover project={project} />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold text-purple-ink shadow-sm backdrop-blur">
              <Star className="size-3.5 fill-purple text-purple" aria-hidden />
              {t.projects.featured}
            </span>
            {project.award ? (
              <span className="inline-flex max-w-[60%] items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-xs font-medium text-[#8a6413] shadow-sm backdrop-blur">
                <Award className="size-3.5 shrink-0" aria-hidden />
                <span dir="auto" className="truncate">{project.award}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-6">
          <CategoryChip name={category} icon={project.category.icon} accent={project.category.accent} className="self-start" />
          <h3 dir="auto" className="mt-4 text-xl font-semibold leading-snug tracking-tight text-ink">
            {project.title}
          </h3>
          {project.description ? (
            <p dir="auto" className="mt-2 line-clamp-2 text-[0.9375rem] leading-relaxed text-muted">
              {excerpt(project.description, 160)}
            </p>
          ) : null}
          <div className="mt-auto pt-6">
            <div className="flex items-center justify-between gap-4 border-t border-line-soft pt-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{studentLine(project, locale)}</p>
                <p className="mt-0.5 text-muted">
                  {[
                    project.grade ? gradeLabel(project.grade, t.grades) : null,
                    project.published_at ? formatDate(project.published_at, locale, "short") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-muted">
                <Eye className="size-4" aria-hidden />
                {formatNumber(project.view_count, locale)}
                <span className="sr-only">{t.common.views}</span>
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
