import { getStoredSession, requestJson, miniProgramLoginCode, ApiError } from '../../lib/auth';
import { isDouyinMiniProgram, miniProgramApi } from '../../lib/platform';
import { applyNativeAppearance, nativeAppearanceStyle } from '../../lib/appearance';
import { tr } from '../../lib/i18n';

type Payout = { id: string; amountMinor: string; status: string; currency: string; transferState: string | null };
const text = (zh: string, en: string) => tr({ zh, en });
const loginRequired = () => text('请在“我的”登录本人讲师账号后重试', 'Sign in to your instructor account in Me, then try again');
function payoutError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return loginRequired();
    if (error.status === 403 && ['Active instructor access required', 'A user-backed instructor account is required'].includes(error.message)) {
      return text('当前账号没有已启用的讲师身份，请使用本人讲师账号', 'This account is not an active instructor. Use your own instructor account.');
    }
    if (error.status >= 400 && error.status < 500) return error.message;
  }
  return fallback;
}
function copy() {
  return {
    title: text('佣金提现', 'Commission payouts'),
    heading: text('微信收款', 'Receive via WeChat'),
    configured: text('已设为默认收款方式', 'Default receiving account'),
    name: text('微信实名姓名', 'WeChat verified name'),
    consent: text('我确认使用本人微信收款，同意财务审核后转账。', 'I confirm this is my WeChat and agree to receive transfers after finance approval.'),
    bind: text('使用微信收款', 'Use WeChat'),
    update: text('更新收款微信', 'Update receiving WeChat'),
    receipt: text('确认收款', 'Confirm receipt'),
    empty: text('暂无结算记录', 'No payout records'),
    available: text('可申请提现', 'Available to request'),
    request: text('申请提现', 'Request payout'),
  };
}
let payoutRequest: { key: string; amountMinor: number; owner: string } | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let visible = false;
let loading = false;
function stopRefresh() { visible = false; clearTimeout(refreshTimer); }

