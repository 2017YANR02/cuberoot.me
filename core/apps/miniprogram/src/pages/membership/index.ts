import { applyNativeAppearance } from '../../lib/appearance';
import { getStoredSession, miniProgramLoginCode, requestJson } from '../../lib/auth';
import { openRequiredSessionLogin } from '../../lib/required-session';
import { isDouyinMiniProgram, miniProgramApi } from '../../lib/platform';
import { tr } from '../../lib/i18n';

interface Context { ticket?: string; pilot?: boolean; pilotPayment?: boolean; account: string; name: string; planSlug: string; priceCents: number; period: string; termsVersion: string; available: boolean }
interface Contract { id: string; planSlug: string; state: string; syncStatus: string; cancellationRequested: boolean; billingStatus: string | null }
const states = new WeakMap<object, { ticket: string; pilotPlan: string; visible: boolean; revision: number }>();
const labels = () => ({
  title: tr({ zh: '自动续费', en: 'Auto-renewal' }),
  login: tr({ zh: '登录 CubeRoot', en: 'Sign in to CubeRoot' }),
  agree: tr({ zh: '我已阅读并同意自动续费服务协议', en: 'I have read and agree to the Auto-renewal Agreement' }),
  terms: tr({ zh: '查看自动续费服务协议', en: 'Read the Auto-renewal Agreement' }),
  sign: tr({ zh: '确认账号并前往微信签约', en: 'Confirm account and authorize in WeChat' }),
  refresh: tr({ zh: '刷新签约与扣款状态', en: 'Refresh authorization and payment' }),
  cancel: tr({ zh: '取消自动续费', en: 'Cancel auto-renewal' }),
  rules: tr({ zh: '签约后申请首期扣款，到账后开通会员。后续在到期前 24 小时申请续费，由微信通知并延迟扣款。可随时取消，已付权益保留到期；取消不会自动退款。', en: 'The first charge is requested after authorization. Benefits start only after payment. Renewals are requested 24 hours before expiry; WeChat sends a notice before debiting. Cancel anytime. Paid benefits remain until expiry; cancellation does not refund previous payments.' }),
});

