import { sessionFetch } from './session-fetch';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type { PlatformActionResult } from './platform-types';

export interface PlatformQuote {
  currency: string; member: boolean; subtotalAmountMinor: number; discountAmountMinor: number; totalAmountMinor: number;
  items?: { titleZh: string; titleEn: string; quantity: number; unitAmountMinor: number; lineAmountMinor: number }[];
}

export async function quotePlatformOrder(items: Record<string, unknown>[], couponCode?: string, signal?: AbortSignal): Promise<PlatformQuote> {
  return handleApi<PlatformQuote>(await sessionFetch(apiUrl('/v1/platform/orders/quote'), {
    method: 'POST', headers: authHeaders(), signal,
    body: JSON.stringify({ items, ...(couponCode?.trim() ? { couponCode: couponCode.trim() } : {}) }),
  }));
}

/** Callers retain this key after a lost response so a retry cannot reserve a second order. */
export async function createPlatformOrder(payload: Record<string, unknown>, requestKey = crypto.randomUUID()): Promise<PlatformActionResult> {
  return handleApi<PlatformActionResult>(await sessionFetch(apiUrl('/v1/platform/orders'), {
    method: 'POST', headers: { ...authHeaders(), 'Idempotency-Key': requestKey },
    body: JSON.stringify(payload),
  }));
}
