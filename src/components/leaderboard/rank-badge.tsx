import { cn } from "@/lib/utils";

const MEDALS = {
  1: "bg-[linear-gradient(145deg,#f7e3a3,#d9ae45)] text-[#5d4510] ring-[#e8c968]",
  2: "bg-[linear-gradient(145deg,#eef1f5,#c5cbd5)] text-[#3f4652] ring-[#d5dae2]",
  3: "bg-[linear-gradient(145deg,#f3d8c4,#c98e63)] text-[#5a3218] ring-[#ddb091]",
} as const;

/** Rank number; top three receive a restrained gold / silver / bronze finish. */
export function RankBadge({ rank, label, size = "md" }: { rank: number; label?: string; size?: "sm" | "md" | "lg" }) {
  const medal = MEDALS[rank as 1 | 2 | 3];
  const dims = size === "lg" ? "size-12 text-lg" : size === "sm" ? "size-7 text-xs" : "size-9 text-sm";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tabular-nums ring-1 ring-inset",
        dims,
        medal ?? "bg-canvas text-ink-soft ring-line",
      )}
      title={label}
    >
      {rank}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
