"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** The search as sent in the URL: trimmed, repeated spaces collapsed. */
const clean = (value: string) => value.trim().replace(/\s+/g, " ");

/**
 * "Search by student name…" above the Manage Projects table. Updates the
 * list as the admin types (debounced): the search goes into `?q=` and the
 * page searches every submitted project on the server. While the new list
 * loads, the current one stays in place, dimmed, with a spinner in the
 * field. Clearing the field brings back the full list.
 */
export function SubmissionSearch({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const p = t.admin.projects;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const lastSent = useRef(clean(urlQ));

  // Follow the URL when it changes elsewhere (back/forward).
  useEffect(() => {
    if (clean(urlQ) !== lastSent.current) {
      lastSent.current = clean(urlQ);
      setQ(urlQ);
    }
  }, [urlQ]);

  const send = (value: string) => {
    lastSent.current = value;
    startTransition(() => router.replace(value ? `${pathname}?q=${encodeURIComponent(value)}` : pathname, { scroll: false }));
  };

  // Search as the admin types (debounced).
  useEffect(() => {
    const value = clean(q);
    if (value === lastSent.current) return;
    const id = setTimeout(() => send(value), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `send` changes with the URL
  }, [q]);

  return (
    <>
      <form
        role="search"
        className="group relative mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          send(clean(q));
        }}
      >
        <label htmlFor="submission-search" className="sr-only">
          {p.searchLabel}
        </label>
        {pending ? (
          <LoaderCircle aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-purple" data-testid="submission-search-loading" />
        ) : (
          <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-purple" />
        )}
        <input
          id="submission-search"
          type="search"
          // Empty, the placeholder follows the page direction; typed names follow their own script.
          dir={q ? "auto" : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={p.searchPlaceholder}
          autoComplete="off"
          maxLength={100}
          className="h-12 w-full rounded-[1.125rem] border border-line bg-white ps-12 pe-12 text-[0.9375rem] text-ink shadow-soft placeholder:text-[#9aa1ad] transition focus:border-purple/50 focus:outline-none focus:ring-4 focus:ring-purple/10 [&::-webkit-search-cancel-button]:hidden"
          data-testid="submission-search"
        />
        {q ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              send("");
            }}
            aria-label={p.clearSearch}
            className="absolute end-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
            data-testid="submission-search-clear"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </form>
      <div aria-busy={pending || undefined} className={cn("transition-opacity", pending && "opacity-60")} data-testid="submission-results">
        {children}
      </div>
    </>
  );
}
