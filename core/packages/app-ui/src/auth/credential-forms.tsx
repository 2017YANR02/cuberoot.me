import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ClearButton } from '@cuberoot/timer-ui/clear-button';
import type { WebSession, WebSessionUser } from '@cuberoot/shared/auth/web-session';
import { PasswordInput } from './PasswordInput';
import { authErrorText } from './account-errors';

export type AccountTranslate = (zh: string, en: string) => string;
export interface SignedIn { isNew?: boolean; hasWca?: boolean }
type OnSignedIn = (info?: SignedIn) => void;
type CredentialResult = WebSession & { isNew?: boolean };

export interface CredentialFormPort {
  sendEmailCode(email: string): Promise<unknown>;
  verifyEmailCode(email: string, code: string, options: { existingOnly?: boolean; signal: AbortSignal }): Promise<CredentialResult>;
  sendPhoneCode(phone: string): Promise<unknown>;
  verifyPhoneCode(phone: string, code: string, options: { signal: AbortSignal }): Promise<CredentialResult>;
  sendPhonePasswordResetCode(phone: string): Promise<unknown>;
  verifyPhonePasswordResetCode(phone: string, code: string, signal: AbortSignal): Promise<CredentialResult>;
  loginPassword(email: string, password: string, signal: AbortSignal): Promise<CredentialResult>;
  applySession(token: string, user: WebSessionUser, signal: AbortSignal): Promise<boolean>;
  apiSetPassword(password: string, currentPassword?: string): Promise<unknown>;
  handleChoice(error: unknown): Promise<boolean>;
  manage?: {
    send(channel: Channel, target: string): Promise<unknown>;
    verify(channel: Channel, mode: 'link' | 'replace', target: string, code: string): Promise<unknown>;
  };
}

const CredentialFormsContext = createContext<{ t: AccountTranslate; port: CredentialFormPort; autoFocus: boolean } | null>(null);

export function CredentialFormsProvider({ t, port, autoFocus = true, children }: {
  t: AccountTranslate; port: CredentialFormPort; autoFocus?: boolean; children: ReactNode;
}) {
  return <CredentialFormsContext.Provider value={{ t, port, autoFocus }}>{children}</CredentialFormsContext.Provider>;
}

function useCredentialForms() {
  const context = useContext(CredentialFormsContext);
  if (!context) throw new Error('Credential forms require a sign-in port');
  return context;
}

const ICON = 16;
const CODE_LEN = 6;
type Channel = 'email' | 'phone';

// A convenience hint only: never store passwords, codes or authorization here.
function readRememberedLogin(channel: Channel): string {
  try { return localStorage.getItem('cuberoot_login_' + channel) ?? ''; }
  catch { return ''; }
}
function rememberLogin(channel: Channel, value: string): void {
  try {
    const key = 'cuberoot_login_' + channel;
    if (value.trim()) localStorage.setItem(key, value.trim());
    else localStorage.removeItem(key);
  } catch { /* Remembering an account is optional; sign-in still succeeds. */ }
}

/** Apple 风格分格验证码输入:6 个格子 + 高亮当前格 + 跳动光标。一个透明原生 input 承接
 *  键盘/粘贴/iOS 短信自动填充(autocomplete=one-time-code),格子只做展示、始终左到右填。 */
