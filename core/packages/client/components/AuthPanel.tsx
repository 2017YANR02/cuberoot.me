'use client';

// 全站认证 UI。**没有任何弹层形态** —— 两块面板都只长在页面里,认证只有 /account 一个地址:
//  1. LoginForm —— 只服务未登录:行业标准布局,邮箱为主凭据(验证码优先,可切密码),下方分隔线
//     + 「用 X 登录」第三方按钮竖排(WCA / Google / 支付宝 / 微信 / QQ)。渲染于 /account。
//  2. AccountPanel —— 已绑定身份 + 绑定新方式 + 设/改密码 + 解绑。同样只渲染于 /account。
// 两者共用同一套表单原语(CodeFlow / 密码表单 / 错误文案),故同处一文件。

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Eye, EyeOff, Mail, Smartphone, KeyRound } from 'lucide-react';
import { SiWechat, SiQq, SiAlipay } from 'react-icons/si';
import { useAuthStore, applySession } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import {
  sendEmailCode, verifyEmailCode, sendPhoneCode, verifyPhoneCode,
  loginPassword, setPassword as apiSetPassword, removePassword,
  linkEmailSend, linkEmailVerify, linkPhoneSend, linkPhoneVerify,
  unlinkIdentity, fetchIdentities, fetchAuthProviders, loginGoogle, linkGoogle, replaceEmailVerify,
  type Identity, type AuthProviders, type SocialProvider,
} from '@/lib/account-api';
import { requestGoogleAssertion } from '@/lib/google-auth';
import { startSocialLogin, isBlockedWebview } from '@/lib/social-auth';
import './auth-panel.css';

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

/** WCA 官方标 — 站内自有 /icons/wca.svg,与首页统计卡、规则页同一份。 */
const WcaGlyph = ({ size = 16 }: { size?: number }) => (
  <img src="/icons/wca.svg" alt="" width={size} height={size} aria-hidden="true" />
);

/** 国内三方品牌标:react-icons/si(simple-icons)按需 import,打进 bundle、不走 CDN。 */
const WechatGlyph = ({ size = 16 }: { size?: number }) => <SiWechat size={size} color="#07C160" aria-hidden="true" />;
const QqGlyph = ({ size = 16 }: { size?: number }) => <SiQq size={size} color="#1EBAFC" aria-hidden="true" />;
const AlipayGlyph = ({ size = 16 }: { size?: number }) => <SiAlipay size={size} color="#1677FF" aria-hidden="true" />;

/** 国内三方 provider 配置(标 + 名),供 SSO 按钮 / 账号绑定 chip 共用。 */
const SOCIALS: { key: SocialProvider; Glyph: (p: { size?: number }) => React.ReactNode; name: { zh: string; en: string } }[] = [
  { key: 'wechat', Glyph: WechatGlyph, name: { zh: '微信', en: 'WeChat' } },
  { key: 'qq', Glyph: QqGlyph, name: { zh: 'QQ', en: 'QQ' } },
  { key: 'alipay', Glyph: AlipayGlyph, name: { zh: '支付宝', en: 'Alipay' } },
];

/**
 * 各登录方式的标:三方用品牌标,邮箱 / 手机 / 密码用 lucide。账号面板的每一行(已绑定、
 * 可绑定、密码)都靠它取标,所以键要和后端 provider 串对齐;认不出的渲染空占位,行不会错位。
 */
const PROVIDER_GLYPH: Record<string, (p: { size?: number }) => React.ReactNode> = {
  wca: WcaGlyph,
  google: GoogleGlyph,
  wechat: WechatGlyph,
  qq: QqGlyph,
  alipay: AlipayGlyph,
  email: ({ size = 16 }) => <Mail size={size} />,
  phone: ({ size = 16 }) => <Smartphone size={size} />,
  password: ({ size = 16 }) => <KeyRound size={size} />,
};

