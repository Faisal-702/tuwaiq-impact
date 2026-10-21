import { PageLoading } from "@/components/ui/page-loading";
import { getI18n } from "@/i18n/server";

export default async function AdminLoading() {
  const { t } = await getI18n();
  return <PageLoading variant="admin" label={t.common.loading} />;
}
