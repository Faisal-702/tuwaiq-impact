import Image from "next/image";
import { cn } from "@/lib/utils";
import moeLogo from "../../../public/brand/official/moe-logo.png";
import tuwaiqLogo from "../../../public/brand/official/tuwaiq-academy-logo.png";

/**
 * The official Ministry of Education and Tuwaiq Academy logos as supplied
 * (only their transparent margins were trimmed). Aspect ratios and
 * transparency are always preserved: only the height is set.
 */
const SIZES = {
  header: { moe: "h-8 min-[400px]:h-10 sm:h-[50px] lg:h-[58px]", tuwaiq: "h-4 min-[400px]:h-[22px] sm:h-[30px] lg:h-[34px]", divider: "h-7 sm:h-11 lg:h-12", gap: "gap-2.5 min-[400px]:gap-3 sm:gap-5 lg:gap-9", px: [76, 188] },
  banner: { moe: "h-11", tuwaiq: "h-7", divider: "h-9", gap: "gap-4", px: [60, 156] },
} as const;

export function OfficialLogos({
  size = "header",
  moeAlt,
  tuwaiqAlt,
  only,
  className,
  priority,
}: {
  size?: keyof typeof SIZES;
  moeAlt: string;
  tuwaiqAlt: string;
  /** Shows one of the two logos only. */
  only?: "moe" | "tuwaiq";
  className?: string;
  priority?: boolean;
}) {
  const s = SIZES[size];
  return (
    <div className={cn("inline-flex items-center", s.gap, className)}>
      {only !== "tuwaiq" ? (
        <Image
          src={moeLogo}
          alt={moeAlt}
          preload={priority}
          className={cn("w-auto max-w-none", s.moe)}
          sizes={`${s.px[0]}px`}
        />
      ) : null}
      {!only ? <span aria-hidden className={cn("w-px bg-gradient-to-b from-transparent via-[#cfd4dc] to-transparent", s.divider)} /> : null}
      {only !== "moe" ? (
        <Image
          src={tuwaiqLogo}
          alt={tuwaiqAlt}
          preload={priority}
          className={cn("w-auto max-w-none", s.tuwaiq)}
          sizes={`${s.px[1]}px`}
        />
      ) : null}
    </div>
  );
}
