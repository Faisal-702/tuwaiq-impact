"use client";

import { AlertDialog as A } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Button } from "./button";

/** Accessible confirmation for destructive or significant actions. */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "danger",
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => Promise<void> | void;
  tone?: "danger" | "primary";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setUncontrolled(o));
  const [busy, setBusy] = useState(false);
  return (
    <A.Root open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <A.Trigger asChild>{trigger}</A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-[#0f1729]/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-panel ring-1 ring-line focus:outline-none data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.22,1,0.36,1)]">
          <A.Title className="text-lg font-semibold text-ink">{title}</A.Title>
          <A.Description className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{body}</A.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="subtle" disabled={busy}>
                {cancelLabel}
              </Button>
            </A.Cancel>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
