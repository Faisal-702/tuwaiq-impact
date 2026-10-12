import { Banknote, GraduationCap, Star, UsersRound } from "lucide-react";
import { CategoryChip } from "@/components/ui/chip";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber, gradeLabel, localName } from "@/i18n/format";
import { fieldLabel } from "@/lib/submission";
import type { ProjectCardData } from "@/lib/types";
import { excerpt } from "@/lib/utils";
import { ProjectCover } from "./project-cover";

function studentLine(project: ProjectCardData, locale: Locale) {
  const names = project.students.map((s) => localName(s, locale)).filter(Boolean);
  if (names.length <= 2) return names.join(locale === "ar" ? " و" : " & ");
  return `${names.slice(0, 2).join(locale === "ar" ? "، " : ", ")} +${names.length - 2}`;
}

/**
 * Card on the Explore Projects page. It shows only public information (cover,
 * name, field, students, grade, the student's own summary and the requested
 * amount) and is deliberately not a link: there is no detail, support or
 * donation action here.
 */
export function ExploreProjectCard({ project, t, locale }: { project: ProjectCardData; t: Dictionary; locale: Locale }) {
  const field = fieldLabel(project.field, project.field_other, locale);
  const category = locale === "ar" ? project.category.name_ar : project.category.name_en;
  const students = studentLine(project, locale);
  // Submitted projects show the summary exactly as written; older projects
  // fall back to a short excerpt of their description.
  const summary = project.summary ?? (project.description ? excerpt(project.description, 160) : null);

  return (
    <article
      className="flex h-full flex-col rounded-[1.25rem] bg-white p-2.5 ring-1 ring-line-soft shadow-soft"
      data-testid="explore-card"
      data-project={project.slug}
      data-views={project.view_count}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[0.9rem] bg-canvas">
        <ProjectCover project={project} />
        {project.is_featured ? (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[0.6875rem] font-semibold text-purple-ink shadow-sm backdrop-blur">
            <Star className="size-3 fill-purple text-purple" aria-hidden />
            {t.projects.featured}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-4">
        <h3 dir="auto" className="line-clamp-2 text-[1.0625rem] font-bold leading-snug text-ink">
          {project.title}
        </h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {field ? (
            <span className="inline-flex max-w-full items-center rounded-full bg-lavender-soft px-2.5 py-1 text-xs font-semibold text-purple-ink ring-1 ring-inset ring-purple/15" data-testid="card-field">
              <span className="truncate" dir="auto">
                {field}
              </span>
            </span>
          ) : (
            <CategoryChip name={category} icon={project.category.icon} accent={project.category.accent} size="xs" />
          )}
        </div>

        {students || project.grade ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
            {students ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UsersRound className="size-4 shrink-0 text-teal-deep" aria-hidden />
                <span className="truncate text-ink-soft">{students}</span>
              </span>
            ) : null}
            {project.grade ? (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-4 shrink-0 text-teal-deep" aria-hidden />
                {gradeLabel(project.grade, t.grades)}
              </span>
            ) : null}
          </div>
        ) : null}

        {summary ? (
          <div className="mt-4 rounded-xl bg-canvas px-3.5 py-3">
            <p className="text-xs font-semibold text-muted">{t.projects.summaryLabel}</p>
            <p dir="auto" className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft" data-testid="card-summary">
              {summary}
            </p>
          </div>
        ) : null}

        {project.requested_amount !== null ? (
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3.5">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <Banknote className="size-4 text-teal-deep" aria-hidden />
                {t.projects.requestedAmount}
              </span>
              <span className="text-base font-bold text-ink" data-testid="card-amount">
                {formatNumber(project.requested_amount, locale)} <span className="text-sm font-semibold text-muted">{t.submit.currency}</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
