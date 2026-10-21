"use client";

import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";

export type Datum = { key: string; label: string; value: number; hint?: string };

function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1);
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Visually hidden data table — the accessible view of every chart. */
function DataTable({ data, caption, valueLabel }: { data: Datum[]; caption: string; valueLabel: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {data.map((d) => (
          <tr key={d.key}>
            <th scope="row">{d.label}</th>
            <td>
              {d.value} {valueLabel}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Horizontal bars for magnitude by category. Single series (no legend);
 * value at the bar tip in text ink; 4px rounded data-end, square baseline.
 */
export function HorizontalBars({
  data,
  caption,
  valueLabel,
  color = "#6D4AFF",
  locale,
}: {
  data: Datum[];
  caption: string;
  valueLabel: string;
  color?: string;
  locale: Locale;
}) {
  const format = (n: number) => formatNumber(n, locale);
  const max = Math.max(...data.map((d) => d.value), 1);
  const [active, setActive] = useState<string | null>(null);
  return (
    <figure>
      <ul className="space-y-3.5" aria-hidden>
        {data.map((d) => (
          <li
            key={d.key}
            className="grid grid-cols-[minmax(6rem,9.5rem)_1fr] items-center gap-4"
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="truncate text-sm text-ink-soft" title={d.label}>
              {d.label}
            </span>
            <span className="relative flex h-6 items-center gap-2.5">
              <span
                className="h-[18px] rounded-e-[4px] transition-[opacity,width] duration-500 ease-out-soft"
                style={{
                  width: `${Math.max((d.value / max) * 82, d.value > 0 ? 1.5 : 0)}%`,
                  background: color,
                  opacity: active && active !== d.key ? 0.45 : 1,
                }}
              />
              <span className="text-sm font-medium tabular-nums text-ink">{format(d.value)}</span>
            </span>
          </li>
        ))}
      </ul>
      <DataTable data={data} caption={caption} valueLabel={valueLabel} />
    </figure>
  );
}

/**
 * Columns over time. Time runs left→right in both languages; hairline
 * gridlines; only the peak is labelled on its cap — hover/focus shows the rest.
 */
export function Columns({
  data,
  caption,
  valueLabel,
  color = "#0D9488",
  locale,
  labelEvery = 1,
  height = 200,
}: {
  data: Datum[];
  caption: string;
  valueLabel: string;
  color?: string;
  locale: Locale;
  labelEvery?: number;
  height?: number;
}) {
  const format = (n: number) => formatNumber(n, locale);
  const id = useId();
  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const max = niceMax(rawMax);
  const ticks = [0, max / 2, max];
  const peakKey = rawMax > 0 ? data.reduce((a, b) => (b.value >= a.value ? b : a)).key : null;
  const [active, setActive] = useState<string | null>(null);
  const activeDatum = data.find((d) => d.key === active);
  const activeIndex = data.findIndex((d) => d.key === active);

  return (
    <figure dir="ltr">
      <div className="relative ps-9" style={{ height }}>
        {/* Gridlines & y ticks */}
        {ticks.map((tick) => (
          <div
            key={tick}
            aria-hidden
            className="absolute inset-x-0 flex items-center"
            style={{ bottom: `${(tick / max) * 100}%` }}
          >
            <span className="w-9 -translate-y-px pe-2 text-end text-[0.6875rem] tabular-nums text-muted">
              {Number.isInteger(tick) ? format(tick) : ""}
            </span>
            <span className={cn("h-px flex-1", tick === 0 ? "bg-[#d5d9e0]" : "bg-line-soft")} />
          </div>
        ))}

        {/* Columns */}
        <div className="absolute inset-y-0 end-0 start-9 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
          {data.map((d) => {
            const h = max > 0 ? (d.value / max) * 100 : 0;
            return (
              <div
                key={d.key}
                role="img"
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)} ${valueLabel}`}
                aria-describedby={active === d.key ? `${id}-tip` : undefined}
                onMouseEnter={() => setActive(d.key)}
                onFocus={() => setActive(d.key)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-sm focus-visible:outline-offset-0"
              >
                <span
                  className="relative w-full max-w-6 rounded-t-[4px] transition-[height,opacity] duration-500 ease-out-soft"
                  style={{
                    height: `${h}%`,
                    minHeight: d.value > 0 ? 3 : 0,
                    background: color,
                    opacity: active && active !== d.key ? 0.4 : 1,
                  }}
                >
                  {d.key === peakKey && !active ? (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[0.6875rem] font-semibold tabular-nums text-ink">
                      {format(d.value)}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {activeDatum ? (
          <div
            id={`${id}-tip`}
            role="tooltip"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift"
            style={{ left: `calc(2.25rem + (100% - 2.25rem) * ${(activeIndex + 0.5) / data.length})` }}
          >
            <span className="text-white/70">{activeDatum.label}</span>
            <span className="ms-2 font-semibold tabular-nums">
              {format(activeDatum.value)} {valueLabel}
            </span>
          </div>
        ) : null}
      </div>
      <div aria-hidden className="mt-2 flex gap-[2px] ps-9">
        {data.map((d, i) => (
          <span key={d.key} className="flex flex-1 justify-center whitespace-nowrap text-[0.6875rem] text-muted">
            {i % labelEvery === 0 || i === data.length - 1 ? d.label : ""}
          </span>
        ))}
      </div>
      <DataTable data={data} caption={caption} valueLabel={valueLabel} />
    </figure>
  );
}
