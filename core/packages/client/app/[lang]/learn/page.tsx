'use client';

import { useEffect, useState } from 'react';
import type { TeachingLearningContext } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import { listTeachingLearningContexts } from '@/lib/teaching-saas-api';
import { MutationMessage, teachingErrorMessage } from '@/components/teaching/TeachingUi';

export default function LearningCenterPage() {
  const t = useT();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [contexts, setContexts] = useState<TeachingLearningContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !user || !getSessionToken()) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void listTeachingLearningContexts().then((value) => {
      if (!cancelled) setContexts(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mounted, t, user]);

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

  return (
    <main className="teaching-page">
      <header className="teaching-header">
        <AppLink className="teaching-eyebrow" href="/account" prefetch={false}>{t('我的账号', 'My account')}</AppLink>
        <h1>{t('学习中心', 'Learning center')}</h1>
        <p className="teaching-lead">{t('查看与当前账号关联的学员档案。监护人只能看到明确向监护人发布的内容。', 'View learner profiles linked to this account. Guardians only see content explicitly published to guardians.')}</p>
      </header>
      {loading ? <p aria-busy="true">{t('正在加载学习档案…', 'Loading learning profiles…')}</p> : error ? (
        <MutationMessage message={error} error />
      ) : contexts.length === 0 ? (
        <p className="teaching-empty">{t('当前账号还没有关联的学员档案。', 'No learner profiles are linked to this account yet.')}</p>
      ) : (
        <div className="teaching-list">
          {contexts.map((context) => {
            const isSelf = context.relationships.some((relationship) => relationship.kind === 'student');
            const guardianRelationships = context.relationships
              .filter((relationship) => relationship.kind === 'guardian')
              .map((relationship) => relationship.relationship);
            return (
              <AppLink
                className="teaching-row teaching-row-link"
                href={`/learn/${context.organization.slug}/students/${context.student.id}`}
                prefetch={false}
                key={`${context.organization.slug}:${context.student.id}`}
              >
                <div className="teaching-row-main">
                  <div className="teaching-row-title">{context.student.displayName}</div>
                  <div className="teaching-row-meta">{context.organization.name}</div>
                </div>
                <span className="teaching-status">{[
                  ...(isSelf ? [t('本人', 'Self')] : []),
                  ...guardianRelationships.map((relationship) => t(`监护人：${relationship}`, `Guardian: ${relationship}`)),
                ].join(' / ')}</span>
              </AppLink>
            );
          })}
        </div>
      )}
    </main>
  );
}
