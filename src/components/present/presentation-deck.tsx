"use client";

import { AnimatePresence, motion } from "motion/react";
import { Award, ChevronLeft, ChevronRight, Expand, Pause, Play, Shrink, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PartnerLogos } from "@/components/brand/partner-logos";
import { DotMotif } from "@/components/brand/wordmark";
import { RankBadge } from "@/components/leaderboard/rank-badge";
import { ProjectCover } from "@/components/projects/project-cover";
import { CategoryChip } from "@/components/ui/chip";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber, gradeLabel, localName, projectCount } from "@/i18n/format";
import type { HomeStats, LeaderboardRow, ProjectCardData } from "@/lib/types";
import { HOME_PATH } from "@/lib/routes";
import { cn, excerpt } from "@/lib/utils";
import heroArt from "../../../public/images/hero-students.webp";

const SLIDE_MS = 8500;

export function PresentationDeck({
  stats,
  featured,
  selected,
  leaders,
}: {
  stats: HomeStats;
  featured: ProjectCardData[];
  selected: ProjectCardData[];
  leaders: LeaderboardRow[];
}) {
  const { t, locale, dir } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const names = (p: ProjectCardData) => p.students.map((s) => localName(s, locale)).join(locale === "ar" ? "، " : ", ");
  const category = (p: ProjectCardData) => (locale === "ar" ? p.category.name_ar : p.category.name_en);

  const slides: { key: string; node: ReactNode }[] = [
    { key: "identity", node: <IdentitySlide /> },
    { key: "stats", node: <StatsSlide stats={stats} /> },
    ...featured.map((p) => ({
      key: `featured-${p.id}`,
      node: (
        <div className="grid h-full items-center gap-[4vw] lg:grid-cols-[1.15fr_1fr]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[2vw] bg-canvas shadow-panel ring-1 ring-line-soft">
            <ProjectCover project={p} eager />
          </div>
          <div>
            <p className="eyebrow !text-[clamp(0.8rem,1vw,1.1rem)]">{t.present.featured}</p>
            <div className="mt-[1.5vw]">
              <CategoryChip name={category(p)} icon={p.category.icon} accent={p.category.accent} className="!text-[clamp(0.8rem,1vw,1.05rem)]" />
            </div>
            <h2 dir="auto" className="mt-[1.5vw] text-[clamp(2rem,3.6vw,4.25rem)] font-bold leading-[1.08] tracking-tight text-ink">
              {p.title}
            </h2>
            <p className="mt-[1.2vw] text-[clamp(1.1rem,1.5vw,1.75rem)] font-medium text-ink-soft">
              {names(p)}
              {p.grade ? <span className="text-muted"> · {gradeLabel(p.grade, t.grades)}</span> : null}
            </p>
            {p.award ? (
              <p className="mt-[1.2vw] inline-flex items-center gap-2 rounded-full bg-[#fdf6e7] px-4 py-2 text-[clamp(0.9rem,1.1vw,1.25rem)] font-medium text-[#8a6413] ring-1 ring-inset ring-[#e9cf8f]/70">
                <Award className="size-[1.2em]" aria-hidden />
                <span dir="auto">{p.award}</span>
              </p>
            ) : null}
            {p.description ? (
              <p dir="auto" className="mt-[1.5vw] max-w-[40ch] text-[clamp(1rem,1.25vw,1.5rem)] leading-relaxed text-muted">
                {excerpt(p.description, 220)}
              </p>
            ) : null}
          </div>
        </div>
      ),
    })),
    ...(selected.length > 0
      ? [
          {
            key: "selected",
            node: (
              <div className="flex h-full flex-col justify-center">
                <h2 className="text-[clamp(2rem,3.2vw,3.75rem)] font-bold tracking-tight text-ink">{t.present.selectedProjects}</h2>
                <ul className="mt-[2.5vw] grid grid-cols-2 gap-[1.6vw] lg:grid-cols-3">
                  {selected.slice(0, 6).map((p) => (
                    <li key={p.id} className="overflow-hidden rounded-[1.2vw] bg-white shadow-soft ring-1 ring-line-soft">
                      <div className="relative aspect-[16/9] bg-canvas">
                        <ProjectCover project={p} eager />
                      </div>
                      <div className="p-[1.2vw]">
                        <p dir="auto" className="line-clamp-1 text-[clamp(1rem,1.35vw,1.6rem)] font-semibold text-ink">{p.title}</p>
                        <p className="mt-1 line-clamp-1 text-[clamp(0.85rem,1vw,1.2rem)] text-muted">{names(p)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]
      : []),
    ...(leaders.length > 0
      ? [
          {
            key: "leaders",
            node: (
              <div className="grid h-full items-center gap-[5vw] lg:grid-cols-[1fr_1.3fr]">
                <div>
                  <p className="eyebrow !text-[clamp(0.8rem,1vw,1.1rem)]">{t.leaderboard.eyebrow}</p>
                  <h2 className="mt-[1.2vw] text-[clamp(2.25rem,4vw,4.75rem)] font-bold tracking-tight text-ink">{t.present.topStudents}</h2>
                  <p className="mt-[1.2vw] max-w-[32ch] text-[clamp(1rem,1.3vw,1.5rem)] leading-relaxed text-muted">{t.leaderboard.intro}</p>
                </div>
                <ol className="space-y-[1vw]">
                  {leaders.map((r) => (
                    <li key={r.id} className="flex items-center gap-[1.4vw] rounded-[1.2vw] bg-white px-[1.6vw] py-[1.1vw] shadow-soft ring-1 ring-line-soft">
                      <RankBadge rank={r.rank} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[clamp(1.1rem,1.6vw,1.9rem)] font-semibold text-ink">{localName(r, locale)}</p>
                        <p className="text-[clamp(0.85rem,1vw,1.15rem)] text-muted">
                          {[r.grade ? gradeLabel(r.grade, t.grades) : null, projectCount(r.projects, locale)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="text-[clamp(1.4rem,2.2vw,2.6rem)] font-bold tabular-nums text-ink">
                        {formatNumber(r.points, locale)}
                        <span className="ms-2 text-[0.45em] font-medium text-muted">{t.common.pointsShort}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ),
          },
        ]
      : []),
    { key: "closing", node: <ClosingSlide /> },
  ];
  const total = slides.length;

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => (i + delta + total) % total);
    },
    [total],
  );

  // Auto-advance.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [playing, index, go]);

  const wake = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 3000);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setChrome(false), 3000);
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    const onKey = (e: KeyboardEvent) => {
      const next = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const prev = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (e.key === next || e.key === "PageDown") go(1);
      else if (e.key === prev || e.key === "PageUp") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "f") void toggleFullscreen();
      wake();
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
    };
  }, [dir, go, toggleFullscreen, wake]);

  const offset = dir === "rtl" ? -1 : 1;

  return (
    <div
      ref={rootRef}
      onMouseMove={wake}
      className={cn("relative h-dvh w-full overflow-hidden bg-white", !chrome && "cursor-none")}
      aria-roledescription="carousel"
      aria-label={t.present.title}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_60%_at_0%_0%,rgba(209,250,229,0.45),transparent_60%),radial-gradient(50%_60%_at_100%_100%,rgba(237,233,254,0.65),transparent_65%)]" />

      {/* Persistent identity strip */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[4vw] pt-[2.2vw]">
        <PartnerLogos size="md" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} priority className="origin-top-left scale-110 rtl:origin-top-right 2xl:scale-125" />
        <p className="text-[clamp(0.9rem,1.1vw,1.25rem)] font-semibold text-ink" dir="ltr">
          <span className="text-gradient-brand">Tuwaiq</span> <span className="text-gradient-purple">Impact</span>
          <span className="mx-2 text-line">|</span>
          <span className="font-[family-name:var(--font-arabic)] text-teal-deep">أثر طويق</span>
        </p>
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.section
          key={slides[index].key}
          aria-roledescription="slide"
          aria-label={fmt(t.present.slide, { n: index + 1, total })}
          initial={{ opacity: 0, x: 40 * direction * offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 * direction * offset }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 px-[6vw] pb-[7vw] pt-[9vw]"
        >
          {slides[index].node}
        </motion.section>
      </AnimatePresence>

      {/* Progress */}
      <div className="absolute inset-x-[6vw] bottom-[2.6vw] z-10 flex gap-2" aria-hidden>
        {slides.map((s, i) => (
          <span key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            {i < index ? <span className="block h-full w-full bg-teal" /> : null}
            {i === index ? (
              <motion.span
                key={`${index}-${playing}`}
                className="block h-full bg-purple"
                initial={{ width: playing ? "0%" : "100%" }}
                animate={{ width: "100%" }}
                transition={{ duration: playing ? SLIDE_MS / 1000 : 0, ease: "linear" }}
              />
            ) : null}
          </span>
        ))}
      </div>

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-[4.2vw] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-white/90 p-1.5 shadow-lift ring-1 ring-line backdrop-blur transition-opacity duration-500",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <CtrlButton label={t.common.previous} onClick={() => go(-1)}>
          <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
        </CtrlButton>
        <CtrlButton label={playing ? t.present.pause : t.present.play} onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
        </CtrlButton>
        <CtrlButton label={t.common.next} onClick={() => go(1)}>
          <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
        </CtrlButton>
        <span className="mx-2 text-sm tabular-nums text-muted" aria-live="polite">
          {index + 1} / {total}
        </span>
        <CtrlButton label={t.present.fullscreen} onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Shrink className="size-5" aria-hidden /> : <Expand className="size-5" aria-hidden />}
        </CtrlButton>
        <Link
          href={HOME_PATH}
          className="grid size-10 place-items-center rounded-xl text-ink-soft transition hover:bg-canvas hover:text-ink"
          aria-label={t.present.exit}
          title={t.present.exit}
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-xl text-ink-soft transition hover:bg-canvas hover:text-ink"
    >
      {children}
    </button>
  );
}

function IdentitySlide() {
  const { t } = useI18n();
  return (
    <div className="relative grid h-full items-center lg:grid-cols-2">
      <div className="relative z-10">
        <p className="eyebrow !text-[clamp(0.85rem,1.1vw,1.25rem)]">{t.home.eyebrow}</p>
        <h1 className="mt-[1.5vw] font-bold leading-[1.02] tracking-[-0.035em]">
          <span dir="ltr" className="block whitespace-nowrap text-[clamp(2.75rem,5.2vw,7rem)]">
            <span className="text-gradient-brand">Tuwaiq</span> <span className="text-gradient-purple">Impact</span>
          </span>
          <span lang="ar" className="mt-[0.6vw] block font-[family-name:var(--font-arabic)] text-[clamp(2.5rem,5vw,6rem)] text-[#0c4a5a]">
            أثر طويق
          </span>
        </h1>
        <p className="mt-[2vw] text-[clamp(1.2rem,1.8vw,2.1rem)] font-medium text-ink-soft">
          <span lang="en" className="block">Technical Talented High School</span>
          <span lang="ar" className="block font-[family-name:var(--font-arabic)]">ثانوية الموهوبين التقنية</span>
        </p>
        <p className="mt-[1.5vw] text-[clamp(1rem,1.4vw,1.6rem)] text-muted">{t.home.tagline}</p>
      </div>
      <div className="absolute inset-y-[-9vw] end-[-6vw] hidden w-[58vw] lg:block">
        <Image src={heroArt} alt={t.home.heroAlt} fill preload sizes="58vw" quality={90} className="hero-art-mask object-cover object-[65%_30%]" />
      </div>
    </div>
  );
}

function StatsSlide({ stats }: { stats: HomeStats }) {
  const { t, locale } = useI18n();
  const items = [
    { label: t.home.stats.projects, value: stats.projects },
    { label: t.home.stats.students, value: stats.students },
    { label: t.home.stats.awards, value: stats.awards },
    { label: t.home.stats.activities, value: stats.activities },
  ];
  return (
    <div className="flex h-full flex-col justify-center">
      <h2 className="text-[clamp(2rem,3.4vw,4rem)] font-bold tracking-tight text-ink">{t.present.keyStats}</h2>
      <dl className="mt-[3vw] grid grid-cols-2 gap-[2vw] lg:grid-cols-4">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[1.6vw] bg-white p-[2.2vw] shadow-lift ring-1 ring-line-soft"
          >
            <dd className="text-[clamp(3rem,6vw,7rem)] font-bold leading-none tracking-tight text-ink tabular-nums">
              {formatNumber(item.value, locale)}
            </dd>
            <dt className="mt-[1vw] text-[clamp(1rem,1.4vw,1.6rem)] text-muted">{item.label}</dt>
          </motion.div>
        ))}
      </dl>
    </div>
  );
}

function ClosingSlide() {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <DotMotif className="w-[14vw] min-w-28" />
      <p className="mt-[2.5vw] text-[clamp(2.5rem,5.5vw,6.5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
        {t.present.thanks}
      </p>
      <p className="mt-[1.5vw] text-[clamp(1.1rem,1.6vw,1.9rem)] text-muted">{t.brand.school}</p>
      <PartnerLogos size="lg" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} className="mt-[3vw]" />
    </div>
  );
}
