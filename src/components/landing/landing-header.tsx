import { UserRound } from "lucide-react";
import { LanguageSwitcher } from "@/components/brand/language-switcher";
import Link from "@/components/ui/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { OfficialLogos } from "./official-logos";

/**
 * Header of the public pages (landing page and partnership form), as on the
 * approved landing reference: on the start side the official Ministry of
 * Education logo, a hairline divider and the school's name (text only); on
 * the end side sign-in, the partners page and the language switch.
 * Large-screen sizes are the proportional `lp-*` rules in globals.css.
 */
export function LandingHeader({ t, className }: { t: Dictionary; className?: string }) {
  return (
    <header className={cn("relative z-20 font-landing", className)} data-testid="landing-header">
      <div className="lp-header-bar container-page flex max-w-[96rem] flex-wrap items-center gap-x-3 gap-y-3 py-4 sm:py-5">
        <Link href="/" aria-label={t.landing.nav.home} className="lp-brand order-1 me-auto flex items-center gap-3 rounded-lg sm:gap-5" data-testid="landing-brand">
          <OfficialLogos size="landing" only="moe" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} priority />
          <span aria-hidden className="lp-brand-divider h-8 w-px bg-gradient-to-b from-transparent via-[#c5cad6] to-transparent sm:h-11" />
          <span className="lp-school whitespace-nowrap text-[0.9375rem] font-bold leading-tight text-[#1d2459] min-[400px]:text-base sm:text-xl" data-testid="landing-school">
            {t.brand.school}
          </span>
        </Link>
        {/* The wrapper follows the page direction (the switch itself is always LTR). */}
        <div className="lp-lang order-2 shrink-0 sm:order-3">
          <LanguageSwitcher variant="landing" />
        </div>
        <nav aria-label={t.nav.primary} className="lp-nav order-3 grid w-full grid-cols-2 items-center gap-2.5 sm:order-2 sm:flex sm:w-auto sm:gap-3">
          <Link
            href="/welcome"
            className="lp-nav-btn lp-nav-login inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#3a14c8] px-4 text-[0.9375rem] font-bold text-white shadow-[0_12px_26px_-12px_rgb(58_20_200/0.85)] transition hover:bg-[#2f0fae] sm:px-6"
            data-testid="landing-login"
          >
            <UserRound className="size-5" strokeWidth={1.9} aria-hidden />
            {t.landing.nav.login}
          </Link>
          <Link
            href="/partners"
            className="lp-nav-btn lp-nav-partners inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full bg-white/90 px-4 text-[0.9375rem] font-bold text-[#2a1590] ring-1 ring-inset ring-[#b9b2dc] backdrop-blur transition hover:bg-lavender-soft sm:px-7"
            data-testid="landing-partners"
          >
            {t.landing.nav.partners}
          </Link>
          <span aria-hidden className="lp-nav-divider mx-1 hidden h-8 w-px bg-[#d5d8e2] sm:block" />
        </nav>
      </div>
    </header>
  );
}
