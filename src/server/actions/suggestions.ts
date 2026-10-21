"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { SUGGESTION_GRADES, SUGGESTION_MAX_LENGTH, SUGGESTION_NAME_MAX_LENGTH } from "@/lib/suggestions";
import { getViewer } from "../auth";
import { sql } from "../db";
import { env } from "../env";

export type SuggestionField = "name" | "grade" | "suggestion";
export type SubmitSuggestionResult =
  | { ok: true }
  | { ok: false; error: "invalid"; fields: SuggestionField[] }
  | { ok: false; error: "rate_limited" | "server" };

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();

const schema = z.object({
  name: z.string().transform(collapse).pipe(z.string().min(1).max(SUGGESTION_NAME_MAX_LENGTH)),
  grade: z.number().int().refine((g) => (SUGGESTION_GRADES as readonly number[]).includes(g)),
  suggestion: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(SUGGESTION_MAX_LENGTH)),
});

// Best-effort abuse protection: a few submissions per visitor per window.
// (Per server instance; validation and DB constraints remain the real gate.)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${env.sessionSecret}|suggest|${ip}`).digest("hex");
}

/**
 * Stores a suggestion from a signed-in student (or admin). Nothing is ever
 * returned from the table to the submitter.
 */
export async function submitSuggestion(input: {
  name: string;
  grade: number | null;
  suggestion: string;
  /** Honeypot: hidden from people, often filled by bots. */
  website?: string;
}): Promise<SubmitSuggestionResult> {
  // Only signed-in students (or admins) can reach the platform and its form.
  if (!(await getViewer())) return { ok: false, error: "server" };

  const data = (input && typeof input === "object" ? input : {}) as Partial<typeof input>;
  if (data.website) return { ok: true }; // silently drop bot submissions

  const parsed = schema.safeParse({
    name: String(data.name ?? ""),
    grade: data.grade,
    suggestion: String(data.suggestion ?? ""),
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path[0]))].filter(
      (f): f is SuggestionField => f === "name" || f === "grade" || f === "suggestion",
    );
    return { ok: false, error: "invalid", fields };
  }

  const key = await visitorKey();
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return { ok: false, error: "rate_limited" };

  try {
    const { name, grade, suggestion } = parsed.data;
    await sql`insert into suggestions (name, grade, suggestion) values (${name}, ${grade}, ${suggestion})`;
  } catch (error) {
    console.error("Could not store suggestion", error);
    return { ok: false, error: "server" };
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return { ok: true };
}
