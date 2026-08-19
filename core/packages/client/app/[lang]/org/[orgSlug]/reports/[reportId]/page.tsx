'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  TEACHING_WEEKLY_REPORT_VISIBILITIES,
  hasTeachingPermission,
  type TeachingOrganizationRole,
  type TeachingWeeklyReport,
  type TeachingWeeklyReportVisibility,
  type TrainingEvidenceActivity,
  type TrainingEvidenceSource,
  type TrainingTrustLevel,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getTeachingWeeklyReport, publishTeachingWeeklyReport } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  teachingErrorMessage,
  teachingRoleLabel,
  useOperationKey,
} from '../../../_components/OrgUi';

function visibilityLabel(visibility: TeachingWeeklyReportVisibility, t: ReturnType<typeof useT>): string {
  const labels: Record<TeachingWeeklyReportVisibility, [string, string]> = {
    staff_only: ['仅教职员工', 'Staff only'],
    student: ['学员', 'Student'],
    student_and_guardians: ['学员与监护人', 'Student and guardians'],
  };
  return t(labels[visibility][0], labels[visibility][1]);
}

function trainingSourceLabel(source: TrainingEvidenceSource, t: ReturnType<typeof useT>): string {
  const labels: Record<TrainingEvidenceSource, [string, string]> = {
    timer: ['计时器', 'Timer'],
    predict: ['预判训练', 'Prediction trainer'],
    'alg-trainer': ['公式训练', 'Algorithm trainer'],
  };
  return t(labels[source][0], labels[source][1]);
}

function trainingActivityLabel(activity: TrainingEvidenceActivity, t: ReturnType<typeof useT>): string {
  const labels: Record<TrainingEvidenceActivity, [string, string]> = {
    solve: ['还原', 'Solve'],
    prediction: ['预判', 'Prediction'],
    algorithm_attempt: ['公式练习', 'Algorithm attempt'],
  };
  return t(labels[activity][0], labels[activity][1]);
}

function trustLevelLabel(trustLevel: TrainingTrustLevel, t: ReturnType<typeof useT>): string {
  const labels: Record<TrainingTrustLevel, [string, string]> = {
    self_reported: ['自主上报', 'Self-reported'],
    server_recomputed: ['服务端复算', 'Server recomputed'],
    server_challenge_recomputed: ['服务端挑战复算', 'Server challenge recomputed'],
    server_originated: ['服务端生成', 'Server originated'],
  };
  return t(labels[trustLevel][0], labels[trustLevel][1]);
}

function formatDuration(durationMs: string, t: ReturnType<typeof useT>): string {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value < 0) return `${durationMs} ms`;
  const minutes = value / 60_000;
  const displayed = minutes >= 10 ? Math.round(minutes).toString() : minutes.toFixed(1);
  return t(`${displayed} 分钟`, `${displayed} min`);
}

export default function WeeklyReportPage() {
  const params = useParams<{ orgSlug: string; reportId: string }>();
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => (
        <ReportContent
          orgSlug={params.orgSlug}
          reportId={params.reportId}
          role={organization.role}
        />
      )}
    </OrgWorkspace>
  );
}

