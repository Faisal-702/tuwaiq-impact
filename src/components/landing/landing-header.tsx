import { UserRound } from "lucide-react";
import { LanguageSwitcher } from "@/components/brand/language-switcher";
import Link from "@/components/ui/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { OfficialLogos } from "./official-logos";

/**
 * Header of the public pages (landing page and partnership form): the
 * official logos on the start side; the language switch, the partners page
 * and sign-in on the end side.
 */
export function LandingHeader({ t, className }: { t: Dictionary; className?: string }) {
  return (
    <header className={cn("relative z-20", className)} data-testid="landing-header">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-3 py-4 sm:py-3.5">
        <Link href="/" aria-label={t.landing.nav.home} className="order-1 me-auto rounded-lg">
          <OfficialLogos moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} priority />
        </Link>
        <LanguageSwitcher variant="adaptive" className="order-2 shrink-0 sm:order-3" />
        <nav aria-label={t.nav.primary} className="order-3 grid w-full grid-cols-2 items-center gap-2.5 sm:order-2 sm:flex sm:w-auto sm:gap-3">
          <Link
            href="/welcome"
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-indigo px-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgb(66_31_190/0.85)] transition hover:bg-[#3418a6] sm:px-6 sm:text-[0.9375rem]"
            data-testid="landing-login"
          >
            <UserRound className="size-4.5" aria-hidden />
            {t.landing.nav.login}
          </Link>
          <Link
            href="/partners"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-white/85 px-3.5 text-sm font-semibold text-indigo-ink ring-1 ring-inset ring-[#8179b9]/70 backdrop-blur transition hover:bg-lavender-soft sm:px-7 sm:text-[0.9375rem]"
            data-testid="landing-partners"
          >
            {t.landing.nav.partners}
          </Link>
          <span aria-hidden className="mx-1 hidden h-8 w-px bg-line sm:block" />
        </nav>
      </div>
    </header>
  );
}
