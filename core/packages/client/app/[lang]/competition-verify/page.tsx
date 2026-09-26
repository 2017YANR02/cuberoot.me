'use client';

import { useEffect, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { apiUrl } from '@/lib/api-base';
import { safeCompetitionReturn } from '@/lib/competition-return';
import { useT } from '@/hooks/useT';
import { ClearButton } from '@/components/ClearButton';
import HeaderToggles from '@/components/HeaderToggles';
import './verification.css';

interface Challenge { id: string; image: string }
export default function CompetitionVerifyPage() {
  const t = useT();
  const [returnTo] = useQueryState('returnTo', parseAsString);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setBusy(true); setError(''); setChallenge(null); setAnswer('');
    try {
      const response = await fetch(apiUrl('/v1/competition-access/challenge'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(response.status === 429 ? t('操作太频繁，请一分钟后重试。', 'Too many attempts. Try again in one minute.') : t('验证码暂时无法加载，请重试。', 'Could not load the image. Please retry.'));
      setChallenge(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : t('加载失败，请重试。', 'Loading failed. Please retry.')); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []); // A fresh image on each visit; no automatic submission.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(apiUrl('/v1/competition-access/verify'), {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: challenge.id, answer }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(response.status === 429 ? t('操作太频繁，请一分钟后重试。', 'Too many attempts. Try again in one minute.') : t('验证码错误或已过期，请重试或换一张。', 'Incorrect or expired code. Try again or get a new image.'));
      const check = await fetch(apiUrl('/v1/competition-access/check'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!check.ok) throw new Error(t('浏览器未保存验证凭证，请允许本站 Cookie 后重试。', 'The browser did not save verification. Allow site cookies and retry.'));
      window.location.replace(safeCompetitionReturn(returnTo));
    } catch (e) { setError(e instanceof Error ? e.message : t('验证失败，请重试。', 'Verification failed. Please retry.')); setBusy(false); }
  }
  return <main className="competition-verification">
    <header><span>CubeRoot</span><HeaderToggles /></header>
    <section data-site-surface="panel">
      <h1>{t('输入验证码', 'Enter the image code')}</h1>
      <p>{t('未完成验证时，同一 IP 每分钟请求网站页面或受保护接口超过 10 次，将被封禁 1 小时。', 'Without verification, more than 10 protected page or API requests per minute from one IP will trigger a 1-hour ban.')}</p>
      <form onSubmit={submit}>
        <div className="competition-verification-image">{challenge ? <img src={challenge.image} width="240" height="76" alt={t('六位字符验证码', 'Six-character verification image')} /> : <span>{busy ? t('正在加载…', 'Loading…') : t('图片未加载', 'Image unavailable')}</span>}</div>
        <button className="competition-verification-action" type="button" onClick={() => void refresh()} disabled={busy}>{t('换一张', 'New image')}</button>
        <label htmlFor="competition-code">{t('图片中的字符', 'Characters in the image')}</label>
        <div className="competition-verification-input"><input className="competition-verification-code" id="competition-code" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} required aria-describedby="competition-code-status" />{answer && <ClearButton onClick={() => setAnswer('')} />}</div>
        <p id="competition-code-status" role="status">{error}</p>
        <button className="competition-verification-action competition-verification-submit" type="submit" disabled={busy || !challenge || answer.trim().length !== 6}>{busy ? t('请稍候…', 'Please wait…') : t('验证并继续', 'Verify and continue')}</button>
      </form>
      <p className="competition-verification-note">{t('验证通过后可访问 7 天。中国大陆 IP 继续豁免。', 'Verification lasts 7 days. Mainland China IP addresses remain exempt.')}</p>
    </section>
  </main>;
}
