import { describe, expect, it, vi } from 'vitest';
import { createPushAcceptanceApi } from '../scripts/push-acceptance/api';

const pair = 'a'.repeat(64);
const device = { installationId: '12345678-1234-4123-8123-123456789abc', secret: 'b'.repeat(64),
  appId: 'me.cuberoot.app.debug', clientId: 'private-client-id-fixture', pushVersion: 2 };
function setup() {
  const app = createPushAcceptanceApi(pair);
  const request = (path: string, method = 'GET', token?: string, body?: unknown, origin?: string) => app.request(path, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const login = async (uid = 900001) => (await (await request('/__acceptance/session', 'POST', pair, { uid })).json()).token as string;
  return { request, login };
}
describe('isolated acceptance API', () => {
  it('rejects production/unpaired sessions, other origins and oversized input', async () => {
    const { request } = setup();
    expect((await request('/v1/notifications/push/config', 'GET', 'production-jwt')).status).toBe(401);
    expect((await request('/__acceptance/session', 'POST', 'é'.repeat(64), { uid: 900001 })).status).toBe(401);
    expect((await request('/__acceptance/session', 'POST', pair, { uid: 900001 }, 'https://cuberoot.me')).status).toBe(403);
    expect((await request('/__acceptance/session', 'POST', pair, { uid: 1 })).status).toBe(400);
    expect((await request('/__acceptance/session', 'POST', pair, { pad: 'x'.repeat(9000) })).status).toBe(413);
  });
  it('binds only one v2 device and generates all four recipient-bound payloads without delivery', async () => {
    const { request, login } = setup(); const token = await login();
    expect((await request('/v1/notifications/push/device', 'PUT', token, { ...device, pushVersion: 1 })).status).toBe(400);
    expect((await request('/v1/notifications/push/device', 'PUT', token, device)).status).toBe(200);
    expect((await request('/v1/notifications/push/device', 'PUT', token, { ...device, installationId: '22345678-1234-4123-8123-123456789abc' })).status).toBe(409);
    for (const kind of ['wca_record', 'comp_announcement', 'comp_registration_open', 'comp_registration_close']) {
      const response = await request('/__acceptance/notification', 'POST', token, { kind });
      expect(response.headers.get('X-CubeRoot-Push-Acceptance')).toBe('fixture-v1');
      const text = await response.text();
      expect(JSON.parse(text)).toMatchObject({ delivery: 'fixture-only', notification: { kind, recipientUid: '900001', link: '/wca/comp/PushAcceptance2026' } });
      expect(text).not.toContain(device.clientId); expect(text).not.toContain(device.secret); expect(text).not.toContain(token);
    }
  });
  it('isolates test accounts and requires the device secret for logout revocation', async () => {
    const { request, login } = setup(); const a = await login(); const b = await login(900002);
    await request('/v1/notifications/push/device', 'PUT', a, device);
    expect((await request('/__acceptance/notification', 'POST', b, { kind: 'wca_record' })).status).toBe(409);
    await request('/v1/notifications/push/device', 'DELETE', undefined, { installationId: device.installationId, secret: 'c'.repeat(64) });
    expect(await (await request('/__acceptance/status', 'GET', a)).json()).toMatchObject({ bound: true });
    await request('/v1/notifications/push/device', 'DELETE', undefined, { installationId: device.installationId, secret: device.secret });
    expect(await (await request('/__acceptance/status', 'GET', a)).json()).toMatchObject({ bound: false });
    expect((await request('/v1/notifications/push/device', 'PUT', b, device)).status).toBe(200);
    expect((await request('/__acceptance/notification', 'POST', a, { kind: 'wca_record' })).status).toBe(409);
  });
  it('expires the whole fixture after one hour', async () => {
    vi.useFakeTimers();
    try { const { request, login } = setup(); const token = await login(); vi.advanceTimersByTime(3_600_000); expect((await request('/__acceptance/status', 'GET', token)).status).toBe(410); }
    finally { vi.useRealTimers(); }
  });
});
