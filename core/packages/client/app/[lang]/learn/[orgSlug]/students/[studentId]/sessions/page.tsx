'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import type { TeachingAttendanceStatus, TeachingLeaveRequestStatus } from '@cuberoot/shared/teaching';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import { MutationMessage, TeachingPagination, teachingErrorMessage, useOperationKey, useTeachingPage } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import {
  cancelLearnerTeachingLeaveRequest,
  createLearnerTeachingLeaveRequest,
  listLearnerTeachingLeaveRequests,
  listLearnerTeachingSessions,
  type TeachingLeaveRequest,
  type TeachingLearnerSessionSummary,
} from '@/lib/teaching-saas-api';

const PAGE_SIZE = 25;

export default function LearnerSessionsPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {() => (
        <SessionsContent
          orgSlug={params.orgSlug}
          studentId={params.studentId}
          page={Math.max(1, rawPage)}
        />
      )}
    </LearnerWorkspace>
  );
}

function SessionsContent({ orgSlug, studentId, page }: { orgSlug: string; studentId: string; page: number }) {
  const t = useT();
  const requestOperation = useOperationKey();
  const cancelOperation = useOperationKey();
  const [revision, setRevision] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [history, setHistory] = useState<TeachingLeaveRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [reason, setReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const loader = useCallback(
    () => listLearnerTeachingSessions(orgSlug, studentId, page, PAGE_SIZE),
    [orgSlug, page, revision, studentId],
  );
  const sessions = useTeachingPage(loader);
  const selectedSession = sessions.result?.items.find((item) => item.id === selectedSessionId) ?? null;
  const baseHref = `/learn/${orgSlug}/students/${studentId}/sessions`;

  useEffect(() => {
    const items = sessions.result?.items ?? [];
    if (items.length && !items.some((item) => item.id === selectedSessionId)) setSelectedSessionId(items[0]!.id);
  }, [selectedSessionId, sessions.result?.items]);

  useEffect(() => {
    if (!selectedSessionId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    void listLearnerTeachingLeaveRequests(orgSlug, studentId, selectedSessionId).then((result) => {
      if (!cancelled) setHistory(result.items);
    }).catch((error: unknown) => {
      if (!cancelled) setHistoryError(teachingErrorMessage(error, t));
    }).finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgSlug, revision, selectedSessionId, studentId, t]);

  function resetIntent() {
    requestOperation.reset();
    cancelOperation.reset();
    setMessage('');
    setMutationError('');
  }

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSession || !canRequestLeave(selectedSession)) return;
    const canonicalReason = reason.trim();
    if (!canonicalReason || canonicalReason.length > 500) {
      setMutationError(t('请填写 1 至 500 字的请假原因。', 'Enter a leave reason between 1 and 500 characters.'));
      return;
    }
    setSaving(true);
    setMessage('');
    setMutationError('');
    try {
      await createLearnerTeachingLeaveRequest(
        orgSlug,
        studentId,
        selectedSession.id,
        selectedSession.attendance.id,
        { reason: canonicalReason },
        requestOperation.get(`${orgSlug}:${studentId}:${selectedSession.id}:${selectedSession.attendance.id}:${canonicalReason}`),
      );
      requestOperation.reset();
      setReason('');
      setRevision((value) => value + 1);
      setMessage(t('请假申请已提交，请等待教职员审批。', 'The leave request was submitted and is awaiting staff review.'));
    } catch (error) {
      setMutationError(teachingErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  async function cancelLeave(request: TeachingLeaveRequest) {
    if (!selectedSession || request.status !== 'pending') return;
    const canonicalReason = cancelReason.trim();
    if (!canonicalReason || canonicalReason.length > 500) {
      setMutationError(t('请填写 1 至 500 字的取消原因。', 'Enter a cancellation reason between 1 and 500 characters.'));
      return;
    }
    setSaving(true);
    setMessage('');
    setMutationError('');
    try {
      await cancelLearnerTeachingLeaveRequest(
        orgSlug,
        studentId,
        selectedSession.id,
        selectedSession.attendance.id,
        request.id,
        { reason: canonicalReason },
        cancelOperation.get(`${orgSlug}:${studentId}:${selectedSession.id}:${selectedSession.attendance.id}:${request.id}:${canonicalReason}`),
      );
      cancelOperation.reset();
      setCancelReason('');
      setRevision((value) => value + 1);
      setMessage(t('请假申请已取消。', 'The leave request was cancelled.'));
    } catch (error) {
      setMutationError(teachingErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2>{t('课次与请假', 'Sessions and leave')}</h2>
      <p className="teaching-lead">{t('请假需等待教职员批准；已批准的请假不扣课，补课由教职员另行安排。', 'Leave requires staff approval. Approved leave is not charged, and staff arrange any makeup session separately.')}</p>
      {sessions.loading ? <p aria-busy="true">{t('正在加载课次…', 'Loading sessions…')}</p> : sessions.error ? (
        <MutationMessage message={sessions.error} error />
      ) : !sessions.result?.items.length ? (
        <p className="teaching-empty">{t('还没有可查看的课次。', 'No sessions are available yet.')}</p>
      ) : (
        <div className="teaching-list">
          {sessions.result.items.map((session) => (
            <article className="teaching-row" key={session.id}>
              <div className="teaching-row-main">
                <div className="teaching-row-title">{session.title}</div>
                <div className="teaching-row-meta">{new Date(session.startsAt).toLocaleString()} – {new Date(session.endsAt).toLocaleString()} ({session.timezone})</div>
                <div className="teaching-row-meta">{t('出勤：', 'Attendance:')} {attendanceLabel(session.attendance.status, t)}{session.activeLeaveRequest ? ` / ${leaveStatusLabel(session.activeLeaveRequest.status, t)}` : ''}</div>
              </div>
              <button
                type="button"
                className="teaching-secondary-button"
                aria-pressed={selectedSessionId === session.id}
                onClick={() => { setSelectedSessionId(session.id); resetIntent(); }}
              >
                {selectedSessionId === session.id ? t('已选择', 'Selected') : t('查看与申请', 'View and request')}
              </button>
            </article>
          ))}
        </div>
      )}
      {sessions.result && <TeachingPagination page={sessions.result.page} pageSize={sessions.result.pageSize} total={sessions.result.total} baseHref={baseHref} />}

      {selectedSession && (
        <section className="teaching-section">
          <h2>{t(`请假：${selectedSession.title}`, `Leave: ${selectedSession.title}`)}</h2>
          {canRequestLeave(selectedSession) ? (
            <form className="teaching-form" onSubmit={submitLeave}>
              <fieldset className="teaching-plain-fieldset" disabled={saving}>
                <label className="teaching-field-wide">
                  <span>{t('请假原因', 'Leave reason')}</span>
                  <textarea className="teaching-form-control teaching-form-textarea" required maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); resetIntent(); }} />
                </label>
                <div className="teaching-form-actions"><button className="teaching-form-button teaching-primary-button" type="submit">{saving ? t('提交中…', 'Submitting…') : t('提交请假申请', 'Submit leave request')}</button></div>
              </fieldset>
            </form>
          ) : (
            <p className="teaching-help">{selectedSession.activeLeaveRequest
              ? t('该课次已有待审批或已批准的请假申请。', 'This session already has a pending or approved leave request.')
              : t('只能为尚未确认出勤的已排期课次申请请假。', 'Leave can only be requested for a scheduled session whose attendance is still expected.')}</p>
          )}
          {historyLoading ? <p aria-busy="true">{t('正在加载请假记录…', 'Loading leave history…')}</p> : historyError ? (
            <MutationMessage message={historyError} error />
          ) : !history.length ? <p className="teaching-empty">{t('还没有请假记录。', 'No leave history yet.')}</p> : (
            <div className="teaching-list">
              {history.map((request) => (
                <article className="teaching-row" key={request.id}>
                  <div className="teaching-row-main">
                    <div className="teaching-row-title">{leaveStatusLabel(request.status, t)}</div>
                    <p>{request.reason}</p>
                    {request.decisionReason && <p className="teaching-row-meta">{t('处理说明：', 'Decision note:')} {request.decisionReason}</p>}
                    <div className="teaching-row-meta">{new Date(request.createdAt).toLocaleString()}</div>
                  </div>
                  {request.status === 'pending' && (
                    <div className="teaching-row-action">
                      <label>
                        <span>{t('取消原因', 'Cancellation reason')}</span>
                        <input className="teaching-table-control" maxLength={500} value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); resetIntent(); }} />
                      </label>
                      <button className="teaching-secondary-button" type="button" disabled={saving} onClick={() => { void cancelLeave(request); }}>{t('取消申请', 'Cancel request')}</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          <MutationMessage message={mutationError || message} error={!!mutationError} />
        </section>
      )}
    </>
  );
}

function canRequestLeave(session: TeachingLearnerSessionSummary): boolean {
  return session.status === 'scheduled' && session.attendance.status === 'expected' && session.activeLeaveRequest === null;
}

function attendanceLabel(status: TeachingAttendanceStatus, t: ReturnType<typeof useT>): string {
  const labels: Record<TeachingAttendanceStatus, [string, string]> = {
    expected: ['待确认', 'Expected'], present: ['出席', 'Present'], late: ['迟到', 'Late'], absent: ['缺席', 'Absent'], excused: ['已批请假', 'Excused'],
  };
  return t(labels[status][0], labels[status][1]);
}

function leaveStatusLabel(status: TeachingLeaveRequestStatus, t: ReturnType<typeof useT>): string {
  const labels: Record<TeachingLeaveRequestStatus, [string, string]> = {
    pending: ['待审批', 'Pending'], approved: ['已批准', 'Approved'], rejected: ['已驳回', 'Rejected'], cancelled: ['已取消', 'Cancelled'],
  };
  return t(labels[status][0], labels[status][1]);
}
