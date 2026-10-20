import { isValidEmail, isValidPhone, isValidPassword, normalizeEmail, normalizePhone } from '@cuberoot/shared/account';
import { ApiError, fetchNativeAccountIdentities, getStoredSession, requestJson, type SessionData } from './auth';
import { applyNativeAppearance } from './appearance';
import { tr } from './i18n';
import { miniProgramApi } from './platform';
import { hidePublicShareMenu } from './share';

function labels() { return {
  title: tr({ zh: '账号安全', en: 'Account security' }),
  email: tr({ zh: '邮箱', en: 'Email' }), phone: tr({ zh: '手机号', en: 'Phone' }),
  destination: tr({ zh: '新邮箱或中国大陆手机号', en: 'New email or mainland China phone number' }),
  code: tr({ zh: '6 位验证码', en: 'Six-digit verification code' }),
  send: tr({ zh: '发送验证码', en: 'Send code' }), bind: tr({ zh: '验证并绑定', en: 'Verify and link' }),
  replace: tr({ zh: '验证并换绑', en: 'Verify and replace' }),
  consent: tr({ zh: '同意将此邮箱或手机号用于账号绑定与登录', en: 'Use this email or phone for account linking and sign-in' }),
  password: tr({ zh: '密码', en: 'Password' }), currentPassword: tr({ zh: '当前密码', en: 'Current password' }),
  newPassword: tr({ zh: '新密码（8–128 位）', en: 'New password (8–128 characters)' }),
  repeatPassword: tr({ zh: '再次输入新密码', en: 'Repeat new password' }),
  savePassword: tr({ zh: '保存密码', en: 'Save password' }),
  show: tr({ zh: '显示密码', en: 'Show passwords' }), hide: tr({ zh: '隐藏密码', en: 'Hide passwords' }),
  clear: tr({ zh: '清除', en: 'Clear' }), reload: tr({ zh: '刷新账号状态', en: 'Refresh account' }),
  policy: tr({ zh: '用户协议与隐私政策', en: 'Agreement and privacy policy' }),
}; }
interface SettingsData {
  appearanceStyle: string; copy: ReturnType<typeof labels>; busy: boolean; ready: boolean;
  error: string; message: string; providerIndex: number; providerOptions: string[];
  destination: string; code: string; consent: boolean; bound: boolean;
  currentPassword: string; newPassword: string; repeatPassword: string; showPassword: boolean; hasPassword: boolean;
}
interface PageInstance { data: SettingsData; setData(value: Partial<SettingsData>): void }
interface State { session: SessionData; providers: Set<string>; attempt: object; sendAt: number }
const states = new WeakMap<object, State>();
const SENSITIVE = { code: '', destination: '', currentPassword: '', newPassword: '', repeatPassword: '', showPassword: false, consent: false };
function current(page: object, state: State, attempt: object) {
  return states.get(page) === state && state.attempt === attempt && getStoredSession()?.token === state.session.token;
}
function errorText(error: unknown) {
  if (error instanceof ApiError && error.status === 429) return tr({ zh: '操作频繁，请稍后重试。', en: 'Too many requests. Try later.' });
  if (error instanceof ApiError && error.status === 409) return tr({ zh: '绑定状态冲突，请刷新账号后核对。', en: 'Linking conflict. Refresh and check your account.' });
  return tr({ zh: '未能确认操作结果，请核对账号、验证码或密码后重试。', en: 'Could not confirm the result. Check your account, code or password before retrying.' });
}
async function mutate(page: PageInstance, state: State, path: string, body: Record<string, string>) {
  const attempt = {}; state.attempt = attempt;
  if (!current(page, state, attempt)) {
    page.setData({ ...SENSITIVE, ready: false, error: tr({ zh: '账号已变化，请刷新账号状态。', en: 'The account changed. Refresh your account.' }) }); return;
  }
  page.setData({ busy: true, error: '', message: '' });
  try {
    const response = await requestJson<{ ok?: boolean }>(path, { method: 'POST', token: state.session.token, body });
    if (!current(page, state, attempt)) return;
    if (response?.ok !== true) throw new Error('invalid response');
    page.setData({ ...SENSITIVE, message: tr({ zh: '已保存', en: 'Saved' }), ready: false });
  } catch (error) { if (current(page, state, attempt)) page.setData({ error: errorText(error), code: '', currentPassword: '', newPassword: '', repeatPassword: '' }); }
  finally { if (states.get(page) === state && state.attempt === attempt) page.setData({ busy: false }); }
}
export function createNativeAccountSettingsPageOptions() {
  return {
    data: { appearanceStyle: '', copy: labels(), busy: false, ready: false, error: '', message: '',
      providerIndex: 0, providerOptions: [labels().email, labels().phone], ...SENSITIVE, bound: false, hasPassword: false } as SettingsData,
    onShow() {
      this.setData({ copy: labels(), providerOptions: [labels().email, labels().phone] });
      applyNativeAppearance(); hidePublicShareMenu();
      miniProgramApi().setNavigationBarTitle({ title: labels().title });
      void this.loadAccount();
    },
    onHide() { states.delete(this); this.setData({ ...SENSITIVE, ready: false, busy: false }); },
    onUnload() { states.delete(this); this.setData({ ...SENSITIVE, ready: false, busy: false }); },
    async loadAccount() {
      if (this.data.busy) return;
      const session = getStoredSession();
      if (!session?.user.uid) { this.setData({ error: tr({ zh: '请先在「我的」登录。', en: 'Sign in from Me first.' }), ready: false }); return; }
      const old = states.get(this);
      const state: State = { session, providers: new Set(), attempt: {}, sendAt: old?.session.token === session.token ? old.sendAt : 0 };
      states.set(this, state);
      const attempt = state.attempt;
      this.setData({ busy: true, ready: false, error: '' });
      try {
        const result = await fetchNativeAccountIdentities(session, () => current(this, state, attempt));
        if (!current(this, state, attempt)) return;
        state.providers = new Set(result.identities.map(row => row.provider));
        this.setData({ ready: true, hasPassword: result.hasPassword, bound: state.providers.has(this.data.providerIndex === 0 ? 'email' : 'phone') });
      } catch (error) { if (current(this, state, attempt)) this.setData({ error: errorText(error) }); }
      finally { if (states.get(this) === state) this.setData({ busy: false }); }
    },
    input(event: WechatMiniprogram.Input & { currentTarget: { dataset: { field?: string } } }) {
      const field = event.currentTarget.dataset.field;
      if (this.data.busy || !['destination', 'code', 'currentPassword', 'newPassword', 'repeatPassword'].includes(field ?? '')) return;
      this.setData({ [field!]: field === 'code' ? event.detail.value.replace(/\D/g, '').slice(0, 6) : event.detail.value, error: '' });
    },
    clearDestination() { if (!this.data.busy) this.setData({ destination: '', code: '' }); },
    toggleConsent() { if (!this.data.busy) this.setData({ consent: !this.data.consent }); },
    togglePassword() { this.setData({ showPassword: !this.data.showPassword }); },
    openPolicy() { miniProgramApi().navigateTo({ url: '/pages/privacy/index' }); },
    selectProvider(event: WechatMiniprogram.PickerChange) {
      if (this.data.busy) return;
      const index = Number(event.detail.value);
      if (index !== 0 && index !== 1) return;
      this.setData({ providerIndex: index, destination: '', code: '', consent: false,
        bound: states.get(this)?.providers.has(index === 0 ? 'email' : 'phone') ?? false });
    },
    async sendCode() {
      const state = states.get(this);
      if (!state || !this.data.ready || this.data.busy || !this.data.consent) return;
      const provider = this.data.providerIndex === 0 ? 'email' : 'phone';
      const value = provider === 'email' ? normalizeEmail(this.data.destination) : normalizePhone(this.data.destination);
      if (!(provider === 'email' ? isValidEmail(value) : isValidPhone(value))) {
        this.setData({ error: tr({ zh: '请输入有效邮箱或中国大陆手机号。', en: 'Enter a valid email or mainland China phone number.' }) }); return;
      }
      if (Date.now() < state.sendAt) { this.setData({ error: tr({ zh: '请稍后再发送验证码。', en: 'Wait before sending another code.' }) }); return; }
      const attempt = {}; state.attempt = attempt;
      if (!current(this, state, attempt)) return;
      state.sendAt = Date.now() + 60_000;
      this.setData({ busy: true, error: '', message: '' });
      try {
        await requestJson(`/auth/link/${provider}/send`, { method: 'POST', token: state.session.token, body: { [provider]: value } });
        if (current(this, state, attempt)) this.setData({ message: tr({ zh: '验证码已发送', en: 'Code sent' }) });
      } catch (error) { if (current(this, state, attempt)) this.setData({ error: errorText(error) }); }
      finally { if (states.get(this) === state) this.setData({ busy: false }); }
    },
    async bindCredential() {
      const state = states.get(this);
      if (!state || !this.data.ready || this.data.busy || !this.data.consent) return;
      const provider = this.data.providerIndex === 0 ? 'email' : 'phone';
      const value = provider === 'email' ? normalizeEmail(this.data.destination) : normalizePhone(this.data.destination);
      if (!(provider === 'email' ? isValidEmail(value) : isValidPhone(value)) || !/^\d{6}$/.test(this.data.code)) {
        this.setData({ error: tr({ zh: '请输入有效账号和 6 位验证码。', en: 'Enter a valid account and six-digit code.' }) }); return;
      }
      const path = state.providers.has(provider) ? `/auth/${provider}/replace` : `/auth/link/${provider}/verify`;
      await mutate(this, state, path, { [provider]: value, code: this.data.code });
      if (states.get(this) === state && !this.data.ready) await this.loadAccount();
    },
    async savePassword() {
      const state = states.get(this);
      if (!state || !this.data.ready || this.data.busy) return;
      if (!isValidPassword(this.data.newPassword) || this.data.newPassword !== this.data.repeatPassword
        || (this.data.hasPassword && !this.data.currentPassword)) {
        this.setData({ error: tr({ zh: '新密码须为 8–128 位且两次一致；修改已有密码需填写当前密码。', en: 'Use matching 8–128 character passwords. Enter your current password when changing it.' }) }); return;
      }
      await mutate(this, state, '/auth/password/set', { password: this.data.newPassword, currentPassword: this.data.currentPassword });
      if (states.get(this) === state && !this.data.ready) await this.loadAccount();
    },
  } satisfies WechatMiniprogram.Page.Options<SettingsData, WechatMiniprogram.Page.CustomOption>;
}
