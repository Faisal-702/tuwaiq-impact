"use client";

import Image from "next/image";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, gradeLabel, localName } from "@/i18n/format";
import { groupCodesForPrint } from "@/lib/student-codes";
import { cn } from "@/lib/utils";
import moeLogo from "../../../../public/brand/moe-logo.png";

export type PrintableStudent = {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  grade: number | null;
  code: string | null;
};

function SheetHeader({ t, title, compact }: { t: Dictionary; title: string; compact?: boolean }) {
  const s = t.admin.studentCodes;
  return (
    <header className={cn("flex items-center justify-between gap-4 border-b border-line", compact ? "pb-3" : "pb-5")}>
      <div>
        <p className={cn("font-bold text-ink", compact ? "text-[0.9375rem]" : "text-xl")}>{s.school}</p>
        <p className={cn("mt-1 font-semibold text-purple-ink", compact ? "text-[0.8125rem]" : "text-lg")}>{title}</p>
      </div>
      <Image
        src={moeLogo}
        alt={t.brand.moeAlt}
        className={cn("w-auto shrink-0", compact ? "h-10" : "h-16")}
        sizes="120px"
      />
    </header>
  );
}

/**
 * The official codes sheet: school, title, print date, then one table per
 * grade in the fixed order (first → second → third secondary year).
 * Used both for the on-screen preview (compact) and the A4 print output.
 */
export function CodesSheet({
  rows,
  t,
  locale,
  date,
  compact,
}: {
  rows: PrintableStudent[];
  t: Dictionary;
  locale: Locale;
  date: string;
  compact?: boolean;
}) {
  const s = t.admin.studentCodes;
  const groups = groupCodesForPrint(rows);
  const cell = compact ? "px-2 py-1.5" : "px-3 py-2";
  return (
    <article className={cn("bg-white text-ink", compact ? "text-[0.75rem]" : "text-[0.875rem]")} data-testid="codes-sheet">
      <SheetHeader t={t} title={s.printTitle} compact={compact} />
      {groups.length === 0 ? (
        <p className="py-10 text-center text-muted">{s.printEmpty}</p>
      ) : (
        <div className={compact ? "mt-3 space-y-4" : "mt-6 space-y-7"}>
          {groups.map((group) => (
            <section key={group.grade ?? "other"} className="print-avoid-break-heading" data-testid="print-group">
              <h2
                className={cn(
                  "rounded-t-lg bg-lavender-soft font-bold text-purple-ink",
                  compact ? "px-2 py-1.5 text-[0.8125rem]" : "px-3 py-2 text-base",
                )}
              >
                {group.grade !== null && [10, 11, 12].includes(group.grade)
                  ? fmt(s.gradeGroup, { grade: gradeLabel(group.grade, t.grades) })
                  : s.otherGroup}
              </h2>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className={cn(cell, "w-10 border border-line-soft text-start font-medium")}>{s.number}</th>
                    <th scope="col" className={cn(cell, "border border-line-soft text-start font-medium")}>{s.printName}</th>
                    <th scope="col" className={cn(cell, "w-32 border border-line-soft text-start font-medium")}>{s.printCode}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r, i) => (
                    <tr key={r.id} className="print-row">
                      <td className={cn(cell, "border border-line-soft tabular-nums")}>{i + 1}</td>
                      <td className={cn(cell, "border border-line-soft")}>
                        <span dir="auto">{localName(r, locale)}</span>
                      </td>
                      <td className={cn(cell, "border border-line-soft font-semibold tabular-nums tracking-wider")} dir="ltr">
                        <span className="block text-start">{r.code}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
      <footer className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-line text-muted", compact ? "mt-4 pt-2 text-[0.6875rem]" : "mt-8 pt-3 text-[0.8125rem]")}>
        <span>{fmt(s.printDate, { date: formatDate(date, locale) })}</span>
        <span>{s.printNote}</span>
      </footer>
    </article>
  );
}

/** A single student's code, printed as a card. */
export function StudentCodeCard({
  row,
  t,
  locale,
  date,
}: {
  row: PrintableStudent & { code: string };
  t: Dictionary;
  locale: Locale;
  date: string;
}) {
  const s = t.admin.studentCodes;
  return (
    <article className="mx-auto max-w-[150mm] rounded-2xl border border-line p-8 text-ink" data-testid="code-card">
      <SheetHeader t={t} title={s.cardTitle} />
      <dl className="mt-6 space-y-3 text-base">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{s.printName}</dt>
          <dd className="font-semibold">
            <span dir="auto">{localName(row, locale)}</span>
          </dd>
        </div>
        {row.grade ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{s.grade}</dt>
            <dd className="font-semibold">{gradeLabel(row.grade, t.grades)}</dd>
          </div>
        ) : null}
      </dl>
      <p dir="ltr" className="mt-6 rounded-xl bg-lavender-soft py-5 text-center text-4xl font-bold tracking-[0.3em] text-purple-ink tabular-nums">
        {row.code}
      </p>
      <p className="mt-5 text-sm leading-relaxed text-muted">{s.cardHint}</p>
      <p className="mt-6 border-t border-line pt-3 text-xs text-muted">{fmt(s.printDate, { date: formatDate(date, locale) })}</p>
    </article>
  );
}
