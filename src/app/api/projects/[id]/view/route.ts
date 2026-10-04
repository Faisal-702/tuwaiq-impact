import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/server/auth";
import { sql } from "@/server/db";
import { env } from "@/server/env";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false }, { status: 401 });
  // Administrators previewing content do not inflate public statistics.
  if (viewer.kind === "admin") return NextResponse.json({ ok: true, counted: false });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  // Anonymous, salted and rotated daily: no personal data is stored.
  const visitor = createHash("sha256").update(`${env.sessionSecret}|${ip}|${ua}|${day}`).digest("hex");

  const inserted = await sql`
    insert into project_views (project_id, visitor_hash)
    select p.id, ${visitor} from projects p
     where p.id = ${id} and p.status = 'published' and p.deleted_at is null
    on conflict (project_id, visitor_hash, viewed_on) do nothing
    returning id`;
  if (inserted.length > 0) {
    await sql`update projects set view_count = view_count + 1 where id = ${id}`;
  }
  return NextResponse.json({ ok: true, counted: inserted.length > 0 });
}
