/**
 * Applies SQL migrations from supabase/migrations in order.
 * Usage: npm run db:migrate   (reads DATABASE_URL from the environment / .env.local)
 *
 * The same files can also be applied with the Supabase CLI (`supabase db push`).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

  await sql`
    create table if not exists public._ti_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
  await sql`alter table public._ti_migrations enable row level security`;

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set(
    (await sql<{ name: string }[]>`select name from public._ti_migrations`).map((r) => r.name),
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(path.join(dir, file), "utf8");
    process.stdout.write(`Applying ${file} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into public._ti_migrations (name) values (${file})`;
    });
    console.log("done");
  }
  console.log("Database is up to date.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
