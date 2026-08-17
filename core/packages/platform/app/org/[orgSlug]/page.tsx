import Link from "next/link";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingOrganizationSummary,
} from "@/lib/teaching-api";
import { teachingRoleLabel } from "@/lib/teaching-labels";

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser(`/org/${orgSlug}`);
  const summary = await getTeachingOrganizationSummary(user, orgSlug);
  const organization = summary.organization;

  const facts = [
    { label: "机构成员", value: summary.memberCount ?? "—" },
    { label: "学员档案", value: summary.studentCount ?? "—" },
    { label: "我的角色", value: teachingRoleLabel(organization.role) },
  ];

  return (
    <div className="max-w-5xl">
      <h2 className="text-[19px] font-semibold text-ink">工作台概览</h2>
      <div className="mt-5 grid grid-cols-2 gap-x-5 border-y border-line sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="py-4">
            <div className="text-[12px] text-ink-3">{fact.label}</div>
            <div className="mt-1 text-[22px] font-semibold text-ink">{fact.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="people-heading">
          <h3 id="people-heading" className="text-[16px] font-semibold text-ink">人员管理</h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-3">当前已接通真实机构隔离、成员角色、校区班级和学员档案。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.studentCount !== null ? (
              <Link href={`/org/${organization.slug}/students`} prefetch={false} className="rounded-md bg-brand px-3 py-2 text-[13px] text-white hover:bg-brand-dark">管理学员</Link>
            ) : null}
            <Link href={`/org/${organization.slug}/members`} prefetch={false} className="rounded-md border border-line px-3 py-2 text-[13px] text-ink-2 hover:text-ink">查看成员与角色</Link>
          </div>
        </section>
        <section aria-labelledby="next-heading">
          <h3 id="next-heading" className="text-[16px] font-semibold text-ink">完整教学闭环</h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-3">校区班级、课包与剩余课时、排课和上课历史已进入同一租户模型；训练作业、周报及家校沟通将继续沿此权限边界接入。</p>
        </section>
      </div>
    </div>
  );
}