function ProviderGlyph({ provider }: { provider: string }) {
  const G = PROVIDER_GLYPH[provider];
  return <span className="auth-idicon">{G ? <G size={16} /> : null}</span>;
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
    <div className="auth-otp" onMouseDown={(e) => { e.preventDefault(); ref.current?.focus(); toEnd(); }}>
      <input
        ref={ref}
        className="auth-otp-native"
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
          <div key={i} className={`auth-otp-cell${active ? ' is-active' : ''}${value[i] ? ' is-filled' : ''}`}>
            {value[i] ? <span>{value[i]}</span> : active ? <span className="auth-otp-caret" /> : null}
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
  if (m.includes('wrong email or password')) return t('邮箱或密码错误,或该邮箱未设密码', 'Wrong email or password (or no password set)');
  if (m.includes('wrong current password')) return t('当前密码不正确', 'Current password is incorrect');
  if (m.includes('invalid password')) return t('密码至少 8 位', 'Password must be at least 8 characters');
  if (m.includes('not configured')) return t('该登录方式暂未开放', "This sign-in method isn't available yet");
  if (m.includes('account already has an email')) return t('一个账号只能绑定一个邮箱,请先解绑现有邮箱', 'An account can have only one email — unlink the current one first');
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

/**
 * 邮箱/手机验证码流程(发码 → 输码 → 校验)。
 *   login    验证后登录
 *   link     绑到当前账号
 *   replace  换掉当前账号已有的邮箱(仅 email)—— 发码与 link 同一条链路,只有最后落库不同
 */
function CodeFlow({ channel, mode, onDone }: { channel: Channel; mode: 'login' | 'link' | 'replace'; onDone: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = channel === 'email' ? t('邮箱', 'Email') : t('手机号', 'Phone');
  const placeholder = channel === 'email' ? undefined : t('11 位手机号', '11-digit phone');

  const send = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'link' || mode === 'replace') {
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
      if (mode === 'replace') {
        await replaceEmailVerify(target, code);
        onDone();
      } else if (mode === 'link') {
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
    <div className="auth-flow">
      {step === 'input' ? (
        <>
          <label className="auth-label">{label}</label>
          <input
            className="auth-input"
            type={channel === 'email' ? 'email' : 'tel'}
            value={target}
            autoFocus
            placeholder={placeholder}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && target && !busy) void send(); }}
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" disabled={!target || busy} onClick={() => void send()}>
            {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
            {t('发送验证码', 'Send code')}
          </button>
        </>
      ) : (
        <>
          <label className="auth-label">{t('验证码', 'Verification code')} · {target}</label>
          <CodeCells value={code} onChange={setCode} disabled={busy} />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" disabled={code.length !== CODE_LEN || busy} onClick={() => void verify()}>
            {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
            {mode === 'link' ? t('绑定', 'Link') : t('登录', 'Sign in')}
          </button>
          <button className="auth-textbtn" onClick={() => { setStep('input'); setCode(''); setError(null); }}>
            {t('改用其它' + label, 'Use another ' + label.toLowerCase())}
          </button>
        </>
      )}
    </div>
  );
}

/** 密码输入框 + 明文/密文切换眼睛。autoComplete 由调用方指定(登录 current / 设密 new)。 */
function PasswordInput({ value, onChange, placeholder, autoComplete, autoFocus, onEnter }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  autoComplete: 'current-password' | 'new-password'; autoFocus?: boolean; onEnter?: () => void;
}) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [show, setShow] = useState(false);
  return (
    <div className="auth-pwfield">
      <input
        className="auth-input"
        type={show ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      />
      <button
        type="button"
        className="auth-pweye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('隐藏密码', 'Hide password') : t('显示密码', 'Show password')}
      >
        {show ? <EyeOff size={ICON} /> : <Eye size={ICON} />}
      </button>
    </div>
  );
}

/**
 * 邮箱验证码登录(受控 email,发码 → 输码 → 校验)。默认方式,passwordless(Vercel/Notion 风)。
 * reset=true 时是「忘记密码」进来的:同一套验证码,只是验完不关窗,交由上层引导设新密码。
 */
