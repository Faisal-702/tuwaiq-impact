import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextResponse, type NextRequest } from "next/server";
import { MIME_RULES, UPLOAD_LIMITS, VARIANT_MIME } from "@/lib/media-rules";
import { env } from "@/server/env";
import { ensureLocalDir, resolveLocalPath, verifyLocalUploadSignature } from "@/server/storage";

/**
 * Receives a direct upload for the local development storage driver.
 * Mirrors Supabase signed upload URLs: authorised by an HMAC signature that
 * the server issued to an authenticated administrator.
 */
export async function PUT(request: NextRequest) {
  if (env.storageDriver !== "local") return NextResponse.json({ error: "disabled" }, { status: 404 });

  const params = request.nextUrl.searchParams;
  const objectPath = params.get("path") ?? "";
  const contentType = params.get("ct") ?? "";
  const expires = Number(params.get("exp"));
  const signature = params.get("sig") ?? "";

  if (!verifyLocalUploadSignature(objectPath, contentType, expires, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }
  const rule = MIME_RULES[contentType];
  if (!rule && contentType !== VARIANT_MIME) {
    return NextResponse.json({ error: "unsupported type" }, { status: 415 });
  }
  const full = resolveLocalPath(objectPath);
  if (!full || !request.body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const limit = rule ? UPLOAD_LIMITS[rule.kind] : UPLOAD_LIMITS.image;
  let received = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (received > limit) cb(new Error("too large"));
      else cb(null, chunk);
    },
  });

  await ensureLocalDir(full);
  try {
    await pipeline(Readable.fromWeb(request.body as never), counter, createWriteStream(full, { flags: "wx" }));
  } catch (error) {
    await rm(full, { force: true });
    const tooLarge = error instanceof Error && error.message === "too large";
    return NextResponse.json({ error: tooLarge ? "too large" : "upload failed" }, { status: tooLarge ? 413 : 500 });
  }
  return NextResponse.json({ ok: true, size: received });
}
