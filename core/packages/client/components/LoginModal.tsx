'use client';

// 全站登录 / 账号弹层。未登录:邮箱 / 手机 / WCA 三种方式(方案 A);已登录:账号面板
// (已绑定身份列表 + 绑定新方式 + 解绑 + 登出)。结构镜像 FeedbackModal(自包含 + 本地 t + 背景点击关闭)。
// 由 store 的 loginOpen 控制,全局挂在 app/layout.tsx。

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Mail, Smartphone, Key, Loader2, LogOut, Link2, UserRound } from 'lucide-react';
import { SiWechat, SiQq, SiAlipay } from 'react-icons/si';
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
import { startSocialLogin, isBlockedWebview } from '@/lib/social-auth';
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

/** 国内三方品牌标:react-icons/si(simple-icons)按需 import,打进 bundle、不走 CDN。 */
const WechatGlyph = ({ size = 16 }: { size?: number }) => <SiWechat size={size} color="#07C160" aria-hidden="true" />;
const QqGlyph = ({ size = 16 }: { size?: number }) => <SiQq size={size} color="#1EBAFC" aria-hidden="true" />;
const AlipayGlyph = ({ size = 16 }: { size?: number }) => <SiAlipay size={size} color="#1677FF" aria-hidden="true" />;

/** 国内三方 provider 配置(标 + 名 + 登录提示),供 tab / 绑定 chip 共用。 */
const SOCIALS: { key: SocialProvider; Glyph: (p: { size?: number }) => React.ReactNode; name: { zh: string; en: string }; hint: { zh: string; en: string } }[] = [
  { key: 'wechat', Glyph: WechatGlyph, name: { zh: '微信', en: 'WeChat' }, hint: { zh: '用微信扫码登录。', en: 'Sign in by scanning with WeChat.' } },
  { key: 'qq', Glyph: QqGlyph, name: { zh: 'QQ', en: 'QQ' }, hint: { zh: '用 QQ 账号登录。', en: 'Sign in with your QQ account.' } },
  { key: 'alipay', Glyph: AlipayGlyph, name: { zh: '支付宝', en: 'Alipay' }, hint: { zh: '用支付宝账号登录。', en: 'Sign in with your Alipay account.' } },
];

/** 三方登录面板:一句提示 + 一个「用 X 登录」按钮。桌面/微信扫码走整页跳授权页;手机支付宝走
 *  `alipays://` 唤起 App —— 唤起后当前页不卸载,故不空转 spinner,改提示「授权完返回本页」,
 *  返回时重读会话(同浏览器另一标签已登录会经 storage 同步回来,弹层自动切成账号面板)。 */
function SocialPane({ provider }: { provider: SocialProvider }) {
  const lang = useLang();
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const refresh = useAuthStore((s) => s.refresh);
  const meta = SOCIALS.find((s) => s.key === provider)!;
  const [busy, setBusy] = useState(false);
  const [launched, setLaunched] = useState(false); // 已唤起 App、页面留存,等用户授权后切回
  const [error, setError] = useState<string | null>(null);
  // 微信/QQ 内置浏览器里,支付宝授权回调会落到系统浏览器,本页收不到登录态 → 先引导去浏览器打开。
  const blocked = provider === 'alipay' && isBlockedWebview();

  useEffect(() => {
    if (!launched) return;
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refresh); };
  }, [launched, refresh]);

  const go = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await startSocialLogin(provider, 'login');
      if (!r.navigated) { setBusy(false); setLaunched(true); } // 唤起了 App,页面还在 → 收 spinner,提示返回
      // r.navigated=true:整页已在跳走,保持 busy 到卸载
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setBusy(false);
    }
  };
  const name = t(meta.name.zh, meta.name.en);

  if (launched) {
    return (
      <div className="lm-flow">
        <p className="lm-hint">{t(`已打开${name},请在其中完成授权,然后返回本页面。`, `Opened ${name} — finish authorizing there, then return to this page.`)}</p>
        <button className="lm-primary" onClick={() => window.location.reload()}>{t('我已完成授权', 'I have authorized')}</button>
        <button className="lm-textbtn" onClick={() => { setLaunched(false); setBusy(false); }}>{t('重新发起', 'Start over')}</button>
      </div>
    );
  }

  return (
    <div className="lm-flow">
      <p className="lm-hint">{t(meta.hint.zh, meta.hint.en)}</p>
      {blocked && <p className="lm-hint">{t('微信 / QQ 内暂不支持支付宝登录。请点右上角「···」选择「在浏览器打开」后再登录。', 'Alipay sign-in does not work inside WeChat / QQ. Tap the ··· menu and choose "Open in Browser" first.')}</p>}
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
  // 手机支付宝唤起 App 绑定后切回本页时,重拉身份列表(同浏览器完成的绑定即刻反映)。
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

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
