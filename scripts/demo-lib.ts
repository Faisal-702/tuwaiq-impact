/**
 * Shared helpers for DEVELOPMENT / DEMO data. Every record created here is
 * flagged with is_demo = true and can be removed with `npm run demo:purge`
 * or from Admin → Settings → "Remove demo data".
 */
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, { prepare: false, max: 1, onnotice: () => {} });
}

const local = process.env.STORAGE_DRIVER === "local";
const localRoot = path.join(process.cwd(), ".data", "uploads");

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createClient(url, key, { auth: { persistSession: false } });
}
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "project-media";

export async function putObject(objectPath: string, sourceFile: string, contentType: string) {
  if (local) {
    const target = path.join(localRoot, objectPath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(sourceFile, target);
    return;
  }
  const { error } = await supabase()
    .storage.from(bucket)
    .upload(objectPath, await readFile(sourceFile), { contentType, upsert: true });
  if (error) throw error;
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  if (local) {
    for (const p of paths) await rm(path.join(localRoot, p), { force: true });
    return;
  }
  const { error } = await supabase().storage.from(bucket).remove(paths);
  if (error) throw error;
}

export async function purgeDemo(sql: ReturnType<typeof db>) {
  const media = await sql<{ storage_path: string | null; preview_path: string | null; thumb_path: string | null }[]>`
    select m.storage_path, m.preview_path, m.thumb_path
      from project_media m join projects p on p.id = m.project_id
     where p.is_demo`;
  const paths = media.flatMap((m) => [m.storage_path, m.preview_path, m.thumb_path]).filter((p): p is string => !!p);
  await removeObjects(paths);
  const projects = await sql`delete from projects where is_demo returning id`;
  const students = await sql`
    delete from students s where s.is_demo
       and not exists (select 1 from project_students ps where ps.student_id = s.id)
    returning id`;
  return { projects: projects.length, students: students.length };
}
