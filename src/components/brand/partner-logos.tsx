import Image from "next/image";
import { cn } from "@/lib/utils";
import moeLogo from "../../../public/brand/moe-logo.png";
import tuwaiqLogo from "../../../public/brand/tuwaiq-academy-logo.png";

/**
 * Official Ministry of Education and Tuwaiq Academy logos, displayed side by
 * side with equal visual weight. The supplied files are used unaltered (only
 * their transparent margins were trimmed); aspect ratios are always preserved.
 *
 * Sizing: the Ministry mark is compact and tall, the Tuwaiq mark is wide and
 * short, so heights are balanced (≈1.55 : 1) to give both similar presence.
 */
const SIZES = {
  sm: { moe: "h-[36px] sm:h-[42px]", tuwaiq: "h-[23px] sm:h-[27px]", gap: "gap-3.5 sm:gap-4", divider: "h-8", px: [112, 272] },
  md: { moe: "h-[44px]", tuwaiq: "h-[28px]", gap: "gap-5", divider: "h-9", px: [116, 282] },
  lg: {
    moe: "h-[58px] sm:h-[74px] lg:h-[clamp(64px,10vh,96px)]",
    tuwaiq: "h-[37px] sm:h-[47px] lg:h-[clamp(41px,6.4vh,61px)]",
    gap: "gap-5 sm:gap-8 lg:gap-10",
    divider: "h-12 sm:h-16 lg:h-20",
    px: [254, 612],
  },
} as const;

export function PartnerLogos({
  size = "md",
  className,
  moeAlt,
  tuwaiqAlt,
  priority,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  moeAlt: string;
  tuwaiqAlt: string;
  priority?: boolean;
}) {
  const s = SIZES[size];
  return (
    <div className={cn("inline-flex items-center", s.gap, className)}>
      <Image
        src={moeLogo}
        alt={moeAlt}
        loading={priority ? "eager" : undefined}
        className={cn("w-auto max-w-none", s.moe)}
        sizes={`${s.px[0]}px`}
      />
      <span aria-hidden className={cn("w-px bg-gradient-to-b from-transparent via-[#cfd4dc] to-transparent", s.divider)} />
      <Image
        src={tuwaiqLogo}
        alt={tuwaiqAlt}
        loading={priority ? "eager" : undefined}
        className={cn("w-auto max-w-none", s.tuwaiq)}
        sizes={`${s.px[1]}px`}
      />
    </div>
  );
}
