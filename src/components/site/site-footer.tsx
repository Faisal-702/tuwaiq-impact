import Link from "next/link";
import { LanguageSwitcher } from "@/components/brand/language-switcher";
import { PartnerLogos } from "@/components/brand/partner-logos";
import { DotMotif } from "@/components/brand/wordmark";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ t }: { t: Dictionary }) {
  const links = [
    { href: "/", label: t.nav.home },
    { href: "/projects", label: t.nav.projects },
    { href: "/students", label: t.nav.students },
    { href: "/leaderboard", label: t.nav.leaderboard },
    { href: "/about", label: t.nav.about },
  ];
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line-soft bg-canvas">
      <DotMotif className="pointer-events-none absolute -top-2 end-[6%] w-40 opacity-25" />
      <div className="container-page relative py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">
              <span dir="ltr" className="inline-block">
              <span lang="en">
                <span className="text-gradient-brand">Tuwaiq</span> <span className="text-gradient-purple">Impact</span>
              </span>
              <span className="mx-2.5 text-line">|</span>
              <span lang="ar" className="font-[family-name:var(--font-arabic)] text-teal-deep">
                أثر طويق
              </span>
              </span>
            </p>
            <p className="mt-3 text-[0.9375rem] text-ink-soft" lang="en">
              Technical Talented High School
            </p>
            <p className="text-[0.9375rem] text-ink-soft">
              <span lang="ar" dir="rtl" className="font-[family-name:var(--font-arabic)]">
                ثانوية الموهوبين التقنية
              </span>
            </p>
            <PartnerLogos size="md" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} className="mt-8 flex w-fit" />
          </div>
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between lg:justify-end lg:gap-16">
            <nav aria-label={t.footer.navigation}>
              <p className="text-sm font-semibold text-ink">{t.footer.navigation}</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-1">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[0.9375rem] text-muted transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <p className="text-sm font-semibold text-ink">{t.common.language}</p>
              <LanguageSwitcher variant="compact" className="mt-4" />
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {t.footer.rights}
          </p>
          <div className="flex items-center gap-5">
            <Link href="/present" className="transition hover:text-ink">
              {t.footer.presentation}
            </Link>
            <Link href="/welcome?mode=admin" className="transition hover:text-ink">
              {t.footer.adminAccess}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
