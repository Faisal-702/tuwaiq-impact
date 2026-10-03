"use client";

import { Dialog as D, Popover as P } from "radix-ui";
import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { SuggestionPanel } from "./suggestion-form";

/**
 * Desktop: "Suggestions" in the top navigation. Opens the form in an anchored,
 * modal popover (focus trapped, Escape/outside click close) — no navigation.
 */
export function SuggestionsNavButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  return (
    <P.Root open={open} onOpenChange={setOpen} modal>
      <P.Trigger type="button" className="nav-link cursor-pointer" data-testid="nav-suggestions">
        <span aria-hidden className="nav-link__pill" />
        <span className="nav-link__label">{t.nav.suggestions}</span>
        <span aria-hidden className="nav-link__line" />
      </P.Trigger>
      <P.Portal>
        <P.Content
          align="end"
          sideOffset={12}
          collisionPadding={16}
          aria-labelledby={`${uid}-title`}
          aria-describedby={`${uid}-desc`}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nameRef.current?.focus();
          }}
          className="suggestion-popover z-50 max-h-[calc(100dvh-var(--header-h)-2rem)] w-[27.5rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[1.5rem] bg-white shadow-panel ring-1 ring-line focus:outline-none"
        >
          <SuggestionPanel
            titleId={`${uid}-title`}
            descriptionId={`${uid}-desc`}
            nameRef={nameRef}
            onClose={() => setOpen(false)}
          />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/** Mobile/tablet: the same form in a centred dialog, opened from the menu. */
export function SuggestionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const uid = useId();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[#0f1729]/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <D.Content
          aria-labelledby={`${uid}-title`}
          aria-describedby={`${uid}-desc`}
          className="fixed left-1/2 top-1/2 z-50 max-h-[min(92dvh,860px)] w-[calc(100vw-2rem)] max-w-[27.5rem] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.5rem] bg-white shadow-panel ring-1 ring-line focus:outline-none suggestion-dialog"
        >
          <SuggestionPanel
            titleId={`${uid}-title`}
            descriptionId={`${uid}-desc`}
            TitleAs={D.Title}
            DescriptionAs={D.Description}
            onClose={() => onOpenChange(false)}
          />
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
