"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeLabel,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  closeLabel: string;
  footer?: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[#0f1729]/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,860px)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl bg-white shadow-panel ring-1 ring-line focus:outline-none data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.22,1,0.36,1)]",
            className,
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div>
              <D.Title className="text-lg font-semibold text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm leading-relaxed text-muted">{description}</D.Description>
              ) : null}
            </div>
            <D.Close
              className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
              aria-label={closeLabel}
            >
              <X className="size-4.5" aria-hidden />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-6 py-4">{footer}</div>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
