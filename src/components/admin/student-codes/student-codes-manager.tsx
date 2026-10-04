"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  MoreVertical,
  Printer,
  RefreshCw,
  Search,
  Shuffle,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal, flushSync } from "react-dom";
import { toast } from "sonner";
import { SuggestionGradeBadge } from "@/components/admin/suggestion-admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber, gradeLabel, localName } from "@/i18n/format";
import { cn } from "@/lib/utils";
import {
  generateMissingStudentCodes,
  generateStudentCode,
  regenerateStudentCode,
  removeStudentCode,
} from "@/server/actions/student-codes";
import type { StudentCodeRow } from "@/server/queries/student-codes";
import { CodesSheet, StudentCodeCard } from "./print-sheet";

const GRADES = [10, 11, 12] as const;
const PAGE_SIZES = [10, 25, 50, 100] as const;

type PluralForms = { one: string; two: string; few: string; many: string };
/** Arabic has distinct forms for 1, 2, 3–10 and 11+; English uses one/other. */
function plural(n: number, forms: PluralForms, locale: Locale) {
  const form = n === 1 ? forms.one : n === 2 ? forms.two : locale === "ar" && n >= 3 && n <= 10 ? forms.few : forms.many;
  return fmt(form, { n: formatNumber(n, locale) });
}

const noopSubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

