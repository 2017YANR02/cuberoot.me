import { useEffect, useRef, useState } from 'react';
import type { MobileAuthProvider, PendingIdentity, WebSession } from '@cuberoot/shared/auth/web-session';
import type { SupportedLanguage } from '../copy';
import type { InstalledAppAuth } from '../platform';
import {
  authErrorText, CredentialFormsProvider, FirstPartyLogin, RegistrationConsent,
  type CredentialFormPort,
} from './account-forms';
import { accountRequest, credentialSession, installedAuthProviders, InstalledAccountChoiceRequired } from './credential-api';

const PROVIDER_NAMES = {
  apple: ['Apple', 'Apple'],
  wca: ['WCA', 'WCA'],
  google: ['Google', 'Google'],
  wechat: ['微信', 'WeChat'],
  qq: ['QQ', 'QQ'],
  alipay: ['支付宝', 'Alipay'],
  douyin: ['抖音', 'Douyin'],
} satisfies Record<MobileAuthProvider, [string, string]>;

type AccountChoice = PendingIdentity & { stage: 'choose' | 'authenticate' | 'confirm'; expiresAt: number };
type Providers = Awaited<ReturnType<typeof installedAuthProviders>>;

export function InstalledSignIn({ auth, language, onClose, openPolicy }: {
  auth: InstalledAppAuth;
  language: SupportedLanguage;
  onClose: () => void;
  openPolicy: (policy: 'terms' | 'privacy') => void;
}) {
  const t = (zh: string, en: string) => ({ zh, en })[language];
  const [providers, setProviders] = useState<Providers>({ email: true, phone: true, social: ['wca'] });
  const [choice, setChoice] = useState<AccountChoice | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const candidate = useRef<WebSession | null>(null);
  const active = useRef(true);
  const completion = useRef<AbortController | null>(null);
  const externalChoice = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      completion.current?.abort();
      candidate.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void installedAuthProviders(language, controller.signal).then(setProviders).catch(() => undefined);
    return () => controller.abort();
  }, [language]);

  const choiceTicket = choice?.ticket;
  const choiceExpiresAt = choice?.expiresAt;
  useEffect(() => {
    if (!choiceTicket || !choiceExpiresAt || saving) return;
    const timer = window.setTimeout(() => {
      externalChoice.current = false;
      candidate.current = null;
      setChoice(null);
      setError(({ zh: '登录验证已过期，请重新获取验证码。', en: 'Verification expired. Request a new code.' })[language]);
    }, Math.max(0, choiceExpiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [choiceTicket, choiceExpiresAt, language, saving]);

  useEffect(() => {
    if (choice?.stage !== 'authenticate' || !auth.session || !externalChoice.current) return;
    externalChoice.current = false;
    candidate.current = auth.session;
    setCandidateName(auth.session.user.name || String(auth.session.user.uid));
    setChoice({ ...choice, stage: 'confirm' });
  }, [auth.session, choice]);
  useEffect(() => {
    if (auth.session && !choice && !saving && !saveFailed) onClose();
  }, [auth.session, choice, onClose, saveFailed, saving]);

  const showError = (cause: unknown) => setError(authErrorText(cause instanceof Error ? cause.message : String(cause), t));
  const verifyExisting = choice?.stage === 'authenticate';
  const existingOnly = verifyExisting ? { existingOnly: true } : {};
  const port: CredentialFormPort = {
    sendEmailCode: (email) => accountRequest('/email/send', language, { body: { email } }),
    verifyEmailCode: (email, code, options) => credentialSession('/email/verify', language, {
      email, code, ...existingOnly, ...(options.existingOnly ? { existingOnly: true } : {}),
    }, options.signal),
    sendPhoneCode: (phone) => accountRequest('/phone/send', language, { body: { phone } }),
    verifyPhoneCode: (phone, code, { signal }) => credentialSession('/phone/verify', language, { phone, code, ...existingOnly }, signal),
    sendPhonePasswordResetCode: (phone) => accountRequest('/phone/send', language, { body: { phone, purpose: 'password_reset' } }),
    verifyPhonePasswordResetCode: (phone, code, signal) =>
      credentialSession('/phone/verify', language, { phone, code, purpose: 'password_reset' }, signal),
    loginPassword: (email, password, signal) => credentialSession('/email/password', language, { email, password }, signal),
    async applySession(token, user, signal) {
      if (!active.current || signal.aborted) return false;
      candidate.current = { token, user };
      return true;
    },
    apiSetPassword: (password) => {
      const session = candidate.current;
      if (!session) throw new Error('invalid account session');
      return accountRequest('/password/set', language, { token: session.token, body: { password } });
    },
    async handleChoice(cause) {
      if (!(cause instanceof InstalledAccountChoiceRequired)) return false;
      if (verifyExisting) throw new Error('account not found');
      setChoice({ ...cause.pending, stage: 'choose', expiresAt: Date.now() + cause.pending.expiresInSeconds * 1000 });
      return true;
    },
  };

  const saveSession = async (action?: 'create' | 'link') => {
    if (completion.current) return;
    const controller = new AbortController();
    completion.current = controller;
    const current = () => active.current && !controller.signal.aborted;
    setSaving(true);
    setError('');
    try {
      let session = candidate.current;
      if (action && choice) {
        if (choice.expiresAt <= Date.now()) throw new Error('identity ticket expired or already used');
        const existing = action === 'link' ? session : null;
        if (action === 'link' && !existing) throw new Error('invalid account session');
        const { token, user } = await credentialSession('/identity/complete', language, {
          ticket: choice.ticket, action,
          ...(existing ? { expectedUid: existing.user.uid } : { acceptedPolicies: true }),
        }, controller.signal, existing?.token);
        session = { token, user };
        if (existing && session.user.uid !== existing.user.uid) throw new Error('account changed; sign in again');
        if (!current()) return;
        candidate.current = session;
        setChoice(null);
      }
      if (!session || !await auth.installCredentialSession(session, current).catch(() => false)) {
        if (current()) throw new Error('session storage failed');
        return;
      }
      if (current()) onClose();
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof Error && cause.message === 'session storage failed') {
        setSaveFailed(true);
        setError(t('无法保存登录状态，请重试。', 'Could not save your sign-in. Please try again.'));
      } else showError(cause);
    } finally {
      if (completion.current === controller) completion.current = null;
      if (current()) setSaving(false);
    }
  };

  const completeCredentials = () => {
    const session = candidate.current;
    if (choice?.stage === 'authenticate' && session) {
      externalChoice.current = false;
      setCandidateName(session.user.name || String(session.user.uid));
      setChoice({ ...choice, stage: 'confirm' });
      return;
    }
    void saveSession();
  };
  const clearChoice = () => {
    externalChoice.current = false;
    setChoice(null);
    setError('');
    if (choice?.stage === 'confirm' && candidate.current) void saveSession();
    else candidate.current = null;
  };
  const signInWithProvider = (provider: MobileAuthProvider) => {
    externalChoice.current = verifyExisting;
    void auth.login(provider);
  };

  const forms = <CredentialFormsProvider t={t} port={port} autoFocus={false}>
    <FirstPartyLogin key={verifyExisting ? 'existing' : 'sign-in'} email={providers.email} phone={providers.phone} onDone={completeCredentials} />
    {providers.social.length > 0 && (
      <>
        {(providers.email || providers.phone) && <div className="auth-divider"><span>{t('或', 'or')}</span></div>}
        <div className="auth-sso-list">
          {providers.social.map((provider) => (
            <button key={provider} data-mobile-auth-provider={provider} className="auth-sso" type="button"
              disabled={auth.busy} onClick={() => signInWithProvider(provider)}>
              {provider === 'apple' ? t('通过 Apple 登录', 'Sign in with Apple')
                : t(`用 ${PROVIDER_NAMES[provider][0]} 登录`, `Continue with ${PROVIDER_NAMES[provider][1]}`)}
            </button>
          ))}
        </div>
      </>
    )}
  </CredentialFormsProvider>;

  return (
    <div className="installed-account-signin" aria-busy={saving}>
      {saving ? <p className="auth-hint" role="status">{t('正在登录…', 'Signing in…')}</p>
        : saveFailed ? <button className="auth-primary" type="button" onClick={() => void saveSession()}>{t('重试', 'Retry')}</button>
        : choice?.stage === 'choose' ? (
          <div className="auth-flow">
            <h2 className="auth-title">{t('你有 CubeRoot 账号吗？', 'Do you have a CubeRoot account?')}</h2>
            <button className="auth-primary" type="button" onClick={() => setChoice({ ...choice, stage: 'authenticate' })}>
              {t('登录已有账号', 'Sign in to an existing account')}
            </button>
            <RegistrationConsent busy={saving} onCreate={() => void saveSession('create')} t={t} links={<>
              <button className="auth-textbtn" type="button" onClick={() => openPolicy('terms')}>{t('用户协议', 'User Agreement')}</button>
              {t('及', ' and ')}
              <button className="auth-textbtn" type="button" onClick={() => openPolicy('privacy')}>{t('隐私政策', 'Privacy Policy')}</button>
            </>} />
          </div>
        ) : choice?.stage === 'confirm' ? (
          <div className="auth-flow">
            <h2 className="auth-title">{t('确认绑定登录方式', 'Confirm sign-in method')}</h2>
            <p className="auth-hint">{candidateName}</p>
            <button className="auth-primary" type="button" onClick={() => void saveSession('link')}>{t('确认绑定', 'Confirm linking')}</button>
            <button className="auth-textbtn" type="button" onClick={() => {
              candidate.current = null;
              setError('');
              setChoice({ ...choice, stage: 'authenticate' });
            }}>{t('使用其他账号', 'Use another account')}</button>
          </div>
        ) : (
          <>
            {verifyExisting && <p className="auth-hint">{t('请用原来的登录方式验证账号。', 'Use a sign-in method already linked to your account.')}</p>}
            {forms}
          </>
        )}
      {choice && !saving && <button className="auth-textbtn" type="button" onClick={clearChoice}>{t('取消', 'Cancel')}</button>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
