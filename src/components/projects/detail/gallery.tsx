"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ExternalLink, Expand, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  id: string;
  thumb: string;
  large: string;
  original: string;
  width: number | null;
  height: number | null;
  caption: string | null;
};

/** Mosaic of project images; any image opens the full-screen viewer. */
export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const visible = images.slice(0, images.length > 5 ? 5 : images.length);
  const extra = images.length - visible.length;
  const layout =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-4 sm:grid-rows-2";

  return (
    <>
      <ul className={cn("grid gap-2.5 sm:gap-3", layout)}>
        {visible.map((img, i) => {
          const isHero = images.length >= 3 && i === 0;
          const isLast = i === visible.length - 1 && extra > 0;
          return (
            <li
              key={img.id}
              className={cn(
                isHero && "col-span-2 sm:row-span-2",
                images.length === 3 && i > 0 && "sm:col-span-2",
                images.length === 4 && i === 3 && "sm:col-span-2",
              )}
            >
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={fmt(t.project.openImage, { n: i + 1, total: images.length })}
                className={cn(
                  "group relative block w-full overflow-hidden rounded-2xl bg-canvas ring-1 ring-line-soft",
                  images.length === 1 ? "aspect-[16/9]" : isHero ? "aspect-[16/10] sm:aspect-auto sm:h-full" : "aspect-[16/10]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- optimised variant */}
                <img
                  src={isHero || images.length <= 2 ? img.large : img.thumb}
                  alt={img.caption ?? ""}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
                <span className="absolute bottom-3 end-3 grid size-9 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Expand className="size-4" aria-hidden />
                </span>
                {isLast ? (
                  <span className="absolute inset-0 grid place-items-center bg-ink/55 text-2xl font-semibold text-white backdrop-blur-[2px]">
                    +{extra + 1}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Lightbox images={images} index={index} onIndexChange={setIndex} title={title} />
    </>
  );
}

function Lightbox({
  images,
  index,
  onIndexChange,
  title,
}: {
  images: GalleryImage[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  title: string;
}) {
  const { t, dir } = useI18n();
  const [direction, setDirection] = useState(0);
  const touchStart = useRef<number | null>(null);
  const open = index !== null;
  const current = index !== null ? images[index] : null;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      setDirection(delta);
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) go(1);
      if (e.key === back) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, dir]);

  // Preload neighbours for instant navigation.
  useEffect(() => {
    if (index === null || images.length < 2) return;
    for (const d of [1, -1]) {
      const img = new Image();
      img.src = images[(index + d + images.length) % images.length].large;
    }
  }, [index, images]);

  const offset = dir === "rtl" ? -1 : 1;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <AnimatePresence>
        {open && current ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[#080b14]/95 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              aria-describedby={undefined}
              className="fixed inset-0 z-50 flex flex-col focus:outline-none"
              onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStart.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStart.current;
                if (Math.abs(dx) > 50) go(dx < 0 ? offset : -offset);
                touchStart.current = null;
              }}
            >
              <Dialog.Title className="sr-only">
                {t.project.viewer} — {title}
              </Dialog.Title>
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-white/85 sm:px-6">
                <p className="text-sm tabular-nums" aria-live="polite">
                  {fmt(t.project.imageOf, { n: (index ?? 0) + 1, total: images.length })}
                </p>
                <div className="flex items-center gap-1.5">
                  <a
                    href={current.original}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    <span className="hidden sm:inline">{t.project.openOriginal}</span>
                  </a>
                  <Dialog.Close
                    aria-label={t.common.close}
                    className="grid size-10 place-items-center rounded-lg transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.img
                    key={current.id}
                    src={current.large}
                    alt={current.caption ?? ""}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * offset * 40, scale: 0.985 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -direction * offset * 40 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
                    draggable={false}
                  />
                </AnimatePresence>
                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      aria-label={t.common.previous}
                      className="absolute start-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:grid"
                    >
                      <ChevronLeft className="size-6 rtl:-scale-x-100" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      aria-label={t.common.next}
                      className="absolute end-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:grid"
                    >
                      <ChevronRight className="size-6 rtl:-scale-x-100" aria-hidden />
                    </button>
                  </>
                ) : null}
              </div>

              <div className="px-4 pb-5 pt-3 text-center sm:px-6">
                {current.caption ? (
                  <p dir="auto" className="text-sm text-white/80">
                    {current.caption}
                  </p>
                ) : null}
                {images.length > 1 ? (
                  <div className="scrollbar-none mx-auto mt-3 flex max-w-full justify-center gap-2 overflow-x-auto">
                    {images.map((img, i) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => {
                          setDirection(i > (index ?? 0) ? 1 : -1);
                          onIndexChange(i);
                        }}
                        aria-label={fmt(t.project.imageOf, { n: i + 1, total: images.length })}
                        aria-current={i === index}
                        className={cn(
                          "h-12 w-16 shrink-0 overflow-hidden rounded-md ring-2 transition",
                          i === index ? "opacity-100 ring-white" : "opacity-45 ring-transparent hover:opacity-80",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
