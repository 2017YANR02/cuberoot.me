'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import { MutationMessage, TeachingPagination, useTeachingPage } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { listLearnerTeachingWeeklyReports } from '@/lib/teaching-saas-api';

const PAGE_SIZE = 25;

export default function LearnerReportsPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {() => <ReportsContent orgSlug={params.orgSlug} studentId={params.studentId} page={page} />}
    </LearnerWorkspace>
  );
}

function ReportsContent({ orgSlug, studentId, page }: { orgSlug: string; studentId: string; page: number }) {
  const t = useT();
  const loader = useCallback(
    () => listLearnerTeachingWeeklyReports(orgSlug, studentId, page, PAGE_SIZE),
    [orgSlug, page, studentId],
  );
  const reports = useTeachingPage(loader);
  const baseHref = `/learn/${orgSlug}/students/${studentId}/reports`;

  return (
    <>
      <h2>{t('每周教学报告', 'Weekly teaching reports')}</h2>
      <p className="teaching-lead">{t('这里只显示已发布并授权当前账号查看的报告。', 'Only published reports authorized for this account appear here.')}</p>
      {reports.loading ? <p aria-busy="true">{t('正在加载周报…', 'Loading weekly reports…')}</p> : reports.error ? (
        <MutationMessage message={reports.error} error />
      ) : !reports.result?.items.length ? (
        <p className="teaching-empty">{t('还没有可查看的每周报告。', 'No weekly reports are available yet.')}</p>
      ) : (
        <div className="teaching-list">
          {reports.result.items.map((report) => (
            <AppLink className="teaching-row teaching-row-link" href={`${baseHref}/${report.id}`} prefetch={false} key={report.id}>
              <div className="teaching-row-main">
                <div className="teaching-row-title">{report.weekStart} – {report.weekEnd}</div>
                <div className="teaching-row-meta">{t(`第 ${report.revision} 版`, `Revision ${report.revision}`)} / {new Date(report.publishedAt).toLocaleString()}</div>
              </div>
              <span className="teaching-status">{t('已发布', 'Published')}</span>
            </AppLink>
          ))}
        </div>
      )}
      {reports.result && <TeachingPagination page={reports.result.page} pageSize={reports.result.pageSize} total={reports.result.total} baseHref={baseHref} />}
    </>
  );
}
