import { ArrowRight, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "@/components/ui/link";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import type { Dictionary } from "@/i18n/dictionaries";
import heroArt from "../../../public/images/hero-students.webp";

export function Hero({ t }: { t: Dictionary }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* Soft background wash */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(60%_60%_at_10%_10%,rgba(209,250,229,0.45),transparent_60%),radial-gradient(50%_60%_at_95%_20%,rgba(237,233,254,0.6),transparent_65%)]"
      />

      {/* Artwork: full-width on small screens; bleeds to the end edge on desktop. */}
      <div className="relative aspect-[16/10] w-full lg:absolute lg:inset-y-0 lg:end-0 lg:-z-10 lg:aspect-auto lg:w-[min(64vw,1240px)]">
        <Image
          src={heroArt}
          alt={t.home.heroAlt}
          preload
          fill
          sizes="(min-width: 1024px) 64vw, 100vw"
          quality={90}
          className="hero-art-mask object-cover object-[62%_30%] lg:object-[68%_28%]"
        />
      </div>

      <div className="container-page">
        <div className="grid lg:min-h-[min(calc(100dvh-var(--header-h)-3rem),720px)] items-center pb-24 pt-2 lg:grid-cols-12 lg:pb-32 lg:pt-10">
          <div className="relative lg:col-span-6 xl:col-span-5">
            <Reveal y={10}>
              <p className="eyebrow">{t.home.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1
                id="hero-title"
                className="mt-5 text-[2.75rem] font-bold leading-[1.04] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4.25rem] rtl:leading-[1.2] rtl:tracking-normal"
              >
                <span className="block">{t.home.headline1}</span>
                <span className="block text-gradient-brand pb-1">{t.home.headline2}</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-lg font-medium text-ink-soft">{t.home.tagline}</p>
              <p className="mt-3 max-w-[30rem] text-[1.0625rem] leading-relaxed text-muted">{t.home.description}</p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/projects" className={buttonClasses("primary", "lg")}>
                  {t.home.ctaPrimary}
                  <ArrowRight className="size-[1.125rem] rtl:-scale-x-100" aria-hidden />
                </Link>
                <Link href="/leaderboard" className={buttonClasses("secondary", "lg")}>
                  <Trophy className="size-[1.125rem]" aria-hidden />
                  {t.home.ctaSecondary}
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
