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
      <p>{t('口述稿与备稿资料', 'Spoken answers and preparation notes')}</p>
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
          <blockquote>{item.answer.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</blockquote>
          <details className="interview-note">
            <summary>{t('备稿备注', 'Preparation notes')}</summary>
            <p>{item.confirm}</p>
            <p className="interview-example">{item.example}</p>
            {item.sourceIds && <ul>{draft.research?.sources.filter(source => item.sourceIds?.includes(source.id)).map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>}
          </details>
        </section>)}
        <section className="interview-question">
          <details>
            <summary>{t('尚待确认的个人信息', 'Personal details still to confirm')}</summary>
            <ul>{draft.pending.map(item => <li key={item}>{item}</li>)}</ul>
          </details>
        </section>
        {draft.research && <section className="interview-question">
          <details>
            <summary>{t('调研资料与出处', 'Research and sources')}</summary>
            <p>{t('查阅日期：', 'Reviewed: ')}{draft.research.checkedAt}</p>
            <p>{draft.research.summary}</p>
            <ol>{draft.research.sources.map(source => <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <p>{source.note}</p>
            </li>)}</ol>
          </details>
        </section>}
      </div>}
  </main>;
}
