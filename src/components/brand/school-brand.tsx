import Image from "next/image";
import { cn } from "@/lib/utils";
import moeLogo from "../../../public/brand/moe-logo.png";

/** Small dotted accent inside the name pill (echoes the Ministry's dot motif). */
function DotAccent({ className }: { className?: string }) {
  const dots: [number, number, number][] = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      // Fades out towards the left; mirrored in LTR so it always fades towards the pill's edge.
      dots.push([col * 5 + 2.5, row * 5 + 2.5, 0.2 + col * 0.22]);
    }
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      {dots.map(([x, y, o]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.05} fill="currentColor" opacity={Math.max(o, 0.15)} />
      ))}
    </svg>
  );
}

/**
 * Site header branding: the official Ministry of Education logo beside the
 * school's name, set in a soft rounded pill (text only, no second logo).
 */
export function SchoolBrand({
  school,
  moeAlt,
  priority,
  className,
}: {
  school: string;
  moeAlt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 sm:gap-3.5", className)}>
      <Image
        src={moeLogo}
        alt={moeAlt}
        loading={priority ? "eager" : undefined}
        className="h-[36px] w-auto max-w-none sm:h-[42px]"
        sizes="112px"
      />
      <span
        data-testid="school-brand"
        className="relative inline-flex h-10 items-center gap-2.5 overflow-hidden rounded-full border border-[#dfe9ef] bg-gradient-to-l from-[#effaf7] via-[#f6f8fd] to-[#f3f0fe] ps-3 pe-3 lg:px-2.5 xl:ps-3 xl:pe-3 shadow-[0_1px_2px_rgb(16_24_40/0.04),inset_0_1px_0_rgb(255_255_255/0.9)] sm:h-11 sm:ps-4 sm:pe-3.5 ltr:bg-gradient-to-r"
      >
        <span className="max-w-[8rem] text-balance text-[0.75rem] font-bold leading-[1.15] text-[#1b2559] sm:max-w-[11rem] sm:text-[0.8125rem] lg:max-w-[7.25rem] lg:text-[0.6875rem] xl:max-w-[8.25rem] xl:text-[0.75rem] min-[1366px]:max-w-[11rem] min-[1366px]:text-[0.8125rem] rtl:max-w-none rtl:whitespace-nowrap rtl:text-[0.9375rem] rtl:sm:text-[1.0625rem] rtl:lg:max-w-[6.5rem] rtl:lg:whitespace-normal rtl:lg:text-[0.8125rem] rtl:xl:max-w-none rtl:xl:whitespace-nowrap rtl:xl:text-[1.0625rem] rtl:2xl:text-lg">
          {school}
        </span>
        <DotAccent className="hidden size-4 shrink-0 text-teal sm:block lg:hidden ltr:-scale-x-100 rtl:xl:block ltr:min-[1600px]:block" />
      </span>
    </span>
  );
}
