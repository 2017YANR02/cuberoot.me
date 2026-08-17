import { hasTeachingPermission } from "@cuberoot/shared/teaching";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { requireUser } from "@/lib/auth-user";
import {
  getTeachingOrganization,
  getTeachingSession,
  TeachingApiError,
} from "@/lib/teaching-api";
import {
  canCompleteTeachingSession,
  teachingAttendanceStatusLabel,
  teachingDateTimeLabel,
  teachingSessionStatusLabel,
} from "@/lib/teaching-stage2";
import { AttendanceForm } from "../../../_components/AttendanceForm";
import { CompleteSessionForm } from "../../../_components/CompleteSessionForm";

function statusTone(status: "scheduled" | "in_progress" | "completed" | "cancelled") {
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  if (status === "cancelled") return "muted" as const;
  return "brand" as const;
}

export default async function TeachingSessionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionId: string }>;
}) {
  const { orgSlug, sessionId } = await params;
  const user = await requireUser(`/org/${orgSlug}/sessions/${sessionId}`);
  const organization = await getTeachingOrganization(user, orgSlug);
  if (!hasTeachingPermission(organization.role, "session:read")) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-[19px] font-semibold text-ink">课堂详情</h2>
        <p className="mt-2 text-[14px] text-ink-2">你当前的机构角色不能查看课堂。</p>
      </div>
    );
  }
  let session;
  try {
    session = await getTeachingSession(user, orgSlug, sessionId);
  } catch (error) {
    if (
      error instanceof TeachingApiError &&
      (error.code === "RESOURCE_NOT_FOUND" || error.code === "INVALID_INPUT")
    ) notFound();
    throw error;
  }
  const canManage = organization.status === "active" &&
    hasTeachingPermission(organization.role, "session:manage") &&
    (session.status === "scheduled" || session.status === "in_progress");
  const canReadPackages = hasTeachingPermission(organization.role, "package:read");
  const canComplete = canManage && canCompleteTeachingSession(session.status, session.attendees);

  return (
    <div className="max-w-5xl">
      <Link href={`/org/${orgSlug}/schedule`} prefetch={false} className="text-[13px] text-ink-3 hover:text-ink">全部课堂</Link>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
        <h2 className="min-w-0 [overflow-wrap:anywhere] text-[19px] font-semibold text-ink">{session.title}</h2>
        <Badge tone={statusTone(session.status)}>{teachingSessionStatusLabel(session.status)}</Badge>
      </div>
      <p className="mt-2 text-[13px] text-ink-2">
        {teachingDateTimeLabel(session.startsAt, session.timezone)} 至 {teachingDateTimeLabel(session.endsAt, session.timezone)}
      </p>
      <p className="mt-0.5 break-all text-[12px] text-ink-3">时区 {session.timezone}</p>

      <section className="mt-8" aria-labelledby="attendance-heading">
        <h3 id="attendance-heading" className="text-[15px] font-semibold text-ink">出勤与扣课</h3>
        {session.attendees.length ? canManage ? (
          <AttendanceForm
            orgSlug={orgSlug}
            sessionId={session.id}
            attendance={session.attendees.map((item) => ({
              id: item.id,
              studentName: item.studentName,
              attendanceStatus: item.attendanceStatus,
              creditCost: item.creditCost,
            }))}
          />
        ) : (
          <div className="mt-3 divide-y divide-line border-y border-line">
            {session.attendees.map((item) => (
              <div key={item.id} className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-5">
                {canReadPackages ? (
                  <Link href={`/org/${orgSlug}/students/${item.studentId}/credits`} prefetch={false} className="min-w-0 [overflow-wrap:anywhere] text-[14px] font-medium text-ink hover:text-brand-dark">{item.studentName}</Link>
                ) : (
                  <span className="min-w-0 [overflow-wrap:anywhere] text-[14px] font-medium text-ink">{item.studentName}</span>
                )}
                <span className="text-[12px] text-ink-3">扣课 {item.creditCost}</span>
                <span className="text-[13px] text-ink-2">{teachingAttendanceStatusLabel(item.attendanceStatus)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-ink-3">本课堂尚未关联学员。</p>
        )}
      </section>

      {canManage ? (
        <section className="mt-8" aria-labelledby="complete-heading">
          <h3 id="complete-heading" className="text-[15px] font-semibold text-ink">完课</h3>
          {canComplete ? (
            <>
              <p className="mt-1 text-[13px] text-ink-3">确认后会为出勤和迟到学员扣除本次课时；重复提交不会重复扣课。</p>
              <CompleteSessionForm orgSlug={orgSlug} sessionId={session.id} />
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">请先保存所有学员的出勤结果，再确认完课。</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
