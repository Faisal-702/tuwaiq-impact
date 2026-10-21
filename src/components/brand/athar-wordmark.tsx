import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/*
 * The platform's wordmark, in the page's language.
 *
 * Arabic: "أثر" drawn as أثـ — ـر: the word is split between ث and ر,
 * with a short bar between the two parts, all on the letters' joining line.
 * The shapes are Cairo's own letters (weight 650), shaped with HarfBuzz and
 * converted to SVG paths by scripts/build-athar-wordmark.py:
 *  - "أثـ"  alef with hamza and ث in its joining form, with a short stroke
 *  - "ـ"    a tatweel: the bar, at the stroke's height and weight
 *  - "ـر"   ر in its final (joined) form, slightly enlarged, with a short stroke
 *
 * English: "Atha-r", in Cairo's own Latin letters at the same weight and
 * scale (scripts/build-athar-wordmark-en.py, tracking +12). Its ascenders and
 * stems match the Arabic alef and its hyphen is as thick as the Arabic bar, so
 * both share one baseline and one height: switching language never moves the
 * text around them.
 *
 * As paths, the wordmarks are identical in every browser, need no font to
 * load, and stay sharp at any size. One gradient runs across each, from the
 * start of the word: deep indigo → blue → teal → green.
 *
 * Assistive technologies read the correctly spelled name ("أثر" / "Athar").
 * Size it with a height class (the width follows).
 */
const HEIGHT = 1246.9;
const TOP = -984;
const AR_WIDTH = 2478;
const EN_WIDTH = 2810;

const STOPS = [
  ["0", "#3a1fb0"],
  ["0.42", "#3a21ad"],
  ["0.6", "#2f3fa0"],
  ["0.78", "#245a8e"],
  ["0.92", "#177683"],
  ["1", "#0b9a6e"],
] as const;

