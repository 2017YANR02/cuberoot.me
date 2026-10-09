import { GOOGLE_MEMBERSHIP_PRODUCT_IDS, type GoogleMembershipProductId } from './google_membership.js';

/** Server-to-server only. Never expose the signing key to an installed client. */
export const GOOGLE_PLAY_PACKAGE = 'me.cuberoot.app';
export const GOOGLE_PLAY_RELAY_PATH = '/api/google-play';
export const GOOGLE_PLAY_RELAY_HEADER = 'x-cuberoot-play-proof';
export const GOOGLE_PLAY_RELAY_MAX_BYTES = 16 * 1024;
export type GooglePlayRelayRequest =
  | { operation: 'ready' }
  | { operation: 'subscription'; token: string }
  | { operation: 'acknowledge'; token: string; productId: GoogleMembershipProductId }
  | { operation: 'verifyPush'; idToken: string };

export function validGooglePurchaseToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 4096 && !/\s/.test(value);
}
export function decodeGooglePlayRelayRequest(value: unknown): GooglePlayRelayRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(',');
  if (v.operation === 'ready' && keys === 'operation') return { operation: 'ready' };
  if (v.operation === 'verifyPush' && keys === 'idToken,operation' && typeof v.idToken === 'string'
    && v.idToken.length <= 8192 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.idToken)) return v as GooglePlayRelayRequest;
  if (!validGooglePurchaseToken(v.token)) return null;
  if (v.operation === 'subscription' && keys === 'operation,token') return v as GooglePlayRelayRequest;
  if (v.operation === 'acknowledge' && keys === 'operation,productId,token'
    && GOOGLE_MEMBERSHIP_PRODUCT_IDS.includes(v.productId as GoogleMembershipProductId)) return v as GooglePlayRelayRequest;
  return null;
}
const encoder = new TextEncoder();
async function signingKey(secret: string) {
  if (secret.length < 32) throw new Error('Google Play relay secret unavailable');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const signedContent = (timestamp: string, body: string) => encoder.encode(`cuberoot-google-play-v1\nPOST\n${GOOGLE_PLAY_RELAY_PATH}\n${timestamp}\n${body}`);
export async function signGooglePlayRelay(secret: string, body: string, now = Date.now()) {
  const timestamp = String(Math.floor(now / 1000));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), signedContent(timestamp, body));
  return `${timestamp}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')}`;
}
/** A bounded replay window is intentional: lookup, verification and acknowledgement are idempotent. */
export async function verifyGooglePlayRelay(secret: string, body: string, proof: string, now = Date.now()) {
  if (secret.length < 32 || encoder.encode(body).length > GOOGLE_PLAY_RELAY_MAX_BYTES) return false;
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(proof);
  if (!match || Math.abs(Math.floor(now / 1000) - Number(match[1])) > 60) return false;
  const signature = Uint8Array.from(match[2].match(/../g)!, b => parseInt(b, 16));
  return crypto.subtle.verify('HMAC', await signingKey(secret), signature, signedContent(match[1], body));
}
