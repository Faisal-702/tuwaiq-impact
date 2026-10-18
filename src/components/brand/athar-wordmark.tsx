import { cn } from "@/lib/utils";

/*
 * The "أثر" wordmark, drawn as أثـ — ـر: the word is split between ث and ر,
 * with a short bar between the two parts, all on the letters' joining line.
 *
 * The shapes are Cairo's own letters (weight 650), shaped with HarfBuzz and
 * converted to SVG paths by scripts/build-athar-wordmark.py:
 *  - "أثـ"  alef with hamza and ث in its joining form, with a short stroke
 *  - "ـ"    a tatweel: the bar, at the stroke's height and weight
 *  - "ـر"   ر in its final (joined) form, slightly enlarged, with a short stroke
 * As paths, the wordmark is identical in every browser, needs no font to
 * load, and stays sharp at any size. One gradient runs across it: deep
 * indigo (start of the word) → blue → teal → green at the tail of ر.
 *
 * Assistive technologies read the correctly spelled word "أثر".
 * Size it with a height class (the width follows).
 */
const VIEWBOX = "0 -984 2478 1246.9";

export function AtharWordmark({ className, label = "أثر" }: { className?: string; label?: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={VIEWBOX}
      width={2478}
      height={1246.9}
      className={cn("inline-block h-[1em] w-auto shrink-0", className)}
      data-testid="athar-wordmark"
    >
      <title>{label}</title>
      <defs>
        <linearGradient id="athar-wordmark-fill" gradientUnits="userSpaceOnUse" x1="2478" y1="-984" x2="0" y2="262.9">
          <stop offset="0" stopColor="#3a1fb0" />
          <stop offset="0.42" stopColor="#3a21ad" />
          <stop offset="0.6" stopColor="#2f3fa0" />
          <stop offset="0.78" stopColor="#245a8e" />
          <stop offset="0.92" stopColor="#177683" />
          <stop offset="1" stopColor="#0b9a6e" />
        </linearGradient>
      </defs>
      <g fill="url(#athar-wordmark-fill)">
          <path transform="translate(0 0)" d="M210 0V-99H339V0ZM27 239Q15 239 0 237.5Q-15 236 -31 235L-24 136Q-9 137 4.5 138Q18 139 26 139Q68 139 93.5 106.5Q119 74 119 15V-501H233V15Q233 81 207 131.5Q181 182 134.5 210.5Q88 239 27 239ZM339 0V-99Q345 -99 348.5 -96Q352 -93 354.5 -86.5Q357 -80 358 -71Q359 -62 359 -50Q359 -39 358 -29.5Q357 -20 354.5 -13.5Q352 -7 348.5 -3.5Q345 0 339 0Z" />
          <path transform="translate(0 0)" d="M349.3 0V-99H478.7V0ZM478.7 0V-99Q481.8 -99 483.8 -96Q485.9 -93 486.9 -86.5Q488 -80 488.5 -71Q489 -62 489 -50Q489 -39 488.5 -29.5Q488 -20 486.9 -13.5Q485.9 -7 483.8 -3.5Q481.8 0 478.7 0ZM349.3 0Q346.2 0 344.2 -3.5Q342.1 -7 341.1 -13.5Q340 -20 339.5 -29.5Q339 -39 339 -50Q339 -66 339.8 -76.5Q340.6 -87 342.9 -93Q345.2 -99 349.3 -99Z" />
          <path transform="translate(724 0)" d="M32.4 0V-99H437.6V0ZM437.6 0V-99Q447.3 -99 453.8 -96Q460.3 -93 463.5 -86.5Q466.8 -80 468.4 -71Q470 -62 470 -50Q470 -39 468.4 -29.5Q466.8 -20 463.5 -13.5Q460.3 -7 453.8 -3.5Q447.3 0 437.6 0ZM32.4 0Q22.7 0 16.2 -3.5Q9.7 -7 6.5 -13.5Q3.2 -20 1.6 -29.5Q0 -39 0 -50Q0 -66 2.4 -76.5Q4.9 -87 12.2 -93Q19.4 -99 32.4 -99Z" />
          <path transform="translate(1429 0)" d="M29 0V-99H391V0ZM391 0V-99Q399.7 -99 405.5 -96Q411.3 -93 414.2 -86.5Q417.1 -80 418.6 -71Q420 -62 420 -50Q420 -39 418.6 -29.5Q417.1 -20 414.2 -13.5Q411.3 -7 405.5 -3.5Q399.7 0 391 0ZM29 0Q20.3 0 14.5 -3.5Q8.7 -7 5.8 -13.5Q2.9 -20 1.4 -29.5Q0 -39 0 -50Q0 -66 2.2 -76.5Q4.3 -87 10.9 -93Q17.4 -99 29 -99Z" />
          <path transform="translate(1429 0)" d="M420 0V-99H623L560 -48V-501H674V0ZM420 0Q414 0 410 -3.5Q406 -7 404 -13.5Q402 -20 401 -29.5Q400 -39 400 -50Q400 -66 401.5 -76.5Q403 -87 407.5 -93Q412 -99 420 -99ZM568 -737V-832H668V-737ZM480 -592V-698H590V-592ZM645 -592V-698H755V-592Z" />
          <path transform="translate(1429 0)" d="M844 0V-710H957V0ZM846 -786Q828 -807 818.5 -827.5Q809 -848 809 -871Q809 -903 825.5 -929Q842 -955 869.5 -969.5Q897 -984 929 -984Q947 -984 965.5 -979Q984 -974 997 -965L966 -910Q958 -915 949.5 -916.5Q941 -918 933 -918Q909 -918 896 -905Q883 -892 883 -872Q883 -859 888 -847.5Q893 -836 904 -823ZM788 -781V-846H1014V-781Z" />
      </g>
    </svg>
  );
}
