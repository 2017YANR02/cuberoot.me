/** CubeRoot configuration adapter for the independently versioned payment client. */
import { createAlipayClient } from '@app-foundation/payments/alipay';
import type { SignParams } from '@app-foundation/payments/core';

function configuration() {
  return {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    sellerId: process.env.ALIPAY_SELLER_ID || undefined,
  };
}

export function alipayConfigured(): boolean {
  const config = configuration();
  return Boolean(config.appId && config.privateKey.trim() && config.publicKey.trim());
}

function client() {
  if (!alipayConfigured()) throw new Error('Alipay is not configured');
  return createAlipayClient(configuration(), { fetch: (input, init) => fetch(input, init) });
}

export function createAlipayCheckoutUrl(opts: {
  outTradeNo: string; amountCents: number; subject: string; clientType: 'pc' | 'wap';
  notifyUrl: string; returnUrl: string;
}): string {
  return client().createCheckoutUrl(opts);
}

/** Preserve the boolean API while checking signature, application and payment fields. */
export function verifyAlipayNotify(params: SignParams & { sign?: string; sign_type?: string }): boolean {
  try {
    client().parseNotification(params);
    return true;
  } catch { return false; }
}

export async function createAlipayRefund(input: {
  transactionId: string; requestId: string; amountMinor: number; reason: string;
}): Promise<Record<string, unknown>> {
  return client().createRefund(input);
}

export async function queryAlipayRefund(transactionId: string, requestId: string): Promise<Record<string, unknown> | null> {
  return client().queryRefund(transactionId, requestId);
}

/** Transport and verification errors propagate; null means a verified missing trade. */
export async function queryAlipayTrade(outTradeNo: string): Promise<{ paid: boolean; txn?: string; raw: unknown } | null> {
  return client().queryTrade(outTradeNo);
}
