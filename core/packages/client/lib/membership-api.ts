/**
 * /v1/membership — 会员订阅 API。
 * server 实现 routes/membership.ts。公开 GET 套餐;其余走 WCA OAuth Bearer(authHeaders)。
 * 支付:聚合支付(虎皮椒)异步入账,前端下单拿支付链接/二维码后轮询查单。
 */
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/membership';

export type MembershipPeriod = 'month' | 'year' | 'week' | 'day' | 'lifetime';

export interface MembershipPlan {
  slug: string;
  nameZh: string;
  nameEn: string;
  period: MembershipPeriod;
  periodCount: number;
  priceCents: number;
  currency: string;
  perks: string[];
}

export interface Membership {
  wcaId: string;
  name: string;
  avatarUrl?: string;
  planSlug: string;
  startedAt: string;
  expiresAt: string | null; // null = 永久
  lifetime: boolean;
  active: boolean;
  source: string;
  contact?: string;
  contactKind?: string;
}

// 到期提醒阈值:到期前 N 天起视为「即将到期」。
export const EXPIRE_SOON_DAYS = 7;

export interface MembershipExpiry {
  lifetime: boolean;
  active: boolean;
  expired: boolean;        // 曾是会员、现已过期
  daysLeft: number | null; // null = 永久;可为负(已过期天数)
  expiringSoon: boolean;   // 生效中、非永久、剩余 ≤ EXPIRE_SOON_DAYS
}

/** 从会员状态算到期信息(纯函数,页/徽章/全局提醒共用)。无会员返回 null。 */
export function membershipExpiry(m: Membership | null): MembershipExpiry | null {
  if (!m) return null;
  if (m.lifetime) return { lifetime: true, active: m.active, expired: false, daysLeft: null, expiringSoon: false };
  const exp = m.expiresAt ? new Date(m.expiresAt).getTime() : 0;
  const daysLeft = Math.ceil((exp - Date.now()) / 86_400_000);
  return {
    lifetime: false,
    active: m.active,
    expired: !m.active,
    daysLeft,
    expiringSoon: m.active && daysLeft <= EXPIRE_SOON_DAYS,
  };
}

export interface OrderInfo {
  outTradeNo: string;
  channel: string;
  provider?: string; // 'alipay' | 'wechat' | 'xunhupay'
  url?: string;      // 收银台跳转链接(支付宝 / 微信 H5 / 虎皮椒手机端)
  qrcode?: string;   // 扫码图(微信 Native code_url 转 PNG / 虎皮椒二维码图)
}

// 渠道可用性:某渠道官方或虎皮椒任一配置了即 true,前端据此显隐按钮。
export interface PayChannels {
  alipay: boolean;
  wechat: boolean;
}

export interface AdminOrder {
  outTradeNo: string;
  wcaId: string;
  name: string;
  planSlug: string;
  amountCents: number;
  provider: string;
  payChannel: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export async function listPlans(): Promise<{ plans: MembershipPlan[]; payEnabled: boolean; channels?: PayChannels }> {
  return handleApi(await fetch(`${BASE}/plans`));
}

export async function getMyMembership(): Promise<{ membership: Membership | null }> {
  return handleApi(await fetch(`${BASE}/me`, { headers: authHeaders(false) }));
}

export async function setMyContact(body: { contact: string | null; contactKind: string | null; note?: string | null }): Promise<{ membership: Membership }> {
  return handleApi(await fetch(`${BASE}/me/contact`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }));
}

export async function createOrder(plan: string, channel: 'alipay' | 'wechat', clientType: 'pc' | 'wap'): Promise<OrderInfo> {
  return handleApi(await fetch(`${BASE}/orders`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ plan, channel, clientType }) }));
}

export async function getOrderStatus(outTradeNo: string): Promise<{ status: string; planSlug: string; payChannel: string | null }> {
  return handleApi(await fetch(`${BASE}/orders/${encodeURIComponent(outTradeNo)}`, { headers: authHeaders(false) }));
}

// ── admin ──
export async function adminGrant(body: { wcaId: string; plan: string; name?: string; avatarUrl?: string | null }): Promise<{ membership: Membership }> {
  return handleApi(await fetch(`${BASE}/admin/grant`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }));
}

export async function adminList(): Promise<{ members: Membership[]; orders: AdminOrder[] }> {
  return handleApi(await fetch(`${BASE}/admin/list`, { headers: authHeaders(false) }));
}

export async function adminRevoke(wcaId: string): Promise<{ ok: boolean }> {
  return handleApi(await fetch(`${BASE}/admin/member/${encodeURIComponent(wcaId)}`, { method: 'DELETE', headers: authHeaders(false) }));
}

export async function adminUpdatePlan(slug: string, body: Partial<{ nameZh: string; nameEn: string; priceCents: number; active: boolean; sort: number; perks: string[]; period: string; periodCount: number }>): Promise<MembershipPlan> {
  return handleApi(await fetch(`${BASE}/admin/plans/${encodeURIComponent(slug)}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }));
}
