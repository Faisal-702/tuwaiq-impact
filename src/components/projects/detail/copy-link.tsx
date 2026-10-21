"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";

export function CopyLinkButton() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          toast.success(t.project.linkCopied);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-ink-soft ring-1 ring-line-soft transition hover:text-ink hover:ring-line"
    >
      {copied ? <Check className="size-4 text-teal-deep" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      {t.project.share}
    </button>
  );
}
