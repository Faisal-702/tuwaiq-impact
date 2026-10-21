/** Upload rules shared by the browser (early feedback) and the server (enforcement). */

export type UploadKind = "image" | "video" | "document";

export const MAX_VIDEO_SECONDS = 300;

export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  image: 50 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024,
  document: 200 * 1024 * 1024,
};

export const MIME_RULES: Record<string, { kind: UploadKind; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/avif": { kind: "image", ext: "avif" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "application/pdf": { kind: "document", ext: "pdf" },
  "application/vnd.ms-powerpoint": { kind: "document", ext: "ppt" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { kind: "document", ext: "pptx" },
  "application/msword": { kind: "document", ext: "doc" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "document", ext: "docx" },
  "application/vnd.ms-excel": { kind: "document", ext: "xls" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { kind: "document", ext: "xlsx" },
};

const EXTENSION_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_RULES).map(([mime, rule]) => [rule.ext, mime]),
);
EXTENSION_TO_MIME.jpeg = "image/jpeg";
EXTENSION_TO_MIME.m4v = "video/mp4";

/** Resolves a trusted MIME type from the declared type, falling back to the extension. */
export function resolveMime(fileName: string, declared: string | null | undefined): string | null {
  if (declared && MIME_RULES[declared]) return declared;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function mimeForExtension(ext: string): string | null {
  return EXTENSION_TO_MIME[ext.toLowerCase()] ?? null;
}

/** Variant files generated in the browser. */
export const VARIANT_MIME = "image/webp";

export const ACCEPT_ATTRIBUTE = [
  ...Object.keys(MIME_RULES),
  ...Object.values(MIME_RULES).map((r) => `.${r.ext}`),
].join(",");

export function documentFlavor(mime: string | null | undefined): "pdf" | "slides" | "sheet" | "doc" {
  if (!mime) return "doc";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slides";
  if (mime.includes("sheet") || mime.includes("excel")) return "sheet";
  return "doc";
}
