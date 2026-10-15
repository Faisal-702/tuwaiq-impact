"use client";

import { FileText, Film, ImageIcon, ImagePlus, Loader2, Paperclip, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { createContext, useContext, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatBytes, formatNumber } from "@/i18n/format";
import {
  COVER_ACCEPT,
  COVER_MAX_BYTES,
  COVER_MIME,
  EVIDENCE_ACCEPT,
  EVIDENCE_MAX_FILES,
  EVIDENCE_RULES,
  evidenceMime,
  type EvidenceFile,
} from "@/lib/submission";
import { processImage, putWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import {
  confirmCoverUpload,
  confirmEvidenceUpload,
  prepareCoverUpload,
  prepareEvidenceUpload,
  removeCoverImage,
  removeEvidence,
} from "@/server/actions/submissions";
import type { DraftView } from "@/server/submissions";

type Cover = DraftView["cover"];

/** Maps a server error code to the message shown under the upload. */
function useUploadError() {
  const { t } = useI18n();
  return (code: string) =>
    code === "type"
      ? t.submit.errors.uploadType
      : code === "size"
        ? t.submit.errors.uploadSize
        : code === "count"
          ? t.submit.errors.uploadCount
          : code === "unauthorized"
            ? t.submit.errors.session
            : t.submit.errors.uploadFailed;
}

/**
 * The form the uploads belong to: null for a new project's draft, or the id
 * of the student's project being edited (the server checks ownership).
 */
const SubmissionTarget = createContext<string | null>(null);
export const SubmissionTargetProvider = SubmissionTarget.Provider;

// ---------------------------------------------------------------------------
// Cover image (public)
// ---------------------------------------------------------------------------

export function CoverUpload({
  cover,
  onChange,
  invalid,
  describedById,
}: {
  cover: Cover;
  onChange: (cover: Cover) => void;
  invalid: boolean;
  describedById?: string;
}) {
  const { t, locale } = useI18n();
  const target = useContext(SubmissionTarget);
  const errorText = useUploadError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ phase: "idle" | "processing" | "uploading"; progress: number }>({ phase: "idle", progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<{ url: string; name: string } | null>(null);
  const busy = state.phase !== "idle";

  async function upload(file: File) {
    setError(null);
    const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!(COVER_MIME as readonly string[]).includes(type)) return setError(t.submit.errors.uploadType);
    if (file.size > COVER_MAX_BYTES) return setError(t.submit.errors.uploadSize);
    const preview = URL.createObjectURL(file);
    setLocalPreview({ url: preview, name: file.name });
    try {
      setState({ phase: "processing", progress: 0 });
      let width: number | null = null;
      let height: number | null = null;
      const blobs: Partial<Record<"large" | "thumb", Blob>> = {};
      try {
        const r = await processImage(file);
        width = r.width || null;
        height = r.height || null;
        if (r.large) blobs.large = r.large;
        if (r.thumb) blobs.thumb = r.thumb;
      } catch {
        /* The browser could not decode it: the original is still uploaded. */
      }
      const res = await prepareCoverUpload({
        fileName: file.name,
        contentType: type,
        size: file.size,
        variants: Object.keys(blobs) as ("large" | "thumb")[],
      }, target);
      if (!res.ok) throw new Error(res.error);
      const { original, variants } = res.data;
      const total = file.size + Object.values(blobs).reduce((s, b) => s + (b?.size ?? 0), 0);
      const loaded: Record<string, number> = {};
      const report = () => {
        const sum = Object.values(loaded).reduce((a, b) => a + b, 0);
        setState({ phase: "uploading", progress: Math.min(99, Math.round((sum / total) * 100)) });
      };
      setState({ phase: "uploading", progress: 0 });
      await Promise.all([
        putWithProgress(original.url, original.headers, file, (n) => {
          loaded.original = n;
          report();
        }),
        ...Object.entries(blobs).map(([v, blob]) =>
          putWithProgress(variants[v].url, variants[v].headers, blob!, (n) => {
            loaded[v] = n;
            report();
          }),
        ),
      ]);
      const done = await confirmCoverUpload({ width, height }, target);
      if (!done.ok) throw new Error(done.error);
      onChange(done.data);
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : "upload"));
      onChange(null);
    } finally {
      setState({ phase: "idle", progress: 0 });
      setLocalPreview(null);
      URL.revokeObjectURL(preview);
    }
  }

  async function remove() {
    setError(null);
    const res = await removeCoverImage(target);
    if (!res.ok) return setError(errorText(res.error));
    onChange(null);
  }

  const shown = localPreview?.url ?? (cover?.uploaded ? cover.thumbUrl : null);

  return (
    <div>
      <input
        ref={inputRef}
        id="cover"
        type="file"
        accept={COVER_ACCEPT}
        className="sr-only"
        aria-describedby={describedById}
        aria-invalid={invalid || undefined}
        data-testid="cover-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {shown ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-3 sm:flex-row sm:items-center">
          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-canvas sm:w-48">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: and storage URLs */}
            <img src={shown} alt="" className="size-full object-cover" />
            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[1px]">
                <Loader2 className="size-6 animate-spin text-purple" aria-hidden />
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink" dir="auto">
              {localPreview?.name ?? cover?.fileName ?? ""}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted" aria-live="polite" data-testid="cover-status">
              {state.phase === "processing"
                ? t.submit.processing
                : state.phase === "uploading"
                  ? fmt(t.submit.uploading, { n: formatNumber(state.progress, locale) })
                  : null}
            </p>
            {busy ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
                <div className="h-full rounded-full bg-purple transition-[width] duration-300" style={{ width: `${state.progress}%` }} />
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-purple/40 hover:text-purple-ink"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  {t.submit.replaceCover}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-danger-ink transition-colors hover:bg-danger-soft"
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t.submit.remove}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <DropZone
          icon={ImagePlus}
          title={t.submit.chooseCover}
          hint={t.submit.dropHint}
          invalid={invalid}
          onClick={() => inputRef.current?.click()}
          onFiles={(files) => files[0] && void upload(files[0])}
        />
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DropZone({
  icon: Icon,
  title,
  hint,
  invalid,
  onClick,
  onFiles,
  disabled,
}: {
  icon: typeof UploadCloud;
  title: string;
  hint: string;
  invalid?: boolean;
  onClick: () => void;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        dragging
          ? "border-purple bg-lavender-soft"
          : invalid
            ? "border-danger-ink/40 bg-danger-soft/40 hover:border-danger-ink/60"
            : "border-[#d6d9e0] bg-canvas/60 hover:border-purple/50 hover:bg-lavender-soft/50",
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-white text-purple shadow-[0_1px_2px_rgb(16_24_40/0.06)] ring-1 ring-line">
        <Icon className="size-6" strokeWidth={1.7} aria-hidden />
      </span>
      <span className="text-[0.9375rem] font-semibold text-ink">{title}</span>
      <span className="text-[0.8125rem] text-muted">{hint}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Supporting files (private)
// ---------------------------------------------------------------------------

type EvidenceItem = EvidenceFile & { progress?: number; error?: string; uploading?: boolean };

const KIND_ICON = { image: ImageIcon, video: Film, document: FileText } as const;

export function EvidenceUpload({
  files,
  onChange,
  describedById,
}: {
  files: EvidenceFile[];
  onChange: (update: (files: EvidenceFile[]) => EvidenceFile[]) => void;
  describedById?: string;
}) {
  const { t, locale } = useI18n();
  const target = useContext(SubmissionTarget);
  const errorText = useUploadError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<EvidenceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const count = files.length + pending.length;

  async function uploadOne(file: File) {
    const mime = evidenceMime(file.name, file.type);
    const rule = mime ? EVIDENCE_RULES[mime] : null;
    if (!mime || !rule) return setError(`${file.name}: ${t.submit.errors.uploadType}`);
    if (file.size > rule.max) return setError(`${file.name}: ${t.submit.errors.uploadSize}`);
    const res = await prepareEvidenceUpload({ fileName: file.name, contentType: mime, size: file.size }, target);
    if (!res.ok) return setError(`${file.name}: ${errorText(res.error)}`);
    const item: EvidenceItem = { ...res.data.file, uploading: true, progress: 0 };
    setPending((p) => [...p, item]);
    const patch = (update: Partial<EvidenceItem>) =>
      setPending((p) => p.map((x) => (x.id === item.id ? { ...x, ...update } : x)));
    try {
      await putWithProgress(res.data.url, res.data.headers, file, (n) =>
        patch({ progress: Math.min(99, Math.round((n / file.size) * 100)) }),
      );
      const done = await confirmEvidenceUpload(item.id, target);
      if (!done.ok) throw new Error(done.error);
      setPending((p) => p.filter((x) => x.id !== item.id));
      onChange((prev) => [...prev.filter((f) => f.id !== item.id), done.data]);
    } catch {
      setPending((p) => p.filter((x) => x.id !== item.id));
      // Drop the reservation so it does not count against the limit.
      await removeEvidence(item.id, target).catch(() => undefined);
      setError(`${file.name}: ${t.submit.errors.uploadFailed}`);
    }
  }

  async function addFiles(list: File[]) {
    setError(null);
    const room = EVIDENCE_MAX_FILES - count;
    if (room <= 0) return setError(t.submit.errors.uploadCount);
    if (list.length > room) setError(t.submit.errors.uploadCount);
    // One at a time keeps the order and the server-side file limit predictable.
    for (const file of list.slice(0, room)) await uploadOne(file);
  }

  async function remove(id: string) {
    setError(null);
    const res = await removeEvidence(id, target);
    if (!res.ok) return setError(errorText(res.error));
    onChange((prev) => prev.filter((f) => f.id !== id));
  }

  // Files whose upload never finished (e.g. the page was closed) are shown
  // so they can be removed; they are ignored on submit.
  const rows: EvidenceItem[] = [...files, ...pending];

  return (
    <div>
      <input
        ref={inputRef}
        id="evidence"
        type="file"
        multiple
        accept={EVIDENCE_ACCEPT}
        className="sr-only"
        aria-describedby={describedById}
        data-testid="evidence-input"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (list.length) void addFiles(list);
        }}
      />
      <DropZone
        icon={UploadCloud}
        title={t.submit.addFiles}
        hint={t.submit.dropHint}
        disabled={count >= EVIDENCE_MAX_FILES}
        onClick={() => inputRef.current?.click()}
        onFiles={(list) => void addFiles(list)}
      />
      <div className="mt-4 flex items-center justify-between gap-3 text-[0.8125rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Paperclip className="size-4" aria-hidden />
          {fmt(t.submit.filesCount, { n: formatNumber(files.length, locale), max: formatNumber(EVIDENCE_MAX_FILES, locale) })}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl bg-canvas px-4 py-3 text-sm text-muted">{t.submit.noFiles}</p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="evidence-list">
          {rows.map((f) => {
            const Icon = KIND_ICON[f.kind] ?? FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-lavender-soft text-purple">
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" dir="auto">
                    {f.name}
                  </p>
                  {f.uploading ? (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                      <div className="h-full rounded-full bg-purple transition-[width] duration-300" style={{ width: `${f.progress ?? 0}%` }} />
                    </div>
                  ) : (
                    <p className={cn("text-xs", f.uploaded ? "text-muted" : "text-danger-ink")}>
                      {f.uploaded ? formatBytes(f.size, locale) : t.submit.errors.uploadFailed}
                    </p>
                  )}
                </div>
                {f.uploading ? (
                  <span className="text-xs tabular-nums text-muted" aria-live="polite">
                    {fmt(t.submit.uploading, { n: formatNumber(f.progress ?? 0, locale) })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void remove(f.id)}
                    aria-label={`${t.submit.remove}: ${f.name}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger-ink"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
