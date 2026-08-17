import { hasTeachingPermission, type TeachingOrganizationRole } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingCampus,
  getTeachingGroup,
  getTeachingOrganization,
  listTeachingGroupStudents,
  listTeachingMembers,
  listTeachingStudents,
  listTeachingTeacherAssignments,
  TeachingApiError,
} from "@/lib/teaching-api";
import { teachingRoleLabel, teachingStatusLabel } from "@/lib/teaching-labels";
import {
  teachingEffectiveRangeLabel,
  teachingEffectiveState,
  teachingEffectiveStateLabel,
} from "@/lib/teaching-stage1";
import { loadGroupDetailParams, serializeGroupDetailParams } from "@/lib/search-params";
import { CreateGroupMembershipForm } from "../../../_components/CreateGroupMembershipForm";
import { CreateTeacherAssignmentForm, type TeachingStaffOption } from "../../../_components/CreateTeacherAssignmentForm";
import { TeachingMutationButton } from "../../../_components/TeachingMutationButton";
import {
  archiveGroupAction,
  revokeGroupMembershipAction,
  revokeTeacherAssignmentAction,
} from "../../../actions";

const ASSIGNABLE_ROLES = new Set<TeachingOrganizationRole>(["owner", "admin", "teacher", "assistant"]);

