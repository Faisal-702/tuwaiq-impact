import {
  Building2,
  CalendarDays,
  Coins,
  GraduationCap,
  Landmark,
  Settings,
  Sparkles,
  University,
  UserRound,
  UsersRound,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { InterestField, OrganizationCategory, PartnerType, SupportType } from "@/lib/partners";
import { cn } from "@/lib/utils";

const chip = "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset";

const SUPPORT_STYLE: Record<SupportType, { icon: LucideIcon; className: string }> = {
  financial: { icon: Coins, className: "bg-[#fff8e6] text-[#9a6700] ring-[#f5d78a]/60" },
  technical: { icon: Settings, className: "bg-lavender-soft text-purple-ink ring-purple/15" },
  mentorship: { icon: UsersRound, className: "bg-[#f6efff] text-[#6b21a8] ring-[#d8b4fe]/50" },
  training: { icon: GraduationCap, className: "bg-[#eef5ff] text-[#1d4ed8] ring-[#93c5fd]/50" },
  sponsorship: { icon: CalendarDays, className: "bg-mint-soft text-teal-deep ring-teal/20" },
  other: { icon: Sparkles, className: "bg-canvas text-ink-soft ring-line" },
};

const PARTY_STYLE: Record<OrganizationCategory | "individual", { icon: LucideIcon; className: string }> = {
  individual: { icon: UserRound, className: "bg-canvas text-ink-soft ring-line" },
  private: { icon: Building2, className: "bg-lavender-soft text-purple-ink ring-purple/15" },
  government: { icon: Landmark, className: "bg-[#eef5ff] text-[#1e40af] ring-[#93c5fd]/50" },
  nonprofit: { icon: HeartHandshake, className: "bg-mint-soft text-teal-deep ring-teal/20" },
  education: { icon: University, className: "bg-[#f6efff] text-[#6b21a8] ring-[#d8b4fe]/50" },
  other: { icon: Sparkles, className: "bg-canvas text-ink-soft ring-line" },
};

export function SupportChip({ type, t, className }: { type: SupportType; t: Dictionary; className?: string }) {
  const { icon: Icon, className: tone } = SUPPORT_STYLE[type];
  return (
    <span className={cn(chip, tone, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{t.partners.support[type]}</span>
    </span>
  );
}

/** "Individual" or the organisation's category. */
export function PartyChip({
  type,
  category,
  t,
}: {
  type: PartnerType;
  category: OrganizationCategory | null;
  t: Dictionary;
}) {
  const key = type === "individual" || !category ? "individual" : category;
  const { icon: Icon, className: tone } = PARTY_STYLE[key];
  const label = key === "individual" ? t.admin.partners.individual : t.partners.categories[key];
  return (
    <span className={cn(chip, tone, "max-w-[10rem]")} data-party={key} title={label}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function InterestChip({ field, t }: { field: InterestField; t: Dictionary }) {
  return <span className={cn(chip, "bg-white text-ink-soft ring-line")}>{t.partners.interests[field]}</span>;
}
