import { hasTeachingPermission, type TeachingOrganizationRole } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingOrganization,
  getTeachingStudent,
  listTeachingMembers,
  listTeachingTeacherAssignments,
  TeachingApiError,
} from "@/lib/teaching-api";
import { teachingRoleLabel, teachingStatusLabel } from "@/lib/teaching-labels";
import {
  teachingEffectiveRangeLabel,
  teachingEffectiveState,
  teachingEffectiveStateLabel,
} from "@/lib/teaching-stage1";
import { loadPageParams, serializePageParams } from "@/lib/search-params";
import { CreateTeacherAssignmentForm, type TeachingStaffOption } from "../../../../_components/CreateTeacherAssignmentForm";
import { TeachingMutationButton } from "../../../../_components/TeachingMutationButton";
import { revokeTeacherAssignmentAction } from "../../../../actions";

const ASSIGNABLE_ROLES = new Set<TeachingOrganizationRole>(["owner", "admin", "teacher", "assistant"]);

export default async function StudentResponsibilitiesPage({ params, searchParams }: {
  params: Promise<{ orgSlug: string; studentId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug, studentId } = await params;
  const { page } = await loadPageParams(searchParams);
  const basePath = `/org/${orgSlug}/students/${studentId}/responsibilities`;
  const user = await requireUser(basePath);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "student:read")) {
    return <p className="text-[14px] text-ink-2">你当前的机构角色不能查看学员。</p>;
  }
  let student;
  try {
    student = await getTeachingStudent(user, orgSlug, studentId);
  } catch (error) {
    if (error instanceof TeachingApiError && (error.code === "RESOURCE_NOT_FOUND" || error.code === "INVALID_INPUT")) notFound();
    throw error;
  }
  const canManageAssignments = organization.status === "active" && student.status !== "archived" && hasTeachingPermission(organization.role, "assignment:manage");
  const [memberChoices, assignments] = await Promise.all([
    canManageAssignments ? listTeachingMembers(user, orgSlug, { pageSize: 100 }) : null,
    canManageAssignments ? listTeachingTeacherAssignments(user, orgSlug, { studentId }, { page }) : null,
  ]);
  if (assignments && assignments.page > assignments.totalPages) {
    redirect(serializePageParams(basePath, { page: assignments.totalPages }));
  }
  const staff: TeachingStaffOption[] = (memberChoices?.items ?? []).flatMap((member) => {
    if (member.status !== "active" || !ASSIGNABLE_ROLES.has(member.role)) return [];
    return [{ userId: member.userId, displayName: member.displayName, role: member.role as TeachingStaffOption["role"] }];
  });

  return (
    <div className="max-w-5xl">
      <Link href={`/org/${orgSlug}/students`} prefetch={false} className="text-[13px] text-ink-3 hover:text-ink">全部学员</Link>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
        <h2 className="min-w-0 [overflow-wrap:anywhere] text-[19px] font-semibold text-ink">{student.displayName}</h2>
        <span className="text-[12px] text-ink-3">{teachingStatusLabel(student.status)}</span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <span className="break-all font-mono text-[12px] text-ink-3">{student.externalRef || "未设置学员编号"}</span>
        {hasTeachingPermission(organization.role, "package:read") ? (
          <Link href={`/org/${orgSlug}/students/${student.id}/credits`} prefetch={false} className="text-[13px] text-brand-dark hover:underline">查看课时余额与流水</Link>
        ) : null}
      </div>

      <section className="mt-8" aria-labelledby="direct-assignment-heading">
        <h3 id="direct-assignment-heading" className="text-[15px] font-semibold text-ink">个别学员负责人</h3>
        <p className="mt-1 text-[13px] leading-5 text-ink-3">这里仅管理直接负责关系；通过班级获得的学员范围在对应班级详情中管理。</p>
        {canManageAssignments && memberChoices && assignments ? (
          <>
            <CreateTeacherAssignmentForm
              orgSlug={orgSlug}
              target={{ studentId: student.id }}
              timezone={organization.timezone}
              staff={staff}
              staffTruncated={memberChoices.total > memberChoices.items.length}
            />
            <div className="mt-5 divide-y divide-line border-y border-line">
              {assignments.items.length ? assignments.items.map((assignment) => {
                const state = teachingEffectiveState(assignment.effectiveFrom, assignment.effectiveTo);
                return (
                  <div key={assignment.id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <div className="[overflow-wrap:anywhere] text-[14px] font-medium text-ink">{assignment.teacher.displayName}</div>
                      <div className="mt-0.5 text-[12px] text-ink-3">{teachingRoleLabel(assignment.teacher.role)}，账号 {assignment.teacherUserIdSnapshot}</div>
                    </div>
                    <div className="min-w-0 [overflow-wrap:anywhere] text-[12px] leading-5 text-ink-3">{teachingEffectiveRangeLabel(assignment.effectiveFrom, assignment.effectiveTo, organization.timezone)}</div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-[12px] text-ink-3">{teachingEffectiveStateLabel(state)}</span>
                      {state !== "ended" ? (
                        <TeachingMutationButton
                          action={revokeTeacherAssignmentAction.bind(null, orgSlug, { studentId: student.id }, assignment.id)}
                          label="结束负责"
                          pendingLabel="结束中…"
                          confirmMessage="确认立即结束这段负责范围？历史记录会保留。"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              }) : <p className="py-5 text-[14px] text-ink-3">暂无直接负责人记录。</p>}
            </div>
            <Pagination page={assignments.page} totalPages={assignments.totalPages} basePath={basePath} prefetch={false} />
          </>
        ) : (
          <p className="mt-3 text-[13px] text-ink-3">你当前只能查看 Core 授权给自己的学员范围；直接负责人列表及历史仅机构所有者和管理员可见。</p>
        )}
      </section>
    </div>
  );
}
