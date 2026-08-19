'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, useAuthUser } from '@/lib/auth-store';
import {
  consumeTeachingGuardianAccountBinding,
  consumeTeachingStudentAccountBinding,
  previewTeachingGuardianAccountBinding,
  previewTeachingStudentAccountBinding,
} from '@/lib/teaching-saas-api';
import { MutationMessage, teachingErrorMessage } from './TeachingUi';

interface Props {
  kind: 'student' | 'guardian';
}

interface BindingPreview {
  organizationName: string;
  studentDisplayName: string;
  relationship?: string;
  expiresAt: string;
}

interface BindingResult {
  organizationName: string;
  studentDisplayName: string;
  relationship?: string;
}

export default function TeachingAccountBindingPage({ kind }: Props) {
  const t = useT();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<BindingPreview | null>(null);
  const [result, setResult] = useState<BindingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isGuardian = kind === 'guardian';

  useEffect(() => {
    setMounted(true);
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  }, []);

  useEffect(() => {
    if (!mounted || !user || !getSessionToken() || !token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const request = isGuardian
      ? previewTeachingGuardianAccountBinding(token)
      : previewTeachingStudentAccountBinding(token);
    void request.then((value) => {
      if (!cancelled) setPreview(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isGuardian, mounted, t, token, user]);

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      if (isGuardian) {
        const value = await consumeTeachingGuardianAccountBinding(token);
        setResult({
          organizationName: value.guardian.organizationName,
          studentDisplayName: value.guardian.studentDisplayName,
          relationship: value.guardian.relationship,
        });
      } else {
        const value = await consumeTeachingStudentAccountBinding(token);
        setResult({
          organizationName: value.student.organizationName,
          studentDisplayName: value.student.displayName,
        });
      }
      setPreview(null);
      setToken('');
      // allow-raw-history: this one-time secret lives in the fragment and must be removed without navigating.
      // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
      window.history.replaceState(null, '', window.location.pathname);
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setLoading(false);
    }
  }

  const title = isGuardian
    ? t('绑定监护人关系', 'Link guardian relationship')
    : t('绑定学员档案', 'Link student profile');

  if (!mounted) return <main className="teaching-page teaching-centered" aria-busy="true" />;
  if (!user || !getSessionToken()) {
    const returnPath = window.location.pathname + window.location.hash;
    return (
      <main className="teaching-page teaching-centered">
        <h1>{title}</h1>
        <p>{isGuardian
          ? t('请先登录监护人自己的主站账号，再回来确认绑定。', 'Sign in with the guardian’s own main-site account before confirming the link.')
          : t('请先登录学员自己的主站账号，再回来确认绑定。', 'Sign in with the learner’s own main-site account before confirming the link.')}</p>
        <AppLink className="teaching-primary-link" href={`/account#next=${encodeURIComponent(returnPath)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }

  return (
    <main className="teaching-page teaching-centered">
      <h1>{title}</h1>
      {!token && !result && <p className="teaching-empty">{t('这个绑定链接无效或已被清除，请向老师获取新链接。', 'This binding link is missing or has been cleared. Ask the teacher for a new one.')}</p>}
      {loading && <p aria-busy="true">{t('正在核对邀请…', 'Checking invitation…')}</p>}
      {preview && !result && (
        <section className="teaching-section">
          <h2>{preview.studentDisplayName}</h2>
          <p className="teaching-lead">{preview.organizationName}</p>
          {preview.relationship && <p>{t(`关系：${preview.relationship}`, `Relationship: ${preview.relationship}`)}</p>}
          <p>{t(`邀请有效至 ${new Date(preview.expiresAt).toLocaleString()}。确认后可在学习中心查看获准公开的教学内容。`, `The invitation expires at ${new Date(preview.expiresAt).toLocaleString()}. After confirmation, approved teaching content appears in the learning center.`)}</p>
          <button className="teaching-primary-button" type="button" disabled={loading} onClick={confirm}>{t('确认绑定', 'Confirm link')}</button>
        </section>
      )}
      {result && (
        <section className="teaching-section">
          <h2>{t('绑定成功', 'Link complete')}</h2>
          <p>{result.organizationName}: {result.studentDisplayName}</p>
          {result.relationship && <p>{t(`关系：${result.relationship}`, `Relationship: ${result.relationship}`)}</p>}
          <AppLink className="teaching-primary-link" href="/learn" prefetch={false}>{t('打开学习中心', 'Open learning center')}</AppLink>
        </section>
      )}
      <MutationMessage message={error} error />
    </main>
  );
}
