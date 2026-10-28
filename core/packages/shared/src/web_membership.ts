import type { MobileEmbedSurface } from './mobile_embed';

export interface WebMembershipRequest {
  type: 'cuberoot:mobile:web-membership';
  surface: MobileEmbedSurface;
  requestId: string;
  expectedUid: number;
  href: string;
  language: 'zh' | 'en';
}

export interface WebMembershipResult {
  type: 'cuberoot:mobile:web-membership-result';
  requestId: string;
  // Returning from a cashier never proves that an order was paid.
  status: 'returned' | 'opened' | 'error';
}

/** Rebuild the destination from a fixed cashier endpoint, preserving its signed query. */
export function resolveWebMembershipCheckout(href: unknown): string | null {
  if (typeof href !== 'string' || href.length > 16_384) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname === 'openapi.alipay.com' && url.pathname === '/gateway.do') {
      return 'https://openapi.alipay.com/gateway.do' + url.search;
    }
    if (url.hostname === 'wx.tenpay.com' && url.pathname === '/cgi-bin/mmpayweb-bin/checkmweb') {
      return 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb' + url.search;
    }
    return null;
  } catch { return null; }
}

/** Only the official website-payment cashiers; never arbitrary URLs or intent schemes. */
export function isWebMembershipCheckout(href: unknown): href is string {
  return resolveWebMembershipCheckout(href) !== null;
}

export function decodeWebMembershipRequest(value: unknown): WebMembershipRequest | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<WebMembershipRequest>;
  if (v.type !== 'cuberoot:mobile:web-membership'
    || (v.surface !== 'account' && v.surface !== 'tools')
    || typeof v.requestId !== 'string' || v.requestId.length < 8 || v.requestId.length > 128
    || !Number.isSafeInteger(v.expectedUid) || (v.expectedUid ?? 0) <= 0
    || (v.language !== 'zh' && v.language !== 'en') || !isWebMembershipCheckout(v.href)) return null;
  return v as WebMembershipRequest;
}

export function decodeWebMembershipResult(value: unknown): WebMembershipResult | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<WebMembershipResult>;
  return v.type === 'cuberoot:mobile:web-membership-result' && typeof v.requestId === 'string'
    && ['returned', 'opened', 'error'].includes(v.status ?? '') ? v as WebMembershipResult : null;
}
