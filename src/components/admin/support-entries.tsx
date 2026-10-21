import { HandCoins } from "lucide-react";
import { Panel } from "@/components/admin/page-header";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatDateTime, formatNumber } from "@/i18n/format";
import { funding } from "@/lib/funding";
import type { SupportEntry } from "@/server/queries/my-projects";

/**
 * Support recorded manually by the student for a project, as an audit list
 * for administrators: amounts, notes, who recorded them and reversals.
 * These are self-reported amounts, not verified payments.
 */
export function SupportEntries({
  entries,
  requested,
  t,
  locale,
}: {
  entries: (SupportEntry & { studentName: string | null })[];
  requested: number | null;
  t: Dictionary;
  locale: Locale;
}) {
  const s = t.admin.support;
  const money = (n: number) => `${formatNumber(n, locale)} ${t.submit.currency}`;
  const totals = funding(requested, entries.filter((e) => !e.reversedAt).reduce((sum, e) => sum + e.amount, 0));
  return (
    <Panel
      title={s.title}
      description={s.intro}
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-semibold text-teal-deep">
          <HandCoins className="size-3.5" aria-hidden />
          {fmt(s.totals, { requested: money(totals.requested), raised: money(totals.recorded), remaining: money(totals.remaining) })}
        </span>
      }
      className="mt-6"
      bodyClassName="p-0"
    >
      {entries.length === 0 ? (
        <p className="px-6 py-6 text-sm text-muted" data-testid="admin-support-empty">
          {s.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm" data-testid="admin-support-entries">
            <thead className="border-b border-line-soft bg-canvas/70 text-[0.8125rem] text-ink-soft">
              <tr>
                <th scope="col" className="px-6 py-3 text-start font-semibold">{s.amount}</th>
                <th scope="col" className="px-3 py-3 text-start font-semibold">{s.note}</th>
                <th scope="col" className="px-3 py-3 text-start font-semibold">{s.by}</th>
                <th scope="col" className="px-3 py-3 text-start font-semibold">{s.date}</th>
                <th scope="col" className="px-6 py-3 text-start font-semibold">{s.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {entries.map((e) => (
                <tr key={e.id} data-reversed={e.reversedAt ? "true" : "false"}>
                  <td className={`whitespace-nowrap px-6 py-3 font-semibold tabular-nums ${e.reversedAt ? "text-muted line-through" : "text-ink"}`}>{money(e.amount)}</td>
                  <td dir="auto" className="max-w-[16rem] px-3 py-3 text-ink-soft">{e.note ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-soft">
                    <span dir="auto">{e.studentName ?? "—"}</span>
                    <span className="ms-1 text-xs text-muted">({e.recordedBy === "admin" ? s.admin : s.student})</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-soft">{formatDateTime(e.createdAt, locale)}</td>
                  <td className="px-6 py-3">
                    {e.reversedAt ? (
                      <span className="text-xs font-semibold text-danger-ink" title={e.reversalReason ?? undefined}>
                        {s.reversed} · {formatDateTime(e.reversedAt, locale)}
                        {e.reversalReason ? <span dir="auto" className="block font-normal text-muted">{e.reversalReason}</span> : null}
                      </span>
                    ) : (
                      <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-semibold text-teal-deep">{s.counted}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
