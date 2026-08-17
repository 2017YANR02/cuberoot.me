import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import { getTeachingOrganization, listTeachingCampuses } from "@/lib/teaching-api";
import { teachingStatusLabel } from "@/lib/teaching-labels";
import { loadPageParams, serializePageParams } from "@/lib/search-params";
import { CreateCampusForm } from "../../_components/CreateCampusForm";
import { TeachingMutationButton } from "../../_components/TeachingMutationButton";
import { archiveCampusAction } from "../../actions";

export default async function OrganizationCampusesPage({ params, searchParams }: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug } = await params;
  const { page } = await loadPageParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/campuses`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "campus:read")) {
    return <p className="text-[14px] text-ink-2">你当前的机构角色不能查看校区。</p>;
  }
  const result = await listTeachingCampuses(user, orgSlug, { page });
  if (result.page > result.totalPages) {
    redirect(serializePageParams(`/org/${orgSlug}/campuses`, { page: result.totalPages }));
  }
  const canManage = organization.status === "active" && hasTeachingPermission(organization.role, "campus:manage");

  return (
    <div className="max-w-5xl">
      <h2 className="text-[19px] font-semibold text-ink">校区</h2>
      <p className="mt-1 text-[13px] leading-5 text-ink-3">校区用于组织班级和时区；未设置独立时区时继承机构时区。</p>
      {canManage ? <CreateCampusForm orgSlug={orgSlug} organizationTimezone={organization.timezone} /> : null}
      <div className="mt-7 divide-y divide-line border-y border-line">
        {result.items.length ? result.items.map((campus) => (
          <div key={campus.id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <div className="[overflow-wrap:anywhere] text-[14px] font-medium text-ink">{campus.name}</div>
              <div className="mt-0.5 min-w-0 break-all font-mono text-[12px] text-ink-3">{campus.code || "未设置代码"}</div>
            </div>
            <div className="min-w-0 text-[13px] text-ink-2">
              <span className="break-all">{campus.timezone || organization.timezone}</span>
              {campus.timezone ? null : <span className="ml-1 text-ink-3">继承机构</span>}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[12px] text-ink-3">{teachingStatusLabel(campus.status)}</span>
              {canManage && campus.status === "active" ? (
                <TeachingMutationButton
                  action={archiveCampusAction.bind(null, orgSlug, campus.id)}
                  label="归档校区"
                  pendingLabel="归档中…"
                  confirmMessage="归档后不能恢复；如仍有正常班级，操作会被拒绝。确认归档此校区？"
                />
              ) : null}
            </div>
          </div>
        )) : <p className="py-5 text-[14px] text-ink-3">暂无可见校区。</p>}
      </div>
      <Pagination page={result.page} totalPages={result.totalPages} basePath={`/org/${orgSlug}/campuses`} prefetch={false} />
    </div>
  );
}
