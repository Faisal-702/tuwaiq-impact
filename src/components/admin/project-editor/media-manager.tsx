"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  FileSpreadsheet,
  FileText,
  Film,
  ImagePlus,
  LoaderCircle,
  Presentation,
  RotateCcw,
  Star,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { fmt, formatBytes, formatDuration } from "@/i18n/format";
import { ACCEPT_ATTRIBUTE, MAX_VIDEO_SECONDS, MIME_RULES, UPLOAD_LIMITS, documentFlavor, resolveMime } from "@/lib/media-rules";
import { processImage, processVideo, putWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { discardUploads, prepareUpload } from "@/server/actions/projects";

export type MediaItem = {
  key: string;
  id?: string;
  kind: "image" | "video" | "document";
  status: "ready" | "processing" | "uploading" | "error";
  progress: number;
  error?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  storagePath?: string;
  previewPath?: string | null;
  thumbPath?: string | null;
  previewUrl?: string | null;
  caption: string;
  file?: File;
};

const FLAVOR_ICON = { pdf: FileText, slides: Presentation, sheet: FileSpreadsheet, doc: FileText } as const;

export function MediaManager({
  items,
  setItems,
  coverKey,
  setCoverKey,
}: {
  items: MediaItem[];
  setItems: (update: (prev: MediaItem[]) => MediaItem[]) => void;
  coverKey: string | null;
  setCoverKey: (key: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const patch = (key: string, update: Partial<MediaItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...update } : i)));

  async function upload(item: MediaItem, file: File) {
    try {
      patch(item.key, { status: "processing", error: undefined, progress: 0 });
      let width: number | null = null;
      let height: number | null = null;
      let duration: number | null = null;
      const blobs: Record<string, Blob> = {};

      if (item.kind === "image") {
        try {
          const r = await processImage(file);
          width = r.width || null;
          height = r.height || null;
          if (r.large) blobs.large = r.large;
          if (r.thumb) blobs.thumb = r.thumb;
        } catch {
          /* Browser could not decode it — the original is still kept and shown. */
        }
      } else if (item.kind === "video") {
        const r = await processVideo(file);
        width = r.width;
        height = r.height;
        duration = r.duration;
        if (duration !== null && duration > MAX_VIDEO_SECONDS + 0.5) {
          patch(item.key, { status: "error", error: fmt(t.admin.media.videoTooLong, { name: file.name }), file });
          toast.error(fmt(t.admin.media.videoTooLong, { name: file.name }));
          return;
        }
        if (duration === null) toast.warning(fmt(t.admin.media.videoUnknown, { name: file.name }));
        if (r.poster) blobs.poster = r.poster;
      }

      const res = await prepareUpload({
        fileName: file.name,
        contentType: item.mimeType,
        size: file.size,
        variants: Object.keys(blobs) as ("large" | "thumb" | "poster")[],
      });
      if (!res.ok || !res.data) throw new Error(res.ok ? "upload" : res.error);
      const { original, variants } = res.data;

      const total = file.size + Object.values(blobs).reduce((s, b) => s + b.size, 0);
      const loaded: Record<string, number> = {};
      const report = () => {
        const sum = Object.values(loaded).reduce((a, b) => a + b, 0);
        patch(item.key, { progress: Math.min(99, Math.round((sum / total) * 100)) });
      };
      patch(item.key, { status: "uploading" });

      await Promise.all([
        putWithProgress(original.url, original.headers, file, (n) => {
          loaded.original = n;
          report();
        }),
        ...Object.entries(blobs).map(([v, blob]) =>
          putWithProgress(variants[v].url, variants[v].headers, blob, (n) => {
            loaded[v] = n;
            report();
          }),
        ),
      ]);

      patch(item.key, {
        status: "ready",
        progress: 100,
        storagePath: original.path,
        previewPath: variants.large?.path ?? null,
        thumbPath: variants.thumb?.path ?? variants.poster?.path ?? null,
        width,
        height,
        durationSeconds: duration !== null ? Math.round(duration * 100) / 100 : null,
        file: undefined,
      });
    } catch {
      patch(item.key, { status: "error", error: t.admin.media.failed, file });
    }
  }

  function addFiles(files: FileList | File[]) {
    const accepted: { item: MediaItem; file: File }[] = [];
    for (const file of Array.from(files)) {
      const mime = resolveMime(file.name, file.type);
      const rule = mime ? MIME_RULES[mime] : null;
      if (!mime || !rule) {
        toast.error(fmt(t.admin.media.unsupported, { name: file.name }));
        continue;
      }
      if (file.size > UPLOAD_LIMITS[rule.kind]) {
        toast.error(fmt(t.admin.media.tooLarge, { name: file.name, limit: formatBytes(UPLOAD_LIMITS[rule.kind], locale) }));
        continue;
      }
      const item: MediaItem = {
        key: crypto.randomUUID(),
        kind: rule.kind,
        status: "processing",
        progress: 0,
        fileName: file.name,
        mimeType: mime,
        sizeBytes: file.size,
        caption: "",
        previewUrl: rule.kind === "image" ? URL.createObjectURL(file) : null,
      };
      accepted.push({ item, file });
    }
    if (accepted.length === 0) return;
    setItems((prev) => [...prev, ...accepted.map((a) => a.item)]);
    for (const { item, file } of accepted) void upload(item, file);
  }

  function remove(item: MediaItem) {
    setItems((prev) => prev.filter((i) => i.key !== item.key));
    if (coverKey === item.key || (item.id && coverKey === item.id)) setCoverKey(null);
    // Unsaved uploads are cleaned up immediately; saved media is removed on save.
    if (!item.id && item.storagePath) {
      void discardUploads([item.storagePath, item.previewPath, item.thumbPath].filter((p): p is string => !!p));
    }
  }

  function move(item: MediaItem, dir: -1 | 1) {
    setItems((prev) => {
      const group = prev.filter((i) => (item.kind === "document" ? i.kind === "document" : i.kind !== "document"));
      const idx = group.findIndex((i) => i.key === item.key);
      const target = group[idx + dir];
      if (!target) return prev;
      const a = prev.findIndex((i) => i.key === item.key);
      const b = prev.findIndex((i) => i.key === target.key);
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  const visual = items.filter((i) => i.kind !== "document");
  const docs = items.filter((i) => i.kind === "document");
  const effectiveCover =
    coverKey ?? visual.find((i) => i.kind === "image")?.key ?? visual.find((i) => i.kind === "video")?.key ?? null;
  const isCover = (i: MediaItem) => effectiveCover === i.key || (i.id !== undefined && effectiveCover === i.id);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-purple bg-lavender-soft" : "border-line bg-canvas/60 hover:border-[#cfd3da]",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-purple shadow-soft ring-1 ring-line">
          <UploadCloud className="size-5.5" aria-hidden />
        </span>
        <p className="mt-4 font-medium text-ink">{t.admin.media.dropTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.admin.media.dropBody}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-purple ring-1 ring-purple/30 transition hover:bg-lavender-soft"
        >
          <ImagePlus className="size-4" aria-hidden />
          {t.admin.media.browse}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-label={t.admin.media.browse}
          data-testid="media-input"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-4 max-w-md text-xs text-muted">{t.admin.media.originalKept}</p>
      </div>

      {visual.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">{t.admin.media.title}</h3>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visual.map((item, i) => (
              <li key={item.key} className="overflow-hidden rounded-2xl bg-white ring-1 ring-line-soft" data-testid="media-item">
                <div className="relative aspect-[16/10] bg-canvas">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#1f2937] to-[#33248f] text-white/80">
                      <Film className="size-8" aria-hidden />
                    </div>
                  )}
                  {item.kind === "video" && item.durationSeconds ? (
                    <span className="absolute bottom-2 end-2 rounded-md bg-black/65 px-1.5 py-0.5 text-xs tabular-nums text-white">
                      {formatDuration(item.durationSeconds)}
                    </span>
                  ) : null}
                  {isCover(item) ? (
                    <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-purple-ink shadow-sm">
                      <Star className="size-3 fill-purple text-purple" aria-hidden />
                      {t.admin.media.cover}
                    </span>
                  ) : null}
                  <UploadOverlay item={item} onRetry={() => item.file && void upload(item, item.file)} />
                </div>
                <div className="space-y-2.5 p-3">
                  <p className="truncate text-xs text-muted" title={item.fileName}>
                    {item.fileName} · {formatBytes(item.sizeBytes, locale)}
                  </p>
                  <input
                    value={item.caption}
                    onChange={(e) => patch(item.key, { caption: e.target.value })}
                    placeholder={t.admin.media.captionPlaceholder}
                    aria-label={`${t.admin.media.caption} — ${item.fileName}`}
                    dir="auto"
                    maxLength={300}
                    className="h-9 w-full rounded-lg border border-line px-3 text-sm focus:border-purple/50 focus:outline-none focus:ring-2 focus:ring-purple/10"
                  />
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label={t.admin.media.setCover}
                      onClick={() => setCoverKey(item.id ?? item.key)}
                      pressed={isCover(item)}
                    >
                      <Star className={cn("size-4", isCover(item) && "fill-purple text-purple")} aria-hidden />
                    </IconBtn>
                    <IconBtn label={t.admin.media.moveUp} onClick={() => move(item, -1)} disabled={i === 0}>
                      <ArrowUp className="size-4" aria-hidden />
                    </IconBtn>
                    <IconBtn label={t.admin.media.moveDown} onClick={() => move(item, 1)} disabled={i === visual.length - 1}>
                      <ArrowDown className="size-4" aria-hidden />
                    </IconBtn>
                    <span className="flex-1" />
                    <IconBtn label={`${t.admin.media.remove} — ${item.fileName}`} onClick={() => remove(item)} danger>
                      <X className="size-4" aria-hidden />
                    </IconBtn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {docs.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">{t.admin.media.attachmentsTitle}</h3>
          <ul className="space-y-2.5">
            {docs.map((item, i) => {
              const Icon = FLAVOR_ICON[documentFlavor(item.mimeType)];
              return (
                <li key={item.key} className="relative overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-line-soft" data-testid="media-item">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lavender-soft text-purple-ink">
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.fileName}</p>
                        <p className="text-xs text-muted">
                          {formatBytes(item.sizeBytes, locale)}
                          {item.status === "uploading" || item.status === "processing" ? ` · ${item.progress}%` : ""}
                          {item.status === "error" ? <span className="text-danger-ink"> · {item.error}</span> : null}
                        </p>
                      </div>
                    </div>
                    <input
                      value={item.caption}
                      onChange={(e) => patch(item.key, { caption: e.target.value })}
                      placeholder={t.admin.media.captionPlaceholder}
                      aria-label={`${t.admin.media.caption} — ${item.fileName}`}
                      dir="auto"
                      maxLength={300}
                      className="h-9 rounded-lg border border-line px-3 text-sm focus:border-purple/50 focus:outline-none focus:ring-2 focus:ring-purple/10 sm:w-56"
                    />
                    <div className="flex items-center gap-1">
                      {item.status === "error" && item.file ? (
                        <IconBtn label={t.admin.media.retry} onClick={() => void upload(item, item.file!)}>
                          <RotateCcw className="size-4" aria-hidden />
                        </IconBtn>
                      ) : null}
                      <IconBtn label={t.admin.media.moveUp} onClick={() => move(item, -1)} disabled={i === 0}>
                        <ArrowUp className="size-4" aria-hidden />
                      </IconBtn>
                      <IconBtn label={t.admin.media.moveDown} onClick={() => move(item, 1)} disabled={i === docs.length - 1}>
                        <ArrowDown className="size-4" aria-hidden />
                      </IconBtn>
                      <IconBtn label={`${t.admin.media.remove} — ${item.fileName}`} onClick={() => remove(item)} danger>
                        <X className="size-4" aria-hidden />
                      </IconBtn>
                    </div>
                  </div>
                  {item.status === "uploading" || item.status === "processing" ? (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line-soft">
                      <div className="h-full bg-purple transition-[width] duration-300" style={{ width: `${item.progress}%` }} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UploadOverlay({ item, onRetry }: { item: MediaItem; onRetry: () => void }) {
  const { t } = useI18n();
  if (item.status === "ready") return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/55 px-6 text-white backdrop-blur-[1px]">
      {item.status === "error" ? (
        <>
          <CircleAlert className="size-6" aria-hidden />
          <p className="text-center text-sm">{item.error ?? t.admin.media.failed}</p>
          {item.file ? (
            <button type="button" onClick={onRetry} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25">
              {t.admin.media.retry}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <LoaderCircle className="size-6 animate-spin" aria-hidden />
          <p className="text-sm" aria-live="polite">
            {item.status === "processing" ? t.admin.media.processing : `${t.admin.media.uploading} ${item.progress}%`}
          </p>
          <div className="h-1 w-full max-w-40 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${item.progress}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  disabled,
  danger,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-ink-soft transition disabled:opacity-35",
        danger ? "hover:bg-danger-soft hover:text-danger-ink" : "hover:bg-canvas hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