Page({
  data: { appearanceStyle: '', labels: labels(), context: null as Context | null,
    account: '', amount: '', message: '', error: '', agreed: false, busy: false,
    needsLogin: false, canSign: false, canCancel: false, contractId: '' },
  onLoad(options: Record<string, string | undefined>) {
    if (isDouyinMiniProgram()) return;
    const ticket = options.ticket ?? '';
    const pilotPlan = options.pilotPlan === 'yearly_auto_renew' ? 'yearly_auto_renew' : options.pilotPlan === 'monthly_auto_renew' ? 'monthly_auto_renew' : '';
    if ((!ticket && !pilotPlan) || ticket.length > 2048) { this.setData({ error: tr({ zh: '请从网站会员页重新打开签约链接。', en: 'Open a new authorization link from the website membership page.' }) }); return; }
    states.set(this, { ticket, pilotPlan, visible: false, revision: 0 });
  },
  onShow() {
    applyNativeAppearance();
    this.setData({ labels: labels() });
    miniProgramApi().setNavigationBarTitle({ title: this.data.labels.title });
    const state = states.get(this);
    if (state) { state.visible = true; void this.refresh(); }
  },
  onHide() { const s = states.get(this); if (s) { s.visible = false; s.revision++; } },
  onUnload() { this.onHide(); states.delete(this); },
  login() {
    const state = states.get(this);
    if (state) openRequiredSessionLogin({ tab: false, url: `/pages/membership/index?ticket=${encodeURIComponent(state.ticket)}&pilotPlan=${encodeURIComponent(state.pilotPlan)}` });
  },
  consent(event: WechatMiniprogram.CheckboxGroupChange) { this.setData({ agreed: event.detail.value.includes('agree') }); },
  terms() { miniProgramApi().navigateTo({ url: '/pages/web/index?key=renewal-terms' }); },
  async refresh() {
    const state = states.get(this);
    if (!state?.visible || isDouyinMiniProgram()) return;
    const revision = ++state.revision;
    const session = getStoredSession();
    this.setData({ needsLogin: !session, canSign: false, canCancel: false, error: '' });
    if (!session) return;
    try {
      const context = await requestJson<Context>('/membership/subscriptions/mini-context', { method: 'POST', token: session.token, body: { ticket: state.ticket, pilotPlan: state.pilotPlan } });
      const result = await requestJson<{ subscriptions: Contract[] }>('/membership/subscriptions', { token: session.token });
      if (!state.visible || state.revision !== revision || states.get(this) !== state || getStoredSession()?.token !== session.token) return;
      if (context.pilot && context.ticket) state.ticket = context.ticket;
      const contract = result.subscriptions.find(row => row.state !== 'terminated');
      const cancelled = result.subscriptions.some(row => row.state === 'terminated' && row.planSlug === context.planSlug);
      const message = contract?.syncStatus === 'unavailable'
        ? tr({ zh: '暂时无法向微信确认签约状态，请稍后刷新。', en: 'Unable to verify authorization with WeChat. Refresh later.' })
        : contract?.billingStatus === 'paid'
          ? tr({ zh: '付款已确认，会员权益已发放。', en: 'Payment confirmed. Membership benefits have been granted.' })
          : contract?.state === 'active'
            ? tr({ zh: '微信签约已确认，扣款结果尚未确认。会员权益以实际到账为准。', en: 'Authorization confirmed. Payment is still pending; benefits depend on confirmed payment.' })
            : !contract && cancelled
              ? tr({ zh: '已取消自动续费，不会再发起续费扣款。已付会员权益保留至到期。', en: 'Auto-renewal cancelled. No further renewal charges will be requested. Paid benefits remain until expiry.' })
              : tr({ zh: '请核对开通账号、价格及续费规则。', en: 'Check the membership account, price and renewal terms.' });
      this.setData({ context, account: `${context.name} (${context.account})`,
        amount: `¥${(context.priceCents / 100).toFixed(2)} / ${context.period === 'year' ? tr({ zh: '年', en: 'year' }) : tr({ zh: '月', en: 'month' })}`,
        message: context.pilot ? (context.pilotPayment
          ? tr({ zh: '指定账号验收：签约后申请真实首期扣款，验收期间不申请第二期扣款。', en: 'Private acceptance: signing requests a real first charge. No second-period charge during acceptance.' })
          : tr({ zh: '指定账号验收：目前扣款关闭，仅验证签约和取消，不发放会员。', en: 'Private acceptance: debits disabled. Test authorization and cancellation only; no membership is granted.' })) + '\n' + message : message, canSign: context.available && (!contract || contract.state === 'pending' && !contract.cancellationRequested && contract.planSlug === context.planSlug),
        canCancel: Boolean(contract && contract.state !== 'terminated'), contractId: contract?.id ?? '' });
    } catch {
      if (state.visible && state.revision === revision) this.setData({ context: null, error: tr({ zh: '链接已过期、账号不一致或服务暂不可用。请确认小程序与网站登录同一账号，再从网站重新打开。', en: 'The link expired, the account differs, or the service is unavailable. Sign in to the same account as the website and open a new link.' }) });
    }
  },
  async sign() {
    const state = states.get(this); const context = this.data.context; const session = getStoredSession();
    if (!state?.visible || !session || !context || !this.data.agreed || !this.data.canSign || this.data.busy || isDouyinMiniProgram()) return;
    this.setData({ busy: true, error: '' });
    try {
      const code = await miniProgramLoginCode();
      if (!state.visible || states.get(this) !== state || getStoredSession()?.token !== session.token) return;
      const result = await requestJson<{ miniProgram: { appId: string; path: string; extraData: Record<string, unknown> } }>('/membership/subscriptions/mini-enroll', {
        method: 'POST', token: session.token, body: { ticket: state.ticket, agreed: true, code, priceCents: context.priceCents, termsVersion: context.termsVersion },
      });
      if (!state.visible || states.get(this) !== state || getStoredSession()?.token !== session.token) return;
      const target = result.miniProgram;
      if (target.appId !== 'wxbd687630cd02ce1d' || target.path !== 'pages/index/index') throw new Error('invalid authorization target');
      await new Promise<void>((resolve, reject) => miniProgramApi().navigateToMiniProgram({
        appId: target.appId, path: target.path, extraData: target.extraData, success: () => resolve(), fail: reject,
      }));
      // Navigation and client return values never grant benefits. onShow queries the server.
    } catch {
      if (states.get(this) === state) this.setData({ error: tr({ zh: '未完成微信签约。请刷新状态后重试。', en: 'WeChat authorization was not completed. Refresh before retrying.' }) });
    } finally { if (states.get(this) === state) this.setData({ busy: false }); }
  },
  async cancel() {
    const state = states.get(this); const session = getStoredSession(); const id = this.data.contractId;
    if (!state?.visible || !session || !id || this.data.busy || !this.data.canCancel) return;
    const accepted = await new Promise<boolean>(resolve => miniProgramApi().showModal({ title: this.data.labels.cancel,
      content: tr({ zh: '确认取消？已付会员权益保留到期，取消不会自动退款。', en: 'Cancel renewal? Paid benefits remain until expiry. This does not issue a refund.' }),
      success: r => resolve(r.confirm), fail: () => resolve(false) }));
    if (!accepted || !state.visible || states.get(this) !== state || getStoredSession()?.token !== session.token) return;
    this.setData({ busy: true });
    try { await requestJson(`/membership/subscriptions/${id}/cancel`, { method: 'POST', token: session.token, body: { confirm: true } }); await this.refresh(); }
    catch { this.setData({ error: tr({ zh: '尚未确认解约，请稍后刷新，也可在微信扣费服务中取消。', en: 'Cancellation is not confirmed. Refresh later or cancel in WeChat payment services.' }) }); }
    finally { if (states.get(this) === state) this.setData({ busy: false }); }
  },
});