Page({
  data: {
    appearanceStyle: nativeAppearanceStyle(), copy: copy(), name: '', agreed: false,
    busy: false, error: '', loadError: '', configured: false, loaded: false, availableMinor: 0, available: '0.00',
    payouts: [] as Array<Payout & { label: string; amount: string }>,
  },
  onShow() {
    visible = true;
    applyNativeAppearance();
    this.refreshLocale();
    void this.load();
  },
  onHide: stopRefresh,
  onUnload: stopRefresh,
  refreshLocale() {
    const content = copy();
    this.setData({ copy: content, appearanceStyle: nativeAppearanceStyle() });
    miniProgramApi().setNavigationBarTitle({ title: content.title });
  },
  async onPullDownRefresh() { try { await this.load(); } finally { miniProgramApi().stopPullDownRefresh(); } },
  nameInput(e: WechatMiniprogram.Input) { this.setData({ name: e.detail.value }); },
  agree(e: WechatMiniprogram.CheckboxGroupChange) { this.setData({ agreed: e.detail.value.includes('yes') }); },
  showError(message: string) {
    this.setData({ error: message });
    miniProgramApi().showModal({ title: text('未完成操作', 'Action incomplete'), content: message, showCancel: false });
  },
  async load() {
    if (loading) return;
    clearTimeout(refreshTimer);
    const session = getStoredSession();
    if (!session || isDouyinMiniProgram()) {
      this.setData({ loadError: loginRequired() });
      return;
    }
    loading = true;
    try {
      const [profile, result] = await Promise.all([
        requestJson<{ configured: boolean; method?: string }>('/platform/instructor/payout-profile', { token: session.token }),
        requestJson<{ payouts: Payout[]; availableMinor: number }>('/platform/instructor/payouts', { token: session.token }),
      ]);
      const labels: Record<string, string> = {
        draft: text('待审核', 'Awaiting approval'), approved: text('待打款', 'Awaiting transfer'),
        processing: text('微信处理中', 'Processing'), paid: text('已到账', 'Paid'),
        failed: text('待核对或转账失败', 'Failed or needs reconciliation'), cancelled: text('已取消', 'Cancelled'),
      };
      this.setData({
        configured: profile.configured && profile.method === 'wechat', loadError: '', loaded: true, availableMinor: result.availableMinor, available: (result.availableMinor / 100).toFixed(2),
        payouts: result.payouts.map(p => ({ ...p, amount: (Number(p.amountMinor) / 100).toFixed(2),
          label: p.transferState === 'WAIT_USER_CONFIRM' ? text('待确认收款', 'Confirm receipt') : labels[p.status] || text('待核对', 'Needs reconciliation') })),
      });
    } catch (error) { this.setData({ loadError: payoutError(error, text('佣金记录暂不可用，请稍后下拉刷新', 'Payout records unavailable. Pull down to refresh later.')) }); }
    finally {
      loading = false;
      if (visible) refreshTimer = setTimeout(() => { void this.load(); }, 30_000);
    }
  },
  async bindWechat() {
    if (this.data.busy) return;
    const session = getStoredSession();
    if (!session || isDouyinMiniProgram()) { this.showError(loginRequired()); return; }
    if (!this.data.name.trim() || !this.data.agreed) {
      this.showError(text('请填写微信实名姓名并确认本人收款', 'Enter your verified name and confirm your receiving account'));
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      const code = await miniProgramLoginCode();
      const result = await requestJson<{ configured: boolean; method: string }>('/platform/instructor/payout-profile/wechat', {
        method: 'POST', token: session.token, idempotencyKey: `wx-profile-${Date.now()}`,
        body: { code, accountName: this.data.name.trim(), agreed: true },
      });
      if (!result.configured || result.method !== 'wechat') throw new Error('Unconfirmed payout profile');
      this.setData({ configured: true, name: '', agreed: false });
      miniProgramApi().showToast({ title: text('微信收款设置成功', 'WeChat payout linked'), icon: 'success' });
      await this.load();
    } catch (error) { this.showError(payoutError(error, text('绑定结果待核对，请下拉刷新后重试', 'Link result unconfirmed. Pull down to refresh before retrying.'))); }
    finally { this.setData({ busy: false }); }
  },
  async requestPayout() {
    if (this.data.busy) return;
    const session = getStoredSession();
    if (!session || isDouyinMiniProgram()) { this.showError(loginRequired()); return; }
    if (!this.data.configured) { this.showError(text('请先设置本人微信收款', 'Set up your WeChat receiving account first')); return; }
    const owner = String(session.user.uid ?? session.user.wcaId);
    if (payoutRequest && payoutRequest.owner !== owner) payoutRequest = null;
    if (!payoutRequest && this.data.availableMinor <= 0) { this.showError(text('当前没有可提现佣金', 'No commission is available to withdraw')); return; }
    payoutRequest ??= { key: `wx-payout-${Date.now()}`, amountMinor: this.data.availableMinor, owner };
    this.setData({ busy: true, error: '' });
    try {
      await requestJson('/platform/instructor/payouts', { method: 'POST', token: session.token, idempotencyKey: payoutRequest.key, body: { amountMinor: payoutRequest.amountMinor, method: 'wechat', agreed: true } });
      payoutRequest = null;
      miniProgramApi().showToast({ title: text('申请已提交', 'Request submitted'), icon: 'success' });
      await this.load();
    } catch (error) {
      if (error instanceof ApiError && [400, 403, 409, 422].includes(error.status)) {
        // A rejected transaction has not created a request; refresh before correcting it.
        payoutRequest = null;
        this.showError(payoutError(error, error.message));
      } else this.showError(payoutError(error, text('申请结果待核对，请重试原申请', 'Request unconfirmed. Retry the original request.')));
    } finally { this.setData({ busy: false }); }
  },
  async confirmReceipt(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return;
    const api = miniProgramApi(), session = getStoredSession();
    if (!session || isDouyinMiniProgram()) { this.showError(loginRequired()); return; }
    if (!api.canIUse('requestMerchantTransfer')) {
      this.showError(text('请更新微信后确认收款', 'Update WeChat to confirm receipt'));
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      const code = await miniProgramLoginCode();
      const result = await requestJson<{ state: string; appId?: string; mchId?: string; package?: string }>(
        `/platform/instructor/payouts/${encodeURIComponent(String(e.currentTarget.dataset.id))}/receipt`,
        { method: 'POST', token: session.token, body: { code } },
      );
      if (result.state === 'WAIT_USER_CONFIRM' && result.appId === api.getAccountInfoSync().miniProgram.appId && result.mchId && result.package) {
        await new Promise<void>(resolve => api.requestMerchantTransfer({ appId: result.appId!, mchId: result.mchId!, package: result.package!, complete: () => resolve() }));
      }
      // The native callback is not proof of payment; read server state only.
      await this.load();
    } catch (error) { this.showError(payoutError(error, text('微信结果暂未确认，请稍后刷新原申请', 'Transfer unconfirmed. Refresh the original payout later.'))); }
    finally { this.setData({ busy: false }); }
  },
});
