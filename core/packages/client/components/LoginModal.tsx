'use client';

// 全站登录 / 账号弹层。未登录:邮箱 / 手机 / WCA 三种方式(方案 A);已登录:账号面板
// (已绑定身份列表 + 绑定新方式 + 解绑 + 登出)。结构镜像 FeedbackModal(自包含 + 本地 t + 背景点击关闭)。
// 由 store 的 loginOpen 控制,全局挂在 app/layout.tsx。

import { useCallback, useEffect, useState } from 'react';
import { X, Mail, Smartphone, Key, Loader2, LogOut, Link2, Unlink, UserRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useAuthStore, applySession } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import {
  sendEmailCode, verifyEmailCode, sendPhoneCode, verifyPhoneCode,
  linkEmailSend, linkEmailVerify, linkPhoneSend, linkPhoneVerify,
  unlinkIdentity, fetchIdentities, type Identity,
} from '@/lib/account-api';
import './login-modal.css';

const ICON = 16;
type Channel = 'email' | 'phone';

/** 邮箱/手机验证码流程(发码 → 输码 → 校验)。login 模式登录;link 模式绑到当前账号。 */
function CodeFlow({ channel, mode, onDone }: { channel: Channel; mode: 'login' | 'link'; onDone: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = channel === 'email' ? t('邮箱', 'Email') : t('手机号', 'Phone');
  const placeholder = channel === 'email' ? 'you@example.com' : t('11 位手机号', '11-digit phone');

  const send = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'link') {
        channel === 'email' ? await linkEmailSend(target) : await linkPhoneSend(target);
      } else {
        channel === 'email' ? await sendEmailCode(target) : await sendPhoneCode(target);
      }
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [channel, mode, target]);

  const verify = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'link') {
        channel === 'email' ? await linkEmailVerify(target, code) : await linkPhoneVerify(target, code);
        onDone();
      } else {
        const r = channel === 'email' ? await verifyEmailCode(target, code) : await verifyPhoneCode(target, code);
        applySession(r.token, r.user);
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [channel, mode, target, code, onDone]);

  return (
    <div className="lm-flow">
      {step === 'input' ? (
        <>
          <label className="lm-label">{label}</label>
          <input
            className="lm-input"
            type={channel === 'email' ? 'email' : 'tel'}
            value={target}
            autoFocus
            placeholder={placeholder}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && target && !busy) void send(); }}
          />
          {error && <p className="lm-error">{error}</p>}
          <button className="lm-primary" disabled={!target || busy} onClick={() => void send()}>
            {busy ? <Loader2 size={ICON} className="lm-spin" /> : null}
            {t('发送验证码', 'Send code')}
          </button>
        </>
      ) : (
        <>
          <label className="lm-label">{t('验证码', 'Verification code')} · {target}</label>
          <input
            className="lm-input lm-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            autoFocus
            placeholder="______"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6 && !busy) void verify(); }}
          />
          {error && <p className="lm-error">{error}</p>}
          <button className="lm-primary" disabled={code.length !== 6 || busy} onClick={() => void verify()}>
            {busy ? <Loader2 size={ICON} className="lm-spin" /> : null}
            {mode === 'link' ? t('绑定', 'Link') : t('登录', 'Sign in')}
          </button>
          <button className="lm-textbtn" onClick={() => { setStep('input'); setCode(''); setError(null); }}>
            {t('改用其它' + label, 'Use another ' + label.toLowerCase())}
          </button>
        </>
      )}
    </div>
  );
}

function LoginTabs({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const loginWithWca = useAuthStore((s) => s.loginWithWca);
  const [method, setMethod] = useState<'email' | 'phone' | 'wca'>('email');

  const tabs: { key: 'email' | 'phone' | 'wca'; icon: React.ReactNode; label: string }[] = [
    { key: 'email', icon: <Mail size={ICON} />, label: t('邮箱', 'Email') },
    { key: 'phone', icon: <Smartphone size={ICON} />, label: t('手机', 'Phone') },
    { key: 'wca', icon: <Key size={ICON} />, label: 'WCA' },
  ];

  return (
    <>
      <h2 className="lm-title">{t('登录 / 注册', 'Sign in / up')}</h2>
      <div className="lm-tabs" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={method === tb.key}
            className={`lm-tab${method === tb.key ? ' is-active' : ''}`}
            onClick={() => setMethod(tb.key)}
          >
            {tb.icon}<span>{tb.label}</span>
          </button>
        ))}
      </div>

      {method === 'email' && <CodeFlow channel="email" mode="login" onDone={onClose} />}
      {method === 'phone' && (
        <>
          <CodeFlow channel="phone" mode="login" onDone={onClose} />
          <p className="lm-hint">{t('目前仅支持中国大陆手机号(+86)。', 'Mainland China (+86) numbers only for now.')}</p>
        </>
      )}
      {method === 'wca' && (
        <div className="lm-flow">
          <p className="lm-hint">{t('用 WCA 账号登录 —— 自动关联你的选手成绩。', 'Sign in with your WCA account — links your competitor results.')}</p>
          <button className="lm-primary" onClick={() => loginWithWca()}>
            <Key size={ICON} /> {t('用 WCA 登录', 'Continue with WCA')}
          </button>
        </div>
      )}
    </>
  );
}

