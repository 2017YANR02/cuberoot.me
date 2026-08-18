'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import { listSelfTeachingTrainingAssignments } from '@/lib/teaching-saas-api';
import { formatTrainingGoal, trainingSourceLabel, trainingToolHref } from '@/lib/teaching-training';
import { entityStatusLabel, MutationMessage, TeachingPagination, useTeachingPage } from '../../org/_components/OrgUi';

const PAGE_SIZE = 25;

export default function LearnerTrainingPage() {
  const params = useParams<{ orgSlug: string; lang: string }>();
  const t = useT();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  useEffect(() => { setMounted(true); }, []);
  const page = Math.max(1, rawPage);
  const loader = useCallback(() => listSelfTeachingTrainingAssignments(params.orgSlug, page, PAGE_SIZE), [page, params.orgSlug]);
  const assignments = useTeachingPage(loader);
  const language = params.lang === 'zh' ? 'zh' : 'en';

  if (!mounted) return <main className="org-page" aria-busy="true" />;
  if (!user || !getSessionToken()) {
    return <main className="org-page org-centered"><h1>{t('我的训练任务', 'My training assignments')}</h1><p>{t('登录后查看老师安排的任务。', 'Sign in to view assignments from your teacher.')}</p><AppLink className="org-primary-link" href={`/account${nextQuery(window.location.pathname)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink></main>;
  }

  return (
    <main className="org-page">
      <header className="org-header"><AppLink className="org-eyebrow" href="/account" prefetch={false}>{t('我的账号', 'My account')}</AppLink><h1>{t('我的训练任务', 'My training assignments')}</h1></header>
      {assignments.loading ? <p aria-busy="true">{t('正在加载任务…', 'Loading assignments…')}</p> : assignments.error ? <MutationMessage message={assignments.error} error /> : !assignments.result?.items.length ? <p className="org-empty">{t('当前没有已发布的训练任务。', 'There are no published training assignments.')}</p> : (
        <div className="org-list">
          {assignments.result.items.map((item) => (
            <section className="org-row" key={item.assignment.id}>
              <div className="org-row-main">
                <div className="org-row-title">{item.assignment.title}</div>
                <div className="org-row-meta">{item.template.name} / {trainingSourceLabel(item.templateVersion.source, language)} / {entityStatusLabel(item.target.latestReviewStatus ?? 'pending', t)}</div>
                <p>{item.assignment.instructions}</p>
                {!!item.goals.length && <div className="org-compact-list">{item.goals.map((goal) => <span key={goal.id}>{formatTrainingGoal(goal, language)}</span>)}</div>}
                <p className="org-help">{t(`已回传 ${item.target.evidenceCount} 条证据`, `${item.target.evidenceCount} evidence records submitted`)}</p>
              </div>
              <AppLink className="org-primary-link" href={trainingToolHref(item.templateVersion.source, params.orgSlug, item.assignment.id)} prefetch={false}>{t('开始训练', 'Start training')}</AppLink>
            </section>
          ))}
        </div>
      )}
      {assignments.result && <TeachingPagination page={assignments.result.page} pageSize={assignments.result.pageSize} total={assignments.result.total} baseHref={`/training/${params.orgSlug}`} />}
    </main>
  );
}
