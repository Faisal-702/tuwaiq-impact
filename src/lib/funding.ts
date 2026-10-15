/**
 * Funding figures of a project, computed one way everywhere (My Projects,
 * Explore cards, project page, admin). "Recorded" is the sum of the support
 * the student reported manually (reversed entries excluded); it is not a
 * payment confirmation.
 */
export type Funding = {
  requested: number;
  recorded: number;
  remaining: number;
  /** 0–100, rounded down to one decimal. */
  percent: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function funding(requested: number | null | undefined, recorded: number | null | undefined): Funding {
  const target = Math.max(0, round2(Number(requested) || 0));
  const raised = Math.max(0, round2(Number(recorded) || 0));
  return {
    requested: target,
    recorded: raised,
    remaining: round2(Math.max(0, target - raised)),
    percent: target > 0 ? Math.floor(Math.min(100, (raised / target) * 100) * 10) / 10 : 0,
  };
}

/** Totals over several projects (each project's remaining is capped at 0 first). */
export function fundingTotals(items: Funding[]): Funding {
  const requested = round2(items.reduce((s, f) => s + f.requested, 0));
  const recorded = round2(items.reduce((s, f) => s + f.recorded, 0));
  const remaining = round2(items.reduce((s, f) => s + f.remaining, 0));
  return { requested, recorded, remaining, percent: requested > 0 ? Math.floor(Math.min(100, (recorded / requested) * 100) * 10) / 10 : 0 };
}

/** Maximum length of the optional note on a support entry and of a reversal reason. */
export const SUPPORT_NOTE_MAX = 200;
