"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";

export type MultiSelectLabels = {
  selected: string;
  done: string;
  clear: string;
  search: string;
  noResults: string;
};

/**
 * A form field that holds several choices: it looks like the other fields
 * (the chosen values sit inside it as tidy tags) and opens a list of
 * checkboxes. Native checkboxes keep it usable with a keyboard and a screen
 * reader; Escape or "Done" closes the list and returns to the field.
 */
export function MultiSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  invalid,
  describedById,
  labels,
  searchable,
}: {
  id: string;
  value: readonly string[];
  options: { value: string; label: string }[];
  onChange: (value: string[]) => void;
  placeholder: string;
  invalid: boolean;
  describedById?: string;
  labels: MultiSelectLabels;
  searchable?: boolean;
}) {
  const { dir, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const chosen = options.filter((o) => value.includes(o.value));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : options.map((o) => o.value).filter((o) => o === v || value.includes(o)));

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <Popover.Trigger
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={describedById}
        aria-invalid={invalid || undefined}
        data-focus={id}
        data-testid={`${id}-trigger`}
        className={cn(
          "flex min-h-12 w-full items-center gap-2 rounded-xl border bg-white py-2 pe-3 ps-3 text-start text-[0.9375rem] transition-[border-color,box-shadow] duration-200 focus:outline-none focus-visible:ring-4",
          invalid
            ? "border-danger-ink/50 focus-visible:ring-danger-ink/10"
            : "border-line hover:border-[#cfd3da] focus-visible:border-indigo/60 focus-visible:ring-indigo/10 data-[state=open]:border-indigo/60 data-[state=open]:ring-4 data-[state=open]:ring-indigo/10",
        )}
      >
        <span id={`${id}-value`} className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {chosen.length === 0 ? (
            <span className="px-1 text-[#9aa1ad]">{placeholder}</span>
          ) : (
            <>
              <span className="sr-only">{fmt(labels.selected, { n: formatNumber(chosen.length, locale) })}: </span>
              {chosen.map((o) => (
                <span
                  key={o.value}
                  className="inline-flex max-w-full items-center rounded-lg bg-lavender-soft px-2.5 py-1 text-[0.8125rem] font-semibold text-indigo-ink ring-1 ring-inset ring-indigo/15"
                  data-chosen={o.value}
                >
                  <span className="truncate">{o.label}</span>
                </span>
              ))}
            </>
          )}
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          dir={dir}
          collisionPadding={12}
          aria-labelledby={`${id}-label`}
          className="z-50 flex max-h-[min(22rem,70vh)] w-[var(--radix-popover-trigger-width)] min-w-[16rem] flex-col overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line"
          data-testid={`${id}-list`}
        >
          {searchable ? (
            <div className="border-b border-line-soft p-2.5">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={labels.search}
                  aria-label={labels.search}
                  aria-controls={listId}
                  className="h-10 w-full rounded-lg border border-line bg-canvas/60 pe-3 ps-9 text-sm text-ink placeholder:text-[#9aa1ad] focus:border-indigo/50 focus:outline-none focus:ring-4 focus:ring-indigo/10"
                />
              </div>
            </div>
          ) : null}
          <div id={listId} role="group" aria-labelledby={`${id}-label`} className="flex-1 overflow-y-auto overscroll-contain p-1.5">
            {shown.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted">{labels.noResults}</p> : null}
            {shown.map((o) => {
              const checked = value.includes(o.value);
              return (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] transition-colors has-[:focus-visible]:bg-canvas has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo/30",
                    checked ? "bg-lavender-soft/70 font-semibold text-indigo-ink" : "text-ink hover:bg-canvas",
                  )}
                  data-option={o.value}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                      checked ? "border-indigo bg-indigo text-white" : "border-[#c5cad3] bg-white",
                    )}
                  >
                    {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  {o.label}
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line-soft bg-canvas/50 px-2.5 py-2">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={value.length === 0}
              className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-white disabled:opacity-40"
            >
              {labels.clear}
            </button>
            <Popover.Close className="h-9 rounded-lg bg-indigo px-5 text-sm font-semibold text-white hover:bg-[#3418a6]" data-testid={`${id}-done`}>
              {labels.done}
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
