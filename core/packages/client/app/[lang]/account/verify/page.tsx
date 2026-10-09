'use client';

import { useCallback, useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from '@/lib/api-base';
import { getSessionToken, useAuthUser } from '@/lib/auth-store';
import { extractChineseName } from '@/lib/cuber-name-display';
import './verify.css';

type Status = { attemptId: string | null; expiresAt: string | null; canCheck: boolean; sessionChanged: boolean; enabled: boolean; consentVersion: string; status: string; verifiedAt: string | null; idLast4: string | null };
type DeviceWindow = Window & { getMetaInfo?: () => unknown };
let deviceScript: Promise<void> | undefined;
function loadDeviceScript() {
  if ((window as DeviceWindow).getMetaInfo) return Promise.resolve();
  return deviceScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => { script.remove(); deviceScript = undefined; reject(new Error('SDK timeout')); }, 15000);
    script.src = 'https://o.alicdn.com/yd-cloudauth/cloudauth-cdn/jsvm_all.js';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); deviceScript = undefined; reject(new Error('SDK unavailable')); };
    document.head.append(script);
  });
}

export default function FaceVerificationPage() {
  const t = useT();
  useDocumentTitle('实名认证', 'Identity Verification');
  const user = useAuthUser();
  const [status, setStatus] = useState<Status | null>(null);
  const owner = user ? String(user.uid ?? user.wcaId) : '';
  const [nameDraft, setNameDraft] = useState<{ owner: string; value: string } | null>(null);
  // Mainland ID names prefer the WCA local name in either UI language.
  // An explicit edit (including clearing the field) wins over later profile refreshes.
  const suggestedName = user?.wcaId ? (extractChineseName(user.name) ?? user.name).trim() : '';
  const realName = nameDraft?.owner === owner ? nameDraft.value : suggestedName;
  const setRealName = (value: string) => setNameDraft({ owner, value });
  const [idCard, setIdCard] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useCallback(async <T,>(body?: unknown): Promise<T> => {
    const token = getSessionToken();
    if (!token) throw new Error(t('请先登录本人账号。', 'Sign in to your own account first.'));
    const response = await sessionFetch(apiUrl('/v1/auth/face'), {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(22000),
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: string } | null;
      const messages: Record<string, string> = {
        FACE_SESSION_CHANGED: t('这次认证由另一设备或登录会话发起。请回到原浏览器查询，或结束此次认证后在这里重新开始。', 'This attempt started in another device or session. Check in the original browser, or end it and start again here.'),
        FACE_CHECK_TOO_SOON: t('请间隔 5 秒后再查询。', 'Wait five seconds before checking again.'),
        FACE_PENDING: t('已有认证正在进行，请完成刷脸后查询结果。', 'An attempt is in progress. Complete it, then check the result.'),
        FACE_RETRY_SOON: t('上次发起未成功，请间隔 1 分钟后重试。', 'The previous attempt did not start. Wait one minute before retrying.'),
        FACE_DAILY_LIMIT: t('最近 24 小时已发起 50 次认证，请稍后再试。', 'You have started 50 attempts in the past 24 hours. Try again later.'),
        FACE_SITE_LIMIT: t('本站今日认证额度已用完，请稍后再试。', 'The site verification quota has been reached. Try again later.'),
        FACE_PROVIDER_PERMISSION: t('网站实名认证服务授权异常，请联系管理员处理后再试。', 'The site verification service has a permission problem. Contact the administrator before retrying.'),
        FACE_PROVIDER_BALANCE: t('网站实名认证服务暂时停用，请联系管理员。', 'The site verification service is temporarily suspended. Contact the administrator.'),
      };
      if (failure?.error && Object.hasOwn(messages, failure.error)) throw new Error(messages[failure.error]);
      if (response.status === 401 || response.status === 403) throw new Error(t('请重新登录本人账号后认证。', 'Sign in to your own account again.'));
      if (response.status === 429) throw new Error(t('请求过于频繁，请稍后再试。', 'Too many requests. Try again later.'));
      if (response.status === 400) throw new Error(t('请检查姓名、18 位身份证号码与同意选项。', 'Check your name, 18-character identity number and consent.'));
      if (response.status === 409) throw new Error(t('认证状态已更新，请刷新后重试。', 'The verification status changed. Refresh and try again.'));
      throw new Error(t('认证服务暂时不可用，请稍后重试。', 'Verification is temporarily unavailable. Try again later.'));
    }
    return response.json() as Promise<T>;
  }, [t]);
  useEffect(() => {
    setNameDraft(null); setIdCard(''); setConsent(false);
  }, [owner]);
  useEffect(() => {
    let cancelled = false;
    setStatus(null); setError('');
    if (user) void request<Status>().then(s => { if (!cancelled) setStatus(s); }).catch(() => {
      if (!cancelled) setError(t('暂时无法读取认证状态，请刷新重试。', 'Unable to load verification status. Refresh to retry.'));
    });
    return () => { cancelled = true; };
  }, [owner, request, t]);

  const start = async () => {
    if (!consent || !status?.enabled || busy) return;
    setBusy(true); setError('');
    const startingToken = getSessionToken();
    try {
      // The provider's device collection only starts after separate, explicit consent.
      await loadDeviceScript();
      const meta = (window as DeviceWindow).getMetaInfo?.();
      if (!meta) throw new Error(t('无法读取认证设备信息，请刷新重试。', 'Unable to read device information. Refresh to retry.'));
      if (getSessionToken() !== startingToken) throw new Error(t('登录已变更，请重新填写。', 'Your session changed. Enter your details again.'));
      const result = await request<{ certifyUrl: string }>({ action: 'start', realName, idCard, consent: true,
        consentVersion: status.consentVersion, metaInfo: typeof meta === 'string' ? meta : JSON.stringify(meta) });
      setRealName(''); setIdCard('');
      if (getSessionToken() !== startingToken) throw new Error(t('登录已变更，请重新登录后查询。', 'Your session changed. Sign in again before checking.'));
      const url = new URL(result.certifyUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid verification URL');
      window.location.assign(url.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('认证未能发起。', 'Unable to start verification.'));
      if (getSessionToken() === startingToken) {
        try { const current = await request<Status>(); if (getSessionToken() === startingToken) setStatus(current); } catch { /* Keep the original start error. */ }
      }
      setBusy(false);
    }
  };
  const updateAttempt = async (action: 'check' | 'cancel') => {
    if (busy) return;
    const token = getSessionToken();
    setBusy(true); setError('');
    try {
      const next = await request<Status>({ action, ...(action === 'cancel' ? { attemptId: status?.attemptId } : {}) });
      if (getSessionToken() === token) { setStatus(next); if (action === 'cancel') setConsent(false); }
    } catch (e) {
      if (getSessionToken() === token) {
        setError(e instanceof Error ? e.message : t('查询失败，请稍后重试。', 'Unable to check. Try again later.'));
        try { const next = await request<Status>(); if (getSessionToken() === token) setStatus(next); } catch { /* Keep the actionable error. */ }
      }
    } finally { setBusy(false); }
  };
  useEffect(() => {
    if (!status?.expiresAt) return;
    const token = getSessionToken();
    const timer = setTimeout(() => {
      void request<Status>().then(next => { if (getSessionToken() === token) { setStatus(next); setError(''); } }).catch(() => {});
    }, Math.max(1000, new Date(status.expiresAt).getTime() - Date.now() + 1000));
    return () => clearTimeout(timer);
  }, [status?.expiresAt, request]);
  const pending = status?.status === 'pending' || status?.status === 'initializing';
  return <main className="face-verify">
    <header><HomeLink>{t('首页', 'Home')}</HomeLink><h1>{t('实名认证', 'Identity Verification')}</h1></header>
    {!user ? <AppLink href="/account?view=signin&next=%2Faccount%2Fverify">{t('登录后认证', 'Sign in to verify')}</AppLink> : <section data-site-surface="panel" className="face-verify-panel">
      <p>{t('通过阿里云完成姓名、身份证与本人活体核验。目前支持中国大陆居民身份证。', 'Verify your name, identity card and liveness through Alibaba Cloud. Mainland China resident identity cards are supported.')}</p>
      <p>{t('实名认证独立于 WCA 账号绑定，不会修改你的 WCA 身份或公开展示身份证信息。', 'This is separate from linking a WCA account. It does not change your WCA identity or publish your identity details.')}</p>
      {status?.status === 'passed' ? <p role="status">{t('已通过实名认证，证件尾号：', 'Identity verified. ID ending in: ')}{status.idLast4}</p> : pending ? <div>
        <p>{t('认证已发起。完成阿里云刷脸并返回后，点击下方按钮查询结果。认证有效期为 30 分钟；尚未完成时可以稍后查询。', 'An attempt is in progress. After completing verification with Alibaba Cloud, return here and check the result. Attempts expire after 30 minutes; pending results can be checked again before expiry.')}</p>
        {status?.sessionChanged && <p role="status">{t('这次认证由另一设备或登录会话发起。请回原浏览器查询，或结束此次认证后在本机重新开始。', 'This attempt started in another device or session. Check in the original browser, or end it to start again here.')}</p>}
        <button className="face-verify-action" disabled={busy || !status?.enabled || !status.canCheck} onClick={() => void updateAttempt('check')}>{busy ? t('查询中…', 'Checking…') : t('查询认证结果', 'Check result')}</button>
        <p>{t('若已失败或无法继续，可结束此次认证。结束后不会采用该次结果，已用次数不退回。', 'If verification failed or cannot continue, end this attempt. Its result will no longer be accepted and the attempt still counts toward your limit.')}</p>
        <button className="face-verify-action" disabled={busy || !status?.enabled} onClick={() => void updateAttempt('cancel')}>{t('结束此次认证并重新开始', 'End attempt and start again')}</button>
      </div> : status?.enabled ? <form onSubmit={e => { e.preventDefault(); void start(); }}>
        {status.status === 'failed' && <p role="status">{t('上次认证未通过或已结束，请重新发起。', 'The previous attempt failed or was ended. Start a new attempt.')}</p>}
        {status.status === 'expired' && <p role="status">{t('上次认证已过期，请重新发起。', 'The previous attempt expired. Start a new attempt.')}</p>}
        <label>{t('真实姓名', 'Legal name')}<span className="face-verify-input"><input className="face-verify-field" required autoComplete="off" maxLength={60} minLength={2} value={realName} onChange={e => setRealName(e.target.value)} disabled={busy} />{realName && !busy && <ClearButton onClick={() => setRealName('')} />}</span></label>
        <label>{t('身份证号码', 'Identity card number')}<span className="face-verify-input"><input className="face-verify-field" required autoComplete="off" maxLength={18} pattern="[0-9]{17}[0-9xX]" value={idCard} onChange={e => setIdCard(e.target.value)} disabled={busy} />{idCard && !busy && <ClearButton onClick={() => setIdCard('')} />}</span></label>
        <p>{t('你提供的姓名、身份证号码以及认证设备信息将提交阿里云，阿里云将采集人脸并进行实名比对与活体检测。CubeRoot 不保存原始身份证号码、人脸照片或视频，仅保存证件摘要、尾号、同意记录及认证结果；注销账号时删除站内认证记录。每个账号最近 24 小时内最多发起 50 次。', 'Your name, identity number and device information are sent to Alibaba Cloud, which collects your face for identity comparison and liveness detection. CubeRoot stores only an identity digest, last four characters, consent and verification results, not your full ID number, face photos or video. Verification records are deleted when you delete your account. Up to 50 attempts per account in a rolling 24-hour period.')}</p>
        {/* allow-checkbox: independent explicit consent for processing identity and facial data */}
        <label className="face-verify-consent"><input className="face-verify-check" type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />{t('我已阅读并单独同意上述身份与人脸信息处理说明，自愿进行本人实名认证。', 'I have read and separately consent to the identity and facial data processing described above, and choose to verify my own identity.')}</label>
        <button className="face-verify-action" type="submit" disabled={!consent || busy}>{busy ? t('正在发起…', 'Starting…') : t('开始刷脸认证', 'Start face verification')}</button>
      </form> : <p>{status ? t('刷脸认证暂未开放。', 'Face verification is not available yet.') : t('正在读取认证状态…', 'Loading verification status…')}</p>}
      {error && <p role="alert" className="face-verify-error">{error}</p>}
    </section>}
  </main>;
}
