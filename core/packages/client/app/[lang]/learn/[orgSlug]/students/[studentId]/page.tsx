'use client';

import { useParams } from 'next/navigation';
import AppLink from '@/components/AppLink';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import { useT } from '@/hooks/useT';

export default function LearnerOverviewPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const t = useT();
  const baseHref = `/learn/${params.orgSlug}/students/${params.studentId}`;
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {(_context, isSelf) => (
        <>
          <h2>{t('学习概览', 'Learning overview')}</h2>
          <p className="teaching-lead">{t('周报与课后反馈只展示老师已经发布并授权当前关系查看的内容。', 'Weekly reports and lesson feedback only show published content authorized for the current relationship.')}</p>
          <div className="teaching-tools">
            <AppLink className="teaching-tool-link" href={`${baseHref}/reports`} prefetch={false}><span><strong>{t('每周教学报告', 'Weekly teaching reports')}</strong><br />{t('查看本周总结与下周计划', 'Review weekly summaries and next-week plans')}</span><span aria-hidden="true">→</span></AppLink>
            <AppLink className="teaching-tool-link" href={`${baseHref}/feedback`} prefetch={false}><span><strong>{t('课后反馈', 'Lesson feedback')}</strong><br />{t('查看老师发布的课堂反馈', 'Review published feedback from teachers')}</span><span aria-hidden="true">→</span></AppLink>
            <AppLink className="teaching-tool-link" href={`${baseHref}/messages`} prefetch={false}><span><strong>{t('消息', 'Messages')}</strong><br />{t('与老师查看并继续教学沟通', 'Review and continue teaching conversations with staff')}</span><span aria-hidden="true">→</span></AppLink>
            {isSelf && <AppLink className="teaching-tool-link" href={`/training/${params.orgSlug}`} prefetch={false}><span><strong>{t('训练任务', 'Training assignments')}</strong><br />{t('打开主站训练工具并回传证据', 'Open main-site trainers and submit evidence')}</span><span aria-hidden="true">→</span></AppLink>}
          </div>
        </>
      )}
    </LearnerWorkspace>
  );
}
