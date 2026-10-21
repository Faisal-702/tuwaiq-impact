"use client";

import {
  AlertCircle,
  ArrowDownUp,
  Bell,
  CalendarDays,
  CircleCheckBig,
  CirclePlus,
  Clock3,
  Coins,
  Copy,
  Database,
  Eye,
  FolderOpen,
  History,
  ImageIcon,
  Info,
  LayoutGrid,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
  Trophy,
  Undo2,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProjectCover } from "@/components/projects/project-cover";
import Link from "@/components/ui/link";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber } from "@/i18n/format";
import { CategoryIcon } from "@/lib/categories";
import { fundingTotals } from "@/lib/funding";
import { fieldLabel, PROJECT_TYPES } from "@/lib/submission";
import { cn } from "@/lib/utils";
import type { MyActivity, MyProject } from "@/server/queries/my-projects";
import { dayAndTime, money, relativeTime } from "./format";
import { FundingBar } from "./funding-bar";
import { FundsDialog } from "./funds-dialog";

export type MyNotification =
  | { kind: "profile"; projectId?: undefined; title?: undefined }
  | { kind: "pending" | "hidden" | "funded"; projectId: string; title: string }
  | { kind: "stale"; projectId: string; title: string; days: number };

type Sort = "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "title_asc";
const SORTS: Sort[] = ["updated_desc", "updated_asc", "created_desc", "created_asc", "title_asc"];
const PAGE = 8;

const card = "rounded-2xl bg-white ring-1 ring-[#eceef4] shadow-[0_8px_24px_-18px_rgb(30_27_90/0.25)]";

/**
 * "مشاريعي": the signed-in student's own projects (data from the server, for
 * this student only), with search, filters, funding and the sidebar.
 */
