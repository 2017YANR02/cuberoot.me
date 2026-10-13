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

/** Only the official website-payment cashiers; never arbitrary URLs or intent schemes. */
export function isWebMembershipCheckout(href: unknown): href is string {
  if (typeof href !== 'string' || href.length > 16_384) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return (url.hostname === 'openapi.alipay.com' && url.pathname === '/gateway.do')
      || (url.hostname === 'wx.tenpay.com' && url.pathname === '/cgi-bin/mmpayweb-bin/checkmweb');
  } catch { return false; }
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
