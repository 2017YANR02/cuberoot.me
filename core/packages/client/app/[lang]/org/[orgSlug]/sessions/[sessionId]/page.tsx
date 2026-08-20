'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  TEACHING_FEEDBACK_VISIBILITIES,
  hasTeachingPermission,
  type TeachingAttendanceStatus,
  type TeachingFeedbackVisibility,
  type TeachingLeaveRequestStatus,
  type TeachingMakeupAttemptStatus,
  type TeachingOrganizationRole,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  completeTeachingSession,
  cancelTeachingLeaveRequest,
  cancelTeachingSession,
  createTeachingLeaveRequest,
  createTeachingLessonFeedback,
  createTeachingMakeupAttempt,
  decideTeachingLeaveRequest,
  getTeachingSession,
  listTeachingLeaveRequests,
  listTeachingLessonFeedback,
  listTeachingMakeupAttempts,
  listTeachingMakeupCandidates,
  saveTeachingAttendanceBatch,
  type TeachingLessonFeedback,
  type TeachingLeaveRequest,
  type TeachingMakeupAttempt,
  type TeachingMakeupCandidate,
  type TeachingSession,
} from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  teachingErrorMessage,
  useOperationKey,
} from '../../../_components/OrgUi';

type FinalAttendanceStatus = Exclude<TeachingAttendanceStatus, 'expected' | 'excused'>;

const FINAL_ATTENDANCE_STATUSES: FinalAttendanceStatus[] = ['present', 'late', 'absent'];

export default function OrganizationSessionDetailPage() {
  const params = useParams<{ orgSlug: string; sessionId: string }>();
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => (
        <SessionDetailContent
          orgSlug={params.orgSlug}
          sessionId={params.sessionId}
          role={organization.role}
        />
      )}
    </OrgWorkspace>
  );
}

function leaveRequestStatusLabel(status: TeachingLeaveRequestStatus, t: ReturnType<typeof useT>): string {
  const labels: Record<TeachingLeaveRequestStatus, [string, string]> = {
    pending: ['待审批', 'Pending'],
    approved: ['已批准', 'Approved'],
    rejected: ['已驳回', 'Rejected'],
    cancelled: ['已取消', 'Cancelled'],
  };
  return t(labels[status][0], labels[status][1]);
}

function makeupAttemptStatusLabel(status: TeachingMakeupAttemptStatus, t: ReturnType<typeof useT>): string {
  const labels: Record<TeachingMakeupAttemptStatus, [string, string]> = {
    scheduled: ['已安排', 'Scheduled'],
    fulfilled: ['已完成', 'Fulfilled'],
    failed: ['未完成', 'Failed'],
    cancelled: ['已取消', 'Cancelled'],
  };
  return t(labels[status][0], labels[status][1]);
}

