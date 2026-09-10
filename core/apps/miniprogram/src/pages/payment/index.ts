import { ApiError, getStoredSession, miniProgramLoginCode, requestJson } from '../../lib/auth';
import { tr } from '../../lib/i18n';
import { isDouyinMiniProgram, miniProgramApi } from '../../lib/platform';
import { clearRuntimeTimeout, scheduleRuntimeTimeout, type RuntimeTimer } from '../../lib/runtime-timers';

interface PaymentParameters {
  timeStamp: string; nonceStr: string; package: string; signType: 'RSA'; paySign: string;
}
interface Order {
  id: string; orderNumber: string; status: string; currency: string; totalAmountMinor: number;
  items: Array<{ sellableType: string }>;
}
interface PaymentState {
  orderId: string; visible: boolean; token: string; polls: number; timer: RuntimeTimer | null;
  parameters?: PaymentParameters;
}
const states = new WeakMap<object, PaymentState>();
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PAYMENT_NOT_CONFIGURED') return tr({ en: 'WeChat payment is not yet available for this Mini Program.', zh: '此小程序暂未开通微信支付。' });
    if (error.status === 401 || error.status === 403) return tr({ en: 'Sign in with the WeChat account used for this order, then try again.', zh: '请使用下单时绑定的微信账号登录，再重试。' });
    if (error.status === 409) return tr({ en: 'The order has changed. Refresh its status before retrying.', zh: '订单状态已变化，请刷新后再试。' });
    if (error.status === 404) return tr({ en: 'This order is unavailable.', zh: '无法找到此订单。' });
  }
  return tr({ en: 'Unable to confirm payment. Refresh the order or try again later.', zh: '暂时无法确认支付，请刷新订单或稍后重试。' });
}

Page({
  data: {
    labels: {
      title: tr({ en: 'Competition entry', zh: '赛事报名支付' }),
      pay: tr({ en: 'Pay with WeChat', zh: '微信支付' }),
      refresh: tr({ en: 'Refresh status', zh: '刷新支付状态' }),
      return: tr({ en: 'Return to order', zh: '返回订单' }),
    },
    amount: '', orderNumber: '', message: '', error: '', canPay: false, hasOrder: false, busy: false,
  },
  onLoad(options: Record<string, string | undefined>) {
    const orderId = options.orderId ?? '';
    if (isDouyinMiniProgram()) {
      this.setData({ message: tr({ en: 'Competition payment is not available in the Douyin Mini Program.', zh: '抖音小程序暂不支持赛事报名支付。' }) });
      return;
    }
    if (!ORDER_ID.test(orderId)) {
      this.setData({ error: tr({ en: 'Invalid order link.', zh: '订单链接无效。' }) });
      return;
    }
    const session = getStoredSession();
    if (!session) {
      this.setData({ error: tr({ en: 'Sign in from the Me tab, then return to your order.', zh: '请先在「我的」登录，再回到订单。' }) });
      return;
    }
    states.set(this, { orderId, token: session.token, visible: true, polls: 0, timer: null });
    this.setData({ hasOrder: true, message: tr({ en: 'Loading order…', zh: '正在读取订单…' }) });
  },
  onShow() {
    const state = states.get(this);
    if (!state) return;
    state.visible = true;
    void this.refresh();
  },
  onHide() {
    const state = states.get(this);
    if (state) { state.visible = false; clearRuntimeTimeout(state.timer); state.timer = null; }
  },
  onUnload() { this.onHide(); states.delete(this); },
  async refresh() {
    const state = states.get(this);
    if (!state || !state.visible) return;
    clearRuntimeTimeout(state.timer);
    state.timer = null;
    try {
      const order = await requestJson<Order>(`/platform/orders/${state.orderId}`, { token: state.token });
      if (states.get(this) !== state || !state.visible) return;
      if (order.id !== state.orderId || !Number.isSafeInteger(Number(order.totalAmountMinor))) throw new Error('Invalid order');
      const paid = ['paid', 'fulfilled', 'partially_fulfilled'].includes(order.status);
      const pending = order.status === 'pending_payment';
      const ticketOnly = Array.isArray(order.items) && order.items.length > 0 && order.items.every((item) => item.sellableType === 'event_ticket');
      const canPay = pending && ticketOnly && order.currency === 'CNY' && Number(order.totalAmountMinor) > 0;
      this.setData({
        orderNumber: order.orderNumber, amount: `${order.currency} ${(Number(order.totalAmountMinor) / 100).toFixed(2)}`, canPay,
        message: paid ? tr({ en: 'Payment confirmed. Return to your order to view your entry.', zh: '支付已确认，返回订单查看报名。' })
          : canPay ? tr({ en: 'CubeRoot collects your entry fee. Your entry is confirmed after payment.', zh: '报名费由 CubeRoot 统一收取，支付确认后报名生效。' })
          : tr({ en: 'This order cannot be paid here. Return to your order for details.', zh: '此订单当前无法在这里支付，请返回订单查看详情。' }),
        error: paid ? '' : this.data.error,
      });
      if (pending && state.polls++ < 15) state.timer = scheduleRuntimeTimeout(() => void this.refresh(), 2000);
    } catch (error) {
      if (states.get(this) === state && state.visible) this.setData({ error: errorMessage(error) });
    }
  },
  async pay() {
    const state = states.get(this);
    if (!state || this.data.busy || !this.data.canPay || isDouyinMiniProgram()) return;
    this.setData({ busy: true, error: '' });
    try {
      if (!state.parameters) {
        const code = await miniProgramLoginCode();
        if (states.get(this) !== state) return;
        const result = await requestJson<{ requestPayment?: PaymentParameters }>(`/platform/orders/${state.orderId}/payment-attempts`, {
          method: 'POST', token: state.token, timeoutMs: 30_000,
          body: { provider: 'wechat', clientType: 'miniprogram', code },
          idempotencyKey: `mini-payment:${state.orderId}:${Date.now()}`,
        });
        const params = result.requestPayment;
        if (!params || params.signType !== 'RSA' || !/^prepay_id=\S+$/.test(params.package)
          || !/^\d+$/.test(params.timeStamp) || !params.nonceStr || !params.paySign) throw new Error('Invalid payment response');
        state.parameters = params;
      }
      if (states.get(this) !== state || !state.visible) return;
      await new Promise<void>((resolve, reject) => miniProgramApi().requestPayment({
        ...state.parameters!, success: () => resolve(), fail: (error) => reject(error),
      }));
      if (states.get(this) === state) this.setData({ message: tr({ en: 'Confirming payment…', zh: '正在确认支付结果…' }) });
    } catch (error) {
      if (states.get(this) === state) {
        const cancelled = error && typeof error === 'object' && 'errMsg' in error && String(error.errMsg).includes('cancel');
        this.setData({ error: cancelled ? tr({ en: 'Payment cancelled. You can retry while the order is open.', zh: '已取消支付，订单有效期内可重试。' }) : errorMessage(error) });
      }
    } finally {
      if (states.get(this) === state) { this.setData({ busy: false }); state.polls = 0; void this.refresh(); }
    }
  },
  returnToOrder() {
    miniProgramApi().navigateBack({ delta: 1, fail: () => miniProgramApi().switchTab({ url: '/pages/account/index' }) });
  },
});
