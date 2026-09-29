import { recordPushUrl } from './record_push_link.js';
import { readFileSync } from 'node:fs';
import { connect, type ClientHttp2Session } from 'node:http2';
import jwt from 'jsonwebtoken';

export type ApnsEnvironment = 'sandbox' | 'production';
export class ApnsError extends Error {
  constructor(public readonly status: number, public readonly reason: string) {
    super(`apns ${status} ${reason}`);
  }
  get invalidDevice(): boolean { return this.reason === 'Unregistered' || this.reason === 'BadDeviceToken' || this.reason === 'DeviceTokenNotForTopic'; }
  get retryable(): boolean { return this.status === 429 || this.status >= 500 || this.reason === 'ExpiredProviderToken'; }
}
export function apnsConfig(appId: string) {
  if (process.env.RECORD_PUSH_ENABLED !== '1' || process.env.APNS_ENABLED !== '1'
    || !['me.cuberoot.app', 'me.cuberoot.app.debug'].includes(appId)) return null;
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const keyPath = process.env.APNS_PRIVATE_KEY_PATH?.trim();
  return teamId && keyId && keyPath ? { teamId, keyId, keyPath, topic: appId } : null;
}
const sessions = new Map<string, ClientHttp2Session>();
let cached: { identity: string; token: string; expires: number } | undefined;
function providerToken(config: NonNullable<ReturnType<typeof apnsConfig>>): string {
  const identity = `${config.teamId}:${config.keyId}:${config.keyPath}`;
  if (cached?.identity === identity && cached.expires > Date.now()) return cached.token;
  const token = jwt.sign({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) }, readFileSync(config.keyPath),
    { algorithm: 'ES256', keyid: config.keyId });
  cached = { identity, token, expires: Date.now() + 50 * 60_000 };
  return token;
}
function sessionFor(origin: string): ClientHttp2Session {
  const existing = sessions.get(origin);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const session = connect(origin);
  sessions.set(origin, session);
  const forget = () => { if (sessions.get(origin) === session) sessions.delete(origin); };
  session.on('error', () => { forget(); session.destroy(); });
  session.on('goaway', () => { forget(); session.close(); });
  session.on('close', forget);
  session.setTimeout(60_000, () => session.close());
  session.unref();
  return session;
}
export interface ApnsRecordInput { clientId: string; notificationId: number; title: string; excerpt: string; link: string }
export function apnsPayload(input: ApnsRecordInput) {
  recordPushUrl(input.link);
  return { aps: { alert: { title: Array.from(input.title).slice(0, 80).join(''),
    body: Array.from(input.excerpt || input.title).slice(0, 400).join('') }, sound: 'default', 'thread-id': 'wca_record' },
  kind: 'wca_record', notificationId: String(input.notificationId), link: input.link };
}
export async function sendApnsRecord(appId: string, environment: ApnsEnvironment, input: ApnsRecordInput): Promise<void> {
  const config = apnsConfig(appId);
  if (!config) throw new Error('APNs not configured');
  const body = JSON.stringify(apnsPayload(input));
  if (Buffer.byteLength(body) > 4096) throw new Error('APNs payload too large');
  const token = providerToken(config);
  const origin = environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  await new Promise<void>((resolve, reject) => {
    const request = sessionFor(origin).request({ ':method': 'POST', ':path': `/3/device/${input.clientId}`,
      authorization: `bearer ${token}`, 'apns-topic': config.topic, 'apns-push-type': 'alert',
      'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      'apns-collapse-id': `wca_record:${input.notificationId}` });
    let status = 0;
    let response = '';
    request.setEncoding('utf8');
    request.on('response', headers => { status = Number(headers[':status']); });
    request.on('data', chunk => { response += chunk; if (response.length > 8192) request.destroy(new Error('APNs invalid response')); });
    request.setTimeout(12_000, () => request.destroy(new Error('APNs timeout')));
    request.on('error', () => reject(new Error('APNs transport failed')));
    request.on('end', () => {
      if (status === 200) { resolve(); return; }
      let reason = 'Unknown';
      try { const parsed = JSON.parse(response); if (typeof parsed.reason === 'string' && /^[A-Za-z]{1,64}$/.test(parsed.reason)) reason = parsed.reason; } catch { /* No response body is retained. */ }
      if (reason === 'ExpiredProviderToken') cached = undefined;
      reject(new ApnsError(status || 503, reason));
    });
    request.end(body);
  });
}
