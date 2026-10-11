import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/server/auth";
import { env } from "@/server/env";
import { privateStorage, resolveLocalPrivatePath } from "@/server/storage";
import { findEvidenceByPath } from "@/server/submissions";

/**
 * Supporting files of student submissions are private: only an
 * administrator with a valid session can download them, and only files
 * recorded in a submission (no arbitrary paths). Local storage streams the file; Supabase
 * redirects to a short-lived signed URL.
 */
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return new NextResponse(null, { status: 401 });
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const file = await findEvidenceByPath(path);
  if (!file) return new NextResponse(null, { status: 404 });

  const safeName = file.name.replace(/["\\\r\n]/g, "") || "file";
  if (env.storageDriver !== "local") {
    const url = await privateStorage().downloadUrl(file.path, safeName);
    return url ? NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } }) : new NextResponse(null, { status: 404 });
  }

  const full = resolveLocalPrivatePath(file.path);
  const size = full ? await stat(full).then((s) => s.size, () => null) : null;
  if (!full || size === null) return new NextResponse(null, { status: 404 });
  return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    status: 200,
    headers: {
      "content-type": file.mime,
      "content-length": String(size),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
