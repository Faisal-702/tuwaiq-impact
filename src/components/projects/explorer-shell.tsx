"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownWideNarrow, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { gradeLabel, localName } from "@/i18n/format";
import { CategoryIcon } from "@/lib/categories";
import type { ContentTypeFilter, ProjectSort } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ExplorerOptions = {
  categories: { slug: string; name_en: string; name_ar: string; icon: string }[];
  grades: number[];
  years: string[];
  students: { slug: string; name_en: string | null; name_ar: string | null }[];
};

const SORTS: ProjectSort[] = ["newest", "views", "points", "active"];
const TYPES: ContentTypeFilter[] = ["image", "video", "document", "link", "text"];
const FILTER_KEYS = ["grade", "year", "type", "student"] as const;

/**
 * Search, sort and filter controls for the project explorer. State lives in
 * the URL so every view is shareable; results are rendered on the server.
 */
export function ExplorerShell({ options, children }: { options: ExplorerOptions; children: ReactNode }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lastPushed = useRef(params.get("q") ?? "");

  // Keep the field in sync when the query changes from elsewhere (e.g. header search).
  const urlQ = params.get("q") ?? "";
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ);
  if (urlQ !== seenUrlQ) {
    setSeenUrlQ(urlQ);
    if (urlQ !== q.trim()) setQ(urlQ);
  }

  const navigate = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  // Debounced live search.
  useEffect(() => {
    const term = q.trim();
    if (term === lastPushed.current || term === urlQ) {
      lastPushed.current = term;
      return;
    }
    const timer = setTimeout(() => {
      lastPushed.current = term;
      navigate({ q: term || null });
    }, 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const category = params.get("category");
  const sort = (params.get("sort") as ProjectSort) || "newest";
  const activeFilters = FILTER_KEYS.filter((k) => params.get(k));

  const filterLabel = (key: (typeof FILTER_KEYS)[number], value: string) => {
    if (key === "grade") return gradeLabel(Number(value), t.grades);
    if (key === "type") return t.projects.contentTypes[value as ContentTypeFilter] ?? value;
    if (key === "student") {
      const s = options.students.find((x) => x.slug === value);
      return s ? localName(s, locale) : value;
    }
    return value;
  };

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          role="search"
          className="group relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            lastPushed.current = q.trim();
            navigate({ q: q.trim() || null });
          }}
        >
          <label htmlFor="project-search" className="sr-only">
            {t.projects.searchLabel}
          </label>
          {pending ? (
            <LoaderCircle aria-hidden className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 animate-spin text-purple" />
          ) : (
            <Search aria-hidden className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-purple" />
          )}
          <input
            id="project-search"
            type="search"
            dir="auto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.projects.searchPlaceholder}
            className="h-14 w-full rounded-2xl border border-line bg-white ps-14 pe-12 text-[1.0625rem] text-ink shadow-soft placeholder:text-[#9aa1ad] transition focus:border-purple/50 focus:outline-none focus:ring-4 focus:ring-purple/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                lastPushed.current = "";
                navigate({ q: null });
              }}
              aria-label={t.projects.clearSearch}
              className="absolute end-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </form>

        <div className="flex gap-3">
          <div className="relative flex-1 lg:w-52 lg:flex-none">
            <label htmlFor="project-sort" className="sr-only">
              {t.projects.sortLabel}
            </label>
            <ArrowDownWideNarrow aria-hidden className="pointer-events-none absolute start-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
            <Select
              id="project-sort"
              value={sort}
              onChange={(e) => navigate({ sort: e.target.value === "newest" ? null : e.target.value })}
              className="h-14 rounded-2xl ps-11 shadow-soft"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.projects.sort[s]}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="subtle"
            onClick={() => setFiltersOpen(true)}
            className="h-14 rounded-2xl bg-white px-5 shadow-soft"
            aria-haspopup="dialog"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t.projects.filters}
            {activeFilters.length > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-purple text-[0.6875rem] font-semibold text-white">
                {activeFilters.length}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* Category chips */}
      <div className="relative mt-5">
        <ul
          aria-label={t.projects.categoriesLabel}
          className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <li className="shrink-0">
            <CategoryButton active={!category} onClick={() => navigate({ category: null })} label={t.projects.allCategories} />
          </li>
          {options.categories.map((c) => (
            <li key={c.slug} className="shrink-0">
              <CategoryButton
                active={category === c.slug}
                onClick={() => navigate({ category: category === c.slug ? null : c.slug })}
                label={locale === "ar" ? c.name_ar : c.name_en}
                icon={c.icon}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Active filter pills */}
      <AnimatePresence initial={false}>
        {activeFilters.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 pt-4">
              {activeFilters.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate({ [key]: null })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lavender-soft py-1.5 pe-2.5 ps-3.5 text-sm text-purple-ink ring-1 ring-inset ring-purple/15 transition hover:ring-purple/35"
                >
                  {filterLabel(key, params.get(key)!)}
                  <X className="size-3.5" aria-hidden />
                  <span className="sr-only">{t.common.clearAll}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}
                className="px-2 text-sm font-medium text-muted transition hover:text-ink"
              >
                {t.projects.resetFilters}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        aria-busy={pending}
        className={cn("mt-8 transition-opacity duration-300", pending && "pointer-events-none opacity-55")}
      >
        {children}
      </div>

      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        options={options}
        initial={Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""]))}
        onApply={(values) => {
          setFiltersOpen(false);
          navigate(values);
        }}
      />
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-[background-color,color,box-shadow] duration-200",
        active
          ? "bg-ink text-white shadow-[0_6px_16px_-8px_rgb(31_41_55/0.6)]"
          : "bg-white text-ink-soft ring-1 ring-line hover:text-ink hover:ring-[#cfd3da]",
      )}
    >
      {icon ? <CategoryIcon name={icon} aria-hidden className={cn("size-4", active ? "text-mint" : "text-teal-deep")} /> : null}
      {label}
    </button>
  );
}

function FiltersDialog({
  open,
  onOpenChange,
  options,
  initial,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ExplorerOptions;
  initial: Record<string, string>;
  onApply: (values: Record<string, string | null>) => void;
}) {
  const { t, locale } = useI18n();
  const [values, setValues] = useState(initial);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues(initial);
  }
  const set = (key: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.projects.filtersTitle}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={() => onApply({ grade: null, year: null, type: null, student: null })}>
            {t.projects.resetFilters}
          </Button>
          <Button
            onClick={() =>
              onApply(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || null])))
            }
          >
            {t.projects.applyFilters}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.projects.filterGrade} htmlFor="f-grade">
          <Select id="f-grade" value={values.grade} onChange={set("grade")}>
            <option value="">{t.projects.anyGrade}</option>
            {options.grades.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g, t.grades)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.projects.filterYear} htmlFor="f-year">
          <Select id="f-year" value={values.year} onChange={set("year")}>
            <option value="">{t.projects.anyYear}</option>
            {options.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.projects.filterType} htmlFor="f-type">
          <Select id="f-type" value={values.type} onChange={set("type")}>
            <option value="">{t.projects.anyType}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t.projects.contentTypes[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.projects.filterStudent} htmlFor="f-student">
          <Select id="f-student" value={values.student} onChange={set("student")}>
            <option value="">{t.projects.anyStudent}</option>
            {options.students.map((s) => (
              <option key={s.slug} value={s.slug}>
                {localName(s, locale)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
