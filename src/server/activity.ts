import "server-only";
import { sql } from "./db";

export type ActivityAction =
  | "project.created"
  | "project.edited"
  | "project.published"
  | "project.unpublished"
  | "project.featured"
  | "project.unfeatured"
  | "project.deleted"
  | "project.restored"
  | "project.purged"
  | "project.points_changed"
  | "student.created"
  | "student.edited"
  | "student.deleted"
  | "category.created"
  | "category.edited"
  | "category.archived"
  | "category.restored"
  | "settings.updated"
  | "admin.signed_in"
  | "admin.sessions_revoked"
  | "demo.purged";

export async function logActivity(entry: {
  action: ActivityAction;
  targetType: "project" | "student" | "category" | "settings" | "session" | "demo";
  targetId?: string | null;
  targetLabel?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    insert into activity_logs (action, target_type, target_id, target_label, details)
    values (${entry.action}, ${entry.targetType}, ${entry.targetId ?? null}, ${entry.targetLabel ?? null},
            ${sql.json((entry.details ?? {}) as never)})`;
}
