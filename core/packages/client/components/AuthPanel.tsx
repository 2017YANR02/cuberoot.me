'use client';

// 全站认证 UI。**没有任何弹层形态** —— 两块面板都只长在页面里,认证只有 /account 一个地址:
//  1. LoginForm —— 只服务未登录:行业标准布局,邮箱为主凭据(验证码优先,可切密码),下方分隔线
//     + 「用 X 登录」第三方按钮竖排(WCA / Google / 支付宝 / 微信 / QQ)。渲染于 /account。
//  2. AccountPanel —— 已绑定身份 + 绑定新方式 + 设/改密码 + 解绑。同样只渲染于 /account。
// 两者共用同一套表单原语(CodeFlow / 密码表单 / 错误文案),故同处一文件。

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Smartphone, KeyRound, Merge } from 'lucide-react';
import { SiWechat, SiQq, SiAlipay } from 'react-icons/si';
import { primaryHandle } from '@cuberoot/shared/account';
import type { MobileAuthProvider } from '@cuberoot/shared/auth/web-session';
import AppLink from '@/components/AppLink';
import PillToggle from '@/components/PillToggle/PillToggle';
import { PasswordInput } from '@/components/PasswordInput';
import { useAuthStore, applySession } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import {
  sendEmailCode, verifyEmailCode, sendPhoneCode, verifyPhoneCode,
  sendPhonePasswordResetCode, verifyPhonePasswordResetCode,
  loginPassword, setPassword as apiSetPassword, removePassword,
  linkEmailSend, linkEmailVerify, linkPhoneSend, linkPhoneVerify,
  unlinkIdentity, fetchIdentities, fetchAuthProviders, loginGoogle, linkGoogle, replaceEmailVerify, replacePhoneVerify,
  deleteAccount, issueAccountMergeCode, mergeAccount,
  type Identity, type AuthProviders, type SocialProvider,
} from '@/lib/account-api';
import { requestGoogleAssertion } from '@/lib/google-auth';
import { startSocialLogin, isBlockedWebview } from '@/lib/social-auth';
import './auth-panel.css';

const ICON = 16;
const CODE_LEN = 6;
type Channel = 'email' | 'phone';

/**
 * 登录/注册完成时回传给宿主页的信息。isNew 由服务端给(登录与注册合流,只有它知道账号是不是
 * 刚建的),hasWca 说明账号已带 WCA 身份。两者一起决定要不要给新人做「有 WCA ID 吗」的引导:
 * 只对刚注册、且还没绑 WCA 的人问一次。
 */
