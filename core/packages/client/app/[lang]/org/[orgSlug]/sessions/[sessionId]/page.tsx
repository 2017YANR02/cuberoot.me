'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  TEACHING_FEEDBACK_VISIBILITIES,
  hasTeachingPermission,
  type TeachingAttendanceStatus,
  type TeachingFeedbackVisibility,
  type TeachingOrganizationRole,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  completeTeachingSession,
  createTeachingLessonFeedback,
  getTeachingSession,
  listTeachingLessonFeedback,
  saveTeachingAttendanceBatch,
  type TeachingLessonFeedback,
  type TeachingSession,
} from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  teachingErrorMessage,
  useOperationKey,
} from '../../../_components/OrgUi';

type FinalAttendanceStatus = Exclude<TeachingAttendanceStatus, 'expected'>;

const FINAL_ATTENDANCE_STATUSES: FinalAttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

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
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [feedback, setFeedback] = useState<TeachingLessonFeedback[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TeachingAttendanceStatus>>({});
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
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'session:manage');
  const canReadFeedback = hasTeachingPermission(role, 'feedback:read');
  const canManageFeedback = hasTeachingPermission(role, 'feedback:manage');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [value, feedbackPage] = await Promise.all([
        getTeachingSession(orgSlug, sessionId),
        canReadFeedback
          ? listTeachingLessonFeedback(orgSlug, sessionId)
          : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
      ]);
      setSession(value);
      setFeedback(feedbackPage.items);
      setStatuses(Object.fromEntries(value.attendance.map((attendance) => [attendance.id, attendance.status])));
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

  const unresolvedCount = useMemo(
    () => session?.attendance.filter((attendance) => (statuses[attendance.id] ?? attendance.status) === 'expected').length ?? 0,
    [session, statuses],
  );
  const canWrite = canManage && !!session && (session.status === 'scheduled' || session.status === 'in_progress');
  const canComplete = canWrite && session.attendance.length > 0 && unresolvedCount === 0;

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
    const records = session.attendance.map((attendance) => ({
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
                      return (
                        <tr key={attendance.id}>
                          <td>{attendance.displayName || attendance.studentId}</td>
                          <td>
                            {canWrite ? (
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
                            ) : attendanceStatusLabel(currentStatus)}
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