function ReportContent({ orgSlug, reportId, role }: {
  orgSlug: string;
  reportId: string;
  role: TeachingOrganizationRole;
}) {
  const t = useT();
  const operationKey = useOperationKey();
  const [report, setReport] = useState<TeachingWeeklyReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'report:manage');

  const loadReport = useCallback(async () => {
    try {
      setReport(await getTeachingWeeklyReport(orgSlug, reportId));
      setLoadError('');
    } catch (reason) {
      setLoadError(teachingErrorMessage(reason, t));
    }
  }, [orgSlug, reportId, t]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const teacherSummary = String(data.get('teacherSummary') ?? '').trim();
    const nextWeekPlan = String(data.get('nextWeekPlan') ?? '').trim();
    const rawVisibility = String(data.get('visibility') ?? '');
    if (teacherSummary.length < 1 || teacherSummary.length > 5_000
      || nextWeekPlan.length < 1 || nextWeekPlan.length > 5_000) {
      setMutationError(t('本周总结和下周计划都需填写，且各不超过 5000 字。', 'Complete both fields with no more than 5,000 characters each.'));
      return;
    }
    if (!(TEACHING_WEEKLY_REPORT_VISIBILITIES as readonly string[]).includes(rawVisibility)) {
      setMutationError(t('请选择有效的发布范围。', 'Select a valid publication audience.'));
      return;
    }
    const visibility = rawVisibility as TeachingWeeklyReportVisibility;
    setSubmitting(true);
    setMessage('');
    setMutationError('');
    try {
      const published = await publishTeachingWeeklyReport(
        orgSlug,
        reportId,
        { teacherSummary, nextWeekPlan, visibility },
        operationKey.get(),
      );
      setReport(published);
      operationKey.reset();
      setMessage(t('每周报告已发布。', 'Weekly report published.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <MutationMessage message={loadError} error />;
  if (!report) return <p aria-busy="true">{t('正在加载每周报告…', 'Loading weekly report…')}</p>;

  const { attendance, credits, training, assignments, lessonFeedback } = report.aggregate;

  return (
    <>
      <AppLink href={`/org/${orgSlug}/reports`} prefetch={false}>{t('每周报告列表', 'Weekly report list')}</AppLink>
      <div className="org-heading-row">
        <h2>{report.studentDisplayNameSnapshot}</h2>
        <span className="org-status">{entityStatusLabel(report.status, t)}</span>
      </div>
      <p className="org-lead">{report.weekStart} – {report.weekEnd} / {report.timezoneSnapshot}</p>
      <p className="org-help">{t('本阶段只有机构教职员工可读取报告；发布范围用于固化未来开放给学员或监护人的意图。', 'Only organization staff can read reports in this stage; the publication audience records the intent for future student or guardian access.')}</p>
      <dl className="org-summary">
        <div><dt>{t('版本', 'Revision')}</dt><dd>{report.revision}</dd></div>
        <div><dt>{t('发布范围意图', 'Publication audience intent')}</dt><dd>{visibilityLabel(report.visibility, t)}</dd></div>
        <div><dt>{t('生成人', 'Generated by')}</dt><dd>{report.generatedByDisplayNameSnapshot} / {teachingRoleLabel(report.generatedByRoleSnapshot, t)}</dd></div>
        <div><dt>{t('生成时间', 'Generated at')}</dt><dd>{new Date(report.generatedAt).toLocaleString()}</dd></div>
        {report.publishedByDisplayNameSnapshot && (
          <div><dt>{t('发布人', 'Published by')}</dt><dd>{report.publishedByDisplayNameSnapshot}</dd></div>
        )}
        {report.publishedAt && <div><dt>{t('发布时间', 'Published at')}</dt><dd>{new Date(report.publishedAt).toLocaleString()}</dd></div>}
      </dl>

      <section className="org-section">
        <h2>{t('出勤', 'Attendance')}</h2>
        <div className="org-summary">
          <div><strong>{attendance.sessionCount}</strong><span>{t('相关课次', 'Sessions')}</span></div>
          <div><strong>{attendance.completedSessionCount}</strong><span>{t('已完成课次', 'Completed')}</span></div>
          <div><strong>{attendance.presentCount}</strong><span>{t('出席', 'Present')}</span></div>
          <div><strong>{attendance.lateCount}</strong><span>{t('迟到', 'Late')}</span></div>
          <div><strong>{attendance.absentCount}</strong><span>{t('缺席', 'Absent')}</span></div>
          <div><strong>{attendance.excusedCount}</strong><span>{t('请假', 'Excused')}</span></div>
        </div>
      </section>

      <section className="org-section">
        <h2>{t('课时流水', 'Credit ledger')}</h2>
        <div className="org-summary">
          <div><strong>{credits.ledgerEntryCount}</strong><span>{t('流水条数', 'Ledger entries')}</span></div>
          <div><strong>{credits.consumedCredits}</strong><span>{t('消耗课时', 'Consumed credits')}</span></div>
          <div><strong>{credits.creditedCredits}</strong><span>{t('增加课时', 'Credited credits')}</span></div>
          <div><strong>{credits.netCreditDelta}</strong><span>{t('净变化', 'Net change')}</span></div>
        </div>
      </section>

      <section className="org-section">
        <h2>{t('训练', 'Training')}</h2>
        <div className="org-summary">
          <div><strong>{training.activeDayCount}</strong><span>{t('活跃天数', 'Active days')}</span></div>
          <div><strong>{training.evidenceCount}</strong><span>{t('训练证据', 'Evidence items')}</span></div>
          <div><strong>{training.successCount}</strong><span>{t('成功次数', 'Successes')}</span></div>
          <div><strong>{formatDuration(training.durationMs, t)}</strong><span>{t('训练时长', 'Duration')}</span></div>
        </div>
        {training.dimensions.length > 0 && (
          <div className="org-list">
            {training.dimensions.map((dimension) => (
              <div className="org-row" key={`${dimension.source}:${dimension.activity}:${dimension.trustLevel}`}>
                <div className="org-row-main">
                  <div className="org-row-title">{trainingSourceLabel(dimension.source, t)}</div>
                  <div className="org-row-meta">
                    {trainingActivityLabel(dimension.activity, t)} / {trustLevelLabel(dimension.trustLevel, t)} / {t(`${dimension.evidenceCount} 条证据`, `${dimension.evidenceCount} evidence items`)} / {formatDuration(dimension.durationMs, t)}
                  </div>
                </div>
                <span className="org-status">{t(`${dimension.successCount} 次成功`, `${dimension.successCount} successes`)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="org-section">
        <h2>{t('训练任务', 'Assignments')}</h2>
        {!assignments.assignments.length ? <p className="org-empty">{t('本周没有训练任务。', 'No assignments this week.')}</p> : (
          <div className="org-list">
            {assignments.assignments.map((assignment) => (
              <AppLink
                className="org-row org-row-link"
                href={`/org/${orgSlug}/training/assignments/${assignment.assignmentId}`}
                prefetch={false}
                key={assignment.assignmentId}
              >
                <div className="org-row-main">
                  <div className="org-row-title">{assignment.title}</div>
                  <div className="org-row-meta">{t(`目标 ${assignment.expectedCount} 次，证据 ${assignment.evidenceCount} 条`, `${assignment.expectedCount} expected, ${assignment.evidenceCount} evidence items`)}</div>
                </div>
                <span className="org-status">{entityStatusLabel(assignment.status, t)}</span>
              </AppLink>
            ))}
          </div>
        )}
      </section>

      <section className="org-section">
        <h2>{t('课后反馈', 'Lesson feedback')}</h2>
        {!lessonFeedback.feedback.length ? <p className="org-empty">{t('本周没有课后反馈。', 'No lesson feedback this week.')}</p> : (
          <div className="org-list">
            {lessonFeedback.feedback.map((feedback) => (
              <article className="org-row" key={feedback.feedbackId}>
                <div className="org-row-main">
                  <div className="org-row-title">{feedback.summary}</div>
                  {feedback.strengths && <p><strong>{t('表现：', 'Strengths:')}</strong> {feedback.strengths}</p>}
                  {feedback.challenges && <p><strong>{t('改进：', 'Challenges:')}</strong> {feedback.challenges}</p>}
                  {feedback.nextGoals && <p><strong>{t('目标：', 'Goals:')}</strong> {feedback.nextGoals}</p>}
                  <div className="org-row-meta">{t(`第 ${feedback.revision} 版`, `Revision ${feedback.revision}`)} / {visibilityLabel(feedback.visibility, t)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="org-section">
        <h2>{t('教学总结', 'Teaching summary')}</h2>
        {report.teacherSummary ? <p className="org-rich-text">{report.teacherSummary}</p> : <p className="org-empty">{t('草稿尚未填写本周总结。', 'The draft has no weekly summary yet.')}</p>}
        <h2 className="org-subsection">{t('下周计划', 'Next week plan')}</h2>
        {report.nextWeekPlan ? <p className="org-rich-text">{report.nextWeekPlan}</p> : <p className="org-empty">{t('草稿尚未填写下周计划。', 'The draft has no next-week plan yet.')}</p>}
      </section>

      {canManage && report.status === 'draft' && (
        <section className="org-section">
          <h2>{t('发布报告', 'Publish report')}</h2>
          <form className="org-form" onSubmit={publish} onChange={() => { operationKey.reset(); setMessage(''); }}>
            <fieldset disabled={submitting}>
              <label className="org-field-wide">{t('本周总结', 'Weekly summary')}
                <textarea className="org-form-control org-form-textarea" name="teacherSummary" required minLength={1} maxLength={5_000} defaultValue={report.teacherSummary} />
              </label>
              <label className="org-field-wide">{t('下周计划', 'Next week plan')}
                <textarea className="org-form-control org-form-textarea" name="nextWeekPlan" required minLength={1} maxLength={5_000} defaultValue={report.nextWeekPlan} />
              </label>
              <label>{t('发布范围意图', 'Publication audience intent')}
                <select className="org-form-control" name="visibility" defaultValue={report.visibility}>
                  {TEACHING_WEEKLY_REPORT_VISIBILITIES.map((visibility) => (
                    <option value={visibility} key={visibility}>{visibilityLabel(visibility, t)}</option>
                  ))}
                </select>
                <small className="org-help">{t('本阶段只记录发布意图，尚未新增学员或监护人的报告读取入口。', 'This stage records publication intent only; no student or guardian report reader is added yet.')}</small>
              </label>
              <div className="org-form-actions">
                <button className="org-form-button" type="submit">{submitting ? t('发布中…', 'Publishing…') : t('发布报告', 'Publish report')}</button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <MutationMessage message={mutationError || message} error={!!mutationError} />
    </>
  );
}