function SessionDetailContent({
  orgSlug,
  sessionId,
  role,
}: {
  orgSlug: string;
  sessionId: string;
  role: TeachingOrganizationRole;
}) {
  const t = useT();
  const saveOperation = useOperationKey();
  const completeOperation = useOperationKey();
  const feedbackOperation = useOperationKey();
  const leaveOperation = useOperationKey();
  const leaveDecisionOperation = useOperationKey();
  const makeupOperation = useOperationKey();
  const sessionCancelOperation = useOperationKey();
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [feedback, setFeedback] = useState<TeachingLessonFeedback[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<TeachingLeaveRequest[]>([]);
  const [makeupAttempts, setMakeupAttempts] = useState<TeachingMakeupAttempt[]>([]);
  const [makeupCandidates, setMakeupCandidates] = useState<TeachingMakeupCandidate[]>([]);
  const [makeupRevision, setMakeupRevision] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, TeachingAttendanceStatus>>({});
  const [leaveAttendanceId, setLeaveAttendanceId] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [makeupAttendanceId, setMakeupAttendanceId] = useState('');
  const [makeupTargetSessionId, setMakeupTargetSessionId] = useState('');
  const [makeupReason, setMakeupReason] = useState('');
  const [sessionCancelReason, setSessionCancelReason] = useState('');
  const [feedbackStudentId, setFeedbackStudentId] = useState('');
  const [feedbackVisibility, setFeedbackVisibility] = useState<TeachingFeedbackVisibility>('staff_only');
  const [feedbackSummary, setFeedbackSummary] = useState('');
  const [feedbackStrengths, setFeedbackStrengths] = useState('');
  const [feedbackChallenges, setFeedbackChallenges] = useState('');
  const [feedbackNextGoals, setFeedbackNextGoals] = useState('');
  const [feedbackInternalNotes, setFeedbackInternalNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);
  const [savingMakeup, setSavingMakeup] = useState(false);
  const [loadingMakeups, setLoadingMakeups] = useState(false);
  const [cancellingSession, setCancellingSession] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'session:manage');
  const canReadFeedback = hasTeachingPermission(role, 'feedback:read');
  const canManageFeedback = hasTeachingPermission(role, 'feedback:manage');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [value, feedbackPage, leavePage] = await Promise.all([
        getTeachingSession(orgSlug, sessionId),
        canReadFeedback
          ? listTeachingLessonFeedback(orgSlug, sessionId)
          : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
        listTeachingLeaveRequests(orgSlug, sessionId),
      ]);
      setSession(value);
      setFeedback(feedbackPage.items);
      setLeaveRequests(leavePage.items);
      setStatuses(Object.fromEntries(value.attendance.map((attendance) => [attendance.id, attendance.status])));
      setLeaveAttendanceId((current) => value.attendance.some((attendance) => attendance.id === current)
        ? current
        : (value.attendance[0]?.id ?? ''));
      const approvedAttendanceId = leavePage.items.find((item) => item.status === 'approved')?.attendanceId ?? '';
      setMakeupAttendanceId((current) => leavePage.items.some((item) => item.attendanceId === current && item.status === 'approved')
        ? current
        : approvedAttendanceId);
      setFeedbackStudentId((current) => value.attendance.some((attendance) => attendance.studentId === current)
        ? current
        : (value.attendance[0]?.studentId ?? ''));
    } catch (reason) {
      setLoadError(teachingErrorMessage(reason, t));
    } finally {
      setLoading(false);
    }
  }, [canReadFeedback, orgSlug, sessionId, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canManage || !makeupAttendanceId) {
      setLoadingMakeups(false);
      setMakeupCandidates([]);
      setMakeupAttempts([]);
      setMakeupTargetSessionId('');
      return;
    }
    let cancelled = false;
    setLoadingMakeups(true);
    setMakeupCandidates([]);
    setMakeupAttempts([]);
    setMakeupTargetSessionId('');
    void Promise.all([
      listTeachingMakeupAttempts(orgSlug, sessionId, makeupAttendanceId),
      listTeachingMakeupCandidates(orgSlug, sessionId, makeupAttendanceId),
    ]).then(([attemptPage, candidatePage]) => {
      if (cancelled) return;
      setMakeupAttempts(attemptPage.items);
      setMakeupCandidates(candidatePage.items);
      setMakeupTargetSessionId((current) => candidatePage.items.some((item) => item.sessionId === current)
        ? current
        : (candidatePage.items[0]?.sessionId ?? ''));
    }).catch((reason: unknown) => {
      if (!cancelled) setMutationError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoadingMakeups(false);
    });
    return () => { cancelled = true; };
  }, [canManage, makeupAttendanceId, makeupRevision, orgSlug, sessionId, t]);

  const unresolvedCount = useMemo(
    () => session?.attendance.filter((attendance) => (statuses[attendance.id] ?? attendance.status) === 'expected').length ?? 0,
    [session, statuses],
  );
  const canWrite = canManage && !!session && (session.status === 'scheduled' || session.status === 'in_progress');
  const canComplete = canWrite && session.attendance.length > 0 && unresolvedCount === 0;
  const activeLeaveAttendanceIds = useMemo(
    () => new Set(leaveRequests.filter((item) => item.status === 'pending' || item.status === 'approved').map((item) => item.attendanceId)),
    [leaveRequests],
  );
  const eligibleLeaveAttendance = useMemo(
    () => session?.attendance.filter((item) => item.status === 'expected' && !activeLeaveAttendanceIds.has(item.id)) ?? [],
    [activeLeaveAttendanceIds, session],
  );
  const approvedLeaveRequests = useMemo(
    () => leaveRequests.filter((item) => item.status === 'approved'),
    [leaveRequests],
  );

  useEffect(() => {
    setLeaveAttendanceId((current) => eligibleLeaveAttendance.some((item) => item.id === current)
      ? current
      : (eligibleLeaveAttendance[0]?.id ?? ''));
  }, [eligibleLeaveAttendance]);

  function attendanceStatusLabel(status: TeachingAttendanceStatus): string {
    const labels: Record<TeachingAttendanceStatus, [string, string]> = {
      expected: ['待确认', 'Expected'],
      present: ['出席', 'Present'],
      late: ['迟到', 'Late'],
      absent: ['缺席', 'Absent'],
      excused: ['请假', 'Excused'],
    };
    return t(labels[status][0], labels[status][1]);
  }

  async function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canWrite) return;
    const records = session.attendance
      .filter((attendance) => attendance.status !== 'excused' && !activeLeaveAttendanceIds.has(attendance.id))
      .map((attendance) => ({
        attendanceId: attendance.id,
        status: statuses[attendance.id] ?? attendance.status,
      }));
    if (!records.length || records.some((record) => record.status === 'expected')) {
      setMutationError(t('请先为每名学员选择出勤结果。', 'Choose an attendance result for every student first.'));
      return;
    }
    setSaving(true);
    setMessage('');
    setMutationError('');
    try {
      await saveTeachingAttendanceBatch(
        orgSlug,
        sessionId,
        records as Array<{ attendanceId: string; status: FinalAttendanceStatus }>,
        saveOperation.get(),
      );
      saveOperation.reset();
      await load();
      setMessage(t('出勤已保存。', 'Attendance saved.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSaving(false);
    }
  }

  function canonicalReason(value: string, messageValue: [string, string]): string | null {
    const parsed = value.trim();
    if (!parsed || parsed.length > 500) {
      setMutationError(t(messageValue[0], messageValue[1]));
      return null;
    }
    return parsed;
  }

  async function submitStaffLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canWrite || !leaveAttendanceId || activeLeaveAttendanceIds.has(leaveAttendanceId)) return;
    const parsedReason = canonicalReason(leaveReason, [
      '请填写 1 至 500 字的请假原因。',
      'Enter a leave reason between 1 and 500 characters.',
    ]);
    if (!parsedReason) return;
    setSavingLeave(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingLeaveRequest(
        orgSlug,
        sessionId,
        leaveAttendanceId,
        { reason: parsedReason },
        leaveOperation.get(`${orgSlug}:${sessionId}:${leaveAttendanceId}:${parsedReason}`),
      );
      leaveOperation.reset();
      setLeaveReason('');
      await load();
      setMessage(t('请假申请已代学员录入，现在等待审批。', 'The leave request was recorded for the student and is awaiting approval.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSavingLeave(false);
    }
  }

  async function decideLeave(request: TeachingLeaveRequest, decision: 'approved' | 'rejected') {
    if (!canManage || request.status !== 'pending') return;
    const parsedReason = canonicalReason(decisionReasons[request.id] ?? '', [
      '请填写 1 至 500 字的审批说明。',
      'Enter a decision note between 1 and 500 characters.',
    ]);
    if (!parsedReason) return;
    setSavingLeave(true);
    setMessage('');
    setMutationError('');
    try {
      await decideTeachingLeaveRequest(
        orgSlug,
        sessionId,
        request.attendanceId,
        request.id,
        { decision, reason: parsedReason },
        leaveDecisionOperation.get(`${orgSlug}:${sessionId}:${request.attendanceId}:${request.id}:${decision}:${parsedReason}`),
      );
      leaveDecisionOperation.reset();
      setDecisionReasons((value) => ({ ...value, [request.id]: '' }));
      await load();
      setMessage(decision === 'approved'
        ? t('请假已批准，该次不扣课。', 'Leave was approved and this session will not consume credits.')
        : t('请假申请已驳回。', 'The leave request was rejected.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSavingLeave(false);
    }
  }

  async function cancelStaffLeave(request: TeachingLeaveRequest) {
    if (!canManage || request.status !== 'pending') return;
    const parsedReason = canonicalReason(decisionReasons[request.id] ?? '', [
      '请填写 1 至 500 字的取消原因。',
      'Enter a cancellation reason between 1 and 500 characters.',
    ]);
    if (!parsedReason) return;
    setSavingLeave(true);
    setMessage('');
    setMutationError('');
    try {
      await cancelTeachingLeaveRequest(
        orgSlug,
        sessionId,
        request.attendanceId,
        request.id,
        { reason: parsedReason },
        leaveDecisionOperation.get(`${orgSlug}:${sessionId}:${request.attendanceId}:${request.id}:cancel:${parsedReason}`),
      );
      leaveDecisionOperation.reset();
      setDecisionReasons((value) => ({ ...value, [request.id]: '' }));
      await load();
      setMessage(t('请假申请已取消。', 'The leave request was cancelled.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSavingLeave(false);
    }
  }

  async function arrangeMakeup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !makeupAttendanceId || !makeupTargetSessionId) return;
    const parsedReason = canonicalReason(makeupReason, [
      '请填写 1 至 500 字的补课安排说明。',
      'Enter a makeup note between 1 and 500 characters.',
    ]);
    if (!parsedReason) return;
    setSavingMakeup(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingMakeupAttempt(
        orgSlug,
        sessionId,
        makeupAttendanceId,
        { targetSessionId: makeupTargetSessionId, reason: parsedReason },
        makeupOperation.get(`${orgSlug}:${sessionId}:${makeupAttendanceId}:${makeupTargetSessionId}:${parsedReason}`),
      );
      makeupOperation.reset();
      setMakeupReason('');
      setMakeupRevision((value) => value + 1);
      await load();
      setMessage(t('补课已安排，目标课次已复用或创建待确认出勤。', 'The makeup was arranged, reusing or creating expected attendance in the target session.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSavingMakeup(false);
    }
  }

  async function cancelSessionNow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManage || session.status !== 'scheduled') return;
    const parsedReason = canonicalReason(sessionCancelReason, [
      '请填写 1 至 500 字的取消课次原因。',
      'Enter a session cancellation reason between 1 and 500 characters.',
    ]);
    if (!parsedReason) return;
    setCancellingSession(true);
    setMessage('');
    setMutationError('');
    try {
      const result = await cancelTeachingSession(
        orgSlug,
        sessionId,
        { reason: parsedReason },
        sessionCancelOperation.get(`${orgSlug}:${sessionId}:${parsedReason}`),
      );
      sessionCancelOperation.reset();
      setSessionCancelReason('');
      setMakeupRevision((value) => value + 1);
      await load();
      setMessage(t(
        `课次已取消，同步取消 ${result.makeupAttempts.length} 条补课安排。`,
        `The session was cancelled together with ${result.makeupAttempts.length} makeup arrangements.`,
      ));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setCancellingSession(false);
    }
  }

  async function complete() {
    if (!session || !canComplete) return;
    setCompleting(true);
    setMessage('');
    setMutationError('');
    try {
      const result = await completeTeachingSession(orgSlug, sessionId, completeOperation.get());
      completeOperation.reset();
      await load();
      setMessage(t(
        `已完课：${result.consumption.attendanceCount} 人，共扣 ${result.consumption.totalCredits} 课时。`,
        `Session completed: ${result.consumption.attendanceCount} attendees and ${result.consumption.totalCredits} credits consumed.`,
      ));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setCompleting(false);
    }
  }

  function resetFeedbackIntent() {
    feedbackOperation.reset();
    setMessage('');
    setMutationError('');
  }

  async function saveFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.status !== 'completed' || !canManageFeedback || !feedbackStudentId) return;
    if (!feedbackSummary.trim()) {
      setMutationError(t('请填写本次课反馈摘要。', 'Enter a lesson feedback summary.'));
      return;
    }
    const optional = (value: string) => value.trim() || null;
    setSavingFeedback(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingLessonFeedback(
        orgSlug,
        sessionId,
        feedbackStudentId,
        {
          visibility: feedbackVisibility,
          summary: feedbackSummary.trim(),
          strengths: optional(feedbackStrengths),
          challenges: optional(feedbackChallenges),
          nextGoals: optional(feedbackNextGoals),
          internalNotes: optional(feedbackInternalNotes),
        },
        feedbackOperation.get(),
      );
      feedbackOperation.reset();
      setFeedbackSummary('');
      setFeedbackStrengths('');
      setFeedbackChallenges('');
      setFeedbackNextGoals('');
      setFeedbackInternalNotes('');
      await load();
      setMessage(t('课后反馈已保存为新版本。', 'Lesson feedback was saved as a new revision.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSavingFeedback(false);
    }
  }

  function feedbackVisibilityLabel(visibility: TeachingFeedbackVisibility): string {
    const labels: Record<TeachingFeedbackVisibility, [string, string]> = {
      staff_only: ['仅教职员工', 'Staff only'],
      student: ['学员可见', 'Visible to student'],
      student_and_guardians: ['学员及监护人可见', 'Visible to student and guardians'],
    };
    return t(labels[visibility][0], labels[visibility][1]);
  }

  if (loading) return <p aria-busy="true">{t('正在加载课次…', 'Loading session…')}</p>;
  if (loadError || !session) return <MutationMessage message={loadError || t('没有找到课次。', 'Session not found.')} error />;

  return (
    <>
      <AppLink href={`/org/${orgSlug}/sessions`} prefetch={false}>{t('课次列表', 'Session list')}</AppLink>
      <div className="org-heading-row">
        <h2>{session.title}</h2>
        <span className="org-status">{entityStatusLabel(session.status, t)}</span>
      </div>
      <p className="org-lead">
        {new Date(session.startsAt).toLocaleString()} – {new Date(session.endsAt).toLocaleString()} ({session.timezone})
      </p>
      <p className="org-row-meta">
        {session.teachers.length
          ? t(`授课：${session.teachers.map((teacher) => teacher.displayName).join('、')}`, `Teachers: ${session.teachers.map((teacher) => teacher.displayName).join(', ')}`)
          : t('尚未安排授课老师。', 'No teacher is assigned.')}
      </p>

      <section className="org-section">
        <h2>{t('出勤与扣课', 'Attendance and credits')}</h2>
        {!session.attendance.length ? (
          <p className="org-empty">{t('该课次没有学员，不能完课。', 'This session has no attendees and cannot be completed.')}</p>
        ) : (
          <form onSubmit={saveAttendance}>
            <fieldset className="org-plain-fieldset" disabled={!canWrite || saving || completing}>
              <div className="org-table-wrap">
                <table className="org-table">
                  <thead><tr><th>{t('学员', 'Student')}</th><th>{t('出勤', 'Attendance')}</th><th>{t('扣课', 'Credits')}</th></tr></thead>
                  <tbody>
                    {session.attendance.map((attendance) => {
                      const currentStatus = statuses[attendance.id] ?? attendance.status;
                      const leaveLocked = activeLeaveAttendanceIds.has(attendance.id);
                      return (
                        <tr key={attendance.id}>
                          <td>{attendance.displayName || attendance.studentId}</td>
                          <td>
                            {canWrite && attendance.status !== 'excused' && !leaveLocked ? (
                              <select
                                className="org-table-control"
                                aria-label={t(`${attendance.displayName || attendance.studentId}的出勤`, `Attendance for ${attendance.displayName || attendance.studentId}`)}
                                value={currentStatus}
                                onChange={(event) => {
                                  setStatuses((value) => ({ ...value, [attendance.id]: event.target.value as TeachingAttendanceStatus }));
                                  saveOperation.reset();
                                  completeOperation.reset();
                                  setMessage('');
                                  setMutationError('');
                                }}
                              >
                                <option value="expected">{attendanceStatusLabel('expected')}</option>
                                {FINAL_ATTENDANCE_STATUSES.map((status) => <option value={status} key={status}>{attendanceStatusLabel(status)}</option>)}
                              </select>
                            ) : (
                              <>
                                {attendanceStatusLabel(currentStatus)}
                                {leaveLocked && currentStatus !== 'excused' && <div className="org-row-meta">{t('请假处理中', 'Leave in progress')}</div>}
                              </>
                            )}
                          </td>
                          <td>{currentStatus === 'absent' || currentStatus === 'excused' ? 0 : attendance.creditCost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canWrite && (
                <div className="org-form-actions org-subsection">
                  <button type="submit" className="org-secondary-button">{saving ? t('保存中…', 'Saving…') : t('保存出勤', 'Save attendance')}</button>
                  <button type="button" className="org-primary-button" disabled={!canComplete || saving || completing} onClick={() => { void complete(); }}>
                    {completing ? t('完课中…', 'Completing…') : t('确认完课并扣课', 'Complete and consume credits')}
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        )}
        {canWrite && unresolvedCount > 0 && <p className="org-help">{t(`还有 ${unresolvedCount} 名学员待确认。`, `${unresolvedCount} attendees still need a result.`)}</p>}
        <MutationMessage message={mutationError || message} error={!!mutationError} />
      </section>

      <section className="org-section">
          <h2>{t('请假申请与审批', 'Leave requests and decisions')}</h2>
          <p className="org-help">{t('批准请假会把该学员的出勤记为请假，该次完课时不扣课。', 'Approving leave marks the attendance as excused, so the session does not consume that student\'s credits.')}</p>
          {canWrite && eligibleLeaveAttendance.length > 0 && (
            <form className="org-form org-subsection" onSubmit={submitStaffLeave}>
              <fieldset className="org-plain-fieldset" disabled={savingLeave}>
                <label>
                  <span>{t('代谁录入', 'Record for')}</span>
                  <select className="org-form-control" value={leaveAttendanceId} onChange={(event) => { setLeaveAttendanceId(event.target.value); leaveOperation.reset(); setMessage(''); setMutationError(''); }}>
                    {eligibleLeaveAttendance.map((item) => <option key={item.id} value={item.id}>{item.displayName || item.studentId}</option>)}
                  </select>
                </label>
                <label className="org-field-wide">
                  <span>{t('请假原因', 'Leave reason')}</span>
                  <textarea className="org-form-control org-form-textarea" required maxLength={500} value={leaveReason} onChange={(event) => { setLeaveReason(event.target.value); leaveOperation.reset(); setMessage(''); setMutationError(''); }} />
                </label>
                <div className="org-form-actions"><button className="org-form-button org-secondary-button" type="submit">{savingLeave ? t('录入中…', 'Recording…') : t('代学员录入请假', 'Record leave for student')}</button></div>
              </fieldset>
            </form>
          )}
          {!leaveRequests.length ? (
            <p className="org-empty">{t('还没有请假申请。', 'No leave requests yet.')}</p>
          ) : (
            <div className="org-list">
              {leaveRequests.map((request) => {
                const attendanceItem = session.attendance.find((item) => item.id === request.attendanceId);
                return (
                  <article className="org-row" key={request.id}>
                    <div className="org-row-main">
                      <div className="org-heading-row">
                        <strong>{attendanceItem?.displayName || request.studentId}</strong>
                        <span className="org-status">{leaveRequestStatusLabel(request.status, t)}</span>
                      </div>
                      <p>{request.reason}</p>
                      {request.decisionReason && <p className="org-row-meta">{t('处理说明：', 'Decision note:')} {request.decisionReason}</p>}
                      <p className="org-row-meta">{t(`由 ${request.requestedBy.displayName} 提交，${new Date(request.createdAt).toLocaleString()}`, `Submitted by ${request.requestedBy.displayName}, ${new Date(request.createdAt).toLocaleString()}`)}</p>
                    </div>
                    {canManage && request.status === 'pending' && (
                      <div className="org-row-action">
                        <label>
                          <span>{t('审批或取消说明', 'Decision or cancellation note')}</span>
                          <input className="org-table-control" maxLength={500} value={decisionReasons[request.id] ?? ''} onChange={(event) => { setDecisionReasons((value) => ({ ...value, [request.id]: event.target.value })); leaveDecisionOperation.reset(); setMessage(''); setMutationError(''); }} />
                        </label>
                        <button type="button" className="org-primary-button" disabled={savingLeave} onClick={() => { void decideLeave(request, 'approved'); }}>{t('批准', 'Approve')}</button>
                        <button type="button" className="org-secondary-button" disabled={savingLeave} onClick={() => { void decideLeave(request, 'rejected'); }}>{t('驳回', 'Reject')}</button>
                        <button type="button" className="org-text-button" disabled={savingLeave} onClick={() => { void cancelStaffLeave(request); }}>{t('取消申请', 'Cancel request')}</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </section>

      {canManage && approvedLeaveRequests.length > 0 && (
        <section className="org-section">
          <h2>{t('补课安排', 'Makeup arrangements')}</h2>
          <p className="org-help">{t('补课是独立的目标课次：安排时只创建或复用待确认出勤，完成目标课次后才按实际出勤扣课。', 'A makeup uses a separate target session. Arranging it only creates or reuses expected attendance; credits are consumed later from the actual target attendance result.')}</p>
          <form className="org-form org-subsection" onSubmit={arrangeMakeup}>
            <fieldset className="org-plain-fieldset" disabled={savingMakeup || loadingMakeups}>
              <label>
                <span>{t('请假学员', 'Student on leave')}</span>
                <select className="org-form-control" value={makeupAttendanceId} onChange={(event) => { setMakeupAttendanceId(event.target.value); makeupOperation.reset(); setMessage(''); setMutationError(''); }}>
                  {approvedLeaveRequests.map((request) => {
                    const attendanceItem = session.attendance.find((item) => item.id === request.attendanceId);
                    return <option key={request.id} value={request.attendanceId}>{attendanceItem?.displayName || request.studentId}</option>;
                  })}
                </select>
              </label>
              <label>
                <span>{t('目标课次', 'Target session')}</span>
                <select className="org-form-control" required value={makeupTargetSessionId} onChange={(event) => { setMakeupTargetSessionId(event.target.value); makeupOperation.reset(); setMessage(''); setMutationError(''); }}>
                  {!makeupCandidates.length && <option value="">{loadingMakeups ? t('正在加载候选课次…', 'Loading eligible target sessions…') : t('没有可用候选课次', 'No eligible target sessions')}</option>}
                  {makeupCandidates.map((candidate) => <option key={candidate.sessionId} value={candidate.sessionId}>{candidate.title} / {new Date(candidate.startsAt).toLocaleString()}</option>)}
                </select>
              </label>
              <label className="org-field-wide">
                <span>{t('安排说明', 'Arrangement note')}</span>
                <textarea className="org-form-control org-form-textarea" required maxLength={500} value={makeupReason} onChange={(event) => { setMakeupReason(event.target.value); makeupOperation.reset(); setMessage(''); setMutationError(''); }} />
              </label>
              <div className="org-form-actions"><button className="org-form-button org-primary-button" type="submit" disabled={!makeupTargetSessionId}>{t('安排补课', 'Arrange makeup')}</button></div>
            </fieldset>
          </form>
          {loadingMakeups ? <p aria-busy="true">{t('正在加载补课安排…', 'Loading makeup arrangements…')}</p> : !makeupAttempts.length ? <p className="org-empty">{t('还没有补课安排。', 'No makeup arrangements yet.')}</p> : (
            <div className="org-list">
              {makeupAttempts.map((attempt) => (
                <article className="org-row" key={attempt.id}>
                  <div className="org-row-main">
                    <div className="org-heading-row"><strong>{session.attendance.find((item) => item.id === attempt.sourceAttendanceId)?.displayName || attempt.studentId}</strong><span className="org-status">{makeupAttemptStatusLabel(attempt.status, t)}</span></div>
                    <p>{attempt.reason}</p>
                    <p className="org-row-meta">{t('目标课次：', 'Target session:')} {attempt.targetSessionId}</p>
                    {attempt.resolutionReason && <p className="org-row-meta">{t('结果：', 'Resolution:')} {attempt.resolutionReason}</p>}
                  </div>
                  <AppLink className="org-text-button" href={`/org/${orgSlug}/sessions/${attempt.targetSessionId}`} prefetch={false}>{t('打开目标课次', 'Open target session')}</AppLink>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {canManage && session.status === 'scheduled' && (
        <section className="org-section">
          <h2>{t('取消课次', 'Cancel session')}</h2>
          <p className="org-help">{t('取消课次会同步取消与本课次相关的待执行补课安排。', 'Cancelling a session also cancels pending makeup arrangements connected to it.')}</p>
          <form className="org-form" onSubmit={cancelSessionNow}>
            <fieldset className="org-plain-fieldset" disabled={cancellingSession}>
              <label className="org-field-wide">
                <span>{t('取消原因', 'Cancellation reason')}</span>
                <textarea className="org-form-control org-form-textarea" required maxLength={500} value={sessionCancelReason} onChange={(event) => { setSessionCancelReason(event.target.value); sessionCancelOperation.reset(); setMessage(''); setMutationError(''); }} />
              </label>
              <div className="org-form-actions"><button className="org-form-button org-secondary-button" type="submit">{cancellingSession ? t('取消中…', 'Cancelling…') : t('确认取消课次', 'Confirm session cancellation')}</button></div>
            </fieldset>
          </form>
        </section>
      )}

      {canReadFeedback && (
        <section className="org-section">
          <h2>{t('课后反馈', 'Lesson feedback')}</h2>
          {session.status !== 'completed' ? (
            <p className="org-help">{t('完课后才能填写课后反馈。', 'Lesson feedback can be added after the session is completed.')}</p>
          ) : canManageFeedback && session.attendance.length > 0 ? (
            <form className="org-form" onSubmit={saveFeedback}>
              <fieldset className="org-plain-fieldset" disabled={savingFeedback}>
                <label>
                  <span>{t('学员', 'Student')}</span>
                  <select
                    className="org-form-control"
                    value={feedbackStudentId}
                    onChange={(event) => { setFeedbackStudentId(event.target.value); resetFeedbackIntent(); }}
                  >
                    {session.attendance.map((attendance) => (
                      <option key={attendance.studentId} value={attendance.studentId}>
                        {attendance.displayName || attendance.studentId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('可见范围', 'Visibility')}</span>
                  <select
                    className="org-form-control"
                    value={feedbackVisibility}
                    onChange={(event) => { setFeedbackVisibility(event.target.value as TeachingFeedbackVisibility); resetFeedbackIntent(); }}
                  >
                    {TEACHING_FEEDBACK_VISIBILITIES.map((visibility) => (
                      <option key={visibility} value={visibility}>{feedbackVisibilityLabel(visibility)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('本次课摘要', 'Lesson summary')}</span>
                  <textarea
                    className="org-form-textarea"
                    required
                    maxLength={2000}
                    value={feedbackSummary}
                    onChange={(event) => { setFeedbackSummary(event.target.value); resetFeedbackIntent(); }}
                  />
                </label>
                <label>
                  <span>{t('表现好的地方', 'Strengths')}</span>
                  <textarea className="org-form-textarea" maxLength={4000} value={feedbackStrengths} onChange={(event) => { setFeedbackStrengths(event.target.value); resetFeedbackIntent(); }} />
                </label>
                <label>
                  <span>{t('需要改进', 'Challenges')}</span>
                  <textarea className="org-form-textarea" maxLength={4000} value={feedbackChallenges} onChange={(event) => { setFeedbackChallenges(event.target.value); resetFeedbackIntent(); }} />
                </label>
                <label>
                  <span>{t('下阶段目标', 'Next goals')}</span>
                  <textarea className="org-form-textarea" maxLength={4000} value={feedbackNextGoals} onChange={(event) => { setFeedbackNextGoals(event.target.value); resetFeedbackIntent(); }} />
                </label>
                <label>
                  <span>{t('内部备注', 'Internal notes')}</span>
                  <textarea className="org-form-textarea" maxLength={4000} value={feedbackInternalNotes} onChange={(event) => { setFeedbackInternalNotes(event.target.value); resetFeedbackIntent(); }} />
                  <small className="org-help">{t('内部备注始终仅教职员工可见。', 'Internal notes always remain staff-only.')}</small>
                </label>
                <div className="org-form-actions">
                  <button className="org-form-button org-primary-button" type="submit">
                    {savingFeedback ? t('保存中…', 'Saving…') : t('保存新版本', 'Save new revision')}
                  </button>
                </div>
              </fieldset>
            </form>
          ) : null}

          {!feedback.length ? (
            <p className="org-empty">{t('还没有课后反馈。', 'No lesson feedback yet.')}</p>
          ) : (
            <div className="org-list">
              {feedback.map((item) => (
                <article className="org-row" key={item.id}>
                  <div className="org-heading-row">
                    <strong>{item.studentDisplayNameSnapshot}</strong>
                    <span className="org-status">{t(`第 ${item.revision} 版`, `Revision ${item.revision}`)}</span>
                  </div>
                  <p>{item.summary}</p>
                  {item.strengths && <p><strong>{t('表现：', 'Strengths:')}</strong> {item.strengths}</p>}
                  {item.challenges && <p><strong>{t('改进：', 'Challenges:')}</strong> {item.challenges}</p>}
                  {item.nextGoals && <p><strong>{t('目标：', 'Goals:')}</strong> {item.nextGoals}</p>}
                  {item.internalNotes && <p><strong>{t('内部备注：', 'Internal notes:')}</strong> {item.internalNotes}</p>}
                  <p className="org-row-meta">
                    {t(
                      `${item.authorDisplayNameSnapshot}，${feedbackVisibilityLabel(item.visibility)}，${new Date(item.createdAt).toLocaleString()}`,
                      `${item.authorDisplayNameSnapshot}, ${feedbackVisibilityLabel(item.visibility)}, ${new Date(item.createdAt).toLocaleString()}`,
                    )}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
