import { createServer, type Http2Server, type ClientHttp2Session } from 'node:http2';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ origin: '', requested: [] as string[], sessions: [] as ClientHttp2Session[] }));
vi.mock('node:http2', async importOriginal => {
  const original = await importOriginal<typeof import('node:http2')>();
  return { ...original, connect: (origin: string) => {
    transport.requested.push(origin);
    const session = original.connect(transport.origin);
    transport.sessions.push(session);
    return session;
  } };
});
import { apnsPayload, ApnsError, sendApnsRecord } from '../src/utils/apns';
import { parsePushDevice } from '../src/utils/push_device';
const input = { clientId: 'ab'.repeat(32), title: 'Record', excerpt: '3.54 PR', link: '/wca/comp/Test2026?event=333', notificationId: 42 };
let server: Http2Server;
let dir: string;
let reply = { status: 200, reason: '' };
const received: { headers: Record<string, unknown>; payload: unknown }[] = [];
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
describe('APNs record channel', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cuberoot-apns-test-'));
    writeFileSync(join(dir, 'key.p8'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    for (const [key, value] of Object.entries({ RECORD_PUSH_ENABLED: '1', APNS_ENABLED: '1', APNS_TEAM_ID: 'TESTTEAM', APNS_KEY_ID: 'TESTKEY', APNS_PRIVATE_KEY_PATH: join(dir, 'key.p8') })) vi.stubEnv(key, value);
    server = createServer();
    server.on('stream', (stream, headers) => {
      let body = '';
      stream.on('data', chunk => { body += chunk; });
      stream.on('end', () => {
        received.push({ headers, payload: JSON.parse(body) });
        stream.respond({ ':status': reply.status });
        stream.end(reply.reason ? JSON.stringify({ reason: reply.reason }) : '');
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    transport.origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    for (const session of transport.sessions) session.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });
  it('sends a signed alert with the correct topic/environment and a stable collapse id', async () => {
    await sendApnsRecord('me.cuberoot.app', 'sandbox', input);
    await sendApnsRecord('me.cuberoot.app', 'production', input);
    expect(transport.requested).toEqual(['https://api.sandbox.push.apple.com', 'https://api.push.apple.com']);
    const { headers, payload } = received[0];
    expect(headers).toMatchObject({ ':path': `/3/device/${input.clientId}`, 'apns-topic': 'me.cuberoot.app', 'apns-push-type': 'alert', 'apns-collapse-id': 'wca_record:42' });
    expect(jwt.verify(String(headers.authorization).slice(7), keys.publicKey, { algorithms: ['ES256'] })).toMatchObject({ iss: 'TESTTEAM' });
    expect(payload).toMatchObject({ kind: 'wca_record', link: input.link, aps: { alert: { title: input.title, body: input.excerpt } } });
  });
  it('distinguishes invalid devices, permanent errors and retryable failures', async () => {
    for (const [status, reason, invalidDevice, retryable] of [[410, 'Unregistered', true, false], [403, 'InvalidProviderToken', false, false], [429, 'TooManyRequests', false, true], [503, 'Shutdown', false, true]] as const) {
      reply = { status, reason };
      const error = await sendApnsRecord('me.cuberoot.app', 'sandbox', input).catch(error => error);
      expect(error).toBeInstanceOf(ApnsError);
      expect(error).toMatchObject({ invalidDevice, retryable });
    }
  });
  it('refuses foreign links and malformed or ambiguous device registrations', () => {
    expect(() => apnsPayload({ ...input, link: 'https://evil.example' })).toThrow();
    const device = { installationId: '12345678-1234-4234-8234-123456789abc', secret: 'a'.repeat(64), appId: 'me.cuberoot.app', clientId: input.clientId };
    expect(parsePushDevice(device)).toMatchObject({ provider: 'getui', environment: 'production' });
    expect(parsePushDevice({ ...device, provider: 'apns', environment: 'sandbox' })).toMatchObject({ provider: 'apns', environment: 'sandbox' });
    expect(parsePushDevice({ ...device, environment: 'sandbox' })).toBeNull();
    expect(parsePushDevice({ ...device, provider: 'apns' })).toBeNull();
    expect(parsePushDevice({ ...device, provider: 'apns', clientId: 'not-a-device-token' })).toBeNull();
  });
});
