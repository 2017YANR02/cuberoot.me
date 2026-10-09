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
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  function blockedMessage(response: Response) {
    const seconds = Number(response.headers.get('retry-after'));
    if (Number.isFinite(seconds) && seconds > 0) {
      const minutes = Math.ceil(seconds / 60);
      return t(`当前网络 IP 被临时限制，验证码也暂时不可用。请约 ${minutes} 分钟后重试。`, `This network IP is temporarily blocked, including verification. Try again in about ${minutes} minutes.`);
    }
    return t('当前网络 IP 被临时限制，验证码也暂时不可用。请稍后重试或联系站点管理员。', 'This network IP is temporarily blocked, including verification. Try again later or contact the site administrator.');
  }
  async function refresh() {
    setBusy(true); setError(''); setChallenge(null); setAnswer(''); setNeedsRefresh(false);
    try {
      // Old links and tabs can still land here after the operator reopens access.
      // Use the same access decision as protected data before requesting an image.
      const check = await fetch(apiUrl('/v1/competition-access/check'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (check.ok) {
        setVerificationRequired(false);
        window.location.replace(safeCompetitionReturn(returnTo));
        return;
      }
      if (check.status !== 403) throw new Error(t('暂时无法确认访问状态，请重试。', 'Could not check access. Please retry.'));
      setVerificationRequired(true);
      const response = await fetch(apiUrl('/v1/competition-access/challenge'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (response.status === 403) throw new Error(blockedMessage(response));
      if (!response.ok) throw new Error(response.status === 429 ? t('操作太频繁，请一分钟后重试。', 'Too many attempts. Try again in one minute.') : t('验证码暂时无法加载，请重试。', 'Could not load the image. Please retry.'));
      setChallenge(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : t('加载失败，请重试。', 'Loading failed. Please retry.')); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []); // Check access first; never automatically submit a challenge.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge || busy || needsRefresh) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(apiUrl('/v1/competition-access/verify'), {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: challenge.id, answer, embedded: window.parent !== window }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        if (response.status === 429) throw new Error(t('操作太频繁，请一分钟后重试。', 'Too many attempts. Try again in one minute.'));
        if (failure?.code === 'captcha_incorrect') {
          const remaining = failure.attemptsRemaining;
          throw new Error(remaining === 1 || remaining === 2
            ? t(`验证码输入错误，还可尝试 ${remaining} 次。请核对图片，字母不区分大小写。`, `Incorrect code. ${remaining} attempts remaining. Check the image; letters are case-insensitive.`)
            : t('验证码输入错误，请核对图片后重试，字母不区分大小写。', 'Incorrect code. Check the image and retry; letters are case-insensitive.'));
        }
        if (['captcha_expired', 'captcha_invalid', 'captcha_browser_changed', 'captcha_attempts_exhausted', 'invalid_challenge'].includes(failure?.code)) {
          setNeedsRefresh(true);
          if (failure.code === 'captcha_expired') throw new Error(t('验证码已过期（有效期 2 分钟），请点击「换一张」后重新输入。', 'This code has expired (valid for 2 minutes). Select New image and enter the new code.'));
          if (failure.code === 'captcha_attempts_exhausted') throw new Error(t('这张验证码已输错 3 次，请点击「换一张」后重新输入。', 'This code was entered incorrectly 3 times. Select New image and enter the new code.'));
          if (failure.code === 'captcha_browser_changed') throw new Error(t('网络或浏览器环境已变化，请点击「换一张」后重新输入。', 'Your network or browser has changed. Select New image and enter the new code.'));
          throw new Error(t('这张验证码已失效，请点击「换一张」后重新输入。', 'This code is no longer valid. Select New image and enter the new code.'));
        }
        // Compatibility while an older API instance is still serving requests.
        if (failure?.code === 'captcha_incorrect_or_expired') throw new Error(t('验证码错误或已过期，请重试或换一张。', 'Incorrect or expired code. Try again or get a new image.'));
        if (failure?.code === 'invalid_origin') throw new Error(t('当前访问地址未获验证服务允许，请检查开发代理配置。', 'The verification service rejected this site address. Check the development proxy configuration.'));
        if (response.status === 403) throw new Error(blockedMessage(response));
        throw new Error(t('验证服务暂时不可用，请稍后重试。', 'Verification is temporarily unavailable. Please try again later.'));
      }
      // Successful verification consumes the challenge even if storage fails.
      setNeedsRefresh(true);
      const check = await fetch(apiUrl('/v1/competition-access/check'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!check.ok) throw new Error(t('浏览器未保存验证凭证，请允许本站 Cookie 后重试。', 'The browser did not save verification. Allow site cookies and retry.'));
      window.location.replace(safeCompetitionReturn(returnTo));
    } catch (e) { setError(e instanceof Error ? e.message : t('验证失败，请重试。', 'Verification failed. Please retry.')); setBusy(false); }
  }
  return <main className="competition-verification">
    <header><span>CubeRoot</span><HeaderToggles /></header>
    <section data-site-surface="panel">
      {!verificationRequired ? <>
        <h1>{t('正在确认访问状态…', 'Checking access…')}</h1>
        <p role="status">{error || t('请稍候，正在返回原页面。', 'Please wait while we return to your page.')}</p>
        {error && <button className="competition-verification-action" type="button" onClick={() => void refresh()} disabled={busy}>{t('重试', 'Retry')}</button>}
      </> : <>
      <h1>{t('输入验证码', 'Enter the image code')}</h1>
      <p>{t('未完成验证时，同一 IP 每分钟请求网站页面或受保护接口超过 10 次，将被封禁 1 小时。', 'Without verification, more than 10 protected page or API requests per minute from one IP will trigger a 1-hour ban.')}</p>
      <form onSubmit={submit}>
        <div className="competition-verification-image">{challenge ? <img src={challenge.image} width="240" height="76" alt={t('六位字符验证码', 'Six-character verification image')} /> : <span>{busy ? t('正在加载…', 'Loading…') : t('图片未加载', 'Image unavailable')}</span>}</div>
        <button className="competition-verification-action" type="button" onClick={() => void refresh()} disabled={busy}>{t('换一张', 'New image')}</button>
        <label htmlFor="competition-code">{t('图片中的字符', 'Characters in the image')}</label>
        <div className="competition-verification-input"><input className="competition-verification-code" id="competition-code" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} required aria-describedby="competition-code-status" />{answer && <ClearButton onClick={() => setAnswer('')} />}</div>
        <p id="competition-code-status" role="status">{error}</p>
        <button className="competition-verification-action competition-verification-submit" type="submit" disabled={busy || !challenge || needsRefresh || answer.trim().length !== 6}>{busy ? t('请稍候…', 'Please wait…') : t('验证并继续', 'Verify and continue')}</button>
      </form>
      <p className="competition-verification-note">{t('验证通过后可访问 7 天。中国大陆 IP 继续豁免。', 'Verification lasts 7 days. Mainland China IP addresses remain exempt.')}</p>
      </>}
    </section>
  </main>;
}
