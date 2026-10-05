import { SearchX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { StudentFilters } from "@/components/students/student-filters";
import { StudentMonogram } from "@/components/students/student-monogram";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getI18n } from "@/i18n/server";
import { formatNumber, gradeLabel, localName, projectCount } from "@/i18n/format";
import { getFilterOptions, getPublicStudents } from "@/server/queries/public";
import { requireViewer } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.students.title, description: t.students.intro };
}

export default async function StudentsPage(props: PageProps<"/students">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const g = Number(sp.grade);
  const grade = Number.isInteger(g) && g > 0 && g <= 12 ? g : undefined;
  // The session check and the page's queries run concurrently; nothing is
  // rendered unless the check passes (requireViewer redirects otherwise).
  const [, students, options] = await Promise.all([requireViewer(), getPublicStudents({ q, grade }), getFilterOptions()]);

  return (
    <div className="container-page pb-8 pt-10 sm:pt-14">
      <SectionHeading as="h1" eyebrow={t.students.eyebrow} title={t.students.title} body={t.students.intro} />
      <div className="mt-10">
        <StudentFilters grades={options.grades}>
          {students.length === 0 ? (
            q || grade ? (
              <EmptyState icon={SearchX} title={t.students.emptyTitle} body={t.students.emptyBody} />
            ) : (
              <EmptyState icon={Users} title={t.students.noneYetTitle} body={t.students.noneYetBody} />
            )
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => {
                const name = localName(s, locale);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/students/${s.slug}`}
                      className="group flex items-center gap-4 rounded-[1.25rem] bg-white p-5 ring-1 ring-line-soft transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <StudentMonogram name={name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink group-hover:text-purple">{name}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {[
                            s.grade ? gradeLabel(s.grade, t.grades) : null,
                            projectCount(s.projects, locale),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-lg font-semibold tabular-nums text-ink">{formatNumber(s.points, locale)}</p>
                        <p className="text-xs text-muted">{t.common.pointsShort}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </StudentFilters>
      </div>
    </div>
  );
}