function EmailCodeFlow({ email, setEmail, onDone, toPassword, reset }: {
  email: string; setEmail: (v: string) => void; onDone: () => void; toPassword: () => void; reset?: boolean;
}) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await sendEmailCode(email);
      setStep('code');
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const verify = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await verifyEmailCode(email, code);
      applySession(r.token, r.user);
      onDone();
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, code, onDone]);

  // 满 6 位自动提交;验证失败后 code 不变不会重复触发。
  useEffect(() => {
    if (step === 'code' && code.length === CODE_LEN && !busy) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  if (step === 'code') {
    return (
      <div className="auth-flow">
        <p className="auth-hint">{t(`验证码已发送至 ${email}`, `We sent a code to ${email}`)}</p>
        <CodeCells value={code} onChange={setCode} disabled={busy} />
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-primary" disabled={code.length !== CODE_LEN || busy} onClick={() => void verify()}>
          {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
          {reset ? t('继续', 'Continue') : t('登录', 'Sign in')}
        </button>
        <button className="auth-textbtn" onClick={() => { setStep('input'); setCode(''); setError(null); }}>
          {t('换邮箱 / 重新发送', 'Change email / resend')}
        </button>
      </div>
    );
  }
  return (
    <div className="auth-flow">
      {reset && (
        <p className="auth-hint">
          {t('给你的邮箱发一个验证码,验证后即可设置新密码。', "We'll email you a code — verify it and you can set a new password.")}
        </p>
      )}
      <label className="auth-label">{t('邮箱', 'Email')}</label>
      <input
        className="auth-input"
        type="email"
        value={email}
        autoFocus
        autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && email && !busy) void send(); }}
      />
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={!email || busy} onClick={() => void send()}>
        {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
        {t('发送验证码', 'Send code')}
      </button>
      <button className="auth-textbtn" onClick={toPassword}>
        {reset ? t('返回密码登录', 'Back to password sign-in') : t('用密码登录', 'Sign in with a password')}
      </button>
    </div>
  );
}

/** 邮箱 + 密码登录(受控 email;仅登录已设密码的账号,未设密码走验证码 + 账号面板设密码)。 */
function EmailPasswordFlow({ email, setEmail, onDone, toCode, onForgot }: {
  email: string; setEmail: (v: string) => void; onDone: () => void; toCode: () => void; onForgot: () => void;
}) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await loginPassword(email, pw);
      applySession(r.token, r.user);
      onDone();
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw, onDone]);

  return (
    <div className="auth-flow">
      <label className="auth-label">{t('邮箱', 'Email')}</label>
      <input
        className="auth-input"
        type="email"
        value={email}
        autoFocus
        autoComplete="username"
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="auth-label">{t('密码', 'Password')}</label>
      <PasswordInput
        value={pw}
        onChange={setPw}
        autoComplete="current-password"
        placeholder={t('密码', 'Password')}
        onEnter={() => { if (email && pw && !busy) void submit(); }}
      />
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={!email || !pw || busy} onClick={() => void submit()}>
        {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
        {t('登录', 'Sign in')}
      </button>
      <button className="auth-textbtn" onClick={toCode}>{t('用邮箱验证码登录', 'Email me a code instead')}</button>
      <button className="auth-textbtn" onClick={onForgot}>{t('忘记密码?', 'Forgot your password?')}</button>
    </div>
  );
}

/**
 * 邮箱凭据区:验证码(默认)/ 密码两种方式,email 提升到此以便切换时保留已输入的地址。
 *
 * 忘记密码走 reset:同一套邮箱验证码 —— 验完即登录(会话带 amr=email_code)→ 不关窗,
 * 直接落到「设置新密码」表单(免旧密码,后端认这个 grant)。等价于别家的重置邮件链接,
 * 但不必再发第二种邮件、也不必再造一个 /reset-password 页。
 */