export function AtharWordmark({ className, locale = "ar", label }: { className?: string; locale?: Locale; label?: string }) {
  const en = locale === "en";
  const width = en ? EN_WIDTH : AR_WIDTH;
  const name = label ?? (en ? "Athar" : "أثر");
  const gradient = en ? "athar-wordmark-fill-en" : "athar-wordmark-fill";
  return (
    <svg
      role="img"
      aria-label={name}
      lang={en ? "en" : "ar"}
      viewBox={`0 ${TOP} ${width} ${HEIGHT}`}
      width={width}
      height={HEIGHT}
      className={cn("inline-block h-[1em] w-auto shrink-0", className)}
      data-testid="athar-wordmark"
      data-locale={en ? "en" : "ar"}
    >
      <title>{name}</title>
      <defs>
        {/* From the start of the word (right in Arabic, left in English) to its end, slightly downwards. */}
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1={en ? 0 : width}
          y1={TOP}
          x2={en ? width : 0}
          y2={TOP + HEIGHT}
        >
          {STOPS.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <g fill={`url(#${gradient})`}>{en ? EN_PATHS : AR_PATHS}</g>
    </svg>
  );
}

const AR_PATHS = (
  <>
    <path transform="translate(0 0)" d="M210 0V-99H339V0ZM27 239Q15 239 0 237.5Q-15 236 -31 235L-24 136Q-9 137 4.5 138Q18 139 26 139Q68 139 93.5 106.5Q119 74 119 15V-501H233V15Q233 81 207 131.5Q181 182 134.5 210.5Q88 239 27 239ZM339 0V-99Q345 -99 348.5 -96Q352 -93 354.5 -86.5Q357 -80 358 -71Q359 -62 359 -50Q359 -39 358 -29.5Q357 -20 354.5 -13.5Q352 -7 348.5 -3.5Q345 0 339 0Z" />
    <path transform="translate(0 0)" d="M349.3 0V-99H478.7V0ZM478.7 0V-99Q481.8 -99 483.8 -96Q485.9 -93 486.9 -86.5Q488 -80 488.5 -71Q489 -62 489 -50Q489 -39 488.5 -29.5Q488 -20 486.9 -13.5Q485.9 -7 483.8 -3.5Q481.8 0 478.7 0ZM349.3 0Q346.2 0 344.2 -3.5Q342.1 -7 341.1 -13.5Q340 -20 339.5 -29.5Q339 -39 339 -50Q339 -66 339.8 -76.5Q340.6 -87 342.9 -93Q345.2 -99 349.3 -99Z" />
    <path transform="translate(724 0)" d="M32.4 0V-99H437.6V0ZM437.6 0V-99Q447.3 -99 453.8 -96Q460.3 -93 463.5 -86.5Q466.8 -80 468.4 -71Q470 -62 470 -50Q470 -39 468.4 -29.5Q466.8 -20 463.5 -13.5Q460.3 -7 453.8 -3.5Q447.3 0 437.6 0ZM32.4 0Q22.7 0 16.2 -3.5Q9.7 -7 6.5 -13.5Q3.2 -20 1.6 -29.5Q0 -39 0 -50Q0 -66 2.4 -76.5Q4.9 -87 12.2 -93Q19.4 -99 32.4 -99Z" />
    <path transform="translate(1429 0)" d="M29 0V-99H391V0ZM391 0V-99Q399.7 -99 405.5 -96Q411.3 -93 414.2 -86.5Q417.1 -80 418.6 -71Q420 -62 420 -50Q420 -39 418.6 -29.5Q417.1 -20 414.2 -13.5Q411.3 -7 405.5 -3.5Q399.7 0 391 0ZM29 0Q20.3 0 14.5 -3.5Q8.7 -7 5.8 -13.5Q2.9 -20 1.4 -29.5Q0 -39 0 -50Q0 -66 2.2 -76.5Q4.3 -87 10.9 -93Q17.4 -99 29 -99Z" />
    <path transform="translate(1429 0)" d="M420 0V-99H623L560 -48V-501H674V0ZM420 0Q414 0 410 -3.5Q406 -7 404 -13.5Q402 -20 401 -29.5Q400 -39 400 -50Q400 -66 401.5 -76.5Q403 -87 407.5 -93Q412 -99 420 -99ZM568 -737V-832H668V-737ZM480 -592V-698H590V-592ZM645 -592V-698H755V-592Z" />
    <path transform="translate(1429 0)" d="M844 0V-710H957V0ZM846 -786Q828 -807 818.5 -827.5Q809 -848 809 -871Q809 -903 825.5 -929Q842 -955 869.5 -969.5Q897 -984 929 -984Q947 -984 965.5 -979Q984 -974 997 -965L966 -910Q958 -915 949.5 -916.5Q941 -918 933 -918Q909 -918 896 -905Q883 -892 883 -872Q883 -859 888 -847.5Q893 -836 904 -823ZM788 -781V-846H1014V-781Z" />
  </>
);

const EN_PATHS = (
  <>
    <path d="M0 0 179 -686H396L575 0H457L415 -151H157L116 0ZM177 -248H397L310 -590H265Z" />
    <path d="M821 11Q767 11 734.5 -4.5Q702 -20 687.5 -59.5Q673 -99 673 -171V-406H610V-501H673V-641H786V-501H925V-406H786V-201Q786 -157 790 -132.5Q794 -108 807 -98Q820 -88 848 -88Q856 -88 870.5 -89Q885 -90 900 -91Q915 -92 925 -93L930 -1Q915 1 894.5 4Q874 7 854.5 9Q835 11 821 11Z" />
    <path d="M1017 0V-710H1130V-480Q1147 -487 1171.5 -494Q1196 -501 1222.5 -506.5Q1249 -512 1272 -512Q1324 -512 1358.5 -498.5Q1393 -485 1412.5 -455.5Q1432 -426 1439.5 -378.5Q1447 -331 1447 -264V0H1334V-256Q1334 -313 1327.5 -347Q1321 -381 1302 -396.5Q1283 -412 1245 -412Q1225 -412 1203 -408.5Q1181 -405 1162 -399.5Q1143 -394 1130 -389V0Z" />
    <path d="M1700 11Q1625 11 1587 -28.5Q1549 -68 1549 -146Q1549 -200 1568 -231Q1587 -262 1624.5 -277.5Q1662 -293 1717 -296L1851 -308V-343Q1851 -384 1831 -401Q1811 -418 1773 -418Q1746 -418 1710.5 -416Q1675 -414 1640 -411Q1605 -408 1579 -405L1574 -487Q1600 -493 1635.5 -498.5Q1671 -504 1710 -508Q1749 -512 1782 -512Q1843 -512 1883.5 -495.5Q1924 -479 1944 -443Q1964 -407 1964 -347V-110Q1967 -93 1980.5 -84.5Q1994 -76 2013 -73L2010 8Q1996 8 1981 8Q1966 8 1953 6.5Q1940 5 1929 3Q1910 -1 1895 -9Q1880 -17 1870 -27Q1853 -20 1825 -11Q1797 -2 1765 4.5Q1733 11 1700 11ZM1725 -76Q1747 -76 1771 -80.5Q1795 -85 1816 -91Q1837 -97 1851 -102V-235L1733 -224Q1696 -220 1679.5 -201.5Q1663 -183 1663 -149Q1663 -115 1678.5 -95.5Q1694 -76 1725 -76Z" />
    <path d="M2101 -220V-319H2403V-220Z" />
    <path d="M2533 0V-501H2646V-439Q2664 -452 2690.5 -467Q2717 -482 2748 -495Q2779 -508 2810 -513V-402Q2780 -397 2749 -387Q2718 -377 2691 -365Q2664 -353 2646 -344V0Z" />
  </>
);