export function MyProjectsDashboard({
  projects,
  activity,
  notifications,
  now,
}: {
  projects: MyProject[];
  activity: MyActivity[];
  notifications: MyNotification[];
  now: string;
}) {
  const { t, locale } = useI18n();
  const m = t.myProjects;
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [field, setField] = useState("");
  const [sort, setSort] = useState<Sort>("updated_desc");
  const [shown, setShown] = useState(PAGE);
  const [funds, setFunds] = useState<{ id: string; history: boolean } | null>(null);

  const fieldOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of projects) {
      if (p.field && !seen.has(p.field)) seen.set(p.field, fieldLabel(p.field, null, locale) ?? p.field);
    }
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [projects, locale]);
  const typeOptions = PROJECT_TYPES.filter((v) => projects.some((p) => p.projectType === v));

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    const list = projects.filter(
      (p) => (!needle || p.title.toLocaleLowerCase().includes(needle)) && (!type || p.projectType === type) && (!field || p.field === field),
    );
    const by: Record<Sort, (a: MyProject, b: MyProject) => number> = {
      updated_desc: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      updated_asc: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
      created_desc: (a, b) => b.submittedAt.localeCompare(a.submittedAt),
      created_asc: (a, b) => a.submittedAt.localeCompare(b.submittedAt),
      title_asc: (a, b) => a.title.localeCompare(b.title, locale),
    };
    return [...list].sort(by[sort]);
  }, [projects, q, type, field, sort, locale]);

  const filtering = Boolean(q.trim() || type || field);
  const fundsProject = funds ? projects.find((p) => p.id === funds.id) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[21.5rem_minmax(0,1fr)] xl:grid-cols-[23.5rem_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5 lg:col-start-2 lg:row-start-1" data-testid="my-projects-main">
        <StatsRow projects={projects} now={now} />
        <Toolbar
          q={q}
          onQ={(v) => {
            setQ(v);
            setShown(PAGE);
          }}
          type={type}
          onType={(v) => {
            setType(v);
            setShown(PAGE);
          }}
          typeOptions={typeOptions.map((v) => ({ value: v, label: t.submit.options.projectType[v] }))}
          field={field}
          onField={(v) => {
            setField(v);
            setShown(PAGE);
          }}
          fieldOptions={fieldOptions}
          sort={sort}
          onSort={setSort}
        />
        {filtered.length === 0 ? (
          <EmptyList
            filtering={filtering}
            onClear={() => {
              setQ("");
              setType("");
              setField("");
            }}
          />
        ) : (
          <>
            <ul className="space-y-4" data-testid="my-projects-list">
              {filtered.slice(0, shown).map((p) => (
                <li key={p.id}>
                  <MyProjectCard project={p} onFunds={(history) => setFunds({ id: p.id, history })} />
                </li>
              ))}
            </ul>
            {filtered.length > shown ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted">
                  {fmt(m.showing, { shown: formatNumber(shown, locale), total: formatNumber(filtered.length, locale) })}
                </p>
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="h-10 rounded-xl bg-white px-5 text-sm font-semibold text-[#5c3bfc] ring-1 ring-inset ring-[#d9d2fb] transition hover:bg-lavender-soft"
                >
                  {m.showMore}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <aside className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1" aria-label={m.summary.title} data-testid="my-projects-sidebar">
        <FundingSummary projects={projects} />
        <ActivityCard activity={activity} now={now} />
        <NotificationsCard notifications={notifications} />
      </aside>

      {fundsProject ? (
        <FundsDialog
          project={fundsProject}
          open
          focusHistory={funds?.history}
          onOpenChange={(open) => {
            if (!open) setFunds(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function StatsRow({ projects, now }: { projects: MyProject[]; now: string }) {
  const { t, locale } = useI18n();
  const s = t.myProjects.stats;
  const totals = fundingTotals(projects.map((p) => p.funding));
  const supervisors = new Set(projects.flatMap((p) => p.supervisors.map((n) => n.trim().toLocaleLowerCase())));
  const latest = projects.reduce<string | null>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null);
  const last = latest ? dayAndTime(latest, now, t, locale) : null;
  return (
    <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="my-projects-stats">
      <Stat icon={Database} tone="bg-[#f3edff] text-[#5b45ca]" label={s.projects} value={formatNumber(projects.length, locale)} unit={s.projectsUnit} testId="stat-projects" />
      <Stat icon={WalletCards} tone="bg-[#ebf1f8] text-[#3554cb]" label={s.remaining} value={formatNumber(totals.remaining, locale)} unit={t.submit.currency} testId="stat-remaining" />
      <Stat icon={UsersRound} tone="bg-[#ebf1f8] text-[#2b51c6]" label={s.supervisors} value={formatNumber(supervisors.size, locale)} unit={s.supervisorsUnit} testId="stat-supervisors" />
      <Stat
        icon={CalendarDays}
        tone="bg-[#f3edff] text-[#553dd0]"
        label={s.lastUpdate}
        value={last ? last.day : s.none}
        unit={last ? fmt(s.at, { time: last.time }) : ""}
        small={!last}
        testId="stat-last-update"
      />
    </ul>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  small,
  testId,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  unit: string;
  small?: boolean;
  testId: string;
}) {
  return (
    <li className={cn(card, "flex items-center justify-between gap-3 px-4 py-4 sm:px-5")} data-testid={testId}>
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-medium text-[#5b6070]">{label}</p>
        <p className={cn("mt-1 truncate font-bold tabular-nums text-[#0d1340]", small ? "text-base" : "text-[1.5rem] leading-tight")} data-value>
          {value}
        </p>
        {unit ? <p className="mt-0.5 truncate text-xs text-muted">{unit}</p> : null}
      </div>
      <span aria-hidden className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", tone)}>
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Search, filters, sort
// ---------------------------------------------------------------------------

const box = "relative flex h-12 items-center rounded-xl bg-white ring-1 ring-inset ring-[#e3e6ee] transition focus-within:ring-2 focus-within:ring-[#5c3bfc]/40";

function Toolbar(props: {
  q: string;
  onQ: (v: string) => void;
  type: string;
  onType: (v: string) => void;
  typeOptions: { value: string; label: string }[];
  field: string;
  onField: (v: string) => void;
  fieldOptions: { value: string; label: string }[];
  sort: Sort;
  onSort: (v: Sort) => void;
}) {
  const { t } = useI18n();
  const tb = t.myProjects.toolbar;
  return (
    <div className={cn(card, "grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)]")} data-testid="my-projects-toolbar">
      <div className={cn(box, "sm:col-span-2 xl:col-span-1")}>
        <label htmlFor="my-search" className="sr-only">
          {tb.searchLabel}
        </label>
        <Search aria-hidden className="pointer-events-none absolute start-4 size-[1.125rem] text-[#5b6070]" />
        <input
          id="my-search"
          type="search"
          value={props.q}
          onChange={(e) => props.onQ(e.target.value)}
          placeholder={tb.search}
          className="h-full w-full rounded-xl bg-transparent pe-4 ps-11 text-[0.9375rem] text-ink placeholder:text-[#8a90a0] focus:outline-none"
          dir="auto"
          autoComplete="off"
        />
      </div>
      <SelectBox id="my-type" label={tb.typeLabel} icon={Database} value={props.type} onChange={props.onType}>
        <option value="">{tb.allTypes}</option>
        {props.typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectBox>
      <SelectBox id="my-field" label={tb.fieldLabel} icon={LayoutGrid} value={props.field} onChange={props.onField}>
        <option value="">{tb.allFields}</option>
        {props.fieldOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectBox>
      <SelectBox id="my-sort" label={tb.sortLabel} icon={ArrowDownUp} value={props.sort} onChange={(v) => props.onSort(v as Sort)}>
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {tb.sort[s]}
          </option>
        ))}
      </SelectBox>
    </div>
  );
}

function SelectBox({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={box}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon aria-hidden className="pointer-events-none absolute start-4 size-[1.125rem] text-[#5b6070]" />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent pe-10 ps-11 text-[0.9375rem] font-medium text-ink focus:outline-none"
      >
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute end-4 size-4 text-[#5b6070]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------

function MyProjectCard({ project: p, onFunds }: { project: MyProject; onFunds: (history: boolean) => void }) {
  const { t, locale } = useI18n();
  const m = t.myProjects;
  const field = fieldLabel(p.field, p.field_other, locale) ?? (locale === "ar" ? p.category.name_ar : p.category.name_en);
  const f = p.funding;
  const reached = p.hasTarget && f.remaining <= 0;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/projects/${p.slug}`);
      toast.success(m.card.linkCopied);
    } catch {
      toast.error(m.card.copyFailed);
    }
  }

  return (
    <article className={cn(card, "grid gap-4 p-3 sm:p-3.5 md:grid-cols-[minmax(0,1fr)_15rem] xl:grid-cols-[minmax(0,1fr)_16.5rem]")} data-testid="my-project-card" data-project={p.id}>
      <div className="flex min-w-0 flex-col gap-3 md:order-1">
        {/* Supervisors (start) and title + summary */}
        <div className="flex flex-col gap-3 xl:flex-row-reverse xl:items-start xl:gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#eef2f9] px-3 py-1.5 text-xs font-semibold text-[#5a6175]" data-testid="card-field">
                <CategoryIcon name={p.category.icon} className="size-3.5 shrink-0 text-[#5173b0]" aria-hidden />
                <span className="truncate" dir="auto">
                  {field}
                </span>
              </span>
              <h3 dir="auto" className="min-w-0 flex-1 text-[1.0625rem] font-bold leading-snug text-[#1f2140]" data-testid="card-title">
                {p.title}
              </h3>
              {p.projectStatus === "complete" || p.projectStatus === "incomplete" ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    p.projectStatus === "complete" ? "bg-[#e0f6f1] text-[#2f8f7f]" : "bg-[#edf4ff] text-[#3554cb]",
                  )}
                >
                  {p.projectStatus === "complete" ? m.card.complete : m.card.incomplete}
                </span>
              ) : null}
            </div>
            {p.summary ? (
              <p dir="auto" className="mt-2 line-clamp-2 text-[0.875rem] leading-relaxed text-[#818690]" title={p.summary} data-testid="card-summary">
                {p.summary}
              </p>
            ) : null}
            {p.status === "draft" || p.hasPendingEdit ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {p.status === "draft" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fef4ec] px-2.5 py-1 text-xs font-semibold text-[#b45e3e]">
                    <AlertCircle className="size-3.5" aria-hidden />
                    {m.card.hidden}
                  </span>
                ) : null}
                {p.hasPendingEdit ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#edf4ff] px-2.5 py-1 text-xs font-semibold text-[#2348c0]">
                    <PencilLine className="size-3.5" aria-hidden />
                    {m.card.pendingEdit}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 xl:w-[18rem]" data-testid="card-supervisors">
            <p className="text-[0.8125rem] font-semibold text-[#2a3652]">{m.card.supervisors}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {p.supervisors.length ? (
                p.supervisors.map((name) => (
                  <li
                    key={name}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f7f8fc] px-3 py-1.5 text-xs font-medium text-[#556070] ring-1 ring-inset ring-[#e8eaf2]"
                  >
                    <UserRound className="size-3.5 shrink-0 text-[#5c3bfc]" aria-hidden />
                    <span className="truncate" dir="auto">
                      {name}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-xs text-muted">{m.card.noSupervisor}</li>
              )}
            </ul>
          </div>
        </div>

        {/* Funding */}
        <div className="grid items-center gap-3 rounded-xl bg-[#fafbfe] px-3.5 py-3 ring-1 ring-inset ring-[#eef0f6] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-5" data-testid="card-funding">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-[#e0f6f1] text-[#029988]">
              <Coins className="size-5" />
            </span>
            <div>
              <p className="text-xs text-[#5b6070]">{m.card.target}</p>
              <p className="font-bold tabular-nums text-[#2a3652]" data-testid="card-target">
                {p.hasTarget ? money(f.requested, t, locale) : m.card.noTarget}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-xs text-[#5b6070]" data-testid="card-raised">
              {reached ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[#029988]">
                  <CircleCheckBig className="size-3.5" aria-hidden />
                  {m.card.fullyFunded}
                </span>
              ) : (
                fmt(m.card.raisedOf, { raised: money(f.recorded, t, locale), target: money(f.requested, t, locale) })
              )}
            </p>
            <FundingBar funding={f} label={fmt(m.card.progressLabel, { n: formatNumber(f.percent, locale) })} />
          </div>
          <div className="sm:text-end">
            <p className="text-xs text-[#5b6070]">{m.card.remaining}</p>
            <p className="text-lg font-bold tabular-nums text-[#24958c]" data-testid="card-remaining">
              {money(f.remaining, t, locale)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onFunds(false)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5c3bfc] px-4 text-sm font-semibold text-white shadow-[0_10px_20px_-14px_rgb(92_59_252/0.9)] transition hover:bg-[#4c2ee0]"
            data-testid="action-add-funds"
          >
            <CirclePlus className="size-4" aria-hidden />
            {m.actions.addFunds}
          </button>
          <Link
            href={`/my-projects/${p.id}/edit`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#5c3bfc] ring-1 ring-inset ring-[#cfc6f8] transition hover:bg-lavender-soft"
            data-testid="action-edit"
          >
            <PencilLine className="size-4" aria-hidden />
            {m.actions.edit}
          </Link>
          {p.status === "published" ? (
            <Link
              href={`/projects/${p.slug}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#5c3bfc] ring-1 ring-inset ring-[#cfc6f8] transition hover:bg-lavender-soft"
              data-testid="action-view"
            >
              <Eye className="size-4" aria-hidden />
              {m.actions.view}
            </Link>
          ) : (
            <span
              className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-canvas px-4 text-sm font-semibold text-muted ring-1 ring-inset ring-line"
              title={m.actions.notPublished}
              aria-disabled="true"
              data-testid="action-view"
            >
              <Eye className="size-4" aria-hidden />
              {m.actions.view}
            </span>
          )}
        </div>
      </div>

      {/* Cover */}
      <div className="relative order-first aspect-[16/10] overflow-hidden rounded-xl bg-canvas md:order-2 md:aspect-auto md:min-h-[11.25rem]">
        <ProjectCover project={p} className="absolute inset-0" />
        {!p.cover ? <span className="sr-only">{m.card.noCover}</span> : null}
        <DropdownMenu.Root dir={locale === "ar" ? "rtl" : "ltr"}>
          <DropdownMenu.Trigger
            className="absolute end-3 top-3 grid size-8 place-items-center rounded-lg bg-white/95 text-[#2a3652] shadow-sm ring-1 ring-black/5 transition hover:bg-white"
            aria-label={fmt(m.card.menu, { title: p.title })}
            data-testid="card-menu"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line">
              <DropdownMenu.Item
                onSelect={() => onFunds(true)}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas"
              >
                <History className="size-4 text-muted" aria-hidden />
                {m.card.supportHistory}
              </DropdownMenu.Item>
              {p.status === "published" ? (
                <DropdownMenu.Item
                  onSelect={() => void copyLink()}
                  className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas"
                >
                  <Copy className="size-4 text-muted" aria-hidden />
                  {m.card.copyLink}
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </article>
  );
}

function EmptyList({ filtering, onClear }: { filtering: boolean; onClear: () => void }) {
  const { t } = useI18n();
  const e = t.myProjects.empty;
  return (
    <div className={cn(card, "flex flex-col items-center px-6 py-14 text-center")} data-testid="my-projects-empty">
      <span className="grid size-16 place-items-center rounded-2xl bg-[#f3edff] text-[#5b45ca]">
        {filtering ? <Search className="size-7" aria-hidden /> : <FolderOpen className="size-7" aria-hidden />}
      </span>
      <p className="mt-5 text-lg font-bold text-[#1f2140]">{filtering ? e.filteredTitle : e.title}</p>
      <p className="mt-1.5 max-w-sm text-[0.9375rem] leading-relaxed text-muted">{filtering ? e.filteredBody : e.body}</p>
      {filtering ? (
        <button type="button" onClick={onClear} className="mt-6 h-10 rounded-xl bg-white px-5 text-sm font-semibold text-[#5c3bfc] ring-1 ring-inset ring-[#cfc6f8] hover:bg-lavender-soft">
          {e.clear}
        </button>
      ) : (
        <Link href="/add-project" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#5c3bfc] px-6 text-sm font-semibold text-white hover:bg-[#4c2ee0]">
          <Plus className="size-4" aria-hidden />
          {t.myProjects.addNew}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function FundingSummary({ projects }: { projects: MyProject[] }) {
  const { t, locale } = useI18n();
  const s = t.myProjects.summary;
  const totals = fundingTotals(projects.map((p) => p.funding));
  const r = 54;
  const c = 2 * Math.PI * r;
  const raisedShare = totals.requested > 0 ? Math.min(1, totals.recorded / totals.requested) : 0;
  const remainingShare = totals.requested > 0 ? Math.min(1 - raisedShare, totals.remaining / totals.requested) : 0;
  return (
    <section className={cn(card, "p-5")} aria-labelledby="funding-summary-title" data-testid="funding-summary">
      <h2 id="funding-summary-title" className="flex items-center gap-2 text-[1.0625rem] font-bold text-[#1f2140]">
        <Trophy className="size-5 text-[#6450cd]" aria-hidden />
        {s.title}
      </h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <dl className="space-y-3.5">
          {(
            [
              ["target", s.target, totals.requested, "bg-[#8b96a9]", "text-[#2a3652]"],
              ["raised", s.raised, totals.recorded, "bg-[#029b87]", "text-[#2f927e]"],
              ["remaining", s.remaining, totals.remaining, "bg-[#d8dfea]", "text-[#2f927e]"],
            ] as const
          ).map(([key, label, value, dot, tone]) => (
            <div key={key} className="flex items-start gap-2.5" data-testid={`summary-${key}`}>
              <span aria-hidden className={cn("mt-1.5 size-3 shrink-0 rounded-full", dot)} />
              <div>
                <dt className="text-[0.8125rem] text-[#5b6070]">{label}</dt>
                <dd className={cn("font-bold tabular-nums", tone)} data-value={value}>
                  {money(value, t, locale)}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        <figure className="relative size-[9.5rem] shrink-0">
          <svg
            viewBox="0 0 140 140"
            className="size-full -rotate-90"
            role="img"
            aria-label={fmt(s.chartLabel, { raised: money(totals.recorded, t, locale), target: money(totals.requested, t, locale), n: formatNumber(totals.percent, locale) })}
          >
            <circle cx="70" cy="70" r={r} fill="none" stroke="#dadfe8" strokeWidth="18" />
            {remainingShare > 0 ? (
              <circle
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke="#c7ede7"
                strokeWidth="18"
                strokeDasharray={`${remainingShare * c} ${c}`}
                strokeDashoffset={-raisedShare * c}
              />
            ) : null}
            {raisedShare > 0 ? (
              <circle cx="70" cy="70" r={r} fill="none" stroke="#029988" strokeWidth="18" strokeDasharray={`${raisedShare * c} ${c}`} />
            ) : null}
          </svg>
          <figcaption className="absolute inset-0 grid place-content-center text-center">
            <span className="text-[1.375rem] font-bold leading-none tabular-nums text-[#1f2140]" data-testid="summary-center">
              {formatNumber(totals.recorded, locale)}
            </span>
            <span className="mt-1 text-xs font-medium text-[#5b6070]">{t.submit.currency}</span>
            <span className="text-[0.6875rem] text-muted">{s.center}</span>
          </figcaption>
        </figure>
      </div>
      <p className="mt-4 border-t border-line-soft pt-3 text-[0.75rem] leading-relaxed text-muted">{s.note}</p>
    </section>
  );
}

const ACTIVITY_ICON: Record<MyActivity["kind"], LucideIcon> = {
  created: Plus,
  edited: PencilLine,
  cover_changed: ImageIcon,
  support_added: CirclePlus,
  support_reversed: Undo2,
};

function ActivityCard({ activity, now }: { activity: MyActivity[]; now: string }) {
  const { t, locale } = useI18n();
  const a = t.myProjects.activity;
  const [all, setAll] = useState(false);
  const items = all ? activity : activity.slice(0, 4);
  return (
    <section className={cn(card, "p-5")} aria-labelledby="activity-title" data-testid="activity-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="activity-title" className="flex items-center gap-2 text-[1.0625rem] font-bold text-[#1f2140]">
          <Clock3 className="size-5 text-[#5c4bb5]" aria-hidden />
          {a.title}
        </h2>
        {activity.length > 4 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="text-sm font-semibold text-[#6f5fbf] hover:underline" aria-expanded={all}>
            {all ? a.showLess : a.viewAll}
          </button>
        ) : null}
      </div>
      {activity.length === 0 ? (
        <p className="mt-4 rounded-xl bg-canvas px-4 py-5 text-center text-sm text-muted" data-testid="activity-empty">
          {a.empty}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft" data-testid="activity-list">
          {items.map((item) => {
            const Icon = ACTIVITY_ICON[item.kind];
            const text = fmt(a[item.kind], { title: item.projectTitle, amount: item.amount !== null ? money(item.amount, t, locale) : "" });
            return (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3" data-kind={item.kind}>
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f2f0fe] text-[#553dd2]">
                  <Icon className="size-4" />
                </span>
                <p dir="auto" className="min-w-0 flex-1 text-[0.8125rem] font-medium leading-snug text-[#2a3652]">
                  {text}
                </p>
                <time dateTime={item.at} className="shrink-0 text-[0.6875rem] text-muted">
                  {relativeTime(item.at, now, locale)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NotificationsCard({ notifications }: { notifications: MyNotification[] }) {
  const { t, locale } = useI18n();
  const n = t.myProjects.notifications;
  const [all, setAll] = useState(false);
  const items = all ? notifications : notifications.slice(0, 2);
  return (
    <section className={cn(card, "p-5")} aria-labelledby="notifications-title" data-testid="notifications-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notifications-title" className="flex items-center gap-2 text-[1.0625rem] font-bold text-[#1f2140]">
          <Bell className="size-5 text-[#d43d5b]" aria-hidden />
          {n.title}
        </h2>
        {notifications.length > 2 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="text-sm font-semibold text-[#6f5fbf] hover:underline" aria-expanded={all}>
            {all ? n.showLess : n.viewAll}
          </button>
        ) : null}
      </div>
      {notifications.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#f3fcfb] px-4 py-3.5 text-sm font-medium text-[#2f8f7f] ring-1 ring-inset ring-[#d5f1eb]" data-testid="notifications-none">
          <CircleCheckBig className="size-4 shrink-0" aria-hidden />
          {n.none}
        </p>
      ) : (
        <ul className="mt-4 space-y-3" data-testid="notifications-list">
          {items.map((item) => {
            const style =
              item.kind === "hidden" || item.kind === "profile"
                ? { box: "bg-[#fef4ec] ring-[#fbe2cf]", title: "text-[#b45e3e]", icon: AlertCircle, iconTone: "text-[#d9822b]" }
                : item.kind === "funded"
                  ? { box: "bg-[#f3fcfb] ring-[#d5f1eb]", title: "text-[#1d7f70]", icon: CircleCheckBig, iconTone: "text-[#029988]" }
                  : { box: "bg-[#edf4ff] ring-[#d6e4ff]", title: "text-[#2348c0]", icon: Info, iconTone: "text-[#2348c0]" };
            const Icon = style.icon;
            const title =
              item.kind === "profile"
                ? n.profileTitle
                : item.kind === "stale"
                  ? n.staleTitle
                  : fmt(n[`${item.kind}Title` as "pendingTitle" | "hiddenTitle" | "fundedTitle"], { title: item.title });
            const body =
              item.kind === "profile"
                ? n.profileBody
                : item.kind === "stale"
                  ? fmt(n.staleBody, { title: item.title, days: formatNumber(item.days, locale) })
                  : n[`${item.kind}Body` as "pendingBody" | "hiddenBody" | "fundedBody"];
            const href =
              item.kind === "profile" ? "/profile" : item.kind === "pending" || item.kind === "stale" ? `/my-projects/${item.projectId}/edit` : null;
            const content = (
              <>
                <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", style.iconTone)} />
                <span className="min-w-0">
                  <span dir="auto" className={cn("block text-[0.875rem] font-bold leading-snug", style.title)}>
                    {title}
                  </span>
                  <span dir="auto" className="mt-1 block text-[0.8125rem] leading-relaxed text-[#5b6070]">
                    {body}
                  </span>
                </span>
              </>
            );
            return (
              <li key={`${item.kind}-${item.projectId ?? ""}`} data-kind={item.kind}>
                {href ? (
                  <Link href={href} className={cn("flex gap-3 rounded-xl p-3.5 ring-1 ring-inset transition hover:brightness-[0.98]", style.box)}>
                    {content}
                  </Link>
                ) : (
                  <div className={cn("flex gap-3 rounded-xl p-3.5 ring-1 ring-inset", style.box)}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
