"use client";

/**
 * Browser-side media preparation. Originals are uploaded untouched (full
 * quality, e.g. 4K); optimised WebP variants are generated here for fast
 * page rendering: `large` (gallery/lightbox) and `thumb` (cards), plus a
 * poster frame for videos.
 */

const LARGE_EDGE = 2560;
const THUMB_WIDTH = 800;
const POSTER_WIDTH = 1280;

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", quality));
}

function drawScaled(source: CanvasImageSource, sw: number, sh: number, maxW: number, maxH: number) {
  const scale = Math.min(1, maxW / sw, maxH / sh);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export async function processImage(
  file: File,
): Promise<{ width: number; height: number; large: Blob | null; thumb: Blob | null }> {
  // Animated GIFs keep their original only.
  if (file.type === "image/gif") {
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });
    return { ...dims, large: null, thumb: null };
  }
  const bitmap = await createImageBitmap(file); // honours EXIF orientation
  try {
    const { width, height } = bitmap;
    const largeCanvas = drawScaled(bitmap, width, height, LARGE_EDGE, LARGE_EDGE);
    const thumbCanvas = drawScaled(bitmap, width, height, THUMB_WIDTH, THUMB_WIDTH * 1.25);
    const [large, thumb] = await Promise.all([
      largeCanvas ? canvasToWebp(largeCanvas, 0.86) : null,
      thumbCanvas ? canvasToWebp(thumbCanvas, 0.8) : null,
    ]);
    return { width, height, large, thumb };
  } finally {
    bitmap.close();
  }
}

export async function processVideo(
  file: File,
): Promise<{ duration: number | null; width: number | null; height: number | null; poster: Blob | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;
  try {
    const meta = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 15000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(true);
      };
      video.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });
    if (!meta) return { duration: null, width: null, height: null, poster: null };
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const width = video.videoWidth || null;
    const height = video.videoHeight || null;

    let poster: Blob | null = null;
    if (width && height) {
      const seekTo = Math.min(1.5, (duration ?? 2) * 0.15);
      const seeked = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 8000);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve(true);
        };
        video.currentTime = seekTo;
      });
      if (seeked) {
        const canvas = drawScaled(video, width, height, POSTER_WIDTH, POSTER_WIDTH);
        if (canvas) poster = await canvasToWebp(canvas, 0.82);
      }
    }
    return { duration, width, height, poster };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** PUT with progress reporting (fetch has no upload progress). */
export function putWithProgress(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}
