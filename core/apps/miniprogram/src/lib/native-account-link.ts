import { isValidEmail, normalizeEmail, isValidPhone, normalizePhone } from '@cuberoot/shared/account';
import { decodeWebSession } from '@cuberoot/shared/auth/web-session';
import { ApiError, requestJson } from './auth';
import { applyNativeAppearance } from './appearance';
import { tr } from './i18n';
import { miniProgramApi } from './platform';
import { hidePublicShareMenu } from './share';
import { scheduleRuntimeTimeout, clearRuntimeTimeout, type RuntimeTimer } from './runtime-timers';

function labels() { return {
  title: tr({ zh: '获取登录码', en: 'Get a sign-in code' }),
  email: tr({ zh: '原账号邮箱', en: 'Existing account email' }),
  verification: tr({ zh: '6 位验证码', en: 'Six-digit verification code' }),
  phone: tr({ zh: '原账号中国大陆手机号', en: 'Existing mainland China phone number' }),
  password: tr({ zh: '密码', en: 'Password' }),
  showPassword: tr({ zh: '显示密码', en: 'Show password' }),
  hidePassword: tr({ zh: '隐藏密码', en: 'Hide password' }),
  clear: tr({ zh: '清除', en: 'Clear' }),
  methods: [tr({ zh: '邮箱验证码', en: 'Email code' }), tr({ zh: '邮箱和密码', en: 'Email and password' }), tr({ zh: '短信验证码', en: 'SMS code' })],
  send: tr({ zh: '发送验证码', en: 'Send verification code' }),
  sent: tr({ zh: '验证码已发送', en: 'Verification code sent' }),
  generate: tr({ zh: '验证并获取登录码', en: 'Verify and get sign-in code' }),
  copy: tr({ zh: '复制登录码', en: 'Copy sign-in code' }),
  back: tr({ zh: '返回确认账号', en: 'Return to confirm account' }),
  policy: tr({ zh: '用户协议与隐私政策', en: 'Agreement and privacy policy' }),
  agreement: tr({ zh: '同意用户协议与隐私政策', en: 'Accept the agreement and privacy policy' }),
  note: tr({ zh: '仅用于登录已有账号。返回后输入登录码，核对账号再确认。不要向他人提供此码。', en: 'Existing accounts only. Return, enter this code and check the account before confirming. Do not share this code.' }),
}; }
interface LinkData {
  appearanceStyle: string; copy: ReturnType<typeof labels>; email: string; code: string;
  agreement: boolean; busy: boolean; message: string; error: string;
  linkCode: string; account: string; expiresAt: number; expiresLabel: string;
  method: number; password: string; showPassword: boolean;
}
interface LinkPage { data: LinkData; setData(value: Partial<LinkData>): void; active: boolean; attempt: number; nextSendAt: number; expiryTimer?: RuntimeTimer }
function invalidate(page: LinkPage) {
  page.active = false; ++page.attempt;
  if (page.expiryTimer) clearRuntimeTimeout(page.expiryTimer);
  page.expiryTimer = undefined;
  page.setData({ code: '', password: '', showPassword: false, linkCode: '', account: '', expiresAt: 0, expiresLabel: '', busy: false, message: '' });
}
function failure(error: unknown) {
  if (error instanceof ApiError && error.status === 429) return tr({ zh: '操作频繁，请稍后重试。', en: 'Too many attempts. Please try later.' });
  return tr({ zh: '未能完成验证，请检查账号、验证码或密码。', en: 'Verification failed. Check your account, code or password.' });
}
export function createNativeAccountLinkPageOptions() {
  return {
    data: { appearanceStyle: '', copy: labels(), email: '', code: '', method: 0, password: '', showPassword: false, agreement: false, busy: false, message: '', error: '', linkCode: '', account: '', expiresAt: 0, expiresLabel: '' } as LinkData,
    active: false, attempt: 0, nextSendAt: 0,
    onShow() { this.active = true; this.setData({ copy: labels() }); applyNativeAppearance(); hidePublicShareMenu(); miniProgramApi().setNavigationBarTitle({ title: labels().title }); },
    onHide() { invalidate(this); },
    onUnload() { invalidate(this); },
    selectMethod(event: WechatMiniprogram.PickerChange) {
      const method = Number(event.detail.value);
      if (this.data.busy || ![0, 1, 2].includes(method)) return;
      ++this.attempt;
      this.setData({ method, email: '', code: '', password: '', showPassword: false, linkCode: '', account: '', error: '', message: '' });
    },
    inputPassword(event: WechatMiniprogram.Input) { if (!this.data.busy) this.setData({ password: event.detail.value }); },
    togglePassword() { this.setData({ showPassword: !this.data.showPassword }); },
    clearAccount() { if (!this.data.busy) this.setData({ email: '', code: '', password: '' }); },
    inputEmail(event: WechatMiniprogram.Input) {
      if (!this.data.busy) this.setData({ email: event.detail.value.slice(0, 320), code: '', linkCode: '', error: '', message: '' });
    },
    inputCode(event: WechatMiniprogram.Input) {
      if (!this.data.busy) this.setData({ code: event.detail.value.replace(/\D/g, '').slice(0, 6), error: '' });
    },
    toggleAgreement() { if (!this.data.busy) this.setData({ agreement: !this.data.agreement }); },
    openPolicy() { miniProgramApi().navigateTo({ url: '/pages/privacy/index' }); },
    async sendCode() {
      if (!this.active || this.data.busy || !this.data.agreement || this.data.method === 1) return;
      const sms = this.data.method === 2;
      const email = normalizeEmail(this.data.email);
      const phone = normalizePhone(this.data.email);
      if (!(sms ? isValidPhone(phone) : isValidEmail(email))) { this.setData({ error: tr({ zh: '请输入有效邮箱或中国大陆手机号。', en: 'Enter a valid email or mainland China phone number.' }) }); return; }
      if (Date.now() < this.nextSendAt) { this.setData({ error: tr({ zh: '请稍后再发送验证码。', en: 'Wait before requesting another code.' }) }); return; }
      const attempt = ++this.attempt;
      this.nextSendAt = Date.now() + 60_000;
      this.setData({ busy: true, error: '', message: '' });
      try {
        await requestJson(sms ? '/auth/phone/send' : '/auth/email/send', { method: 'POST', body: sms ? { phone, purpose: 'login' } : { email } });
        if (this.active && this.attempt === attempt) this.setData({ message: labels().sent });
      } catch (error) {
        if (this.active && this.attempt === attempt) this.setData({ error: failure(error) });
      } finally { if (this.active && this.attempt === attempt) this.setData({ busy: false }); }
    },
    async generateCode() {
      if (!this.active || this.data.busy || !this.data.agreement) return;
      const email = normalizeEmail(this.data.email), code = this.data.code;
      const phone = normalizePhone(this.data.email);
      const method = this.data.method;
      if (!(method === 2 ? isValidPhone(phone) : isValidEmail(email)) || (method === 1 ? !this.data.password : !/^\d{6}$/.test(code))) {
        this.setData({ error: tr({ zh: '请填写有效账号及验证码或密码。', en: 'Enter a valid account and code or password.' }) }); return;
      }
      const attempt = ++this.attempt;
      const current = () => this.active && this.attempt === attempt;
      this.setData({ busy: true, error: '', message: '', linkCode: '' });
      try {
        const response = await requestJson<unknown>(method === 1 ? '/auth/email/password' : method === 2 ? '/auth/phone/verify' : '/auth/email/verify', {
          method: 'POST', body: method === 1 ? { email, password: this.data.password }
            : method === 2 ? { phone, code, purpose: 'login', existingOnly: true } : { email, code, existingOnly: true },
        });
        if (!current()) return;
        const session = decodeWebSession(response);
        if (!session || (response as { isNew?: boolean }).isNew === true) throw new Error('invalid existing account');
        // Never install this session. It only proves ownership for issuing a code.
        const issued = await requestJson<{ linkCode: string; expiresInSeconds: number }>('/auth/identity/link-code', {
          method: 'POST', token: session.token, body: { expectedUid: session.user.uid },
        });
        if (!current()) return;
        if (typeof issued.linkCode !== 'string' || !/^\d{6}$/.test(issued.linkCode) || !Number.isSafeInteger(issued.expiresInSeconds) || issued.expiresInSeconds <= 0 || issued.expiresInSeconds > 3600) throw new Error('invalid link code');
        const expiresAt = Date.now() + issued.expiresInSeconds * 1000;
        this.setData({ code: '', password: '', linkCode: issued.linkCode, account: `${session.user.name} · CubeRoot ID ${session.user.uid}`,
          expiresAt, expiresLabel: tr({ zh: `有效期 ${issued.expiresInSeconds} 秒`, en: `Valid for ${issued.expiresInSeconds} seconds` }) });
        this.expiryTimer = scheduleRuntimeTimeout(() => {
          if (current()) this.setData({ linkCode: '', error: tr({ zh: '登录码已过期，请重新验证。', en: 'The sign-in code expired. Verify again.' }) });
        }, issued.expiresInSeconds * 1000) ?? undefined;
      } catch (error) { if (current()) this.setData({ error: failure(error), code: '', password: '' }); }
      finally { if (current()) this.setData({ busy: false }); }
    },
    copyCode() {
      if (!this.data.linkCode || Date.now() >= this.data.expiresAt) {
        this.setData({ linkCode: '', error: tr({ zh: '登录码已过期，请重新验证。', en: 'The sign-in code expired. Verify again.' }) }); return;
      }
      const fail = () => { if (this.active) this.setData({ error: tr({ zh: '复制失败，请手动输入登录码。', en: 'Copy failed. Enter the sign-in code manually.' }) }); };
      try { miniProgramApi().setClipboardData({ data: this.data.linkCode, fail }); } catch { fail(); }
    },
    returnToAccount() { miniProgramApi().navigateBack({ delta: 1 }); },
  } satisfies WechatMiniprogram.Page.Options<LinkData, WechatMiniprogram.Page.CustomOption & Pick<LinkPage, 'active' | 'attempt' | 'nextSendAt' | 'expiryTimer'>>;
}