export default async function OrganizationClassPage({ params, searchParams }: {
  params: Promise<{ orgSlug: string; groupId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug, groupId } = await params;
  const { membershipPage, assignmentPage } = await loadGroupDetailParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/classes/${groupId}`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "group:read")) {
    return <p className="text-[14px] text-ink-2">你当前的机构角色不能查看班级。</p>;
  }

  let group;
  let memberships;
  let campus = null;
  try {
    group = await getTeachingGroup(user, orgSlug, groupId);
    [memberships, campus] = await Promise.all([
      listTeachingGroupStudents(user, orgSlug, groupId, { page: membershipPage }),
      group.campusId ? getTeachingCampus(user, orgSlug, group.campusId) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof TeachingApiError && (error.code === "RESOURCE_NOT_FOUND" || error.code === "INVALID_INPUT")) notFound();
    throw error;
  }
  const basePath = `/org/${orgSlug}/classes/${groupId}`;
  const effectiveTimezone = campus?.timezone || organization.timezone;
  const canManageGroup = organization.status === "active" && group.status === "active" && hasTeachingPermission(organization.role, "group:manage");
  const canManageAssignments = organization.status === "active" && group.status === "active" && hasTeachingPermission(organization.role, "assignment:manage");
  const [studentChoices, memberChoices, assignments] = await Promise.all([
    canManageGroup ? listTeachingStudents(user, orgSlug, { pageSize: 100 }) : null,
    canManageAssignments ? listTeachingMembers(user, orgSlug, { pageSize: 100 }) : null,
    canManageAssignments ? listTeachingTeacherAssignments(user, orgSlug, { groupId }, { page: assignmentPage }) : null,
  ]);
  if (memberships.page > memberships.totalPages || (assignments && assignments.page > assignments.totalPages)) {
    redirect(serializeGroupDetailParams(basePath, {
      membershipPage: Math.min(memberships.page, memberships.totalPages),
      assignmentPage: assignments ? Math.min(assignments.page, assignments.totalPages) : 1,
    }));
  }
  const staff: TeachingStaffOption[] = (memberChoices?.items ?? []).flatMap((member) => {
    if (member.status !== "active" || !ASSIGNABLE_ROLES.has(member.role)) return [];
    return [{
      userId: member.userId,
      displayName: member.displayName,
      role: member.role as TeachingStaffOption["role"],
    }];
  });

  return (
    <div className="max-w-5xl">
      <Link href={`/org/${orgSlug}/classes`} prefetch={false} className="text-[13px] text-ink-3 hover:text-ink">全部班级</Link>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
        <h2 className="min-w-0 [overflow-wrap:anywhere] text-[19px] font-semibold text-ink">{group.name}</h2>
        <span className="text-[12px] text-ink-3">{teachingStatusLabel(group.status)}</span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span className="break-all">代码 {group.code || "未设置"}</span>
        <span className="[overflow-wrap:anywhere]">校区 {campus?.name || "未设置"}</span>
      </div>
      {canManageGroup ? (
        <div className="mt-4">
          <TeachingMutationButton
            action={archiveGroupAction.bind(null, orgSlug, group.id)}
            label="归档班级"
            pendingLabel="归档中…"
            confirmMessage="归档后不能恢复，并会立即结束老师和助教通过此班级获得的可见范围。确认归档？"
          />
        </div>
      ) : null}

      <section className="mt-8" aria-labelledby="students-heading">
        <h3 id="students-heading" className="text-[15px] font-semibold text-ink">分班学员</h3>
        <p className="mt-1 text-[13px] leading-5 text-ink-3">同一学员可以同时加入多个班级；有效期按 [开始时间, 结束时间) 计算。</p>
        {canManageGroup && studentChoices ? (
          <CreateGroupMembershipForm
            orgSlug={orgSlug}
            groupId={group.id}
            timezone={effectiveTimezone}
            students={studentChoices.items.filter((student) => student.status === "active")}
            studentsTruncated={studentChoices.total > studentChoices.items.length}
          />
        ) : null}
        <div className="mt-5 divide-y divide-line border-y border-line">
          {memberships.items.length ? memberships.items.map((membership) => {
            const state = teachingEffectiveState(membership.effectiveFrom, membership.effectiveTo);
            return (
              <div key={membership.id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <Link href={`/org/${orgSlug}/students/${membership.student.id}/responsibilities`} prefetch={false} className="[overflow-wrap:anywhere] text-[14px] font-medium text-ink hover:text-brand-dark">{membership.student.displayName}</Link>
                  <div className="mt-0.5 break-all font-mono text-[12px] text-ink-3">{membership.student.externalRef || "未设置编号"}</div>
                </div>
                <div className="min-w-0 [overflow-wrap:anywhere] text-[12px] leading-5 text-ink-3">
                  {teachingEffectiveRangeLabel(membership.effectiveFrom, membership.effectiveTo, effectiveTimezone)}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[12px] text-ink-3">{teachingEffectiveStateLabel(state)}</span>
                  {canManageGroup && state !== "ended" ? (
                    <TeachingMutationButton
                      action={revokeGroupMembershipAction.bind(null, orgSlug, group.id, membership.id)}
                      label="结束分班"
                      pendingLabel="结束中…"
                      confirmMessage="确认立即结束这段分班有效期？历史记录会保留。"
                    />
                  ) : null}
                </div>
              </div>
            );
          }) : <p className="py-5 text-[14px] text-ink-3">暂无分班记录。</p>}
        </div>
        <Pagination
          page={memberships.page}
          totalPages={memberships.totalPages}
          basePath={basePath}
          pageParam="membershipPage"
          params={{ assignmentPage: assignments && assignments.page > 1 ? String(assignments.page) : undefined }}
          prefetch={false}
        />
      </section>

      <section className="mt-10" aria-labelledby="assignments-heading">
        <h3 id="assignments-heading" className="text-[15px] font-semibold text-ink">班级负责人</h3>
        <p className="mt-1 text-[13px] leading-5 text-ink-3">负责范围只控制可见学员；实际课堂授课老师仍按每一堂课单独关联。</p>
        {canManageAssignments && memberChoices && assignments ? (
          <>
            <CreateTeacherAssignmentForm
              orgSlug={orgSlug}
              target={{ groupId: group.id }}
              timezone={effectiveTimezone}
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
                    <div className="min-w-0 [overflow-wrap:anywhere] text-[12px] leading-5 text-ink-3">{teachingEffectiveRangeLabel(assignment.effectiveFrom, assignment.effectiveTo, effectiveTimezone)}</div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-[12px] text-ink-3">{teachingEffectiveStateLabel(state)}</span>
                      {state !== "ended" ? (
                        <TeachingMutationButton
                          action={revokeTeacherAssignmentAction.bind(null, orgSlug, { groupId: group.id }, assignment.id)}
                          label="结束负责"
                          pendingLabel="结束中…"
                          confirmMessage="确认立即结束这段负责范围？历史记录会保留。"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              }) : <p className="py-5 text-[14px] text-ink-3">暂无负责人记录。</p>}
            </div>
            <Pagination
              page={assignments.page}
              totalPages={assignments.totalPages}
              basePath={basePath}
              pageParam="assignmentPage"
              params={{ membershipPage: memberships.page > 1 ? String(memberships.page) : undefined }}
              prefetch={false}
            />
          </>
        ) : (
          <p className="mt-3 text-[13px] text-ink-3">你只能查看自己获授权的班级和学员；负责人列表及历史仅机构所有者和管理员可见。</p>
        )}
      </section>
    </div>
  );
}
