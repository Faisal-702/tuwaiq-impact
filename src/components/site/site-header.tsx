"use client";

import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, LogOut, Menu, MessageSquareText, Search, UserRound, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/brand/language-switcher";
import { SchoolBrand } from "@/components/brand/school-brand";
import { SuggestionsDialog, SuggestionsNavButton } from "@/components/suggestions/suggestion-dialog";
import { useI18n } from "@/i18n/client";
import { localName } from "@/i18n/format";
import { HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/settings";
import { SearchDialog } from "./search-dialog";

/** "Suggestions" sits between Leaderboard and About. */
const SUGGESTIONS_AFTER = "/leaderboard";

export function SiteHeader({
  isAdmin,
  student = null,
}: {
  isAdmin: boolean;
  /** The signed-in student (name only), when the viewer is a student. */
  student?: { name_en: string | null; name_ar: string | null } | null;
}) {
  const { t, locale, dir } = useI18n();
  const studentName = student ? localName(student, locale) : "";
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = [
    { href: HOME_PATH, label: t.nav.home },
    { href: "/projects", label: t.nav.projects },
    { href: "/students", label: t.nav.students },
    { href: "/leaderboard", label: t.nav.leaderboard },
    { href: "/about", label: t.nav.about },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-white px-4 py-2 text-sm font-medium text-purple shadow-lift focus:not-sr-only focus:fixed focus:start-4 focus:top-3"
      >
        {t.common.skipToContent}
      </a>
      <header
        className={cn(
          "sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300",
          scrolled || menuOpen
            ? "border-b border-line/80 bg-white/85 shadow-[0_6px_24px_-18px_rgb(31_41_55/0.35)] backdrop-blur-xl"
            : "border-b border-transparent bg-white/0",
        )}
      >
        <div className="container-page flex h-[var(--header-h)] items-center gap-6">
          <Link href={HOME_PATH} aria-label={`${t.brand.name} — ${t.nav.home}`} className="shrink-0 rounded-lg">
            <SchoolBrand school={t.brand.school} moeAlt={t.brand.moeAlt} priority />
          </Link>

          <nav aria-label={t.nav.primary} className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-1">
              {links.map((l) => {
                const active = isActive(l.href);
                return (
                  <Fragment key={l.href}>
                    <li>
                      <Link href={l.href} aria-current={active ? "page" : undefined} className="nav-link">
                        <span aria-hidden className="nav-link__pill" />
                        <span className="nav-link__label">{l.label}</span>
                        <span aria-hidden className="nav-link__line" />
                      </Link>
                    </li>
                    {l.href === SUGGESTIONS_AFTER ? (
                      <li>
                        <SuggestionsNavButton />
                      </li>
                    ) : null}
                  </Fragment>
                );
              })}
            </ul>
          </nav>

          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t.common.search}
              className="grid size-10 place-items-center rounded-xl text-ink-soft transition hover:bg-canvas hover:text-ink"
            >
              <Search className="size-[1.125rem]" aria-hidden />
            </button>
            <LanguageSwitcher variant="compact" className="hidden sm:inline-flex" />
            {isAdmin ? (
              <Link
                href="/admin"
                className="hidden items-center gap-2 rounded-xl bg-purple px-3.5 py-2 text-sm font-medium text-white shadow-[0_8px_20px_-12px_rgb(109_74_255/0.9)] transition hover:bg-purple-strong md:inline-flex"
              >
                <LayoutDashboard className="size-4" aria-hidden />
                {t.nav.dashboard}
              </Link>
            ) : null}
            {student ? (
              <DropdownMenu.Root dir={dir}>
                <DropdownMenu.Trigger
                  aria-label={`${t.nav.account}: ${studentName}`}
                  data-testid="student-menu"
                  className="hidden max-w-44 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas hover:text-ink data-[state=open]:bg-canvas md:inline-flex"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lavender text-purple">
                    <UserRound className="size-4" aria-hidden />
                  </span>
                  <span dir="auto" className="truncate">
                    {studentName.split(/\s+/)[0]}
                  </span>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-56 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line data-[state=open]:animate-[fade-in_140ms_ease-out]"
                  >
                    <p dir="auto" className="truncate px-3 pb-2 pt-1.5 text-sm font-semibold text-ink">
                      {studentName}
                    </p>
                    <DropdownMenu.Separator className="mx-1 my-1 h-px bg-line-soft" />
                    <form action={signOut}>
                      <DropdownMenu.Item asChild onSelect={(e) => e.preventDefault()}>
                        <button
                          type="submit"
                          className="flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger-ink"
                        >
                          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
                          {t.nav.signOut}
                        </button>
                      </DropdownMenu.Item>
                    </form>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : null}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? t.common.closeMenu : t.common.openMenu}
              className="grid size-10 place-items-center rounded-xl text-ink transition hover:bg-canvas lg:hidden"
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              id="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-line-soft lg:hidden"
            >
              <nav aria-label={t.nav.primary} className="container-page py-4">
                <ul className="space-y-1">
                  {links.map((l) => (
                    <Fragment key={l.href}>
                      <li>
                        <Link
                          href={l.href}
                          aria-current={isActive(l.href) ? "page" : undefined}
                          className={cn(
                            "flex items-center justify-between rounded-xl px-4 py-3 text-base transition",
                            isActive(l.href) ? "bg-lavender-soft font-semibold text-purple-ink" : "text-ink hover:bg-canvas",
                          )}
                        >
                          {l.label}
                        </Link>
                      </li>
                      {l.href === SUGGESTIONS_AFTER ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setSuggestOpen(true);
                            }}
                            aria-haspopup="dialog"
                            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-start text-base text-ink transition hover:bg-canvas"
                          >
                            {t.nav.suggestions}
                            <MessageSquareText className="size-4 text-muted" aria-hidden />
                          </button>
                        </li>
                      ) : null}
                    </Fragment>
                  ))}
                  {isAdmin ? (
                    <li>
                      <Link
                        href="/admin"
                        className="mt-2 flex items-center gap-2 rounded-xl bg-purple px-4 py-3 text-base font-medium text-white"
                      >
                        <LayoutDashboard className="size-4" aria-hidden />
                        {t.nav.dashboard}
                      </Link>
                    </li>
                  ) : null}
                </ul>
                {student ? (
                  <form action={signOut} className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                    <span dir="auto" className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                      <UserRound className="size-4 shrink-0 text-purple" aria-hidden />
                      <span className="truncate">{studentName}</span>
                    </span>
                    <button
                      type="submit"
                      className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft transition hover:bg-danger-soft hover:text-danger-ink"
                    >
                      <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
                      {t.nav.signOut}
                    </button>
                  </form>
                ) : null}
                <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-4 sm:hidden">
                  <span className="text-sm text-muted">{t.common.language}</span>
                  <LanguageSwitcher variant="compact" />
                </div>
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <SuggestionsDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
    </>
  );
}
