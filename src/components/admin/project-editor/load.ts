import "server-only";
import type { EditableProject } from "@/server/queries/admin";
import type { EditorInitial } from "./project-editor";

export function toEditorInitial(p: EditableProject): EditorInitial {
  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    featured: p.is_featured,
    title: p.title,
    description: p.description ?? "",
    categoryId: p.category_id,
    grade: p.grade,
    className: p.class_name ?? "",
    academicYear: p.academic_year ?? "",
    supervisor: p.supervisor ?? "",
    award: p.award ?? "",
    points: p.points,
    students: p.students.map((s) => ({ id: s.id })),
    media: p.media
      .filter((m) => m.kind !== "link")
      .map((m) => ({
        key: m.id,
        id: m.id,
        kind: m.kind as "image" | "video" | "document",
        status: "ready" as const,
        progress: 100,
        fileName: m.file_name ?? "file",
        mimeType: m.mime_type ?? "",
        sizeBytes: m.size_bytes ?? 0,
        width: m.width,
        height: m.height,
        durationSeconds: m.duration_seconds,
        storagePath: m.storage_path ?? undefined,
        previewPath: m.preview_path,
        thumbPath: m.thumb_path,
        previewUrl: m.thumb_url ?? (m.kind === "image" ? m.original_url : null),
        caption: m.caption ?? "",
      })),
    links: p.media
      .filter((m) => m.kind === "link")
      .map((m) => ({ key: m.id, id: m.id, url: m.url ?? "", caption: m.caption ?? "" })),
    coverKey: p.cover_media_id,
  };
}
