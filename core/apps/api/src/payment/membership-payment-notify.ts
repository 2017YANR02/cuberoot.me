import type { QueryRunner } from '../db/connection.js';
import { adminRecipients, insertNotifications } from '../utils/notify.js';
import { sendBark } from '../monitors/bark.js';

export interface PaidMembershipNotice {
  orderNo: string; name: string; memberKey: string; plan: string;
  amountMinor: number; currency: string; channel: string;
  renewalCycle?: number;
}

const membershipAdminLink = '/admin/users?tab=memberships';
const methods: Record<string, string> = { alipay: '支付宝 / Alipay', wechat: '微信支付 / WeChat Pay',
  card_cn: '境内银行卡 / Domestic card', card_global: '国际银行卡 / International card' };

function paymentMessage(order: PaidMembershipNotice) {
  const method = order.channel === 'wechat_papay'
    ? order.renewalCycle === 0 ? '微信订阅首笔付款 / WeChat subscription first payment' : '微信自动续费 / WeChat auto-renewal'
    : methods[order.channel] || order.channel;
  const title = `会员收款 / Membership payment · ${(order.amountMinor / 100).toFixed(2)} ${order.currency}`;
  const body = `${order.name} (${order.memberKey})\n${order.plan}\n${method}\n订单 / Order: ${order.orderNo}`;
  return { title, body };
}

/** Persist the super administrator's inbox alert in the same transaction as the payment. */
export async function recordMembershipPaymentNotice(run: QueryRunner, order: PaidMembershipNotice): Promise<boolean> {
  const { title, body } = paymentMessage(order);
  const { insertedTargets } = await insertNotifications({
    recipients: adminRecipients(), kind: 'membership_payment', actorKey: '', actorName: '',
    title, excerpt: body, link: membershipAdminLink, dedupeKey: `membership-payment:${order.orderNo}`,
  }, run);
  return insertedTargets.length > 0;
}

/** Best-effort external delivery, after the transaction has committed. */
export async function pushMembershipPayment(order: PaidMembershipNotice): Promise<void> {
  try {
    const sent = await sendBark({ ...paymentMessage(order), url: `https://cuberoot.me${membershipAdminLink}`, group: 'Membership payments' });
    if (sent) return;
  } catch { /* The committed in-site alert remains available. */ }
  console.warn(`[membership] Bark payment notification failed for ${order.orderNo}`);
}
