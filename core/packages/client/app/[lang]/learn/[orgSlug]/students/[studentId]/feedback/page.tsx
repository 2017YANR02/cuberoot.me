'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import LessonFeedbackList from '@/components/teaching/LessonFeedbackList';
import { MutationMessage, TeachingPagination, useTeachingPage } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { listLearnerTeachingLessonFeedback } from '@/lib/teaching-saas-api';

const PAGE_SIZE = 25;

export default function LearnerFeedbackPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {() => <FeedbackContent orgSlug={params.orgSlug} studentId={params.studentId} page={page} />}
    </LearnerWorkspace>
  );
}

function FeedbackContent({ orgSlug, studentId, page }: { orgSlug: string; studentId: string; page: number }) {
  const t = useT();
  const loader = useCallback(
    () => listLearnerTeachingLessonFeedback(orgSlug, studentId, page, PAGE_SIZE),
    [orgSlug, page, studentId],
  );
  const feedback = useTeachingPage(loader);
  const baseHref = `/learn/${orgSlug}/students/${studentId}/feedback`;
  return (
    <>
      <h2>{t('课后反馈', 'Lesson feedback')}</h2>
      <p className="teaching-lead">{t('这里只显示老师已发布并授权当前账号查看的反馈，不包含教职员工内部备注。', 'Only feedback published to this account appears here. Staff-only notes are never included.')}</p>
      {feedback.loading ? <p aria-busy="true">{t('正在加载反馈…', 'Loading feedback…')}</p> : feedback.error ? (
        <MutationMessage message={feedback.error} error />
      ) : <LessonFeedbackList feedback={feedback.result?.items ?? []} />}
      {feedback.result && <TeachingPagination page={feedback.result.page} pageSize={feedback.result.pageSize} total={feedback.result.total} baseHref={baseHref} />}
    </>
  );
}