function CodeCells({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const { t, autoFocus } = useCredentialForms();
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
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={t('验证码', 'Verification code')}
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

/**
 * 邮箱/手机验证码流程(发码 → 输码 → 校验)。
 *   login    验证后登录
 *   link     绑到当前账号
 *   replace  换掉当前账号已有的那条(邮箱 / 手机号)—— 发码与 link 同一条链路,只有最后落库不同
 *   reset    仅手机找回密码;验证码和登录用途隔离,验证后签出 10 分钟重置授权
 */
export function CodeFlow({ channel, mode, onDone }: { channel: Channel; mode: 'login' | 'link' | 'replace' | 'reset'; onDone: OnSignedIn }) {
  const { t, port, autoFocus } = useCredentialForms();
  const targetId = useId();
  const [target, setTarget] = useState('');
  useEffect(() => {
    if (mode === 'login' || mode === 'reset') setTarget(readRememberedLogin(channel));
  }, [channel, mode]);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verification = useRef<AbortController | null>(null);
  useEffect(() => () => { verification.current?.abort(); }, []);

  const label = channel === 'email' ? t('邮箱', 'Email') : t('手机号', 'Phone');
  const placeholder = channel === 'email' ? undefined : t('11 位手机号', '11-digit phone');

  const send = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'link' || mode === 'replace') {
        if (!port.manage) throw new Error('account service unavailable');
        await port.manage.send(channel, target);
      } else if (mode === 'reset') {
        await port.sendPhonePasswordResetCode(target);
      } else {
        channel === 'email' ? await port.sendEmailCode(target) : await port.sendPhoneCode(target);
      }
      setStep('code');
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setBusy(false);
    }
  }, [channel, mode, target, port, t]);

  const verify = useCallback(async () => {
    if (verification.current) return;
    const controller = new AbortController();
    verification.current = controller;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'replace') {
        if (!port.manage) throw new Error('account service unavailable');
        await port.manage.verify(channel, 'replace', target, code);
        if (!controller.signal.aborted) onDone();
      } else if (mode === 'link') {
        if (!port.manage) throw new Error('account service unavailable');
        await port.manage.verify(channel, 'link', target, code);
        if (!controller.signal.aborted) onDone();
      } else if (mode === 'reset') {
        const r = await port.verifyPhonePasswordResetCode(target, code, controller.signal);
        if (controller.signal.aborted) return;
        if (!(await port.applySession(r.token, r.user, controller.signal))) throw new Error('session storage failed');
        rememberLogin(channel, target);
        onDone();
      } else {
        const r = channel === 'email' ? await port.verifyEmailCode(target, code, { signal: controller.signal }) : await port.verifyPhoneCode(target, code, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!(await port.applySession(r.token, r.user, controller.signal))) throw new Error('session storage failed');
        rememberLogin(channel, target);
        onDone({ isNew: r.isNew, hasWca: !!r.user.wcaId });
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      if (mode === 'login') {
        try { if (await port.handleChoice(e)) return; }
        catch (storageError) { setError(authErrorText(String(storageError), t)); return; }
      }
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      if (verification.current === controller) verification.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [channel, mode, target, code, onDone, port, t]);

  // 满 6 位自动提交(Apple 风格,免点按钮);验证失败后 code 不变不会重复触发。
  useEffect(() => {
    if (step === 'code' && code.length === CODE_LEN && !busy) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  const input = (
    <input
      id={targetId}
      className="auth-input"
      type={channel === 'email' ? 'email' : 'tel'}
      value={target}
      autoComplete={channel === 'email' ? 'email' : 'tel-national'}
      inputMode={channel === 'email' ? 'email' : 'tel'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => setTarget(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && target && !busy) void send();
      }}
    />
  );

  return (
    <div className="auth-flow">
      {step === 'input' ? (
        <>
          <label className="auth-label" htmlFor={targetId}>{label}</label>
          {/* 手机号框挂一个 +86 前缀:只支持中国大陆号,这事该在输入前就说,而不是等人填完
              国外号码再回一句错误。前缀纯装饰,不进 target —— normalizePhone 认裸 11 位。 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {channel === 'phone' ? (
              <div className="auth-phonefield" style={{ flex: 1, minWidth: 0 }}>
                <span className="auth-phoneprefix">+86</span>
                {input}
              </div>
          ) : input}
          {target && !busy && <ClearButton variant="standalone" ariaLabel={t('清除并忘记账号', 'Clear and forget account')} onClick={() => { setTarget(''); if (mode === 'login' || mode === 'reset') rememberLogin(channel, ''); }} />}
          </div>
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
          <button className="auth-textbtn" disabled={busy} onClick={() => { setStep('input'); setCode(''); setError(null); }}>
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
function EmailCodeFlow({ email, setEmail, onDone, toPassword, reset, alternatives }: {
  alternatives?: ReactNode;
  email: string; setEmail: (v: string) => void; onDone: OnSignedIn; toPassword: () => void; reset?: boolean;
}) {
  const { t, port, autoFocus } = useCredentialForms();
  const emailId = useId();
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verification = useRef<AbortController | null>(null);
  useEffect(() => () => { verification.current?.abort(); }, []);

  const send = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await port.sendEmailCode(email);
      setStep('code');
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, port, t]);

  const verify = useCallback(async () => {
    if (verification.current) return;
    const controller = new AbortController();
    verification.current = controller;
    setError(null);
    setBusy(true);
    try {
      const r = await port.verifyEmailCode(email, code, { existingOnly: reset, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!(await port.applySession(r.token, r.user, controller.signal))) throw new Error('session storage failed');
      rememberLogin('email', email);
      onDone({ isNew: r.isNew, hasWca: !!r.user.wcaId });
    } catch (e) {
      if (controller.signal.aborted) return;
      if (!reset) {
        try { if (await port.handleChoice(e)) return; }
        catch (storageError) { setError(authErrorText(String(storageError), t)); return; }
      }
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      if (verification.current === controller) verification.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, code, onDone, reset, port, t]);

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
        <button className="auth-textbtn" disabled={busy} onClick={() => { setStep('input'); setCode(''); setError(null); }}>
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
      <label className="auth-label" htmlFor={emailId}>{t('邮箱', 'Email')}</label>
      <div className="auth-clearfield">
        <input
          id={emailId}
          className="auth-input"
          type="email"
          style={{ minWidth: 0 }}
          value={email}
          autoFocus={autoFocus}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && email && !busy) void send();
          }}
        />
        {email && !busy && <ClearButton ariaLabel={t('清除并忘记账号', 'Clear and forget account')} onClick={() => { setEmail(''); rememberLogin('email', ''); }} />}
      </div>
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={!email || busy} onClick={() => void send()}>
        {busy ? <Loader2 size={ICON} className="auth-spin" /> : null}
        {t('发送验证码', 'Send code')}
      </button>
      <div className="auth-method-actions">
        <button className="auth-textbtn" onClick={toPassword}>
          {reset ? t('返回密码登录', 'Back to password sign-in') : t('用密码登录', 'Sign in with a password')}
        </button>
        {!reset && alternatives}
      </div>
    </div>
  );
}

/** 邮箱 + 密码登录(受控 email;仅登录已设密码的账号,未设密码走验证码 + 账号面板设密码)。 */
// 密码登录只对「已注册且已设密码」的账号成立 → 永远不是新注册,onDone 不带 info。
function EmailPasswordFlow({ email, setEmail, onDone, toCode, onForgot }: {
  email: string; setEmail: (v: string) => void; onDone: OnSignedIn; toCode: () => void; onForgot: () => void;
}) {
  const { t, port, autoFocus } = useCredentialForms();
  const emailId = useId();
  const passwordId = useId();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verification = useRef<AbortController | null>(null);
  useEffect(() => () => { verification.current?.abort(); }, []);
  const submit = useCallback(async () => {
    if (verification.current) return;
    const controller = new AbortController();
    verification.current = controller;
    setError(null);
    setBusy(true);
    try {
      const r = await port.loginPassword(email, pw, controller.signal);
      if (controller.signal.aborted) return;
      if (!(await port.applySession(r.token, r.user, controller.signal))) throw new Error('session storage failed');
      rememberLogin('email', email);
      onDone();
    } catch (e) {
      if (!controller.signal.aborted) setError(authErrorText(e instanceof Error ? e.message : String(e), t));
    } finally {
      if (verification.current === controller) verification.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw, onDone, port, t]);

  return (
    <div className="auth-flow">
      <label className="auth-label" htmlFor={emailId}>{t('邮箱', 'Email')}</label>
      <div className="auth-clearfield">
        <input
          id={emailId}
          className="auth-input"
          type="email"
          style={{ minWidth: 0 }}
          value={email}
          autoFocus={autoFocus}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setEmail(e.target.value)}
        />
        {email && !busy && <ClearButton ariaLabel={t('清除并忘记账号', 'Clear and forget account')} onClick={() => { setEmail(''); rememberLogin('email', ''); }} />}
      </div>
      <label className="auth-label" htmlFor={passwordId}>{t('密码', 'Password')}</label>
      <PasswordInput t={t}
        id={passwordId}
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
function EmailAuth({ onDone, alternatives, existingOnly }: { onDone: OnSignedIn; alternatives: ReactNode; existingOnly: boolean }) {
  const { t } = useCredentialForms();
  const [email, setEmail] = useState('');
  useEffect(() => { setEmail(readRememberedLogin('email')); }, []);
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
      <>
      <EmailPasswordFlow
        email={email} setEmail={setEmail} onDone={onDone}
        toCode={() => setMode('code')}
        onForgot={() => setMode('reset')}
      />
      {alternatives}
      </>
    );
  }
  return (
    <>
    {!existingOnly && mode === 'code' && <RegistrationHint />}
    <EmailCodeFlow alternatives={alternatives}
      email={email} setEmail={setEmail}
      reset={mode === 'reset'}
      onDone={(info) => (mode === 'reset' ? setNewPw(true) : onDone(info))}
      toPassword={() => setMode('password')}
    />
    </>
  );
}

/** 手机登录及独立的找回密码用途。普通登录码不能获得重置权限。 */
function PhoneAuth({ onDone }: { onDone: OnSignedIn }) {
  const { t } = useCredentialForms();
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

/**
 * 设置 / 修改 / 重置密码。needCurrent 决定要不要先验旧密码 —— 与后端同一条规矩:
 * 已有密码要改 → 要旧密码;首次设置、或本次会话刚验过邮箱(忘记密码) → 不要。
 */
export function SetPasswordForm({ needCurrent, label, onDone }: {
  needCurrent: boolean; label: string; onDone: () => void;
}) {
  const { t, port, autoFocus } = useCredentialForms();
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
      await port.apiSetPassword(next, needCurrent ? current : undefined);
      setDone(true);
      window.setTimeout(onDone, 800);
    } catch (e) {
      setError(authErrorText(e instanceof Error ? e.message : String(e), t));
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, next, confirm, needCurrent, onDone, port, t]);

  if (done) {
    return <div className="auth-flow auth-pwform"><p className="auth-hint">{t('密码已保存。', 'Password saved.')}</p></div>;
  }
  return (
    <div className="auth-flow auth-pwform">
      {needCurrent && (
        <>
          <label className="auth-label">{t('当前密码', 'Current password')}</label>
          <PasswordInput t={t} className="auth-input" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus={autoFocus} />
        </>
      )}
      <label className="auth-label">{label}</label>
      <PasswordInput t={t}
        className="auth-input"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        autoFocus={autoFocus && !needCurrent}
        placeholder={t('至少 8 位', 'At least 8 characters')}
      />
      <label className="auth-label">{t('确认密码', 'Confirm password')}</label>
      <PasswordInput t={t}
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


function RegistrationHint() {
  const { t } = useCredentialForms();
  return <p className="auth-registration-hint">{t(
    '已有账号可直接登录。第一次来？用验证码验证后即可选择创建账号。',
    'Already registered? Sign in below. New here? Verify with a code, then choose to create an account.',
  )}</p>;
}

export function FirstPartyLogin({ email, phone, onDone, existingOnly = false }: {
  email: boolean; phone: boolean; onDone: OnSignedIn; existingOnly?: boolean;
}) {
  const { t } = useCredentialForms();
  const [preferred, setPreferred] = useState<Channel>('email');
  const channel = email && (!phone || preferred === 'email') ? 'email' : phone ? 'phone' : null;
  const switchChannel = email && phone && (
    <button type="button" className="auth-textbtn auth-cred-switch"
      onClick={() => setPreferred(channel === 'email' ? 'phone' : 'email')}>
      {channel === 'email' ? t('用手机号登录', 'Use phone number') : t('用邮箱登录', 'Use email')}
    </button>
  );
  if (channel === 'email') return <EmailAuth existingOnly={existingOnly} onDone={onDone} alternatives={switchChannel} />;
  if (channel === 'phone') return <>
    {!existingOnly && <RegistrationHint />}
    <PhoneAuth onDone={onDone} />
    {switchChannel}
  </>;
  return null;
}
