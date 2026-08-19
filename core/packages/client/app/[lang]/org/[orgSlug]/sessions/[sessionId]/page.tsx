'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { hasTeachingPermission, type TeachingAttendanceStatus, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  completeTeachingSession,
  getTeachingSession,
  saveTeachingAttendanceBatch,
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
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [statuses, setStatuses] = useState<Record<string, TeachingAttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'session:manage');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const value = await getTeachingSession(orgSlug, sessionId);
      setSession(value);
      setStatuses(Object.fromEntries(value.attendance.map((attendance) => [attendance.id, attendance.status])));
    } catch (reason) {
      setLoadError(teachingErrorMessage(reason, t));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, sessionId, t]);

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
    </>
  );
}
