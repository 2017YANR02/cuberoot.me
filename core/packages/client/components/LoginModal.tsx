'use client';

// 全站登录 / 账号弹层。未登录:邮箱 / 手机 / WCA 三种方式(方案 A);已登录:账号面板
// (已绑定身份列表 + 绑定新方式 + 解绑 + 登出)。结构镜像 FeedbackModal(自包含 + 本地 t + 背景点击关闭)。
// 由 store 的 loginOpen 控制,全局挂在 app/layout.tsx。

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Mail, Smartphone, Key, Loader2, LogOut, Link2, UserRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useAuthStore, applySession } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import {
  sendEmailCode, verifyEmailCode, sendPhoneCode, verifyPhoneCode,
  linkEmailSend, linkEmailVerify, linkPhoneSend, linkPhoneVerify,
  unlinkIdentity, fetchIdentities, fetchAuthProviders, loginGoogle, linkGoogle,
  type Identity, type AuthProviders, type SocialProvider,
} from '@/lib/account-api';
import { requestGoogleAssertion } from '@/lib/google-auth';
import { startSocialLogin } from '@/lib/social-auth';
import './login-modal.css';

const ICON = 16;
const CODE_LEN = 6;
type Channel = 'email' | 'phone';

/** Google 官方四色 "G" 标(内嵌 SVG,自包含,不依赖外部图标 CDN)。 */
function GoogleGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18A13.98 13.98 0 0 1 10.94 24c0-1.45.25-2.86.7-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/** 国内三方品牌标(内嵌 simple-icons 单路径 + 品牌色,自包含)。 */
function WechatGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="#07C160">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
    </svg>
  );
}
function QqGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="#1EBAFC">
      <path d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673" />
    </svg>
  );
}
function AlipayGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="#1677FF">
      <path d="M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809" />
    </svg>
  );
}

/** 国内三方 provider 配置(标 + 名 + 登录提示),供 tab / 绑定 chip 共用。 */
const SOCIALS: { key: SocialProvider; Glyph: (p: { size?: number }) => React.ReactNode; name: { zh: string; en: string }; hint: { zh: string; en: string } }[] = [
  { key: 'wechat', Glyph: WechatGlyph, name: { zh: '微信', en: 'WeChat' }, hint: { zh: '用微信扫码登录。', en: 'Sign in by scanning with WeChat.' } },
  { key: 'qq', Glyph: QqGlyph, name: { zh: 'QQ', en: 'QQ' }, hint: { zh: '用 QQ 账号登录。', en: 'Sign in with your QQ account.' } },
  { key: 'alipay', Glyph: AlipayGlyph, name: { zh: '支付宝', en: 'Alipay' }, hint: { zh: '用支付宝账号登录。', en: 'Sign in with your Alipay account.' } },
];

/** 三方登录面板:一句提示 + 一个「用 X 登录」按钮(点了整页跳授权页)。 */
function SocialPane({ provider }: { provider: SocialProvider }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const meta = SOCIALS.find((s) => s.key === provider)!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setError(null);
    setBusy(true);
    try {
      await startSocialLogin(provider, 'login'); // 成功即整页跳转,busy 保持到离开
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setBusy(false);
    }
  };
  const name = t(meta.name.zh, meta.name.en);
  return (
    <div className="lm-flow">
      <p className="lm-hint">{t(meta.hint.zh, meta.hint.en)}</p>
      {error && <p className="lm-error">{error}</p>}
      <button className="lm-primary" disabled={busy} onClick={() => void go()}>
        {busy ? <Loader2 size={ICON} className="lm-spin" /> : <meta.Glyph size={ICON} />}
        {t(`用${name}登录`, `Continue with ${name}`)}
      </button>
    </div>
  );
}

/** Apple 风格分格验证码输入:6 个格子 + 高亮当前格 + 跳动光标。一个透明原生 input 承接
 *  键盘/粘贴/iOS 短信自动填充(autocomplete=one-time-code),格子只做展示、始终左到右填。 */