function EmailAuth({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'code' | 'password' | 'reset'>('code');
  const [newPw, setNewPw] = useState(false); // 重置流验证通过,待设新密码

  if (newPw) {
    return (
      <div className="auth-flow">
        <p className="auth-hint">{t('邮箱已验证。设置一个新密码,下次即可用它登录。', 'Email verified. Set a new password to sign in with next time.')}</p>
        <SetPasswordForm needCurrent={false} label={t('新密码', 'New password')} onDone={onDone} />
        <button className="auth-textbtn" onClick={onDone}>{t('跳过', 'Skip')}</button>
      </div>
    );
  }
  if (mode === 'password') {
    return (
      <EmailPasswordFlow
        email={email} setEmail={setEmail} onDone={onDone}
        toCode={() => setMode('code')}
        onForgot={() => setMode('reset')}
      />
    );
  }
  return (
    <EmailCodeFlow
      email={email} setEmail={setEmail}
      reset={mode === 'reset'}
      onDone={() => (mode === 'reset' ? setNewPw(true) : onDone())}
      toPassword={() => setMode('password')}
    />
  );
}

/** 「或」分隔线(两侧发丝线 + 居中文字),分隔主凭据区与第三方登录。 */
function OrDivider() {
  const lang = useLang();
  return <div className="auth-divider"><span>{lang === 'zh' ? '或' : 'or'}</span></div>;
}

/** 第三方「用 X 登录」按钮:整行、图标定位左侧、文字居中(Google/Apple 官方按钮范式)。 */
function SsoButton({ icon, label, busy, onClick }: {
  icon: React.ReactNode; label: string; busy?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" className="auth-sso" disabled={busy} onClick={onClick}>
      <span className="auth-sso-icon">{busy ? <Loader2 size={ICON} className="auth-spin" /> : icon}</span>
      <span className="auth-sso-label">{label}</span>
    </button>
  );
}

/**
 * 设置 / 修改 / 重置密码。needCurrent 决定要不要先验旧密码 —— 与后端同一条规矩:
 * 已有密码要改 → 要旧密码;首次设置、或本次会话刚验过邮箱(忘记密码) → 不要。
 */
function SetPasswordForm({ needCurrent, label, onDone }: {
  needCurrent: boolean; label: string; onDone: () => void;
}) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(async () => {
    setError(null);
    if (next.length < 8) { setError(t('密码至少 8 位', 'Password must be at least 8 characters')); return; }
    if (next !== confirm) { setError(t('两次输入的密码不一致', 'Passwords do not match')); return; }
    setBusy(true);
    try {
      await apiSetPassword(next, needCurrent ? current : undefined);
      setDone(true);
      window.setTimeout(onDone, 800);
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, next, confirm, needCurrent, onDone]);

  if (done) {
    return <div className="auth-flow auth-pwform"><p className="auth-hint">{t('密码已保存。', 'Password saved.')}</p></div>;
  }
  return (
    <div className="auth-flow auth-pwform">
      {needCurrent && (
        <>
          <label className="auth-label">{t('当前密码', 'Current password')}</label>
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </>
      )}
      <label className="auth-label">{label}</label>
      <PasswordInput
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        autoFocus={!needCurrent}
        placeholder={t('至少 8 位', 'At least 8 characters')}
      />
      <label className="auth-label">{t('确认密码', 'Confirm password')}</label>
      <PasswordInput
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        onEnter={() => { if (!busy) void submit(); }}
      />
      {error && <p className="auth-error">{error}</p>}
      <button
        className="auth-primary"
        disabled={busy || !next || !confirm || (needCurrent && !current)}
        onClick={() => void submit()}
      >
        {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
        {t('保存', 'Save')}
      </button>
    </div>
  );
}

/** 移除密码(退回纯验证码登录)。凭据要求与改密一致:无「刚验过邮箱」的 grant 就得输当前密码。 */
function RemovePasswordForm({ needCurrent, onDone, onCancel }: {
  needCurrent: boolean; onDone: () => void; onCancel: () => void;
}) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await removePassword(needCurrent ? current : undefined);
      onDone();
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, needCurrent, onDone]);

  return (
    <div className="auth-flow auth-pwform">
      <p className="auth-hint">{t('移除后仍可用邮箱验证码登录,不会丢失账号。', 'You can still sign in with an emailed code — your account stays.')}</p>
      {needCurrent && (
        <>
          <label className="auth-label">{t('当前密码', 'Current password')}</label>
          <PasswordInput
            value={current} onChange={setCurrent} autoComplete="current-password" autoFocus
            onEnter={() => { if (!busy && current) void submit(); }}
          />
        </>
      )}
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy || (needCurrent && !current)} onClick={() => void submit()}>
        {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
        {t('移除密码', 'Remove password')}
      </button>
      <button className="auth-textbtn" onClick={onCancel}>{t('取消', 'Cancel')}</button>
    </div>
  );
}

