"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ChartColumn,
  ExternalLink,
  FolderKanban,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  MonitorPlay,
  PlusCircle,
  Settings,
  Tags,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/brand/language-switcher";
import { PartnerLogos } from "@/components/brand/partner-logos";
import { useI18n } from "@/i18n/client";
import { HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/settings";

export function AdminShell({ children, trashCount }: { children: ReactNode; trashCount: number }) {
  const { t, dir } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const items = [
    { href: "/admin", label: t.admin.nav.overview, icon: LayoutDashboard, exact: true },
    { href: "/admin/projects/new", label: t.admin.nav.addProject, icon: PlusCircle, exact: true },
    { href: "/admin/projects", label: t.admin.nav.manageProjects, icon: FolderKanban },
    { href: "/admin/students", label: t.admin.nav.students, icon: Users },
    { href: "/admin/categories", label: t.admin.nav.categories, icon: Tags },
    { href: "/admin/suggestions", label: t.admin.nav.suggestions, icon: MessageSquareText },
    { href: "/admin/student-codes", label: t.admin.nav.studentCodes, icon: KeyRound },
    { href: "/admin/leaderboard", label: t.admin.nav.leaderboard, icon: Trophy },
    { href: "/admin/analytics", label: t.admin.nav.analytics, icon: ChartColumn },
    { href: "/admin/activity", label: t.admin.nav.activity, icon: History },
    { href: "/admin/trash", label: t.admin.nav.trash, icon: Trash2, badge: trashCount },
    { href: "/admin/settings", label: t.admin.nav.settings, icon: Settings },
  ];
  const isActive = (href: string, exact?: boolean) =>
    exact
      ? pathname === href
      : pathname === href || (pathname.startsWith(href + "/") && !pathname.startsWith("/admin/projects/new"));

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <Link href={HOME_PATH} className="block rounded-lg">
          <PartnerLogos size="sm" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} />
        </Link>
        <div className="mt-5 flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 ring-1 ring-inset ring-line-soft">
          <span className="text-sm font-semibold text-ink" dir="ltr">
            <span className="text-gradient-brand">Tuwaiq</span> <span className="text-gradient-purple">Impact</span>
          </span>
          <span className="rounded-full bg-lavender-soft px-2 py-0.5 text-[0.6875rem] font-medium text-purple-ink">
            {t.admin.adminBadge}
          </span>
        </div>
      </div>
      <nav aria-label={t.admin.title} className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] transition-colors",
                    active ? "bg-lavender-soft font-medium text-purple-ink" : "text-ink-soft hover:bg-canvas hover:text-ink",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="admin-nav-indicator"
                      className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-purple"
                    />
                  ) : null}
                  <item.icon className={cn("size-[1.125rem]", active ? "text-purple" : "text-muted group-hover:text-ink-soft")} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted ring-1 ring-line">{item.badge}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-line-soft p-3">
        <Link
          href="/present"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] text-ink-soft transition hover:bg-canvas hover:text-ink"
        >
          <MonitorPlay className="size-[1.125rem] text-teal-deep" aria-hidden />
          {t.admin.presentation}
        </Link>
        <Link
          href={HOME_PATH}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] text-ink-soft transition hover:bg-canvas hover:text-ink"
        >
          <ExternalLink className="size-[1.125rem] text-muted" aria-hidden />
          {t.admin.viewSite}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] text-ink-soft transition hover:bg-danger-soft hover:text-danger-ink"
          >
            <LogOut className="size-[1.125rem] rtl:-scale-x-100" aria-hidden />
            {t.admin.signOut}
          </button>
        </form>
        <div className="px-3 pt-2">
          <LanguageSwitcher variant="compact" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[17rem] border-e border-line-soft bg-white lg:block">{nav}</aside>

      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line-soft bg-white/90 px-4 backdrop-blur lg:hidden">
        <PartnerLogos size="sm" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.common.openMenu}
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-xl text-ink hover:bg-canvas"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-[#0f1729]/35 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t.admin.title}
              className="fixed inset-y-0 start-0 z-50 w-[17rem] bg-white shadow-panel lg:hidden"
              initial={{ x: dir === "rtl" ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: dir === "rtl" ? "100%" : "-100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.common.closeMenu}
                className="absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas"
              >
                <X className="size-4.5" aria-hidden />
              </button>
              {nav}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main id="main" className="lg:ps-[17rem]">
        <div className="mx-auto max-w-[78rem] px-4 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
