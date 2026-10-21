"use client";

import { AlertCircle, CheckCircle2, CirclePlus, History, Loader2, Undo2 } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { funding as computeFunding, SUPPORT_NOTE_MAX, type Funding } from "@/lib/funding";
import { parseAmount } from "@/lib/submission";
import { cn } from "@/lib/utils";
import { addSupport, getSupport, reverseSupport, type SupportResult } from "@/server/actions/my-projects";
import type { SupportEntry } from "@/server/queries/my-projects";
import { fullDateTime, money } from "./format";
import { FundingBar } from "./funding-bar";

const newToken = () => crypto.randomUUID();

/**
 * "إضافة رصيد": records support the student received for one of their
 * projects (manual tracking, not a payment), shows the support history and
 * lets a mistaken entry be reversed. Totals come back from the server.
 */
export function FundsDialog({
  project,
  open,
  onOpenChange,
  focusHistory,
}: {
  project: { id: string; title: string; funding: Funding; hasTarget: boolean };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusHistory?: boolean;
}) {
  const { t, locale } = useI18n();
  const f = t.myProjects.funds;
  const router = useRouter();
  const [totals, setTotals] = useState<Funding>(project.funding);
  const [entries, setEntries] = useState<SupportEntry[] | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reversing, setReversing] = useState<SupportEntry | null>(null);
  const token = useRef<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // The dialog is mounted when it opens: load fresh totals and the history.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void getSupport(project.id).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setTotals(res.data.funding);
        setEntries(res.data.entries);
        if (focusHistory) requestAnimationFrame(() => historyRef.current?.scrollIntoView({ block: "start" }));
      } else setError(errorText(res));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on open only
  }, [open, project.id]);

  function errorText(res: Extract<SupportResult, { ok: false }>) {
    switch (res.error) {
      case "amount":
        return f.errors.amount;
      case "over_remaining":
        return fmt(f.errors.over, { remaining: money(res.remaining ?? 0, t, locale) });
      case "no_target":
        return f.errors.noTarget;
      case "note":
        return f.errors.note;
      case "unauthorized":
        return f.errors.session;
      case "not_found":
        return f.errors.notFound;
      case "already_reversed":
        return f.errors.already;
      default:
        return f.errors.server;
    }
  }

  const parsed = parseAmount(amount);
  const preview = parsed && parsed > 0 && parsed <= totals.remaining ? computeFunding(totals.requested, totals.recorded + parsed) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setError(null);
    if (parsed === null || parsed <= 0) return setError(f.errors.amount);
    if (parsed > totals.remaining) return setError(fmt(f.errors.over, { remaining: money(totals.remaining, t, locale) }));
    if (note.trim().length > SUPPORT_NOTE_MAX) return setError(f.errors.note);
    setSending(true);
    token.current ??= newToken();
    try {
      const res = await addSupport({ projectId: project.id, amount, note, token: token.current });
      if (!res.ok) return setError(errorText(res));
      setTotals(res.data.funding);
      setEntries(res.data.entries);
      toast.success(fmt(f.success, { amount: money(parsed, t, locale) }));
      setAmount("");
      setNote("");
      token.current = null;
      router.refresh();
    } catch {
      setError(f.errors.server);
    } finally {
      setSending(false);
    }
  }

  const reached = project.hasTarget && totals.remaining <= 0;

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} title={f.title} description={f.intro} closeLabel={t.common.close} className="max-w-xl">
        <div className="space-y-5" data-testid="funds-dialog">
          <div className="rounded-2xl bg-[#f7f6fe] p-4 ring-1 ring-inset ring-[#ece9fb]">
            <p className="text-xs font-semibold text-muted">{f.project}</p>
            <p dir="auto" className="mt-0.5 font-bold text-[#1f2140]" data-testid="funds-project">
              {project.title}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["requested", f.requested, totals.requested, "text-[#2a3652]"],
                  ["recorded", f.recorded, totals.recorded, "text-[#029988]"],
                  ["remaining", f.remaining, totals.remaining, "text-[#24958c]"],
                ] as const
              ).map(([key, label, value, tone]) => (
                <div key={key} className="rounded-xl bg-white px-2 py-2.5 ring-1 ring-inset ring-[#eeecf8]">
                  <dt className="text-[0.75rem] text-muted">{label}</dt>
                  <dd className={cn("mt-0.5 text-[0.9375rem] font-bold tabular-nums", tone)} data-testid={`funds-${key}`}>
                    {money(value, t, locale)}
                  </dd>
                </div>
              ))}
            </dl>
            <FundingBar funding={preview ?? totals} className="mt-4" />
          </div>

          {reached ? (
            <p className="flex items-center gap-2 rounded-xl bg-[#e0f6f1] px-4 py-3 text-sm font-medium text-[#1d7f70]" role="status">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {f.reached}
            </p>
          ) : !project.hasTarget ? (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">{f.errors.noTarget}</p>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <div>
                <label htmlFor="support-amount" className="text-sm font-semibold text-ink">
                  {f.amount}
                </label>
                <input
                  id="support-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder={f.amountPlaceholder}
                  aria-invalid={Boolean(error) || undefined}
                  aria-describedby={error ? "support-error" : "support-hint"}
                  className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-base tabular-nums text-ink placeholder:text-[#9aa1ad] focus:border-[#5c3bfc]/60 focus:outline-none focus:ring-4 focus:ring-[#5c3bfc]/10 aria-invalid:border-danger-ink/50"
                  dir="ltr"
                  data-testid="support-amount"
                />
                <p id="support-hint" className="mt-1.5 text-[0.8125rem] text-muted">
                  {f.amountHint}
                </p>
              </div>
              <div>
                <label htmlFor="support-note" className="text-sm font-semibold text-ink">
                  {f.note} <span className="text-xs font-normal text-muted">{t.common.optional}</span>
                </label>
                <input
                  id="support-note"
                  value={note}
                  maxLength={SUPPORT_NOTE_MAX}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={f.notePlaceholder}
                  className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-4 text-[0.9375rem] text-ink placeholder:text-[#9aa1ad] focus:border-[#5c3bfc]/60 focus:outline-none focus:ring-4 focus:ring-[#5c3bfc]/10"
                  dir="auto"
                  data-testid="support-note"
                />
              </div>
              {error ? (
                <p id="support-error" role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink" data-testid="support-error">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <D.Close className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-ink-soft ring-1 ring-inset ring-line transition hover:bg-canvas">
                  {f.cancel}
                </D.Close>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5c3bfc] px-6 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgb(92_59_252/0.9)] transition hover:bg-[#4c2ee0] disabled:opacity-70"
                  data-testid="support-confirm"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CirclePlus className="size-4" aria-hidden />}
                  {sending ? f.confirming : f.confirm}
                </button>
              </div>
            </form>
          )}

          <div ref={historyRef} className="scroll-mt-4 border-t border-line-soft pt-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <History className="size-4 text-[#5c4bb5]" aria-hidden />
              {f.history}
            </h3>
            {entries === null ? (
              <p className="mt-3 text-sm text-muted">{f.loading}</p>
            ) : entries.length === 0 ? (
              <p className="mt-3 text-sm text-muted" data-testid="support-history-empty">
                {f.historyEmpty}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line-soft" data-testid="support-history">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2.5" data-entry={e.id} data-reversed={e.reversedAt ? "true" : "false"}>
                    <div className="min-w-0">
                      <p className={cn("font-bold tabular-nums", e.reversedAt ? "text-muted line-through" : "text-[#1f2140]")}>{money(e.amount, t, locale)}</p>
                      {e.note ? (
                        <p dir="auto" className="mt-0.5 break-words text-[0.8125rem] text-ink-soft">
                          {e.note}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted">
                        {fullDateTime(e.createdAt, locale)} · {f.manual}
                      </p>
                      {e.reversedAt ? (
                        <p className="mt-0.5 text-xs font-medium text-danger-ink">
                          {fmt(f.reversedOn, { date: fullDateTime(e.reversedAt, locale) })}
                          {e.reversalReason ? ` — ${e.reversalReason}` : ""}
                        </p>
                      ) : null}
                    </div>
                    {e.reversedAt ? (
                      <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">{f.reversed}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReversing(e)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-inset ring-line transition hover:bg-danger-soft hover:text-danger-ink"
                        data-testid="support-reverse"
                      >
                        <Undo2 className="size-3.5" aria-hidden />
                        {f.reverse}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
      {reversing ? (
        <ReverseDialog
          entry={reversing}
          onClose={() => setReversing(null)}
          onConfirm={async (reason) => {
            const res = await reverseSupport({ projectId: project.id, entryId: reversing.id, reason });
            if (!res.ok) return errorText(res);
            setTotals(res.data.funding);
            setEntries(res.data.entries);
            toast.success(f.reversedToast);
            router.refresh();
            return null;
          }}
        />
      ) : null}
    </>
  );
}

function ReverseDialog({
  entry,
  onClose,
  onConfirm,
}: {
  entry: SupportEntry;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const { t, locale } = useI18n();
  const f = t.myProjects.funds;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={f.reverseTitle} description={fmt(f.reverseBody, { amount: money(entry.amount, t, locale) })} closeLabel={t.common.close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          const message = await onConfirm(reason);
          setBusy(false);
          if (message) setError(message);
          else onClose();
        }}
        className="space-y-4"
        data-testid="reverse-dialog"
      >
        <div>
          <label htmlFor="reverse-reason" className="text-sm font-semibold text-ink">
            {f.reverseReason}
          </label>
          <input
            id="reverse-reason"
            value={reason}
            maxLength={SUPPORT_NOTE_MAX}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-4 text-[0.9375rem] focus:border-[#5c3bfc]/60 focus:outline-none focus:ring-4 focus:ring-[#5c3bfc]/10"
            dir="auto"
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-ink-soft ring-1 ring-inset ring-line hover:bg-canvas">
            {f.cancel}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-danger-ink px-5 text-sm font-bold text-white hover:bg-[#962016] disabled:opacity-70"
            data-testid="reverse-confirm"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
            {f.reverseConfirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}
