import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import { getTeachingOrganization, listTeachingCampuses, listTeachingGroups } from "@/lib/teaching-api";
import { teachingStatusLabel } from "@/lib/teaching-labels";
import { loadPageParams, serializePageParams } from "@/lib/search-params";
import { CreateGroupForm } from "../../_components/CreateGroupForm";

export default async function OrganizationClassesPage({ params, searchParams }: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug } = await params;
  const { page } = await loadPageParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/classes`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "group:read")) {
    return <p className="text-[14px] text-ink-2">你当前的机构角色不能查看班级。</p>;
  }
  const [result, campusResult] = await Promise.all([
    listTeachingGroups(user, orgSlug, { page }),
    listTeachingCampuses(user, orgSlug, { pageSize: 100 }),
  ]);
  if (result.page > result.totalPages) {
    redirect(serializePageParams(`/org/${orgSlug}/classes`, { page: result.totalPages }));
  }
  const canManage = organization.status === "active" && hasTeachingPermission(organization.role, "group:manage");
  const activeCampuses = campusResult.items.filter((campus) => campus.status === "active");
  const campusNames = new Map(campusResult.items.map((campus) => [campus.id, campus.name]));

  return (
    <div className="max-w-5xl">
      <h2 className="text-[19px] font-semibold text-ink">班级</h2>
      <p className="mt-1 text-[13px] leading-5 text-ink-3">老师和助教只会看到自己当前负责的班级；归档班级会立即结束对应可见范围。</p>
      {canManage ? <CreateGroupForm orgSlug={orgSlug} campuses={activeCampuses} campusesTruncated={campusResult.total > campusResult.items.length} /> : null}
      {campusResult.total > campusResult.items.length ? <p className="mt-4 text-[12px] text-ink-3">校区名称映射仅加载当前可见范围的前 100 项，未命中的班级显示校区标识。</p> : null}
      <div className="mt-7 divide-y divide-line border-y border-line">
        {result.items.length ? result.items.map((group) => (
          <div key={group.id} className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <Link href={`/org/${orgSlug}/classes/${group.id}`} prefetch={false} className="[overflow-wrap:anywhere] text-[14px] font-medium text-ink hover:text-brand-dark">{group.name}</Link>
              <div className="mt-0.5 min-w-0 break-all font-mono text-[12px] text-ink-3">{group.code || "未设置代码"}</div>
            </div>
            <span className="min-w-0 [overflow-wrap:anywhere] text-[13px] text-ink-2">
              {group.campusId ? campusNames.get(group.campusId) || `校区 ${group.campusId}` : "未设置校区"}
            </span>
            <span className="text-[12px] text-ink-3">{teachingStatusLabel(group.status)}</span>
          </div>
        )) : <p className="py-5 text-[14px] text-ink-3">暂无可见班级。</p>}
      </div>
      <Pagination page={result.page} totalPages={result.totalPages} basePath={`/org/${orgSlug}/classes`} prefetch={false} />
    </div>
  );
}
