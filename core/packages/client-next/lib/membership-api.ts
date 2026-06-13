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

export interface OrderInfo {
  outTradeNo: string;
  channel: string;
  url?: string;     // 手机端跳转收银台(自动判微信/H5)
  qrcode?: string;  // PC 扫码图(5 分钟有效)
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

export async function listPlans(): Promise<{ plans: MembershipPlan[]; payEnabled: boolean }> {
  return handleApi(await fetch(`${BASE}/plans`));
}

export async function getMyMembership(): Promise<{ membership: Membership | null }> {
  return handleApi(await fetch(`${BASE}/me`, { headers: authHeaders(false) }));
}

export async function setMyContact(body: { contact: string | null; contactKind: string | null; note?: string | null }): Promise<{ membership: Membership }> {
  return handleApi(await fetch(`${BASE}/me/contact`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }));
}

export async function createOrder(plan: string, channel: 'alipay' | 'wechat'): Promise<OrderInfo> {
  return handleApi(await fetch(`${BASE}/orders`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ plan, channel }) }));
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
