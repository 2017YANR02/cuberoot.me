'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import {
  consumeTeachingStudentAccountBinding,
  previewTeachingStudentAccountBinding,
} from '@/lib/teaching-saas-api';
import type {
  TeachingStudentAccountBindingConsumed,
  TeachingStudentAccountBindingPreview,
} from '@cuberoot/shared/teaching';
import { MutationMessage, teachingErrorMessage } from '../../org/_components/OrgUi';

export default function StudentAccountBindingPage() {
  const t = useT();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [preview, setPreview] = useState<TeachingStudentAccountBindingPreview | null>(null);
  const [result, setResult] = useState<TeachingStudentAccountBindingConsumed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setToken(hash.get('token') ?? '');
    setOrgSlug(hash.get('org') ?? '');
  }, []);

  useEffect(() => {
    if (!mounted || !user || !getSessionToken() || !token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void previewTeachingStudentAccountBinding(token).then((value) => {
      if (!cancelled) setPreview(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mounted, t, token, user]);

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      const value = await consumeTeachingStudentAccountBinding(token);
      setResult(value);
      setPreview(null);
      setToken('');
      // The fragment carries a one-time secret and nuqs only manages query state; clear it without navigation.
      // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
      window.history.replaceState(null, '', window.location.pathname);
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return <main className="org-page org-centered" aria-busy="true" />;
  if (!user || !getSessionToken()) {
    return (
      <main className="org-page org-centered">
        <h1>{t('绑定学员档案', 'Link student profile')}</h1>
        <p>{t('请先登录学员自己的主站账号，再回来确认绑定。', 'Sign in with the learner’s own main-site account before confirming the link.')}</p>
        <AppLink className="org-primary-link" href={`/account${nextQuery(window.location.pathname + window.location.hash)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }

  return (
    <main className="org-page org-centered">
      <h1>{t('绑定学员档案', 'Link student profile')}</h1>
      {!token && !result && <p className="org-empty">{t('这个绑定链接无效或已被清除，请向老师获取新链接。', 'This binding link is missing or has been cleared. Ask the teacher for a new one.')}</p>}
      {loading && <p aria-busy="true">{t('正在核对邀请…', 'Checking invitation…')}</p>}
      {preview && !result && (
        <section className="org-section">
          <h2>{preview.studentDisplayName}</h2>
          <p className="org-lead">{preview.organizationName}</p>
          <p>{t(`确认后，该机构可把训练任务发送到当前账号。邀请有效至 ${new Date(preview.expiresAt).toLocaleString()}。`, `After confirmation, this organization can send assignments to the current account. The invitation expires at ${new Date(preview.expiresAt).toLocaleString()}.`)}</p>
          <button className="org-primary-button" type="button" disabled={loading} onClick={confirm}>{t('确认绑定', 'Confirm link')}</button>
        </section>
      )}
      {result && (
        <section className="org-section">
          <h2>{t('绑定成功', 'Profile linked')}</h2>
          <p>{result.student.organizationName}: {result.student.displayName}</p>
          {orgSlug && <AppLink className="org-primary-link" href={`/training/${orgSlug}`} prefetch={false}>{t('查看我的训练任务', 'View my training assignments')}</AppLink>}
        </section>
      )}
      <MutationMessage message={error} error />
    </main>
  );
}
