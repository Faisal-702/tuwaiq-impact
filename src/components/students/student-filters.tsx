"use client";

import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { gradeLabel } from "@/i18n/format";
import { cn } from "@/lib/utils";

export function StudentFilters({ grades, children }: { grades: number[]; children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const last = useRef(q);

  const navigate = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    const term = q.trim();
    if (term === last.current) return;
    const timer = setTimeout(() => {
      last.current = term;
      navigate({ q: term || null });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="group relative flex-1">
          <label htmlFor="student-search" className="sr-only">
            {t.students.searchLabel}
          </label>
          {pending ? (
            <LoaderCircle aria-hidden className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 animate-spin text-purple" />
          ) : (
            <Search aria-hidden className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted group-focus-within:text-purple" />
          )}
          <input
            id="student-search"
            type="search"
            dir="auto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.students.searchPlaceholder}
            className="h-14 w-full rounded-2xl border border-line bg-white ps-14 pe-5 text-[1.0625rem] shadow-soft placeholder:text-[#9aa1ad] focus:border-purple/50 focus:outline-none focus:ring-4 focus:ring-purple/10"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="student-grade" className="sr-only">
            {t.projects.filterGrade}
          </label>
          <Select
            id="student-grade"
            value={params.get("grade") ?? ""}
            onChange={(e) => navigate({ grade: e.target.value || null })}
            className="h-14 rounded-2xl shadow-soft"
          >
            <option value="">{t.students.allGrades}</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g, t.grades)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div aria-busy={pending} className={cn("mt-8 transition-opacity duration-300", pending && "opacity-55")}>
        {children}
      </div>
    </div>
  );
}