/** 登录 / 注册表单。`onDone` 在拿到会话后触发(/account 用它回跳 ?next=)。 */
export function LoginForm({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const loginWithWca = useAuthStore((s) => s.loginWithWca);
  const refresh = useAuthStore((s) => s.refresh);
  // 服务端已配置的登录方式:未配的(email/sms env 缺、google/三方没配)对应入口隐藏,配好 env 一
  // reload 即自动亮。拿不到默认全开 email/phone/wca(退化成旧行为),google/三方拿不到凭据不乐观开。
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => { void fetchAuthProviders().then(setProviders); }, []);
  const avail = providers ?? { email: true, phone: true, wca: true, googleClientId: null, googleRelayUrl: null, social: { wechat: null, qq: null, alipay: null } };
  const googleOn = !!(avail.googleClientId && avail.googleRelayUrl);

  // 主凭据区:邮箱(默认)/ 手机;仅邮箱未开放时落到手机。
  const [credMode, setCredMode] = useState<'email' | 'phone'>('email');
  useEffect(() => {
    if (providers && !avail.email && avail.phone) setCredMode('phone');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  const [gBusy, setGBusy] = useState(false);
  const [gError, setGError] = useState<string | null>(null);
  const handleGoogleLogin = async () => {
    const { googleClientId: clientId, googleRelayUrl: relayUrl } = avail;
    if (!clientId || !relayUrl) return;
    setGError(null);
    setGBusy(true);
    try {
      const assertion = await requestGoogleAssertion(clientId, relayUrl);
      const r = await loginGoogle(assertion);
      applySession(r.token, r.user);
      onDone();
    } catch (e) {
      setGError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setGBusy(false);
    }
  };

  // 国内三方:桌面/扫码整页跳授权页(navigated);手机支付宝唤起 App(页面不卸载 → 提示返回本页,
  // 切回时 refresh 拉回会话)。微信/QQ 内置浏览器直接引导去浏览器。(原 SocialPane 逻辑内联到此。)
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [socialLaunched, setSocialLaunched] = useState<SocialProvider | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  useEffect(() => {
    if (!socialLaunched) return;
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refresh); };
  }, [socialLaunched, refresh]);
  const startSocial = async (p: SocialProvider) => {
    setSocialError(null);
    if (p === 'alipay' && isBlockedWebview()) {
      setSocialError(t('微信 / QQ 内暂不支持支付宝登录,请点右上角「···」在浏览器中打开。', 'Alipay sign-in does not work inside WeChat / QQ — open this page in your browser first.'));
      return;
    }
    setSocialBusy(p);
    try {
      const r = await startSocialLogin(p, 'login');
      if (!r.navigated) { setSocialBusy(null); setSocialLaunched(p); }
    } catch (e) {
      setSocialError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setSocialBusy(null);
    }
  };

  // 手机支付宝唤起 App 后当前页留存:改成「返回本页」提示态,切回时上面的 visibilitychange 会 refresh。
  if (socialLaunched) {
    const meta = SOCIALS.find((s) => s.key === socialLaunched)!;
    const name = t(meta.name.zh, meta.name.en);
    return (
      <>
        <h2 className="auth-title">{t('登录 / 注册', 'Sign in / up')}</h2>
        <div className="auth-flow">
          <p className="auth-hint">{t(`已打开${name},请完成授权后返回本页面。`, `Opened ${name} — finish authorizing there, then return to this page.`)}</p>
          <button className="auth-primary" onClick={() => window.location.reload()}>{t('我已完成授权', 'I have authorized')}</button>
          <button className="auth-textbtn" onClick={() => setSocialLaunched(null)}>{t('返回', 'Back')}</button>
        </div>
      </>
    );
  }

  const activeSocials = SOCIALS.filter((s) => !!avail.social[s.key]);
  const hasCred = avail.email || avail.phone;
  const hasSso = avail.wca || googleOn || activeSocials.length > 0;

  return (
    <>
      <h2 className="auth-title">{t('登录 / 注册', 'Sign in / up')}</h2>

      {credMode === 'email' && avail.email && <EmailAuth onDone={onDone} />}
      {credMode === 'phone' && avail.phone && (
        <>
          <CodeFlow channel="phone" mode="login" onDone={onDone} />
          <p className="auth-hint">{t('目前仅支持中国大陆手机号(+86)。', 'Mainland China (+86) numbers only for now.')}</p>
        </>
      )}
      {avail.email && avail.phone && (
        <button className="auth-textbtn auth-cred-switch" onClick={() => setCredMode((m) => (m === 'email' ? 'phone' : 'email'))}>
          {credMode === 'email' ? t('用手机号登录', 'Use phone number') : t('用邮箱登录', 'Use email')}
        </button>
      )}

      {hasCred && hasSso && <OrDivider />}

      {hasSso && (
        <div className="auth-sso-list">
          {avail.wca && (
            <SsoButton icon={<WcaGlyph size={ICON} />} label={t('用 WCA 登录', 'Continue with WCA')} onClick={() => loginWithWca()} />
          )}
          {googleOn && (
            <SsoButton icon={<GoogleGlyph size={ICON} />} busy={gBusy} label={t('用 Google 登录', 'Continue with Google')} onClick={() => void handleGoogleLogin()} />
          )}
          {activeSocials.map((s) => (
            <SsoButton key={s.key} icon={<s.Glyph size={ICON} />} busy={socialBusy === s.key} label={t(`用${s.name.zh}登录`, `Continue with ${s.name.en}`)} onClick={() => void startSocial(s.key)} />
          ))}
        </div>
      )}
      {(gError || socialError) && <p className="auth-error auth-sso-error">{gError || socialError}</p>}
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

/**
 * 账号面板:已绑定身份 + 绑定新方式 + 解绑 + 设/改密码。只渲染于 /account。
 * 姓名与登出归宿主页头部管(那是页面级信息),这里只管凭据本身。
 */
export function AccountPanel() {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const loginWithWca = useAuthStore((s) => s.loginWithWca);
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  // 本次会话刚用邮箱验证码登录 → 改 / 移除密码免输当前密码(忘了密码的人正是这样进来的)。
  const [canReset, setCanReset] = useState(false);
  const [pwAction, setPwAction] = useState<'set' | 'remove' | null>(null);
  const [linking, setLinking] = useState<'email' | 'phone' | null>(null);
  // 换绑邮箱。与 linking 互斥:同时展开两个验证码表单,用户分不清哪个码填哪儿。
  const [replacingEmail, setReplacingEmail] = useState(false);
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
    const acct = await fetchIdentities();
    setIdentities(acct.identities);
    setHasPassword(acct.hasPassword);
    setCanReset(acct.canResetPassword);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  // 手机支付宝唤起 App 绑定后切回本页时,重拉身份列表(同浏览器完成的绑定即刻反映)。
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  const hasWca = (identities ?? []).some((i) => i.provider === 'wca');
  const hasGoogle = (identities ?? []).some((i) => i.provider === 'google');
  // 密码登录 = 邮箱 + 密码,故仅当账号有邮箱身份时才给密码入口(无邮箱设了也用不上)。
  const hasEmail = (identities ?? []).some((i) => i.provider === 'email');
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

  // 国内三方绑定:桌面/微信扫码整页跳授权页;手机支付宝唤起 App(页面不卸载 → 收起 chip spinner,
  // 切回时上面的 visibilitychange 会 reload 拉到新绑定)。微信/QQ 内置浏览器直接引导去浏览器。
  const linkSocialStart = async (provider: SocialProvider) => {
    setError(null);
    if (provider === 'alipay' && isBlockedWebview()) {
      setError(t('微信 / QQ 内暂不支持支付宝绑定,请在浏览器中打开本页。', 'Alipay linking does not work inside WeChat / QQ — open this page in your browser.'));
      return;
    }
    setLinkingSocial(provider);
    try {
      const r = await startSocialLogin(provider, 'link');
      if (!r.navigated) setLinkingSocial(null); // 唤起了 App,页面还在
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setLinkingSocial(null);
    }
  };

  return (
    <>
      <div className="auth-idlist">
        {identities === null ? (
          <div className="auth-loading"><Loader2 size={ICON} className="auth-spin" /></div>
        ) : identities.length === 0 ? (
          <p className="auth-hint">{t('暂无已绑定的登录方式。', 'No linked login methods yet.')}</p>
        ) : (
          identities.map((i) => {
            const lab = PROVIDER_LABEL[i.provider] ?? { zh: i.provider, en: i.provider };
            const key = `${i.provider}:${i.providerUid}`;
            const onlyOne = identities.length <= 1;
            // WCA ID / 邮箱 / 手机号对用户有意义,展示;三方(Google/支付宝/微信/QQ)的 uid 是不透明数字串,不展示。
            const showUid = i.provider === 'wca' || i.provider === 'email' || i.provider === 'phone';
            return (
              <div key={key} className="auth-idrow">
                <ProviderGlyph provider={i.provider} />
                <span className="auth-idprov">{lang === 'zh' ? lab.zh : lab.en}</span>
                {showUid && <span className="auth-iduid">{i.providerUid}</span>}
                {confirmKey === key ? (
                  <div className="auth-unlink-confirm">
                    <span className="auth-unlink-confirm-text">{t('确定解绑?', 'Unlink?')}</span>
                    <button
                      type="button"
                      className="auth-unlink-yes"
                      disabled={unlinking}
                      onClick={() => void doUnlink(i.provider, i.providerUid)}
                    >
                      {unlinking ? <Loader2 size={12} className="auth-spin" /> : t('确定', 'Yes')}
                    </button>
                    <button
                      type="button"
                      className="auth-unlink-no"
                      disabled={unlinking}
                      onClick={() => setConfirmKey(null)}
                    >
                      {t('取消', 'Cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="auth-idactions">
                    {/* 换邮箱只能走这里:一个账号只能一个邮箱、唯一的登录方式又不许解绑,
                        「先解绑再绑定」对只有邮箱的账号是死路。这个按钮原地换掉那条身份。 */}
                    {i.provider === 'email' && (
                      <button
                        type="button"
                        className="auth-link"
                        onClick={() => { setLinking(null); setReplacingEmail((v) => !v); }}
                      >
                        {t('更换', 'Change')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="auth-unlink"
                      disabled={onlyOne}
                      title={onlyOne ? t('不能解绑唯一的登录方式', 'Cannot unlink your only method') : undefined}
                      onClick={() => setConfirmKey(key)}
                    >
                      {t('解绑', 'Unlink')}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      {replacingEmail && (
        <div className="auth-replace">
          <p className="auth-hint">
            {t('验证新邮箱后,原邮箱立即失效。', 'Once the new address is verified, the old one stops working immediately.')}
          </p>
          <CodeFlow
            channel="email"
            mode="replace"
            onDone={() => { setReplacingEmail(false); void reload(); }}
          />
        </div>
      )}

      {/* 「还能绑什么」在拿到已绑列表前无从谈起:identities 为 null 时 hasEmail/hasWca 全是
          false,会把已绑过的方式先闪一行再撤掉。等加载完再渲染整块。
          一个账号只能绑一个邮箱(0078 偏唯一索引),已有就不给入口 —— 否则和上面「邮箱
          xxx@x 解绑」那行撞脸,看着像重复渲染。手机仍可多绑,故不加同样的判断。 */}
      {identities !== null
        && ((avail.email && !hasEmail) || avail.phone || !hasWca || (googleOn && !hasGoogle) || availableSocials.length > 0) && (
        <div className="auth-linklist">
          {avail.email && !hasEmail && (
            <div className="auth-idrow">
              <ProviderGlyph provider="email" />
              <span className="auth-idprov">{t('邮箱', 'Email')}</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" onClick={() => { setReplacingEmail(false); setLinking(linking === 'email' ? null : 'email'); }}>
                  {t('绑定', 'Link')}
                </button>
              </div>
            </div>
          )}
          {avail.phone && (
            <div className="auth-idrow">
              <ProviderGlyph provider="phone" />
              <span className="auth-idprov">{t('手机', 'Phone')}</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" onClick={() => { setReplacingEmail(false); setLinking(linking === 'phone' ? null : 'phone'); }}>
                  {t('绑定', 'Link')}
                </button>
              </div>
            </div>
          )}
          {!hasWca && (
            <div className="auth-idrow">
              <ProviderGlyph provider="wca" />
              <span className="auth-idprov">WCA</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" onClick={linkWcaStart}>
                  {t('绑定', 'Link')}
                </button>
              </div>
            </div>
          )}
          {googleOn && !hasGoogle && (
            <div className="auth-idrow">
              <ProviderGlyph provider="google" />
              <span className="auth-idprov">Google</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" disabled={linkingGoogle} onClick={() => void linkGoogleStart()}>
                  {linkingGoogle ? <Loader2 size={12} className="auth-spin" /> : t('绑定', 'Link')}
                </button>
              </div>
            </div>
          )}
          {availableSocials.map((s) => (
            <div key={s.key} className="auth-idrow">
              <ProviderGlyph provider={s.key} />
              <span className="auth-idprov">{t(s.name.zh, s.name.en)}</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" disabled={linkingSocial === s.key} onClick={() => void linkSocialStart(s.key)}>
                  {linkingSocial === s.key ? <Loader2 size={12} className="auth-spin" /> : t('绑定', 'Link')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {linking && (
        <CodeFlow channel={linking} mode="link" onDone={() => { setLinking(null); void reload(); }} />
      )}

      {hasEmail && (
        <div className="auth-linklist">
          <div className="auth-idrow">
            <ProviderGlyph provider="password" />
            <span className="auth-idprov">{t('密码', 'Password')}</span>
            <div className="auth-idactions">
              <button
                type="button"
                className="auth-link"
                onClick={() => setPwAction((a) => (a === 'set' ? null : 'set'))}
              >
                {hasPassword ? t('修改', 'Change') : t('设置', 'Set')}
              </button>
              {hasPassword && (
                <button
                  type="button"
                  className="auth-unlink"
                  onClick={() => setPwAction((a) => (a === 'remove' ? null : 'remove'))}
                >
                  {t('移除', 'Remove')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {pwAction === 'set' && (
        <SetPasswordForm
          needCurrent={hasPassword && !canReset}
          label={hasPassword ? t('新密码', 'New password') : t('设置密码', 'Set password')}
          onDone={() => { setPwAction(null); void reload(); }}
        />
      )}
      {pwAction === 'remove' && (
        <RemovePasswordForm
          needCurrent={!canReset}
          onDone={() => { setPwAction(null); void reload(); }}
          onCancel={() => setPwAction(null)}
        />
      )}
    </>
  );
}