const PROVIDER_LABEL: Record<string, { zh: string; en: string }> = {
  email: { zh: '邮箱', en: 'Email' },
  phone: { zh: '手机', en: 'Phone' },
  wca: { zh: 'WCA', en: 'WCA' },
  apple: { zh: 'Apple', en: 'Apple' },
  google: { zh: 'Google', en: 'Google' },
  wechat: { zh: '微信', en: 'WeChat' },
  alipay: { zh: '支付宝', en: 'Alipay' },
};

function AccountPanel({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const loginWithWca = useAuthStore((s) => s.loginWithWca);
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [linking, setLinking] = useState<'email' | 'phone' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIdentities(await fetchIdentities());
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const hasWca = (identities ?? []).some((i) => i.provider === 'wca');

  const doUnlink = async (provider: string, providerUid: string) => {
    setError(null);
    try {
      await unlinkIdentity(provider, providerUid);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const linkWcaStart = () => {
    // 告诉 callback 页这次是「绑定」而非「登录」。
    try { sessionStorage.setItem('wca_oauth_intent', 'link'); } catch { /* ignore */ }
    loginWithWca();
  };

  return (
    <>
      <h2 className="lm-title">{t('我的账号', 'My account')}</h2>
      <p className="lm-who">{user?.name || (user?.wcaId ? user.wcaId : t('未命名', 'Unnamed'))}</p>
      {user?.wcaId && (
        <AppLink href={`/person/${user.wcaId}`} className="lm-textbtn lm-profile" onClick={onClose}>
          <UserRound size={14} /> {t('我的主页', 'My profile')}
        </AppLink>
      )}

      <div className="lm-idlist">
        {identities === null ? (
          <div className="lm-loading"><Loader2 size={ICON} className="lm-spin" /></div>
        ) : identities.length === 0 ? (
          <p className="lm-hint">{t('暂无已绑定的登录方式。', 'No linked login methods yet.')}</p>
        ) : (
          identities.map((i) => {
            const lab = PROVIDER_LABEL[i.provider] ?? { zh: i.provider, en: i.provider };
            return (
              <div key={`${i.provider}:${i.providerUid}`} className="lm-idrow">
                <span className="lm-idprov">{lang === 'zh' ? lab.zh : lab.en}</span>
                <span className="lm-iduid">{i.providerUid}</span>
                <button
                  type="button"
                  className="lm-unlink"
                  disabled={identities.length <= 1}
                  title={identities.length <= 1 ? t('不能解绑唯一的登录方式', 'Cannot unlink your only method') : t('解绑', 'Unlink')}
                  onClick={() => void doUnlink(i.provider, i.providerUid)}
                >
                  <Unlink size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="lm-error">{error}</p>}

      <div className="lm-linkrow">
        <span className="lm-linktitle">{t('绑定新方式', 'Link a method')}</span>
        <div className="lm-linkbtns">
          <button type="button" className="lm-chip" onClick={() => setLinking(linking === 'email' ? null : 'email')}>
            <Mail size={14} /> {t('邮箱', 'Email')}
          </button>
          <button type="button" className="lm-chip" onClick={() => setLinking(linking === 'phone' ? null : 'phone')}>
            <Smartphone size={14} /> {t('手机', 'Phone')}
          </button>
          {!hasWca && (
            <button type="button" className="lm-chip" onClick={linkWcaStart}>
              <Link2 size={14} /> WCA
            </button>
          )}
        </div>
      </div>

      {linking && (
        <CodeFlow channel={linking} mode="link" onDone={() => { setLinking(null); void reload(); }} />
      )}

      <button className="lm-textbtn lm-logout" onClick={() => { logout(); onClose(); }}>
        <LogOut size={14} /> {t('退出登录', 'Sign out')}
      </button>
    </>
  );
}

export default function LoginModal() {
  const open = useAuthStore((s) => s.loginOpen);
  const close = useAuthStore((s) => s.closeLogin);
  const user = useAuthStore((s) => s.user);
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="lm-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="lm-modal">
        <button className="lm-close" onClick={close} aria-label={t('关闭', 'Close')}>
          <X size={ICON} />
        </button>
        {user ? <AccountPanel onClose={close} /> : <LoginTabs onClose={close} />}
      </div>
    </div>
  );
}
