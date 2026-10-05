import { PageLoading } from "@/components/ui/page-loading";
import { getI18n } from "@/i18n/server";

/**
 * Loading state for the public pages. It is attached to the list pages only:
 * pages that answer 404 for unknown or unpublished items (projects/[slug],
 * students/[slug]) must not stream before they know, or the status would be
 * 200. Those pages are prefetched in full when a link is hovered instead.
 */
export default async function SiteLoading() {
  const { t } = await getI18n();
  return <PageLoading variant="site" label={t.common.loading} />;
}