export function StudentCodesManager({ rows, today }: { rows: StudentCodeRow[]; today: string }) {
  const { t, locale, dir } = useI18n();
  const s = t.admin.studentCodes;
  const router = useRouter();
  const mounted = useMounted();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState<"" | "has" | "none">("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [result, setResult] = useState<{ created: number; existing: number } | null>(null);
  const [printTarget, setPrintTarget] = useState<StudentCodeRow | null>(null);

  const missing = rows.filter((r) => !r.code).length;
  const withCodes = rows.length - missing;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return rows.filter(
      (r) =>
        (!q || `${r.name_ar ?? ""} ${r.name_en ?? ""}`.toLocaleLowerCase().includes(q)) &&
        (!grade || String(r.grade) === grade) &&
        (!status || (status === "has" ? Boolean(r.code) : !r.code)),
    );
  }, [rows, query, grade, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const resetPage = () => setPage(1);

  const refresh = () => startTransition(() => router.refresh());

  const runGenerate = async (row: StudentCodeRow) => {
    const res = await generateStudentCode(row.id);
    if (res.ok) toast.success(s.generated);
    else toast.error(t.common.somethingWrong);
    refresh();
  };
  const runRegenerate = async (row: StudentCodeRow) => {
    const res = await regenerateStudentCode(row.id);
    if (res.ok) toast.success(s.regenerated);
    else toast.error(t.common.somethingWrong);
    refresh();
  };
  const runRemove = async (row: StudentCodeRow) => {
    const res = await removeStudentCode(row.id);
    if (res.ok) toast.success(s.removed);
    else toast.error(t.common.somethingWrong);
    refresh();
  };
  const runBulk = async () => {
    const res = await generateMissingStudentCodes();
    if (res.ok && res.data) setResult(res.data);
    else toast.error(t.common.somethingWrong);
    refresh();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(s.copied);
    } catch {
      toast.error(s.copyFailed);
    }
  };

  /** Renders the chosen sheet into the print root, then opens the print dialog. */
  const print = (target: StudentCodeRow | null) => {
    flushSync(() => setPrintTarget(target));
    window.print();
    setPrintTarget(null);
  };

  const tiles = [
    {
      label: s.total,
      value: rows.length,
      caption: fmt(s.withCodes, { n: formatNumber(withCodes, locale) }),
      icon: Users,
      tone: "bg-mint-soft text-teal-deep",
    },
    ...GRADES.map((g, i) => ({
      label: gradeLabel(g, t.grades),
      value: rows.filter((r) => r.grade === g).length,
      caption: fmt(s.withCodes, { n: formatNumber(rows.filter((r) => r.grade === g && r.code).length, locale) }),
      icon: KeyRound,
      tone: ["bg-[#eef6fd] text-[#1d5f9e]", "bg-lavender-soft text-purple", "bg-mint-soft text-teal-deep"][i],
    })),
  ];

  return (
    <div className="print:hidden" aria-busy={pending}>
      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4" data-testid="code-stats">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex items-center justify-between gap-3 rounded-[1.25rem] bg-white p-5 shadow-soft ring-1 ring-line-soft">
            <div>
              <dd className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{formatNumber(tile.value, locale)}</dd>
              <dt className="mt-1 text-sm text-muted">{tile.label}</dt>
              <p className="mt-0.5 text-xs text-muted">{tile.caption}</p>
            </div>
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tile.tone}`}>
              <tile.icon className="size-5" aria-hidden />
            </span>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <ConfirmDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          tone="primary"
          title={s.confirmAllTitle}
          body={fmt(s.confirmAllBody, { n: formatNumber(missing, locale) })}
          confirmLabel={s.confirmGenerate}
          cancelLabel={t.common.cancel}
          onConfirm={runBulk}
          trigger={
            <Button
              variant="secondary"
              onClick={(e) => {
                if (missing === 0) {
                  e.preventDefault();
                  toast.info(s.allHaveCodes);
                }
              }}
            >
              <Shuffle className="size-4" aria-hidden />
              {s.generateAll}
            </Button>
          }
        />
        <Button onClick={() => print(null)}>
          <Printer className="size-4" aria-hidden />
          {s.print}
        </Button>
      </div>

      {result ? (
        <div
          role="status"
          data-testid="bulk-result"
          className="mt-4 flex items-start gap-3 rounded-2xl bg-mint-soft px-5 py-4 ring-1 ring-inset ring-teal/20"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-deep" aria-hidden />
          <div className="flex-1 text-[0.9375rem]">
            <p className="font-semibold text-teal-deep">
              {result.created > 0 ? plural(result.created, s.created, locale) : s.allHaveCodes}
            </p>
            {result.existing > 0 ? <p className="mt-0.5 text-ink-soft">{plural(result.existing, s.existing, locale)}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setResult(null)}
            aria-label={t.common.close}
            className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-white/70"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
          <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <label htmlFor="code-search" className="sr-only">
                {s.searchLabel}
              </label>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="code-search"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                placeholder={s.search}
                className="h-10 ps-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <div className="sm:w-44">
                <label htmlFor="code-grade" className="sr-only">
                  {s.gradeFilter}
                </label>
                <Select
                  id="code-grade"
                  value={grade}
                  className="h-10 text-sm"
                  onChange={(e) => {
                    setGrade(e.target.value);
                    resetPage();
                  }}
                >
                  <option value="">{s.allGrades}</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g, t.grades)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:w-40">
                <label htmlFor="code-status" className="sr-only">
                  {s.statusFilter}
                </label>
                <Select
                  id="code-status"
                  value={status}
                  className="h-10 text-sm"
                  onChange={(e) => {
                    setStatus(e.target.value as "" | "has" | "none");
                    resetPage();
                  }}
                >
                  <option value="">{s.allStatuses}</option>
                  <option value="has">{s.statusHas}</option>
                  <option value="none">{s.statusNone}</option>
                </Select>
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Users} title={s.noStudentsTitle} body={s.noStudentsBody} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted">{s.noMatches}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm" data-testid="codes-table">
                <thead className="border-b border-line-soft bg-canvas/70 text-[0.8125rem] text-ink-soft">
                  <tr>
                    <th scope="col" className="w-12 px-4 py-3 text-start font-semibold">{s.number}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{s.name}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{s.grade}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{s.code}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{s.status}</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold">{s.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {visible.map((row, i) => (
                    <CodeRow
                      key={row.id}
                      row={row}
                      index={(current - 1) * pageSize + i + 1}
                      onGenerate={runGenerate}
                      onRegenerate={runRegenerate}
                      onRemove={runRemove}
                      onCopy={copy}
                      onPrint={print}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted">
                <label htmlFor="code-page-size">{s.show}</label>
                <Select
                  id="code-page-size"
                  aria-label={s.pageSize}
                  value={pageSize}
                  className="h-9 w-20 text-sm"
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    resetPage();
                  }}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
                <span data-testid="codes-range">
                  {fmt(s.showing, {
                    from: formatNumber((current - 1) * pageSize + 1, locale),
                    to: formatNumber(Math.min(current * pageSize, filtered.length), locale),
                    total: formatNumber(filtered.length, locale),
                  })}
                </span>
              </div>
              <nav className="flex items-center gap-1.5" aria-label={s.title}>
                <PagerButton label={s.previous} disabled={current === 1} onClick={() => setPage(current - 1)}>
                  {dir === "rtl" ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
                </PagerButton>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - current) <= 1)
                  .map((n) => (
                    <PagerButton key={n} label={fmt(s.pageN, { n })} active={n === current} onClick={() => setPage(n)}>
                      {formatNumber(n, locale)}
                    </PagerButton>
                  ))}
                <PagerButton label={s.next} disabled={current === pages} onClick={() => setPage(current + 1)}>
                  {dir === "rtl" ? <ChevronLeft className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                </PagerButton>
              </nav>
            </div>
          ) : null}
        </section>

        <aside className="rounded-[1.25rem] bg-white p-5 shadow-soft ring-1 ring-line-soft" aria-label={s.printPreview}>
          <h2 className="font-semibold text-ink">{s.printPreview}</h2>
          <div className="mt-4 max-h-[36rem] overflow-y-auto rounded-xl p-4 ring-1 ring-line-soft">
            <CodesSheet rows={rows} t={t} locale={locale} date={today} compact />
          </div>
        </aside>
      </div>

      {/* Print output: a direct child of <body>, the only thing shown when printing. */}
      {mounted
        ? createPortal(
            <div id="print-root" dir={dir} lang={locale}>
              {printTarget?.code ? (
                <StudentCodeCard row={{ ...printTarget, code: printTarget.code }} t={t} locale={locale} date={today} />
              ) : (
                <CodesSheet rows={rows} t={t} locale={locale} date={today} />
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PagerButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg text-sm tabular-nums ring-1 ring-inset transition disabled:opacity-40",
        active ? "bg-purple text-white ring-purple" : "bg-white text-ink-soft ring-line hover:bg-canvas",
      )}
    >
      {children}
    </button>
  );
}

const iconButton =
  "grid size-9 place-items-center rounded-lg text-ink-soft ring-1 ring-inset ring-line-soft transition hover:bg-canvas hover:text-ink";

function CodeRow({
  row,
  index,
  onGenerate,
  onRegenerate,
  onRemove,
  onCopy,
  onPrint,
}: {
  row: StudentCodeRow;
  index: number;
  onGenerate: (row: StudentCodeRow) => Promise<void>;
  onRegenerate: (row: StudentCodeRow) => Promise<void>;
  onRemove: (row: StudentCodeRow) => Promise<void>;
  onCopy: (code: string) => void;
  onPrint: (row: StudentCodeRow) => void;
}) {
  const { t, locale, dir } = useI18n();
  const s = t.admin.studentCodes;
  const name = localName(row, locale);
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  return (
    <tr className="hover:bg-canvas/60" data-testid="code-row" data-student={row.name_en ?? row.name_ar ?? ""}>
      <td className="px-4 py-3.5 tabular-nums text-muted">{formatNumber(index, locale)}</td>
      <td className="max-w-[14rem] truncate px-3 py-3.5 font-medium text-ink">
        <span dir="auto">{name}</span>
      </td>
      <td className="px-3 py-3.5">{row.grade ? <SuggestionGradeBadge grade={row.grade} /> : <span className="text-muted">—</span>}</td>
      <td className="px-3 py-3.5">
        {row.code ? (
          <span dir="ltr" data-testid="student-code" className="font-semibold tabular-nums tracking-wider text-ink">
            {row.code}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-3.5">
        {row.code ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-medium text-teal-deep">
            <span className="size-1.5 rounded-full bg-[#16a34a]" aria-hidden />
            {s.active}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-line">
            <span className="size-1.5 rounded-full bg-[#9aa1ad]" aria-hidden />
            {s.noCode}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1.5">
          {row.code ? (
            <>
              <button type="button" className={iconButton} aria-label={`${s.copy}: ${name}`} title={s.copy} onClick={() => onCopy(row.code!)}>
                <Copy className="size-4" aria-hidden />
              </button>
              <ConfirmDialog
                tone="primary"
                title={s.confirmRegenerateTitle}
                body={fmt(s.confirmRegenerateBody, { name })}
                confirmLabel={s.confirmRegenerate}
                cancelLabel={t.common.cancel}
                onConfirm={() => onRegenerate(row)}
                trigger={
                  <button type="button" className={iconButton} aria-label={`${s.regenerate}: ${name}`} title={s.regenerate}>
                    <RefreshCw className="size-4" aria-hidden />
                  </button>
                }
              />
              <DropdownMenu.Root dir={dir}>
                <DropdownMenu.Trigger className={cn(iconButton, "data-[state=open]:bg-canvas")} aria-label={`${s.more}: ${name}`}>
                  <MoreVertical className="size-4" aria-hidden />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-48 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line data-[state=open]:animate-[fade-in_140ms_ease-out]"
                  >
                    <DropdownMenu.Item
                      onSelect={() => onPrint(row)}
                      className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas"
                    >
                      <Printer className="size-4 text-muted" aria-hidden />
                      {s.printOne}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setRemoveOpen(true)}
                      className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger-ink outline-none data-[highlighted]:bg-danger-soft"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {s.remove}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <ConfirmDialog
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                title={s.confirmRemoveTitle}
                body={fmt(s.confirmRemoveBody, { name })}
                confirmLabel={s.confirmRemove}
                cancelLabel={t.common.cancel}
                onConfirm={() => onRemove(row)}
                trigger={<span hidden />}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onGenerate(row);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <KeyRound className="size-3.5" aria-hidden />
              {s.generate}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
