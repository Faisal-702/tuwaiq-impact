import {
  Atom,
  Award,
  BookOpen,
  Bot,
  BrainCircuit,
  Clapperboard,
  CodeXml,
  Cpu,
  Flag,
  FlaskConical,
  Globe,
  HandHeart,
  Landmark,
  Leaf,
  Lightbulb,
  Medal,
  Microscope,
  Palette,
  Rocket,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement } from "react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  "flask-conical": FlaskConical,
  "code-xml": CodeXml,
  "brain-circuit": BrainCircuit,
  "shield-check": ShieldCheck,
  bot: Bot,
  clapperboard: Clapperboard,
  "hand-heart": HandHeart,
  trophy: Trophy,
  school: School,
  flag: Flag,
  landmark: Landmark,
  award: Award,
  medal: Medal,
  star: Star,
  rocket: Rocket,
  cpu: Cpu,
  globe: Globe,
  leaf: Leaf,
  palette: Palette,
  microscope: Microscope,
  atom: Atom,
  "book-open": BookOpen,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function categoryIcon(key: string | null | undefined): LucideIcon {
  return (key && CATEGORY_ICONS[key]) || Sparkles;
}

/** Renders a category's icon by key (icons come from a static map). */
export function CategoryIcon({ name, ...props }: LucideProps & { name: string | null | undefined }) {
  return createElement(categoryIcon(name), props);
}

/** Brand-safe accents. Categories may only use these. */
export const CATEGORY_ACCENTS = {
  teal: { chip: "bg-mint-soft text-teal-deep ring-teal/20", dot: "bg-teal", tint: "from-mint to-mint-soft", icon: "text-teal-deep", swatch: "#14B8A6" },
  "deep-teal": { chip: "bg-mint-soft text-teal-deep ring-teal-deep/20", dot: "bg-teal-deep", tint: "from-[#cdeee9] to-mint-soft", icon: "text-teal-deep", swatch: "#0F766E" },
  purple: { chip: "bg-lavender-soft text-purple-ink ring-purple/20", dot: "bg-purple", tint: "from-lavender to-lavender-soft", icon: "text-purple", swatch: "#6D4AFF" },
  violet: { chip: "bg-lavender-soft text-purple-ink ring-violet/30", dot: "bg-violet", tint: "from-[#efe9ff] to-lavender-soft", icon: "text-purple-ink", swatch: "#A78BFA" },
  graphite: { chip: "bg-canvas text-ink ring-ink/10", dot: "bg-ink", tint: "from-[#e9ecf1] to-canvas", icon: "text-ink", swatch: "#1F2937" },
  slate: { chip: "bg-canvas text-ink-soft ring-muted/20", dot: "bg-muted", tint: "from-[#eef1f5] to-canvas", icon: "text-ink-soft", swatch: "#6B7280" },
} as const;

export type CategoryAccent = keyof typeof CATEGORY_ACCENTS;
export const CATEGORY_ACCENT_KEYS = Object.keys(CATEGORY_ACCENTS) as CategoryAccent[];

export function categoryAccent(key: string | null | undefined) {
  return CATEGORY_ACCENTS[(key as CategoryAccent) in CATEGORY_ACCENTS ? (key as CategoryAccent) : "teal"];
}