export interface SignedIn { isNew?: boolean; hasWca?: boolean }
type OnSignedIn = (info?: SignedIn) => void;

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
const DouyinGlyph = ({ size = 16 }: { size?: number }) => (
  <img src="/assets/douyin_logo.svg" alt="" width={size} height={size} aria-hidden="true" />
);

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
  douyin: DouyinGlyph,
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
  if (m.includes('phone not linked to an account')) return t('该手机号未绑定账号', 'No account is linked to this phone number');
  if (m.includes('confirmation does not match')) return t('输入的内容与账号标识不一致', "That doesn't match your account identifier");
  if (m.includes('invalid password')) return t('密码至少 8 位', 'Password must be at least 8 characters');
  if (m.includes('not configured')) return t('该登录方式暂未开放', "This sign-in method isn't available yet");
  if (m.includes('account already has an email')) return t('一个账号只能绑定一个邮箱,请先解绑现有邮箱', 'An account can have only one email — unlink the current one first');
  if (m.includes('account already has a phone')) return t('一个账号只能绑定一个手机号,请先解绑现有手机号', 'An account can have only one phone number — unlink the current one first');
  if (m.includes('already linked')) return t('该方式已绑定到另一个账号', 'Already linked to another account');
  if (m.includes('credential_conflict')) return t('两个账号存在重复登录凭据,请先在其中一个账号解绑同类方式或移除密码', 'The accounts have duplicate sign-in credentials. Unlink the duplicate type or remove one password first');
  if (m.includes('wca_conflict')) return t('两个账号绑定了不同的 WCA ID,不能自动合并', 'The accounts have different WCA IDs and cannot be merged automatically');
  if (m.includes('linked_data')) return t('待合并账号含有需要人工确认归属的数据,请联系管理员', 'The account contains data that needs an administrator to review');
  if (m.includes('data_conflict')) return t('两个账号存在无法自动合并的重复数据,原账号均未改动', 'The accounts contain conflicting data; neither account was changed');
  if (m.includes('already_merged')) return t('其中一个账号已经合并过', 'One of these accounts has already been merged');
  if (m.includes('invalid merge code')) return t('合并码格式不正确', 'Invalid merge code');
  if (m.includes('invalid email')) return t('邮箱格式不正确', 'Invalid email address');
  // 只支持中国大陆号(sms.ts 走的是国内通道)。旧文案「手机号格式不正确」对一个合法的
  // 美国号码是句假话,人家会以为自己填错了。说清楚不支持,并指路还能用的方式。
  if (m.includes('invalid phone')) return t('请输入 11 位中国大陆手机号。国外号码暂不支持,可用邮箱 / WCA / Google 登录', 'Enter an 11-digit mainland China number. Other countries aren’t supported yet — use email, WCA or Google instead');
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
 *   replace  换掉当前账号已有的那条(邮箱 / 手机号)—— 发码与 link 同一条链路,只有最后落库不同
 *   reset    仅手机找回密码;验证码和登录用途隔离,验证后签出 10 分钟重置授权
 */
