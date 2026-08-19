'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { TeachingLearningContext } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import { listTeachingOrganizationLearningContexts } from '@/lib/teaching-saas-api';
import { teachingErrorMessage } from './TeachingUi';

interface Props {
  orgSlug: string;
  studentId: string;
  children: (context: TeachingLearningContext, isSelf: boolean) => ReactNode;
}

export default function LearnerWorkspace({ orgSlug, studentId, children }: Props) {
  const t = useT();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [context, setContext] = useState<TeachingLearningContext | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !user || !getSessionToken()) return;
    let cancelled = false;
    setContext(null);
    setError('');
    void listTeachingOrganizationLearningContexts(orgSlug).then((contexts) => {
      if (cancelled) return;
      const match = contexts.find((item) => item.student.id === studentId);
      if (match) setContext(match);
      else setError(t('没有找到对应学习档案，或当前账号无权查看。', 'This learning profile was not found or is not available to this account.'));
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [mounted, orgSlug, studentId, t, user]);

  if (!mounted) return <main className="teaching-page" aria-busy="true" />;
  if (!user || !getSessionToken()) {
    return (
      <main className="teaching-page teaching-centered">
        <h1>{t('学习中心', 'Learning center')}</h1>
        <p>{t('登录后查看学员周报、课后反馈和训练任务。', 'Sign in to view weekly reports, lesson feedback, and training assignments.')}</p>
        <AppLink className="teaching-primary-link" href={`/account${nextQuery(window.location.pathname)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }
  if (error) {
    return <main className="teaching-page teaching-centered"><p role="alert">{error}</p><AppLink href="/learn" prefetch={false}>{t('返回学习中心', 'Back to learning center')}</AppLink></main>;
  }
  if (!context) return <main className="teaching-page" aria-busy="true"><p>{t('正在加载学习档案…', 'Loading learning profile…')}</p></main>;

  const isSelf = context.relationships.some((relationship) => relationship.kind === 'student');
  const guardianRelationships = context.relationships
    .filter((relationship) => relationship.kind === 'guardian')
    .map((relationship) => relationship.relationship);
  const relationshipLabel = [
    ...(isSelf ? [t('学员本人', 'Learner')] : []),
    ...guardianRelationships.map((relationship) => t(`监护人：${relationship}`, `Guardian: ${relationship}`)),
  ].join(' / ');
  const baseHref = `/learn/${context.organization.slug}/students/${context.student.id}`;

  return (
    <main className="teaching-page">
      <header className="teaching-header">
        <AppLink className="teaching-eyebrow" href="/learn" prefetch={false}>{t('学习中心', 'Learning center')}</AppLink>
        <div className="teaching-heading-row">
          <h1>{context.student.displayName}</h1>
          <span className="teaching-role">{relationshipLabel}</span>
        </div>
        <p className="teaching-help">{context.organization.name}</p>
      </header>
      <nav className="teaching-nav" aria-label={t('学习档案导航', 'Learning profile navigation')}>
        <AppLink href={baseHref} prefetch={false}>{t('概览', 'Overview')}</AppLink>
        <AppLink href={`${baseHref}/reports`} prefetch={false}>{t('周报', 'Reports')}</AppLink>
        <AppLink href={`${baseHref}/feedback`} prefetch={false}>{t('课后反馈', 'Lesson feedback')}</AppLink>
        {isSelf && <AppLink href={`/training/${context.organization.slug}`} prefetch={false}>{t('训练任务', 'Training assignments')}</AppLink>}
      </nav>
      <div className="teaching-content">{children(context, isSelf)}</div>
    </main>
  );
}
