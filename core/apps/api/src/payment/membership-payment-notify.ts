import { adminRecipients, notify } from '../utils/notify.js';
import { sendBark } from '../monitors/bark.js';

export interface PaidMembershipNotice {
  orderNo: string; name: string; memberKey: string; plan: string;
  amountMinor: number; currency: string; channel: string;
}

/** Only called after the payment transaction commits. Never sends credentials or callback payloads. */
export async function notifyMembershipPayment(order: PaidMembershipNotice): Promise<void> {
  const methods: Record<string, string> = { alipay: '支付宝 / Alipay', wechat: '微信支付 / WeChat Pay',
    card_cn: '境内银行卡 / Domestic card', card_global: '国际银行卡 / International card' };
  const title = `会员收款 / Membership payment · ${(order.amountMinor / 100).toFixed(2)} ${order.currency}`;
  const body = `${order.name} (${order.memberKey})\n${order.plan}\n${methods[order.channel] || order.channel}\n订单 / Order: ${order.orderNo}`;
  const results = await Promise.allSettled([
    notify({ recipients: adminRecipients(), kind: 'membership_payment', actorKey: '', actorName: '',
      title, excerpt: body, link: '/admin/users', dedupeKey: `membership-payment:${order.orderNo}`, email: false }),
    sendBark({ title, body, url: 'https://cuberoot.me/admin/users', group: 'Membership payments' }),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected' || result.value === false) {
      console.warn(`[membership] ${index === 0 ? 'in-site' : 'Bark'} payment notification failed for ${order.orderNo}`);
    }
  }
}
