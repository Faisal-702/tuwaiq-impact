"use client";

import { ArrowRight, FolderOpen, LoaderCircle, Search, UserRound, X } from "lucide-react";
import { Dialog } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CategoryChip } from "@/components/ui/chip";
import { useI18n } from "@/i18n/client";
import { fmt, gradeLabel, localName } from "@/i18n/format";

type Results = {
  projects: {
    slug: string;
    title: string;
    category: { name_en: string; name_ar: string; icon: string; accent: string };
    students: { name_en: string | null; name_ar: string | null }[];
  }[];
  students: { slug: string; name_en: string | null; name_ar: string | null; grade: number | null }[];
};

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted */
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const term = q.trim();
  const shown = term.length >= 2 ? results : null;
  const close = () => onOpenChange(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setQ("");
          setResults(null);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0f1729]/30 backdrop-blur-[3px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-3xl bg-white shadow-panel ring-1 ring-line focus:outline-none data-[state=open]:animate-[fade-in_180ms_ease-out]"
        >
          <Dialog.Title className="sr-only">{t.search.title}</Dialog.Title>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (!term) return;
              close();
              router.push(`/projects?q=${encodeURIComponent(term)}`);
            }}
            className="flex items-center gap-3 border-b border-line-soft px-5"
          >
            {loading ? (
              <LoaderCircle className="size-5 shrink-0 animate-spin text-purple" aria-hidden />
            ) : (
              <Search className="size-5 shrink-0 text-muted" aria-hidden />
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search.placeholder}
              aria-label={t.search.title}
              className="h-16 flex-1 bg-transparent text-[1.0625rem] text-ink placeholder:text-[#9aa1ad] focus:outline-none"
              dir="auto"
            />
            <Dialog.Close
              aria-label={t.common.close}
              className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
            >
              <X className="size-4.5" aria-hidden />
            </Dialog.Close>
          </form>

          <div className="max-h-[60vh] overflow-y-auto p-3" aria-live="polite">
            {!shown ? (
              <p className="px-3 py-6 text-center text-sm text-muted">{t.search.hint}</p>
            ) : shown.projects.length === 0 && shown.students.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">{fmt(t.search.noResults, { q: term })}</p>
            ) : (
              <div className="space-y-4">
                {shown.projects.length > 0 ? (
                  <section>
                    <h3 className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted rtl:tracking-normal">
                      {t.search.projects}
                    </h3>
                    <ul>
                      {shown.projects.map((p) => (
                        <li key={p.slug}>
                          <Link
                            href={`/projects/${p.slug}`}
                            onClick={close}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-canvas focus-visible:bg-canvas"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lavender-soft text-purple">
                              <FolderOpen className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span dir="auto" className="block truncate font-medium text-ink">
                                {p.title}
                              </span>
                              <span className="block truncate text-sm text-muted">
                                {p.students.map((s) => localName(s, locale)).join("، ")}
                              </span>
                            </span>
                            <CategoryChip
                              size="xs"
                              name={locale === "ar" ? p.category.name_ar : p.category.name_en}
                              icon={p.category.icon}
                              accent={p.category.accent}
                              className="hidden sm:inline-flex"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {shown.students.length > 0 ? (
                  <section>
                    <h3 className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted rtl:tracking-normal">
                      {t.search.students}
                    </h3>
                    <ul>
                      {shown.students.map((s) => (
                        <li key={s.slug}>
                          <Link
                            href={`/students/${s.slug}`}
                            onClick={close}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-canvas focus-visible:bg-canvas"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint-soft text-teal-deep">
                              <UserRound className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-ink">{localName(s, locale)}</span>
                              {s.grade ? (
                                <span className="block text-sm text-muted">{gradeLabel(s.grade, t.grades.label)}</span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <Link
                  href={`/projects?q=${encodeURIComponent(term)}`}
                  onClick={close}
                  className="flex items-center justify-center gap-2 rounded-xl border-t border-line-soft px-3 py-3 text-sm font-medium text-purple transition hover:bg-lavender-soft"
                >
                  {fmt(t.search.seeAll, { q: term })}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
