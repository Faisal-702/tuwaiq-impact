import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { mimeForExtension } from "@/lib/media-rules";
import { env } from "@/server/env";
import { resolveLocalPath } from "@/server/storage";

/** Serves files for the local development storage driver (supports Range for video seeking). */
export async function GET(request: NextRequest, ctx: RouteContext<"/media/[...path]">) {
  if (env.storageDriver !== "local") return new NextResponse(null, { status: 404 });
  const { path: parts } = await ctx.params;
  const objectPath = parts.map(decodeURIComponent).join("/");
  const full = resolveLocalPath(objectPath);
  if (!full) return new NextResponse(null, { status: 404 });

  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const ext = objectPath.split(".").pop() ?? "";
  const headers = new Headers({
    "content-type": mimeForExtension(ext) ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
  });
  const download = request.nextUrl.searchParams.get("download");
  if (download !== null) {
    const name = (download || objectPath.split("/").pop() || "file").replace(/["\\\r\n]/g, "");
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : size - Number(match[2]);
    let end = match[1] && match[2] ? Number(match[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }

  headers.set("content-length", String(size));
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
