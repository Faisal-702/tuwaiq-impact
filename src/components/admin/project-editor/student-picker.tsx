"use client";

import { Plus, UserRound, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, gradeLabel, localName } from "@/i18n/format";
import { cn } from "@/lib/utils";

export type StudentOption = { id: string; name_en: string | null; name_ar: string | null; grade: number | null };
export type StudentValue = { id: string } | { name: string };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();

/** Combobox for assigning one or more students; unknown names can be created inline. */
export function StudentPicker({
  options,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  options: StudentOption[];
  value: StudentValue[];
  onChange: (v: StudentValue[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selectedIds = new Set(value.filter((v): v is { id: string } => "id" in v).map((v) => v.id));
  const q = normalize(query);
  const matches = useMemo(
    () =>
      options
        .filter((o) => !selectedIds.has(o.id))
        .filter((o) => !q || normalize(`${o.name_en ?? ""} ${o.name_ar ?? ""}`).includes(q))
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, q, value],
  );
  const exact = options.some((o) => normalize(o.name_en ?? "") === q || normalize(o.name_ar ?? "") === q);
  const canCreate = query.trim().length > 1 && !exact && !value.some((v) => "name" in v && normalize(v.name) === q);
  const entries = [...matches.map((m) => ({ type: "student" as const, option: m })), ...(canCreate ? [{ type: "create" as const }] : [])];

  const select = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    if (entry.type === "student") onChange([...value, { id: entry.option.id }]);
    else onChange([...value, { name: query.trim() }]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const labelFor = (v: StudentValue) => {
    if ("name" in v) return v.name;
    const o = options.find((x) => x.id === v.id);
    return o ? localName(o, locale) : "";
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2 py-1.5 transition focus-within:border-purple/60 focus-within:ring-4 focus-within:ring-purple/10",
          invalid ? "border-danger-ink/50" : "border-line hover:border-[#d3d7de]",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((v, i) => {
          const label = labelFor(v);
          return (
            <span
              key={"id" in v ? v.id : `new-${v.name}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg py-1 pe-1 ps-2.5 text-sm",
                "name" in v ? "bg-mint-soft text-teal-deep ring-1 ring-inset ring-teal/25" : "bg-lavender-soft text-purple-ink",
              )}
            >
              {"name" in v ? <Plus className="size-3.5" aria-hidden /> : null}
              <span dir="auto">{label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((_, j) => j !== i));
                }}
                aria-label={fmt(t.admin.editor.removeStudent, { name: label })}
                className="grid size-5 place-items-center rounded-md hover:bg-white/70"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id="project-students"
          role="combobox"
          aria-expanded={open && entries.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && entries[highlight] ? `${listId}-${highlight}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={query}
          dir="auto"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, entries.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (open && entries.length > 0) {
                e.preventDefault();
                select(highlight);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !query && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length === 0 ? t.admin.editor.studentSearch : ""}
          className="h-8 min-w-40 flex-1 bg-transparent px-1.5 text-[0.9375rem] text-ink placeholder:text-[#9aa1ad] focus:outline-none"
        />
      </div>

      {open && (entries.length > 0 || query.trim()) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-line"
        >
          {entries.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted">{t.admin.editor.noStudentMatches}</li>
          ) : (
            entries.map((entry, i) => (
              <li
                key={entry.type === "student" ? entry.option.id : "create"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(i);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  i === highlight ? "bg-canvas" : "",
                )}
              >
                {entry.type === "student" ? (
                  <>
                    <UserRound className="size-4 text-muted" aria-hidden />
                    <span className="flex-1 text-ink">{localName(entry.option, locale)}</span>
                    {entry.option.grade ? <span className="text-xs text-muted">{gradeLabel(entry.option.grade, t.grades.label)}</span> : null}
                  </>
                ) : (
                  <>
                    <Plus className="size-4 text-teal-deep" aria-hidden />
                    <span className="text-teal-deep">{fmt(t.admin.editor.createStudent, { name: query.trim() })}</span>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
