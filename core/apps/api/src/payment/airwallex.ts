/**
 * Airwallex Hosted Payment Page adapter for membership card payments.
 *
 * Card data is collected by Airwallex. CubeRoot only creates/retrieves a
 * PaymentIntent and verifies signed webhook payloads.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type AirwallexEnvironment = 'demo' | 'prod';
export type AirwallexCardChannel = 'card_cn' | 'card_global';
export type AirwallexCardNetwork =
  | 'visa'
  | 'mastercard'
  | 'maestro'
  | 'unionpay'
  | 'amex'
  | 'jcb'
  | 'diners'
  | 'discover';

interface AirwallexAccessToken {
  token: string;
  expiresAtMs: number;
}

export interface AirwallexPaymentIntent {
  id: string;
  client_secret?: string;
  merchant_order_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface AirwallexWebhookEvent {
  id?: string;
  name?: string;
  account_id?: string;
  created_at?: string;
  data?: { object?: AirwallexPaymentIntent };
}

const CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID || '';
const API_KEY = process.env.AIRWALLEX_API_KEY || '';
const ACCOUNT_ID = process.env.AIRWALLEX_ACCOUNT_ID || '';
const LOGIN_AS = process.env.AIRWALLEX_LOGIN_AS || '';
const WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET || '';
const ENVIRONMENT = process.env.AIRWALLEX_ENV;
const CARD_CN_ENABLED = process.env.AIRWALLEX_CARD_CN_ENABLED === '1';
const CARD_GLOBAL_ENABLED = process.env.AIRWALLEX_CARD_GLOBAL_ENABLED === '1';

const API_BASE = ENVIRONMENT === 'demo'
  ? 'https://api-demo.airwallex.com'
  : 'https://api.airwallex.com';

let cachedToken: AirwallexAccessToken | null = null;

export function airwallexEnvironment(): AirwallexEnvironment | null {
  return ENVIRONMENT === 'demo' || ENVIRONMENT === 'prod' ? ENVIRONMENT : null;
}

export function airwallexConfigured(): boolean {
  return Boolean(
    airwallexEnvironment()
    && CLIENT_ID
    && API_KEY
    && ACCOUNT_ID
    && WEBHOOK_SECRET,
  );
}

export function airwallexChannelEnabled(channel: AirwallexCardChannel): boolean {
  if (!airwallexConfigured()) return false;
  return channel === 'card_cn' ? CARD_CN_ENABLED : CARD_GLOBAL_ENABLED;
}

export function airwallexAccountId(): string {
  return ACCOUNT_ID;
}

export function allowedCardNetworks(channel: AirwallexCardChannel): AirwallexCardNetwork[] {
  return channel === 'card_cn'
    ? ['unionpay']
    : ['visa', 'mastercard', 'amex', 'jcb'];
}

async function accessToken(): Promise<string> {
  if (!airwallexConfigured()) throw new Error('Airwallex is not configured');
  if (cachedToken && cachedToken.expiresAtMs - Date.now() > 60_000) return cachedToken.token;

  const headers: Record<string, string> = {
    'x-client-id': CLIENT_ID,
    'x-api-key': API_KEY,
  };
  if (LOGIN_AS) headers['x-login-as'] = LOGIN_AS;
  const res = await fetch(`${API_BASE}/api/v1/authentication/login`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Airwallex authentication HTTP ${res.status}`);

  const body = await res.json() as { token?: string; expires_at?: string };
  if (!body.token || !body.expires_at) throw new Error('Airwallex authentication returned an invalid response');
  const expiresAtMs = Date.parse(body.expires_at);
  if (!Number.isFinite(expiresAtMs)) throw new Error('Airwallex authentication returned an invalid expiry');
  cachedToken = { token: body.token, expiresAtMs };
  return body.token;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Airwallex API HTTP ${res.status}`);
  return await res.json() as T;
}

export async function createAirwallexPaymentIntent(opts: {
  outTradeNo: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
  channel: AirwallexCardChannel;
}): Promise<AirwallexPaymentIntent & { client_secret: string }> {
  const body = {
    request_id: randomUUID(),
    amount: Number((opts.amountCents / 100).toFixed(2)),
    currency: opts.currency.toUpperCase(),
    merchant_order_id: opts.outTradeNo,
    return_url: opts.returnUrl,
    metadata: {
      product: 'membership',
      pay_channel: opts.channel,
    },
  };
  const intent = await apiRequest<AirwallexPaymentIntent>(
    '/api/v1/pa/payment_intents/create',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!intent.id || !intent.client_secret || intent.merchant_order_id !== opts.outTradeNo) {
    throw new Error('Airwallex created an invalid PaymentIntent');
  }
  return intent as AirwallexPaymentIntent & { client_secret: string };
}

export async function retrieveAirwallexPaymentIntent(intentId: string): Promise<AirwallexPaymentIntent> {
  if (!/^int_[A-Za-z0-9_-]{3,128}$/.test(intentId)) throw new Error('Invalid Airwallex PaymentIntent ID');
  return apiRequest<AirwallexPaymentIntent>(`/api/v1/pa/payment_intents/${encodeURIComponent(intentId)}`);
}

export function verifyAirwallexWebhook(rawBody: string, timestamp: string, signature: string): boolean {
  if (!airwallexConfigured() || !/^\d{10,16}$/.test(timestamp) || !/^[a-fA-F0-9]{64}$/.test(signature)) {
    return false;
  }
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) return false;

  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(timestamp + rawBody, 'utf8')
    .digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function sanitizeAirwallexWebhook(event: AirwallexWebhookEvent): Record<string, unknown> {
  const intent = event.data?.object;
  return {
    id: event.id,
    name: event.name,
    account_id: event.account_id,
    created_at: event.created_at,
    data: intent ? {
      object: {
        id: intent.id,
        merchant_order_id: intent.merchant_order_id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
      },
    } : undefined,
  };
}
