"use client";

import { CalendarRange, Check, ChevronDown, Copy, Mail, MoreHorizontal, Phone, Search, X } from "lucide-react";
import { DropdownMenu, Popover } from "radix-ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { ORGANIZATION_CATEGORIES, SUPPORT_TYPES } from "@/lib/partners";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* Filters                                                                   */
/* ------------------------------------------------------------------------- */

const boxClass = "rounded-[1.125rem] bg-white p-4 shadow-soft ring-1 ring-line-soft";
const controlClass =
  "h-11 w-full rounded-xl border border-line bg-white text-sm text-ink transition-[border-color,box-shadow] hover:border-[#d3d7de] focus:border-purple/60 focus:outline-none focus:ring-4 focus:ring-purple/10";

/** Updates the list's query string (filters always return to page 1). */
function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Several quick changes build on each other even before the URL updates.
  const latest = useRef<string | null>(null);
  const current = params.toString();
  useEffect(() => {
    if (latest.current === current) latest.current = null;
  }, [current]);
  const update = (changes: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(latest.current ?? current);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!keepPage) next.delete("page");
    const qs = next.toString();
    latest.current = qs;
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

export function PartnerFilters() {
  const { t } = useI18n();
  const a = t.admin.partners;
  const { params, update, pending } = useQueryUpdater();
  const [q, setQ] = useState(params.get("q") ?? "");
  const lastSent = useRef(params.get("q") ?? "");

  // Follow the URL when it changes elsewhere (e.g. "Clear filters").
  const urlQ = params.get("q") ?? "";
  useEffect(() => {
    if (urlQ !== lastSent.current) {
      lastSent.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  // Search as the admin types (debounced).
  useEffect(() => {
    const value = q.trim();
    if (value === lastSent.current) return;
    const id = setTimeout(() => {
      lastSent.current = value;
      update({ q: value || null });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` changes with the URL
  }, [q]);

  const type = params.get("type");
  const category = params.get("category");
  const party = type === "individual" ? "individual" : category ? `category:${category}` : type === "organization" ? "organization" : "";

  const setParty = (value: string) => {
    if (value === "individual" || value === "organization") update({ type: value, category: null });
    else if (value.startsWith("category:")) update({ type: "organization", category: value.slice(9) });
    else update({ type: null, category: null });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]" data-testid="partner-filters" aria-busy={pending || undefined}>
      <div className={cn(boxClass, "flex items-center sm:col-span-2 xl:col-span-1")}>
        <label htmlFor="partner-search" className="sr-only">
          {a.searchLabel}
        </label>
        <div className="relative w-full">
          <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-4.5 -translate-y-1/2 text-muted" />
          <input
            id="partner-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={a.searchPlaceholder}
            className={cn(controlClass, "h-12 pe-4 ps-11")}
            dir="auto"
            autoComplete="off"
          />
        </div>
      </div>

      <FilterBox label={a.filterParty} htmlFor="partner-party">
        <NativeSelect id="partner-party" value={party} onChange={setParty}>
          <option value="">{a.allTypes}</option>
          <option value="individual">{a.individuals}</option>
          <option value="organization">{a.allOrganizations}</option>
          {ORGANIZATION_CATEGORIES.map((c) => (
            <option key={c} value={`category:${c}`}>
              {t.partners.categories[c]}
            </option>
          ))}
        </NativeSelect>
      </FilterBox>

      <FilterBox label={a.filterSupport} htmlFor="partner-support">
        <NativeSelect id="partner-support" value={params.get("support") ?? ""} onChange={(v) => update({ support: v || null })}>
          <option value="">{a.allTypes}</option>
          {SUPPORT_TYPES.map((s) => (
            <option key={s} value={s}>
              {t.partners.support[s]}
            </option>
          ))}
        </NativeSelect>
      </FilterBox>

      <FilterBox label={a.filterPeriod} htmlFor="partner-period">
        <PeriodPicker from={params.get("from") ?? ""} to={params.get("to") ?? ""} onApply={(from, to) => update({ from: from || null, to: to || null })} />
      </FilterBox>
    </div>
  );
}

function FilterBox({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className={boxClass}>
      <label htmlFor={htmlFor} className="mb-2 block text-[0.8125rem] font-semibold text-ink-soft">
        {label}
      </label>
      {children}
    </div>
  );
}

function NativeSelect({ id, value, onChange, children }: { id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlClass, "cursor-pointer appearance-none pe-10 ps-4 font-medium")}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

function PeriodPicker({ from, to, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
  const { t, locale, dir } = useI18n();
  const a = t.admin.partners;
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const label =
    from || to
      ? `${from ? formatDate(from, locale, "short") : "…"} – ${to ? formatDate(to, locale, "short") : "…"}`
      : a.choosePeriod;
  const valid = !draftFrom || !draftTo || draftFrom <= draftTo;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDraftFrom(from);
          setDraftTo(to);
        }
      }}
    >
      <div className="relative">
        <Popover.Trigger
          id="partner-period"
          className={cn(controlClass, "flex items-center gap-2.5 pe-10 ps-4 text-start", !(from || to) && "text-[#9aa1ad]")}
          data-testid="period-trigger"
        >
          <CalendarRange className="size-4.5 shrink-0 text-muted" aria-hidden />
          <span className="truncate font-medium">{label}</span>
        </Popover.Trigger>
        {from || to ? (
          <button
            type="button"
            onClick={() => onApply("", "")}
            className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
            aria-label={a.clear}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          dir={dir}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-lift ring-1 ring-line"
          data-testid="period-popover"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[0.8125rem] font-semibold text-ink-soft">
              {a.from}
              <input
                type="date"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
                className={cn(controlClass, "mt-1.5 px-2.5")}
                name="from"
              />
            </label>
            <label className="block text-[0.8125rem] font-semibold text-ink-soft">
              {a.to}
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className={cn(controlClass, "mt-1.5 px-2.5")}
                name="to"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onApply("", "");
              }}
              className="h-9 rounded-lg px-3.5 text-sm font-medium text-ink-soft hover:bg-canvas"
            >
              {a.clear}
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                setOpen(false);
                onApply(draftFrom, draftTo);
              }}
              className="h-9 rounded-lg bg-purple px-4 text-sm font-semibold text-white hover:bg-purple-strong disabled:opacity-50"
              data-testid="period-apply"
            >
              {a.apply}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------------- */
/* Page size                                                                 */
/* ------------------------------------------------------------------------- */

export function PageSizeSelect({ value, options }: { value: number; options: readonly number[] }) {
  const { t } = useI18n();
  const { update } = useQueryUpdater();
  return (
    <div className="relative w-20">
      <label htmlFor="partner-page-size" className="sr-only">
        {t.admin.partners.perPage}
      </label>
      <select
        id="partner-page-size"
        value={value}
        onChange={(e) => update({ size: e.target.value === String(options[0]) ? null : e.target.value })}
        className={cn(controlClass, "h-10 cursor-pointer appearance-none pe-8 ps-3.5 font-semibold tabular-nums")}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Copy contact details                                                      */
/* ------------------------------------------------------------------------- */

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        setState((await copyText(value)) ? "copied" : "failed");
        setTimeout(() => setState("idle"), 1800);
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset transition",
        state === "copied" ? "bg-mint-soft text-teal-deep ring-teal/25" : "bg-white text-purple-ink ring-line hover:bg-lavender-soft",
        className,
      )}
      aria-label={label}
    >
      {state === "copied" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{state === "copied" ? t.admin.partners.copied : state === "failed" ? t.admin.partners.copyFailed : label}</span>
    </button>
  );
}

/** "…" menu of a row: copy or use the contact details. */
export function PartnerRowMenu({ name, email, phone }: { name: string; email: string; phone: string }) {
  const { t, dir } = useI18n();
  const a = t.admin.partners;
  const [notice, setNotice] = useState<string | null>(null);
  const item = "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-canvas";
  const copy = async (value: string) => {
    setNotice((await copyText(value)) ? a.copied : a.copyFailed);
    setTimeout(() => setNotice(null), 1800);
  };
  return (
    <>
      <DropdownMenu.Root dir={dir}>
        <DropdownMenu.Trigger
          className="grid size-9 place-items-center rounded-lg text-ink-soft ring-1 ring-inset ring-line transition hover:bg-canvas hover:text-ink data-[state=open]:bg-canvas"
          aria-label={`${a.moreActions}: ${name}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line">
            <DropdownMenu.Item onSelect={() => copy(email)} className={item}>
              <Copy className="size-4 text-muted" aria-hidden />
              {a.copyEmail}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => copy(phone)} className={item}>
              <Copy className="size-4 text-muted" aria-hidden />
              {a.copyPhone}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
            <DropdownMenu.Item asChild className={item}>
              <a href={`mailto:${email}`}>
                <Mail className="size-4 text-muted" aria-hidden />
                {a.sendEmail}
              </a>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild className={item}>
              <a href={`tel:${phone}`}>
                <Phone className="size-4 text-muted" aria-hidden />
                {a.call}
              </a>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span className="sr-only" role="status" aria-live="polite">
        {notice ?? ""}
      </span>
    </>
  );
}
