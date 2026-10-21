import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/server/auth";
import { quickSearch } from "@/server/queries/public";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ projects: [], students: [] });
  const results = await quickSearch(q);
  // Student projects are discovered by signed-in students only (administrators use the dashboard).
  const visible = viewer.kind === "student" ? results : { ...results, projects: [] };
  return NextResponse.json(visible, { headers: { "cache-control": "private, max-age=30" } });
}
