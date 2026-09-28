'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { authHeaders } from '@/lib/admin-api';
import type { InterviewDraft } from '@/app/api/admin/interview/content';
import '../admin.css';
import './interview.css';

export default function InterviewPage() {
  const t = useT();
  const isAdmin = useIsAdmin();
  const user = useAuthUser();
  const [draft, setDraft] = useState<InterviewDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setDraft(null);
    setFailed(false);
    if (!isAdmin) return;
    const controller = new AbortController();
    // Same-origin private Next endpoint; the server verifies the live account role.
    void fetch('/api/admin/interview', { headers: authHeaders(false), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Access verification failed');
        const data = await response.json() as InterviewDraft;
        if (!controller.signal.aborted) setDraft(data);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [isAdmin, user, attempt]);

  return <main className="admin-hub interview-page">
    <header className="admin-hub__heading">
      <p className="admin-hub__eyebrow">{t('管理员专属', 'Administrators only')}</p>
      <h1>{t('采访准备', 'Interview preparation')}</h1>
      <p>{t('中文问答稿 · 待本人确认', 'Chinese Q&A draft · Awaiting personal confirmation')}</p>
    </header>
    {!isAdmin ? <p role="status">{t('请使用管理员账号登录后查看。', 'Sign in with an administrator account to view this material.')} <AppLink href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink></p>
      : failed ? <p role="alert">{t('未能读取采访稿，请确认管理员登录状态后重试。', 'Unable to load the draft. Check your administrator session and try again.')} <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('重试', 'Retry')}</button></p>
      : !draft ? <p role="status">{t('正在校验权限并读取采访稿…', 'Verifying access and loading the draft…')}</p>
      : <div lang="zh-Hans">
        <section className="interview-intro">
          <p>{draft.source}</p>
          <p><strong>{draft.status}</strong></p>
          <p>{draft.context}</p>
          <p>{draft.schedule}</p>
          <h2>{t('开场自我介绍', 'Opening introduction')}</h2>
          <blockquote>{draft.introduction}</blockquote>
        </section>
        <nav className="interview-toc" aria-label={t('采访问题', 'Interview questions')}>
          {draft.questions.map(item => <a key={item.id} href={`#question-${item.id}`}>{item.id}. {item.topic}</a>)}
        </nav>
        {draft.questions.map(item => <section className="interview-question" id={`question-${item.id}`} key={item.id}>
          <h2>{item.id}. {item.question}</h2>
          <p className="interview-takeaway">{item.takeaway}</p>
          <h3>{t('建议回答', 'Suggested answer')}</h3>
          <blockquote>{item.answer}</blockquote>
          <div className="interview-note"><h3>{t('需要确认', 'To confirm')}</h3><p>{item.confirm}</p></div>
          <p className="interview-example"><strong>{t('现场例子：', 'Example: ')}</strong>{item.example}</p>
        </section>)}
        <section className="interview-question">
          <h2>{t('定稿前补充', 'Before finalizing')}</h2>
          <ul>{draft.pending.map(item => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>}
  </main>;
}
