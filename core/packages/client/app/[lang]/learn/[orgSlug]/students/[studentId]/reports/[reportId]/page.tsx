'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { TeachingLearnerWeeklyReport } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import { MutationMessage, teachingErrorMessage, teachingRoleLabel } from '@/components/teaching/TeachingUi';
import WeeklyReportSections, { teachingVisibilityLabel } from '@/components/teaching/WeeklyReportSections';
import { useT } from '@/hooks/useT';
import { getLearnerTeachingWeeklyReport } from '@/lib/teaching-saas-api';

export default function LearnerReportDetailPage() {
  const params = useParams<{ orgSlug: string; studentId: string; reportId: string }>();
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {() => <ReportContent orgSlug={params.orgSlug} studentId={params.studentId} reportId={params.reportId} />}
    </LearnerWorkspace>
  );
}

function ReportContent({ orgSlug, studentId, reportId }: { orgSlug: string; studentId: string; reportId: string }) {
  const t = useT();
  const [report, setReport] = useState<TeachingLearnerWeeklyReport | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setReport(await getLearnerTeachingWeeklyReport(orgSlug, studentId, reportId));
      setError('');
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    }
  }, [orgSlug, reportId, studentId, t]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <MutationMessage message={error} error />;
  if (!report?.aggregate) return <p aria-busy="true">{t('正在加载每周报告…', 'Loading weekly report…')}</p>;

  return (
    <>
      <AppLink href={`/learn/${orgSlug}/students/${studentId}/reports`} prefetch={false}>{t('每周报告列表', 'Weekly report list')}</AppLink>
      <div className="teaching-heading-row">
        <h2>{report.weekStart} – {report.weekEnd}</h2>
        <span className="teaching-status">{t('已发布', 'Published')}</span>
      </div>
      <p className="teaching-lead">{report.timezoneSnapshot}</p>
      <dl className="teaching-summary">
        <div><dt>{t('版本', 'Revision')}</dt><dd>{report.revision}</dd></div>
        <div><dt>{t('查看范围', 'Audience')}</dt><dd>{teachingVisibilityLabel(report.visibility, t)}</dd></div>
        <div><dt>{t('发布人', 'Published by')}</dt><dd>{report.publishedByDisplayNameSnapshot} / {teachingRoleLabel(report.publishedByRoleSnapshot, t)}</dd></div>
        <div><dt>{t('发布时间', 'Published at')}</dt><dd>{new Date(report.publishedAt).toLocaleString()}</dd></div>
      </dl>
      <WeeklyReportSections aggregate={report.aggregate} teacherSummary={report.teacherSummary} nextWeekPlan={report.nextWeekPlan} />
    </>
  );
}
