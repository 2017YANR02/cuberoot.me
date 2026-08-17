import type { SearchParams } from "nuqs/server";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import { listTeachingMembers } from "@/lib/teaching-api";
import { teachingRoleLabel, teachingStatusLabel } from "@/lib/teaching-labels";
import { loadPageParams, serializePageParams } from "@/lib/search-params";

export default async function OrganizationMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug } = await params;
  const { page } = await loadPageParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/members`);
  const result = await listTeachingMembers(user, orgSlug, { page });
  if (result.page > result.totalPages) {
    redirect(serializePageParams(`/org/${orgSlug}/members`, { page: result.totalPages }));
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-[19px] font-semibold text-ink">成员与角色</h2>
      <p className="mt-1 text-[13px] leading-5 text-ink-3">角色按机构独立授权。成员邀请将在下一阶段与老师、助教和班级关系一起接入。</p>
      <div className="mt-6 border-y border-line divide-y divide-line">
        {result.items.length ? result.items.map((member) => (
          <div key={member.userId} className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_auto] sm:items-center sm:gap-4">
            <span className="min-w-0 [overflow-wrap:anywhere] text-[14px] font-medium text-ink">{member.displayName || `账号 ${member.userId}`}</span>
            <span className="text-[13px] text-ink-2">{teachingRoleLabel(member.role)}</span>
            <span className="text-[12px] text-ink-3">{teachingStatusLabel(member.status)}</span>
          </div>
        )) : (
          <p className="py-5 text-[14px] text-ink-3">暂无机构成员。</p>
        )}
      </div>
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath={`/org/${orgSlug}/members`}
        prefetch={false}
      />
    </div>
  );
}
