"use client";

import { Download, Eye, FileSpreadsheet, FileText, Presentation, SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { formatBytes } from "@/i18n/format";
import { documentFlavor } from "@/lib/media-rules";

export type AttachmentItem = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  caption: string | null;
};

const FLAVOR = {
  pdf: { icon: FileText, label: "PDF", tone: "bg-[#fdecea] text-[#b42318]" },
  slides: { icon: Presentation, label: "PowerPoint", tone: "bg-[#fdf0e6] text-[#b54708]" },
  sheet: { icon: FileSpreadsheet, label: "Excel", tone: "bg-mint-soft text-teal-deep" },
  doc: { icon: FileText, label: "Word", tone: "bg-lavender-soft text-purple-ink" },
} as const;

function downloadUrl(url: string, fileName: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(fileName)}`;
}

export function Attachments({ items }: { items: AttachmentItem[] }) {
  const { t, locale } = useI18n();
  const [preview, setPreview] = useState<AttachmentItem | null>(null);
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const flavor = FLAVOR[documentFlavor(item.mimeType)];
          const isPdf = documentFlavor(item.mimeType) === "pdf";
          return (
            <li key={item.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-line-soft transition hover:ring-line">
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${flavor.tone}`}>
                <flavor.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate font-medium text-ink" title={item.fileName}>
                  {item.caption || item.fileName}
                </p>
                <p className="text-xs text-muted">
                  {flavor.label}
                  {item.size ? ` · ${formatBytes(item.size, locale)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isPdf ? (
                  <button
                    type="button"
                    onClick={() => setPreview(item)}
                    className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-purple"
                    aria-label={`${t.project.previewDocument}: ${item.fileName}`}
                    title={t.project.previewDocument}
                  >
                    <Eye className="size-4.5" aria-hidden />
                  </button>
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-purple"
                    aria-label={`${t.project.open}: ${item.fileName}`}
                    title={t.project.open}
                  >
                    <SquareArrowOutUpRight className="size-4.5" aria-hidden />
                  </a>
                )}
                <a
                  href={downloadUrl(item.url, item.fileName)}
                  download={item.fileName}
                  className="grid size-9 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-purple"
                  aria-label={`${t.project.download}: ${item.fileName}`}
                  title={t.project.download}
                >
                  <Download className="size-4.5" aria-hidden />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <Modal
        open={preview !== null}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.caption || preview?.fileName || t.project.documentPreview}
        closeLabel={t.common.close}
        className="max-w-5xl"
        footer={
          preview ? (
            <>
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-ink-soft transition hover:bg-canvas"
              >
                <SquareArrowOutUpRight className="size-4" aria-hidden />
                {t.project.open}
              </a>
              <a
                href={downloadUrl(preview.url, preview.fileName)}
                download={preview.fileName}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-purple px-4 text-sm font-medium text-white transition hover:bg-purple-strong"
              >
                <Download className="size-4" aria-hidden />
                {t.project.download}
              </a>
            </>
          ) : null
        }
      >
        {preview ? (
          <iframe
            src={`${preview.url}#view=FitH`}
            title={preview.fileName}
            className="h-[68vh] w-full rounded-xl bg-canvas ring-1 ring-line"
          >
            {t.project.pdfFallback}
          </iframe>
        ) : null}
      </Modal>
    </>
  );
}