function CodeFlow({ channel, mode, onDone }: { channel: Channel; mode: 'login' | 'link' | 'replace' | 'reset'; onDone: OnSignedIn }) {
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
      } else if (mode === 'reset') {
        await sendPhonePasswordResetCode(target);
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
        channel === 'email' ? await replaceEmailVerify(target, code) : await replacePhoneVerify(target, code);
        onDone();
      } else if (mode === 'link') {
        channel === 'email' ? await linkEmailVerify(target, code) : await linkPhoneVerify(target, code);
        onDone();
      } else if (mode === 'reset') {
        const r = await verifyPhonePasswordResetCode(target, code);
        applySession(r.token, r.user);
        onDone();
      } else {
        const r = channel === 'email' ? await verifyEmailCode(target, code) : await verifyPhoneCode(target, code);
        applySession(r.token, r.user);
        onDone({ isNew: r.isNew, hasWca: !!r.user.wcaId });
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

  const input = (
    <input
      className="auth-input"
      type={channel === 'email' ? 'email' : 'tel'}
      value={target}
      autoFocus
      placeholder={placeholder}
      onChange={(e) => setTarget(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && target && !busy) void send(); }}
    />
  );

  return (
    <div className="auth-flow">
      {step === 'input' ? (
        <>
          <label className="auth-label">{label}</label>
          {/* 手机号框挂一个 +86 前缀:只支持中国大陆号,这事该在输入前就说,而不是等人填完
              国外号码再回一句错误。前缀纯装饰,不进 target —— normalizePhone 认裸 11 位。 */}
          {channel === 'phone' ? (
            <div className="auth-phonefield">
              <span className="auth-phoneprefix">+86</span>
              {input}
            </div>
          ) : input}
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
            {mode === 'login' ? t('登录', 'Sign in') : mode === 'replace' ? t('更换', 'Change') : mode === 'reset' ? t('继续', 'Continue') : t('绑定', 'Link')}
          </button>
          <button className="auth-textbtn" onClick={() => { setStep('input'); setCode(''); setError(null); }}>
            {t('改用其它' + label, 'Use another ' + label.toLowerCase())}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 邮箱验证码登录(受控 email,发码 → 输码 → 校验)。默认方式,passwordless(Vercel/Notion 风)。
 * reset=true 时是「忘记密码」进来的:同一套验证码,只是验完不关窗,交由上层引导设新密码。
 */
function EmailCodeFlow({ email, setEmail, onDone, toPassword, reset }: {
  email: string; setEmail: (v: string) => void; onDone: OnSignedIn; toPassword: () => void; reset?: boolean;
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
      onDone({ isNew: r.isNew, hasWca: !!r.user.wcaId });
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
// 密码登录只对「已注册且已设密码」的账号成立 → 永远不是新注册,onDone 不带 info。
function EmailPasswordFlow({ email, setEmail, onDone, toCode, onForgot }: {
  email: string; setEmail: (v: string) => void; onDone: OnSignedIn; toCode: () => void; onForgot: () => void;
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
        className="auth-input"
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
function EmailAuth({ onDone }: { onDone: OnSignedIn }) {
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
        <button className="auth-textbtn" onClick={() => onDone()}>{t('跳过', 'Skip')}</button>
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
      onDone={(info) => (mode === 'reset' ? setNewPw(true) : onDone(info))}
      toPassword={() => setMode('password')}
    />
  );
}

/** 手机登录及独立的找回密码用途。普通登录码不能获得重置权限。 */
function PhoneAuth({ onDone }: { onDone: OnSignedIn }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [reset, setReset] = useState(false);
  const [newPw, setNewPw] = useState(false);

  if (newPw) {
    return (
      <div className="auth-flow">
        <p className="auth-hint">{t('手机号已验证。现在可以为账号设置新密码。', 'Phone number verified. You can now set a new account password.')}</p>
        <SetPasswordForm needCurrent={false} label={t('新密码', 'New password')} onDone={onDone} />
      </div>
    );
  }

  return (
    <>
      {reset && <p className="auth-hint">{t('给已绑定的手机号发一个验证码,验证后即可设置新密码。', "We'll text your linked phone number a code — verify it and you can set a new password.")}</p>}
      <CodeFlow key={reset ? 'reset' : 'login'} channel="phone" mode={reset ? 'reset' : 'login'} onDone={reset ? () => setNewPw(true) : onDone} />
      <p className="auth-hint">{t('目前仅支持中国大陆手机号(+86)。', 'Mainland China (+86) numbers only for now.')}</p>
      <button className="auth-textbtn" onClick={() => setReset((value) => !value)}>
        {reset ? t('返回手机号登录', 'Back to phone sign-in') : t('用手机号重置密码', 'Reset password with phone')}
      </button>
    </>
  );
}

/** 「或」分隔线(两侧发丝线 + 居中文字),分隔主凭据区与第三方登录。 */
function OrDivider() {
  const lang = useLang();
  return <div className="auth-divider"><span>{lang === 'zh' ? '或' : 'or'}</span></div>;
}

/** 第三方「用 X 登录」按钮:整行、图标定位左侧、文字居中(Google/Apple 官方按钮范式)。 */
function SsoButton({ icon, label, busy, mobileAuthProvider, onClick }: {
  icon: React.ReactNode;
  label: string;
  busy?: boolean;
  mobileAuthProvider?: MobileAuthProvider;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="auth-sso"
      data-mobile-auth-provider={mobileAuthProvider}
      disabled={busy}
      onClick={onClick}
    >
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
          <PasswordInput className="auth-input" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </>
      )}
      <label className="auth-label">{label}</label>
      <PasswordInput
        className="auth-input"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        autoFocus={!needCurrent}
        placeholder={t('至少 8 位', 'At least 8 characters')}
      />
      <label className="auth-label">{t('确认密码', 'Confirm password')}</label>
      <PasswordInput
        className="auth-input"
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
            className="auth-input"
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

/**
 * 登录 / 注册表单。`onDone(info)` 在拿到会话后触发 —— /account 用它决定去哪:新注册且没绑 WCA
 * 的先做一步引导,否则回跳 ?next=。
 */
export function LoginForm({
  firstPartyOnly = false,
  onDone,
}: {
  firstPartyOnly?: boolean;
  onDone: OnSignedIn;
}) {
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
      onDone({ isNew: r.isNew, hasWca: !!r.user.wcaId });
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
  const hasSso = !firstPartyOnly && (avail.wca || googleOn || activeSocials.length > 0);

  return (
    <>
      <h2 className="auth-title">{t('登录 / 注册', 'Sign in / up')}</h2>

      {credMode === 'email' && avail.email && <EmailAuth onDone={onDone} />}
      {credMode === 'phone' && avail.phone && <PhoneAuth onDone={onDone} />}
      {avail.email && avail.phone && (
        <button className="auth-textbtn auth-cred-switch" onClick={() => setCredMode((m) => (m === 'email' ? 'phone' : 'email'))}>
          {credMode === 'email' ? t('用手机号登录', 'Use phone number') : t('用邮箱登录', 'Use email')}
        </button>
      )}

      {hasCred && hasSso && <OrDivider />}

      {hasSso && (
        <div className="auth-sso-list">
          {avail.wca && (
            <SsoButton icon={<WcaGlyph size={ICON} />} label={t('用 WCA 登录', 'Continue with WCA')} mobileAuthProvider="wca" onClick={() => loginWithWca()} />
          )}
          {googleOn && (
            <SsoButton icon={<GoogleGlyph size={ICON} />} busy={gBusy} label={t('用 Google 登录', 'Continue with Google')} mobileAuthProvider="google" onClick={() => void handleGoogleLogin()} />
          )}
          {activeSocials.map((s) => (
            <SsoButton key={s.key} icon={<s.Glyph size={ICON} />} busy={socialBusy === s.key} label={t(`用${s.name.zh}登录`, `Continue with ${s.name.en}`)} mobileAuthProvider={s.key} onClick={() => void startSocial(s.key)} />
          ))}
        </div>
      )}
      {(gError || socialError) && <p className="auth-error auth-sso-error">{gError || socialError}</p>}
    </>
  );
}

/**
 * 发起「绑定 WCA」的 OAuth。与「用 WCA 登录」同一条授权链路,靠 sessionStorage 里的 intent
 * 让 callback 页走 link 分支(加身份)而不是 login 分支(另建账号)。
 * returnTo:授权完成后落到哪。新人引导用它把人直接送回 ?next= 的来处,不在账号页多停一站。
 */
function startWcaLink(loginWithWca: (returnTo?: string) => void, returnTo?: string): void {
  try { sessionStorage.setItem('wca_oauth_intent', 'link'); } catch { /* 隐私模式忽略 */ }
  loginWithWca(returnTo);
}

/**
 * 新人引导:刚注册、账号还没有 WCA 身份时问一次「有没有 WCA ID」。渲染于 /account,由页面在
 * LoginForm 的 onDone 里切进来 —— 挡在回跳 ?next= 之前,是注册流程的最后一步,不是弹窗打断。
 *
 * 只给 OAuth 一条路,**不提供手填 WCA ID 的输入框**:手填没有所有权证明,等于让任何人认领
 * 别人的成绩与纪录。问句本身也得解释「WCA ID 是什么」—— 会走到这一步的人多半是刚入坑的,
 * 直接问一个术语,他答不上来。
 */
export function WcaLinkPrompt({ returnTo, onSkip }: { returnTo?: string | null; onSkip: () => void }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const loginWithWca = useAuthStore((s) => s.loginWithWca);
  return (
    <>
      <h2 className="auth-title">{t('您是否参加过 WCA 比赛？', 'Have you competed in a WCA competition?')}</h2>
      <div className="auth-flow">
        <p className="auth-lead">
          {t('WCA ID 是参加过 WCA 官方比赛后拿到的编号,形如 ', 'A WCA ID is the number you get after competing in an official WCA competition, like ')}
          <span className="auth-sample">2016ABCD01</span>
          {t('。绑定后,你的成绩、个人纪录、比赛历史和复盘会直接出现在这里。', '. Link it and your results, personal records, competition history and reconstructions all show up here.')}
        </p>
        <div className="auth-sso-list">
          <SsoButton
            icon={<WcaGlyph size={ICON} />}
            label={t('有,绑定我的 WCA 账号', 'Yes, link my WCA account')}
            onClick={() => startWcaLink(loginWithWca, returnTo ?? undefined)}
          />
        </div>
        <button type="button" className="auth-textbtn" onClick={onSkip}>
          {t('我还没有 WCA ID', "I don't have one yet")}
        </button>
      </div>
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
  douyin: { zh: '抖音', en: 'Douyin' },
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
  // 换绑邮箱 / 手机号。与 linking 互斥:同时展开两个验证码表单,用户分不清哪个码填哪儿。
  const [replacing, setReplacing] = useState<'email' | 'phone' | null>(null);
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
  const [mergeMode, setMergeMode] = useState<'keep' | 'move' | null>(null);
  const [mergeCode, setMergeCode] = useState('');
  const [generatedMergeCode, setGeneratedMergeCode] = useState('');
  const [mergeBusy, setMergeBusy] = useState(false);

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
  const hasPhone = (identities ?? []).some((i) => i.provider === 'phone');
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

  // 绑完回本页(账号设置就是来处),故不传 returnTo。
  const linkWcaStart = () => startWcaLink(loginWithWca);

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

  const generateMergeCode = async () => {
    setError(null);
    setMergeBusy(true);
    try {
      setGeneratedMergeCode((await issueAccountMergeCode()).code);
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setMergeBusy(false);
    }
  };

  const submitMerge = async () => {
    setError(null);
    setMergeBusy(true);
    try {
      const result = await mergeAccount(mergeCode.trim());
      applySession(result.token, result.user);
      setMergeMode(null);
      setMergeCode('');
      await reload();
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setMergeBusy(false);
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
                    {/* 换邮箱 / 手机号只能走这里:各只能有一个、唯一的登录方式又不许解绑,
                        「先解绑再绑定」对只有这一条的账号是死路。这个按钮原地换掉那条身份。
                        方式本身没开(如短信未配置)就别给入口 —— 点进去发码必 503。 */}
                    {(i.provider === 'email' || i.provider === 'phone') && avail[i.provider] && (
                      <button
                        type="button"
                        className="auth-link"
                        onClick={() => {
                          setLinking(null);
                          setReplacing((v) => (v === i.provider ? null : (i.provider as 'email' | 'phone')));
                        }}
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

      {replacing && (
        <div className="auth-replace">
          <p className="auth-hint">
            {replacing === 'email'
              ? t('验证新邮箱后,原邮箱立即失效。', 'Once the new address is verified, the old one stops working immediately.')
              : t('验证新手机号后,原手机号立即失效。', 'Once the new number is verified, the old one stops working immediately.')}
          </p>
          <CodeFlow
            channel={replacing}
            mode="replace"
            onDone={() => { setReplacing(null); void reload(); }}
          />
        </div>
      )}

      {/* 「还能绑什么」在拿到已绑列表前无从谈起:identities 为 null 时 hasEmail/hasWca 全是
          false,会把已绑过的方式先闪一行再撤掉。等加载完再渲染整块。
          一个账号只能绑一个邮箱 / 一个手机号(0078 / 0103 偏唯一索引),已有就不给入口 ——
          否则和上面「邮箱 xxx@x 解绑」那行撞脸,看着像重复渲染;要换走上面的「更换」。 */}
      {identities !== null
        && ((avail.email && !hasEmail) || (avail.phone && !hasPhone) || !hasWca || (googleOn && !hasGoogle) || availableSocials.length > 0) && (
        <div className="auth-linklist">
          {avail.email && !hasEmail && (
            <div className="auth-idrow">
              <ProviderGlyph provider="email" />
              <span className="auth-idprov">{t('邮箱', 'Email')}</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" onClick={() => { setReplacing(null); setLinking(linking === 'email' ? null : 'email'); }}>
                  {t('绑定', 'Link')}
                </button>
              </div>
            </div>
          )}
          {avail.phone && !hasPhone && (
            <div className="auth-idrow">
              <ProviderGlyph provider="phone" />
              <span className="auth-idprov">{t('手机', 'Phone')}</span>
              <div className="auth-idactions">
                <button type="button" className="auth-link" onClick={() => { setReplacing(null); setLinking(linking === 'phone' ? null : 'phone'); }}>
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

      <div className="auth-linklist">
        <div className="auth-idrow">
          <span className="auth-idicon"><Merge size={ICON} /></span>
          <span className="auth-idprov">{t('合并账号', 'Merge accounts')}</span>
          <div className="auth-idactions">
            <button type="button" className="auth-link" onClick={() => setMergeMode((mode) => mode ? null : 'keep')}>
              {mergeMode ? t('收起', 'Close') : t('打开', 'Open')}
            </button>
          </div>
        </div>
      </div>
      {mergeMode && (
        <div className="auth-flow">
          <p className="auth-hint">
            {t('合并后不能撤销。登录方式和个人数据会进入保留账号；遇到重复或归属不明确的数据会停止,不会改动任何账号。',
              'Merging cannot be undone. Sign-in methods and personal data move to the kept account; conflicts stop the merge without changing either account.')}
          </p>
          <PillToggle
            value={mergeMode === 'keep'}
            onChange={(keep) => setMergeMode(keep ? 'keep' : 'move')}
            onLabel={t('保留当前账号', 'Keep this account')}
            offLabel={t('合并当前账号', 'Merge this account')}
            ariaLabel={t('选择合并方向', 'Choose merge direction')}
          />
          {mergeMode === 'keep' ? (
            <>
              <p className="auth-hint">{t('生成合并码,再登录另一个账号输入。合并后保留当前账号。', 'Generate a code, then sign in to the other account and enter it. This account will be kept.')}</p>
              {generatedMergeCode && <input className="auth-input" readOnly value={generatedMergeCode} aria-label={t('合并码', 'Merge code')} />}
              <button type="button" className="auth-primary" disabled={mergeBusy} onClick={() => void generateMergeCode()}>
                {mergeBusy ? <Loader2 size={ICON} className="auth-spin" /> : t('生成合并码', 'Generate merge code')}
              </button>
            </>
          ) : (
            <>
              <p className="auth-hint">{t('输入保留账号生成的合并码。确认后当前账号会并入对方。', 'Enter the code generated by the account you want to keep. This account will be merged into it.')}</p>
              <input className="auth-input" value={mergeCode} onChange={(event) => setMergeCode(event.target.value)} placeholder="330-123456" autoComplete="off" aria-label={t('合并码', 'Merge code')} />
              <button type="button" className="auth-primary" disabled={mergeBusy || !mergeCode.trim()} onClick={() => void submitMerge()}>
                {mergeBusy ? <Loader2 size={ICON} className="auth-spin" /> : t('确认合并当前账号', 'Merge this account')}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * 注销账号。**独立一屏**,不是账号面板底部的一个红按钮 —— 这件事不可撤销,要先把「删什么、
 * 留什么」摊开讲清楚,再问一次确认;塞在面板末尾的按钮会被顺手点掉。入口在账号设置最底部
 * (一条不起眼的文字按钮),链到 /account?view=delete,所以这一屏也能被中键新开、后退退出。
 *
 * 确认方式是照抄主标识(邮箱 / 手机 / WCA ID)而不是弹个「确定吗」:后者点两下就过了,
 * 前者要求人先认一眼这是哪个账号 —— 多账号的人最容易在这里删错。
 */
export function DeleteAccountPanel({ backHref }: { backHref: string }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [handle, setHandle] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void fetchIdentities().then((acct) => {
      setHandle(primaryHandle(acct.identities, user?.uid));
      setHasPassword(acct.hasPassword);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 大小写折叠比对,与服务端同一判据 —— 邮箱按小写存、WCA ID 全大写,照抄时对不上很常见。
  const matched = !!handle && confirm.trim().toLowerCase() === handle.toLowerCase();

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(confirm.trim(), hasPassword ? pw : undefined);
      logout();       // 账号已经没了,本地会话立刻清掉,别留一个指向空账号的 token
      setDone(true);
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, pw, hasPassword, logout]);

  if (done) {
    return (
      <>
        <h2 className="auth-title">{t('账号已注销', 'Account deleted')}</h2>
        <div className="auth-flow">
          <p className="auth-lead">
            {t('你的账号和私有数据已经删除,登录方式即刻失效。感谢一路同行。',
              'Your account and private data are gone, and your sign-in methods no longer work. Thanks for having been here.')}
          </p>
          <AppLink href="/" className="auth-textbtn">{t('返回首页', 'Back to home')}</AppLink>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="auth-title">{t('注销账号', 'Delete account')}</h2>
      <div className="auth-flow">
        <p className="auth-lead">
          {t('注销立即生效,无法撤销,也没有恢复期。', 'Deletion takes effect immediately. It cannot be undone, and there is no grace period.')}
        </p>

        <p className="auth-dl-head">{t('永久删除', 'Permanently deleted')}</p>
        <ul className="auth-dl">
          <li>{t('登录方式(邮箱 / 手机 / WCA / 第三方绑定)', 'Sign-in methods (email / phone / WCA / third-party links)')}</li>
          <li>{t('计时器云备份、训练成绩、公式掌握与记忆进度', 'Timer backups, training results, algorithm mastery and review progress')}</li>
          <li>{t('关注的比赛、打乱标记、画板作品', 'Followed competitions, scramble marks, drawings')}</li>
          <li>{t('通知与反馈会话', 'Notifications and feedback threads')}</li>
          <li>{t('私享 / 不公开列出的复盘', 'Private and unlisted reconstructions')}</li>
        </ul>

        <p className="auth-dl-head">{t('留在站上,但不再关联到你', 'Stays on the site, no longer tied to you')}</p>
        <ul className="auth-dl">
          <li>{t('论坛主题与回帖、评论、公式提交', 'Forum threads and replies, comments, algorithm submissions')}</li>
          <li>{t('已公开的复盘', 'Public reconstructions')}</li>
        </ul>
        <p className="auth-hint">
          {t('作者位会显示为「已注销用户」,不再带你的 WCA ID 或邮箱 —— 这样别人的讨论不会断链、公开复盘的链接也不会失效。如有付费订单,交易记录会作为对账凭证保留。',
            'These keep an author slot reading “Deleted user”, with no WCA ID or email attached — so other people’s discussions stay intact and public reconstruction links keep working. Any purchase records are kept for accounting.')}
        </p>

        {handle === null ? (
          <div className="auth-loading"><Loader2 size={ICON} className="auth-spin" /></div>
        ) : handle === '' ? (
          /* 身份列表没拉到(会话过期 / 接口不通)。这时不能渲染确认框:比对串是空的,按钮
             永远点不亮,人只会以为自己抄错了。说清楚为什么,别给一个死掉的表单。 */
          <p className="auth-error">
            {t('读不到账号信息,请刷新页面后重试。', 'Could not load your account details — reload the page and try again.')}
          </p>
        ) : (
          <>
            <label className="auth-label">
              {t('输入 ', 'Type ')}<span className="auth-sample">{handle}</span>{t(' 以确认', ' to confirm')}
            </label>
            <input
              className="auth-input"
              value={confirm}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {hasPassword && (
              <>
                <label className="auth-label">{t('当前密码', 'Current password')}</label>
                <PasswordInput
                  className="auth-input"
                  value={pw}
                  onChange={setPw}
                  autoComplete="current-password"
                  onEnter={() => { if (matched && pw && !busy) void submit(); }}
                />
              </>
            )}
            {error && <p className="auth-error">{error}</p>}
            <button
              type="button"
              className="auth-danger"
              disabled={busy || !matched || (hasPassword && !pw)}
              onClick={() => void submit()}
            >
              {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
              {t('永久注销账号', 'Permanently delete my account')}
            </button>
            <AppLink href={backHref} className="auth-textbtn" prefetch={false}>{t('取消', 'Cancel')}</AppLink>
          </>
        )}
      </div>
    </>
  );
}
