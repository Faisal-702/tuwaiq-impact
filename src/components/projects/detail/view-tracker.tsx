"use client";

import { useEffect } from "react";

/** Records one anonymous view per visitor per day (deduplicated server-side). */
export function ViewTracker({ projectId }: { projectId: string }) {
  useEffect(() => {
    const key = `ti_viewed_${projectId}_${new Date().toISOString().slice(0, 10)}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable — the server still deduplicates */
    }
    void fetch(`/api/projects/${projectId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [projectId]);
  return null;
}
