import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import type { SearchParams } from "nuqs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingOrganization,
  listTeachingMembers,
  listTeachingSessions,
  listTeachingStudents,
} from "@/lib/teaching-api";
import {
  teachingDateTimeLabel,
  teachingSessionStatusLabel,
} from "@/lib/teaching-stage2";
import { loadPageParams, serializePageParams } from "@/lib/search-params";
import { CreateSessionForm } from "../../_components/CreateSessionForm";

function statusTone(status: "scheduled" | "in_progress" | "completed" | "cancelled") {
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  if (status === "cancelled") return "muted" as const;
  return "brand" as const;
}

export default async function OrganizationSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgSlug } = await params;
  const { page } = await loadPageParams(searchParams);
  const user = await requireUser(`/org/${orgSlug}/schedule`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "session:read")) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-[19px] font-semibold text-ink">课堂</h2>
        <p className="mt-2 text-[14px] text-ink-2">你当前的机构角色不能查看课堂。</p>
      </div>
    );
  }
  const canCreate = organization.status === "active" &&
    hasTeachingPermission(organization.role, "session:create");
  const [sessions, students, members] = await Promise.all([
    listTeachingSessions(user, orgSlug, { page }),
    canCreate
      ? listTeachingStudents(user, orgSlug, { page: 1, pageSize: 100 })
      : Promise.resolve(null),
    canCreate
      ? listTeachingMembers(user, orgSlug, { page: 1, pageSize: 100 })
      : Promise.resolve(null),
  ]);
  if (sessions.page > sessions.totalPages) {
    redirect(serializePageParams(`/org/${orgSlug}/schedule`, { page: sessions.totalPages }));
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-[19px] font-semibold text-ink">课堂与上课历史</h2>
      <p className="mt-1 text-[13px] text-ink-3">创建课堂时关联学员课包；记录完出勤后，完课会按出勤扣减课时。</p>
      {canCreate && students ? (
        <CreateSessionForm
          orgSlug={orgSlug}
          timezone={organization.timezone}
          students={students.items.filter((student) => student.status === "active").map((student) => ({
            id: student.id,
            name: student.displayName,
          }))}
          teachers={(members?.items ?? [])
            .filter((member) => (
              member.status === "active" &&
              (member.role === "owner" || member.role === "admin" || member.role === "teacher" || member.role === "assistant")
            ))
            .map((member) => ({ userId: member.userId, name: member.displayName }))}
        />
      ) : null}
      {canCreate && students && students.total > students.items.length ? (
        <p className="mt-2 text-[12px] text-ink-3">学员超过 100 人，创建课堂暂显示前 100 人；可从学员列表分批管理。</p>
      ) : null}
      {canCreate && members && members.total > members.items.length ? (
        <p className="mt-2 text-[12px] text-ink-3">成员超过 100 人，授课成员暂显示前 100 人。</p>
      ) : null}

      <div className="mt-8 divide-y divide-line border-y border-line">
        {sessions.items.length ? sessions.items.map((session) => (
          <Link
            key={session.id}
            href={`/org/${orgSlug}/sessions/${session.id}`}
            prefetch={false}
            className="grid min-w-0 gap-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-5"
          >
            <span className="min-w-0 [overflow-wrap:anywhere] text-[14px] font-medium text-ink hover:text-brand-dark">{session.title}</span>
            <span className="text-[12px] text-ink-2 sm:text-right">
              {teachingDateTimeLabel(session.startsAt, session.timezone)}
              <span className="ml-2 whitespace-nowrap">{session.attendeeCount} 人</span>
            </span>
            <span><Badge tone={statusTone(session.status)}>{teachingSessionStatusLabel(session.status)}</Badge></span>
          </Link>
        )) : <p className="py-5 text-[14px] text-ink-3">暂无课堂记录。</p>}
      </div>
      <Pagination page={sessions.page} totalPages={sessions.totalPages} basePath={`/org/${orgSlug}/schedule`} prefetch={false} />
    </div>
  );
}