function CodeCells({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const toEnd = () => { const el = ref.current; if (el) el.setSelectionRange(el.value.length, el.value.length); };
  return (
    <div className="lm-otp" onMouseDown={(e) => { e.preventDefault(); ref.current?.focus(); toEnd(); }}>
      <input
        ref={ref}
        className="lm-otp-native"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={CODE_LEN}
        value={value}
        autoFocus
        disabled={disabled}
        aria-label="verification code"
        onFocus={() => { setFocused(true); toEnd(); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LEN))}
      />
      {Array.from({ length: CODE_LEN }).map((_, i) => {
        const active = focused && (i === value.length || (value.length === CODE_LEN && i === CODE_LEN - 1));
        return (
          <div key={i} className={`lm-otp-cell${active ? ' is-active' : ''}${value[i] ? ' is-filled' : ''}`}>
            {value[i] ? <span>{value[i]}</span> : active ? <span className="lm-otp-caret" /> : null}
          </div>
        );
      })}
    </div>
  );
}

/** 把后端英文错误串 / HTTP 码翻成给用户看的本地化文案;未识别的原样回退。 */
function authErrorText(raw: string, t: (zh: string, en: string) => string): string {
  const m = raw.toLowerCase();
  if (m.includes('too frequent')) return t('操作太频繁,请 60 秒后再试', 'Too many requests — please wait a minute');
  if (m.includes('wrong or expired')) return t('验证码错误或已过期', 'Wrong or expired code');
  if (m.includes('not configured')) return t('该登录方式暂未开放', "This sign-in method isn't available yet");
  if (m.includes('already linked')) return t('该方式已绑定到另一个账号', 'Already linked to another account');
  if (m.includes('invalid email')) return t('邮箱格式不正确', 'Invalid email address');
  if (m.includes('invalid phone')) return t('手机号格式不正确', 'Invalid phone number');
  if (m.includes('invalid input')) return t('输入有误,请检查', 'Invalid input');
  if (m.includes('send failed')) return t('发送失败,请稍后重试', 'Send failed — please try again');
  if (m.includes('popup_closed')) return t('登录窗口已关闭', 'Sign-in window closed');
  if (m.includes('popup_failed_to_open')) return t('无法打开登录窗口,请检查浏览器弹窗拦截', 'Could not open sign-in window — check your popup blocker');
  if (/invalid (wechat|qq|alipay|google) (code|token)/.test(m)) return t('第三方登录失败,请重试', 'Third-party sign-in failed — please try again');
  if (m.includes('http 404') || /http 5\d\d/.test(m)) return t('服务暂时不可用,请稍后重试', 'Service temporarily unavailable — please try again');
  return raw;
}

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
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
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
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setBusy(false);
    }
  }, [channel, mode, target, code, onDone]);

  // 满 6 位自动提交(Apple 风格,免点按钮);验证失败后 code 不变不会重复触发。
  useEffect(() => {
    if (step === 'code' && code.length === CODE_LEN && !busy) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

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
          <CodeCells value={code} onChange={setCode} disabled={busy} />
          {error && <p className="lm-error">{error}</p>}
          <button className="lm-primary" disabled={code.length !== CODE_LEN || busy} onClick={() => void verify()}>
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
  const [method, setMethod] = useState<'email' | 'phone' | 'wca' | 'google' | SocialProvider>('email');
  // 服务端已配置的登录方式:未配的(email/sms env 缺、google 没配 client id)tab 隐藏,现在只亮 WCA;
  // 配好 env 一 reload 即自动亮,不用改代码。拿不到默认全开 email/phone/wca(退化成旧行为),
  // google 拿不到 clientId 没法弹窗,不能乐观开。
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => { void fetchAuthProviders().then(setProviders); }, []);
  const avail = providers ?? { email: true, phone: true, wca: true, googleClientId: null, googleRelayUrl: null, social: { wechat: null, qq: null, alipay: null } };
  const googleOn = !!(avail.googleClientId && avail.googleRelayUrl);
  const [gBusy, setGBusy] = useState(false);
  const [gError, setGError] = useState<string | null>(null);

  type TabKey = 'email' | 'phone' | 'wca' | 'google' | SocialProvider;
  const tabs: { key: TabKey; icon: React.ReactNode; label: string; on: boolean }[] = ([
    { key: 'email', icon: <Mail size={ICON} />, label: t('邮箱', 'Email'), on: avail.email },
    { key: 'phone', icon: <Smartphone size={ICON} />, label: t('手机', 'Phone'), on: avail.phone },
    { key: 'wca', icon: <Key size={ICON} />, label: 'WCA', on: true },
    { key: 'google', icon: <GoogleGlyph size={ICON} />, label: 'Google', on: googleOn },
    ...SOCIALS.map((s) => ({ key: s.key, icon: <s.Glyph size={ICON} />, label: t(s.name.zh, s.name.en), on: !!avail.social[s.key] })),
  ] as { key: TabKey; icon: React.ReactNode; label: string; on: boolean }[]).filter((tb) => tb.on);

  // 当前选中的方式若被隐藏(如默认 email 但未开放),落到第一个可用 tab。
  useEffect(() => {
    if (providers && !tabs.some((tb) => tb.key === method)) setMethod(tabs[0]?.key ?? 'wca');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  const handleGoogleLogin = async () => {
    const { googleClientId: clientId, googleRelayUrl: relayUrl } = avail;
    if (!clientId || !relayUrl) return;
    setGError(null);
    setGBusy(true);
    try {
      const assertion = await requestGoogleAssertion(clientId, relayUrl);
      const r = await loginGoogle(assertion);
      applySession(r.token, r.user);
      onClose();
    } catch (e) {
      setGError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setGBusy(false);
    }
  };

  return (
    <>
      <h2 className="lm-title">{t('登录 / 注册', 'Sign in / up')}</h2>
      {tabs.length > 1 && (
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
      )}

      {method === 'email' && avail.email && <CodeFlow channel="email" mode="login" onDone={onClose} />}
      {method === 'phone' && avail.phone && (
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
      {method === 'google' && googleOn && (
        <div className="lm-flow">
          <p className="lm-hint">{t('用 Google 账号登录。', 'Sign in with your Google account.')}</p>
          {gError && <p className="lm-error">{gError}</p>}
          <button className="lm-primary" disabled={gBusy} onClick={() => void handleGoogleLogin()}>
            {gBusy ? <Loader2 size={ICON} className="lm-spin" /> : <GoogleGlyph size={ICON} />}
            {t('用 Google 登录', 'Continue with Google')}
          </button>
        </div>
      )}
      {SOCIALS.some((s) => s.key === method) && avail.social[method as SocialProvider] && (
        <SocialPane provider={method as SocialProvider} />
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
  qq: { zh: 'QQ', en: 'QQ' },
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
  // 解绑二次确认:先点「解绑」进入待确认态,再点「确定」才真正调用。
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  // 未配置的登录方式不给「绑定」入口(绑定同样会 503)。默认全开 email/phone/wca,退化成旧行为;
  // googleClientId 拿不到没法弹窗,不能乐观开。
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => { void fetchAuthProviders().then(setProviders); }, []);
  const avail = providers ?? { email: true, phone: true, wca: true, googleClientId: null, googleRelayUrl: null, social: { wechat: null, qq: null, alipay: null } };
  const googleOn = !!(avail.googleClientId && avail.googleRelayUrl);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [linkingSocial, setLinkingSocial] = useState<SocialProvider | null>(null);

  const reload = useCallback(async () => {
    setIdentities(await fetchIdentities());
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const hasWca = (identities ?? []).some((i) => i.provider === 'wca');
  const hasGoogle = (identities ?? []).some((i) => i.provider === 'google');
  const boundProviders = new Set((identities ?? []).map((i) => i.provider));
  const availableSocials = SOCIALS.filter((s) => !!avail.social[s.key] && !boundProviders.has(s.key));

  const doUnlink = async (provider: string, providerUid: string) => {
    setError(null);
    setUnlinking(true);
    try {
      await unlinkIdentity(provider, providerUid);
      setConfirmKey(null);
      await reload();
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setUnlinking(false);
    }
  };

  const linkWcaStart = () => {
    // 告诉 callback 页这次是「绑定」而非「登录」。
    try { sessionStorage.setItem('wca_oauth_intent', 'link'); } catch { /* ignore */ }
    loginWithWca();
  };

  const linkGoogleStart = async () => {
    const { googleClientId: clientId, googleRelayUrl: relayUrl } = avail;
    if (!clientId || !relayUrl) return;
    setError(null);
    setLinkingGoogle(true);
    try {
      const assertion = await requestGoogleAssertion(clientId, relayUrl);
      await linkGoogle(assertion);
      await reload();
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setLinkingGoogle(false);
    }
  };

  // 国内三方绑定:整页跳授权页,回来落 callback 完成绑定(回到本页时账号面板重开会刷新列表)。
  const linkSocialStart = async (provider: SocialProvider) => {
    setError(null);
    setLinkingSocial(provider);
    try {
      await startSocialLogin(provider, 'link'); // 成功即整页跳转,状态保持到离开
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setLinkingSocial(null);
    }
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
            const key = `${i.provider}:${i.providerUid}`;
            const onlyOne = identities.length <= 1;
            return (
              <div key={key} className="lm-idrow">
                <span className="lm-idprov">{lang === 'zh' ? lab.zh : lab.en}</span>
                <span className="lm-iduid">{i.providerUid}</span>
                {confirmKey === key ? (
                  <div className="lm-unlink-confirm">
                    <span className="lm-unlink-confirm-text">{t('确定解绑?', 'Unlink?')}</span>
                    <button
                      type="button"
                      className="lm-unlink-yes"
                      disabled={unlinking}
                      onClick={() => void doUnlink(i.provider, i.providerUid)}
                    >
                      {unlinking ? <Loader2 size={12} className="lm-spin" /> : t('确定', 'Yes')}
                    </button>
                    <button
                      type="button"
                      className="lm-unlink-no"
                      disabled={unlinking}
                      onClick={() => setConfirmKey(null)}
                    >
                      {t('取消', 'Cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="lm-unlink"
                    disabled={onlyOne}
                    title={onlyOne ? t('不能解绑唯一的登录方式', 'Cannot unlink your only method') : undefined}
                    onClick={() => setConfirmKey(key)}
                  >
                    {t('解绑', 'Unlink')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && <p className="lm-error">{error}</p>}

      {(avail.email || avail.phone || !hasWca || (googleOn && !hasGoogle) || availableSocials.length > 0) && (
        <div className="lm-linkrow">
          <span className="lm-linktitle">{t('绑定新方式', 'Link a method')}</span>
          <div className="lm-linkbtns">
            {avail.email && (
              <button type="button" className="lm-chip" onClick={() => setLinking(linking === 'email' ? null : 'email')}>
                <Mail size={14} /> {t('邮箱', 'Email')}
              </button>
            )}
            {avail.phone && (
              <button type="button" className="lm-chip" onClick={() => setLinking(linking === 'phone' ? null : 'phone')}>
                <Smartphone size={14} /> {t('手机', 'Phone')}
              </button>
            )}
            {!hasWca && (
              <button type="button" className="lm-chip" onClick={linkWcaStart}>
                <Link2 size={14} /> WCA
              </button>
            )}
            {googleOn && !hasGoogle && (
              <button type="button" className="lm-chip" disabled={linkingGoogle} onClick={() => void linkGoogleStart()}>
                {linkingGoogle ? <Loader2 size={14} className="lm-spin" /> : <GoogleGlyph size={14} />} Google
              </button>
            )}
            {availableSocials.map((s) => (
              <button key={s.key} type="button" className="lm-chip" disabled={linkingSocial === s.key} onClick={() => void linkSocialStart(s.key)}>
                {linkingSocial === s.key ? <Loader2 size={14} className="lm-spin" /> : <s.Glyph size={14} />} {t(s.name.zh, s.name.en)}
              </button>
            ))}
          </div>
        </div>
      )}

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
