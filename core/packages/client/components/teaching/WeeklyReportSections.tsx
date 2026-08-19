'use client';

import type {
  TeachingWeeklyReportAggregate,
  TeachingWeeklyReportVisibility,
  TrainingEvidenceActivity,
  TrainingEvidenceSource,
  TrainingTrustLevel,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { entityStatusLabel } from './TeachingUi';

export function teachingVisibilityLabel(visibility: TeachingWeeklyReportVisibility, t: ReturnType<typeof useT>): string {
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

interface Props {
  aggregate: TeachingWeeklyReportAggregate;
  teacherSummary: string;
  nextWeekPlan: string;
  assignmentHref?: (assignmentId: string) => string;
}

export default function WeeklyReportSections({ aggregate, teacherSummary, nextWeekPlan, assignmentHref }: Props) {
  const t = useT();
  const { attendance, credits, training, assignments, lessonFeedback } = aggregate;

  return (
    <>
      <section className="teaching-section">
        <h2>{t('出勤', 'Attendance')}</h2>
        <div className="teaching-summary">
          <div><strong>{attendance.sessionCount}</strong><span>{t('相关课次', 'Sessions')}</span></div>
          <div><strong>{attendance.completedSessionCount}</strong><span>{t('已完成课次', 'Completed')}</span></div>
          <div><strong>{attendance.presentCount}</strong><span>{t('出席', 'Present')}</span></div>
          <div><strong>{attendance.lateCount}</strong><span>{t('迟到', 'Late')}</span></div>
          <div><strong>{attendance.absentCount}</strong><span>{t('缺席', 'Absent')}</span></div>
          <div><strong>{attendance.excusedCount}</strong><span>{t('请假', 'Excused')}</span></div>
        </div>
      </section>

      <section className="teaching-section">
        <h2>{t('课时流水', 'Credit ledger')}</h2>
        <div className="teaching-summary">
          <div><strong>{credits.ledgerEntryCount}</strong><span>{t('流水条数', 'Ledger entries')}</span></div>
          <div><strong>{credits.consumedCredits}</strong><span>{t('消耗课时', 'Consumed credits')}</span></div>
          <div><strong>{credits.creditedCredits}</strong><span>{t('增加课时', 'Credited credits')}</span></div>
          <div><strong>{credits.netCreditDelta}</strong><span>{t('净变化', 'Net change')}</span></div>
        </div>
      </section>

      <section className="teaching-section">
        <h2>{t('训练', 'Training')}</h2>
        <div className="teaching-summary">
          <div><strong>{training.activeDayCount}</strong><span>{t('活跃天数', 'Active days')}</span></div>
          <div><strong>{training.evidenceCount}</strong><span>{t('训练证据', 'Evidence items')}</span></div>
          <div><strong>{training.successCount}</strong><span>{t('成功次数', 'Successes')}</span></div>
          <div><strong>{formatDuration(training.durationMs, t)}</strong><span>{t('训练时长', 'Duration')}</span></div>
        </div>
        {training.dimensions.length > 0 && (
          <div className="teaching-list">
            {training.dimensions.map((dimension) => (
              <div className="teaching-row" key={`${dimension.source}:${dimension.activity}:${dimension.trustLevel}`}>
                <div className="teaching-row-main">
                  <div className="teaching-row-title">{trainingSourceLabel(dimension.source, t)}</div>
                  <div className="teaching-row-meta">
                    {trainingActivityLabel(dimension.activity, t)} / {trustLevelLabel(dimension.trustLevel, t)} / {t(`${dimension.evidenceCount} 条证据`, `${dimension.evidenceCount} evidence items`)} / {formatDuration(dimension.durationMs, t)}
                  </div>
                </div>
                <span className="teaching-status">{t(`${dimension.successCount} 次成功`, `${dimension.successCount} successes`)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="teaching-section">
        <h2>{t('训练任务', 'Assignments')}</h2>
        {!assignments.assignments.length ? <p className="teaching-empty">{t('本周没有训练任务。', 'No assignments this week.')}</p> : (
          <div className="teaching-list">
            {assignments.assignments.map((assignment) => {
              const content = (
                <>
                  <div className="teaching-row-main">
                    <div className="teaching-row-title">{assignment.title}</div>
                    <div className="teaching-row-meta">{t(`目标 ${assignment.expectedCount} 次，证据 ${assignment.evidenceCount} 条`, `${assignment.expectedCount} expected, ${assignment.evidenceCount} evidence items`)}</div>
                  </div>
                  <span className="teaching-status">{entityStatusLabel(assignment.status, t)}</span>
                </>
              );
              return assignmentHref ? (
                <AppLink className="teaching-row teaching-row-link" href={assignmentHref(assignment.assignmentId)} prefetch={false} key={assignment.assignmentId}>{content}</AppLink>
              ) : (
                <article className="teaching-row" key={assignment.assignmentId}>{content}</article>
              );
            })}
          </div>
        )}
      </section>

      <section className="teaching-section">
        <h2>{t('课后反馈', 'Lesson feedback')}</h2>
        {!lessonFeedback.feedback.length ? <p className="teaching-empty">{t('本周没有课后反馈。', 'No lesson feedback this week.')}</p> : (
          <div className="teaching-list">
            {lessonFeedback.feedback.map((feedback) => (
              <article className="teaching-row" key={feedback.feedbackId}>
                <div className="teaching-row-main">
                  <div className="teaching-row-title">{feedback.summary}</div>
                  {feedback.strengths && <p><strong>{t('表现：', 'Strengths:')}</strong> {feedback.strengths}</p>}
                  {feedback.challenges && <p><strong>{t('改进：', 'Challenges:')}</strong> {feedback.challenges}</p>}
                  {feedback.nextGoals && <p><strong>{t('目标：', 'Goals:')}</strong> {feedback.nextGoals}</p>}
                  <div className="teaching-row-meta">{t(`第 ${feedback.revision} 版`, `Revision ${feedback.revision}`)} / {teachingVisibilityLabel(feedback.visibility, t)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="teaching-section">
        <h2>{t('教学总结', 'Teaching summary')}</h2>
        {teacherSummary ? <p className="teaching-rich-text">{teacherSummary}</p> : <p className="teaching-empty">{t('草稿尚未填写本周总结。', 'The draft has no weekly summary yet.')}</p>}
        <h2 className="teaching-subsection">{t('下周计划', 'Next week plan')}</h2>
        {nextWeekPlan ? <p className="teaching-rich-text">{nextWeekPlan}</p> : <p className="teaching-empty">{t('草稿尚未填写下周计划。', 'The draft has no next-week plan yet.')}</p>}
      </section>
    </>
  );
}
