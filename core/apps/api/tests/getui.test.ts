import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { getuiConfig, recordPushPayload, sendRecordPush } from '../src/utils/getui';
import { parsePushDevice } from '../src/utils/push_device';

const input = { clientId: '0123456789abcdef', requestId: 'request1234567890', title: 'Record', excerpt: '3.54 PR',
  link: '/wca/comp/WuhanCrimsonAutumn2026?event=333', notificationId: 42 };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Getui record transport', () => {
  it('fails closed without opt-in and keeps application credentials separate', () => {
    vi.stubEnv('RECORD_PUSH_ENABLED', '');
    expect(getuiConfig('me.cuberoot.app')).toBeNull();
    vi.stubEnv('RECORD_PUSH_ENABLED', '1');
    vi.stubEnv('GETUI_APP_ID', 'release'); vi.stubEnv('GETUI_APP_KEY', 'key'); vi.stubEnv('GETUI_MASTER_SECRET', 'secret');
    vi.stubEnv('GETUI_DEBUG_APP_ID', '');
    expect(getuiConfig('me.cuberoot.app')?.appId).toBe('release');
    expect(getuiConfig('me.cuberoot.app.debug')).toBeNull();
    expect(getuiConfig('evil')).toBeNull();
  });
  it('emits online and manufacturer notifications with bounded unicode text and an owned URL', () => {
    const payload = recordPushPayload({ ...input, title: '🌍'.repeat(40), excerpt: '中'.repeat(120) });
    expect(Array.from(payload.push_message.notification.title)).toHaveLength(32);
    expect(payload.push_channel.android.ups.notification.body).toBe('中'.repeat(100));
    expect(payload.push_channel.android.ups.notification).toEqual(payload.push_message.notification);
    expect(payload.push_message.notification.url).toBe('https://cuberoot.me' + input.link);
    for (const link of ['//evil.test', '/account', '/wca/comp/../account', 'https://evil.test']) {
      expect(() => recordPushPayload({ ...input, link })).toThrow();
    }
  });
  it('signs auth, refreshes an invalid token once and requires recipient acceptance', async () => {
    vi.stubEnv('RECORD_PUSH_ENABLED', '1'); vi.stubEnv('GETUI_APP_ID', 'test-auth');
    vi.stubEnv('GETUI_APP_KEY', 'key'); vi.stubEnv('GETUI_MASTER_SECRET', 'secret');
    const response = (data: unknown) => new Response(JSON.stringify(data));
    const fetcher = vi.fn().mockResolvedValueOnce(response({ code: 0, data: { token: 'old', expire_time: Date.now() + 3600000 } }))
      .mockResolvedValueOnce(response({ code: 10001 }))
      .mockResolvedValueOnce(response({ code: 0, data: { token: 'new', expire_time: Date.now() + 3600000 } }))
      .mockResolvedValueOnce(response({ code: 0, data: { task: { [input.clientId]: 'successed_offline' } } }))
      .mockResolvedValueOnce(response({ code: 0, data: { task: { [input.clientId]: 'ignored' } } }));
    vi.stubGlobal('fetch', fetcher);
    await sendRecordPush('me.cuberoot.app', input);
    const auth = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(auth.sign).toBe(createHash('sha256').update('key' + auth.timestamp + 'secret').digest('hex'));
    expect(fetcher.mock.calls[3][1].headers.token).toBe('new');
    await expect(sendRecordPush('me.cuberoot.app', input)).rejects.toThrow('did not accept');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('validates device credentials and hashes the revocation secret', () => {
    const device = { installationId: 'f60d8a67-4e22-4b6f-a785-5fa3e90e7f6c', secret: 'a'.repeat(64),
      appId: 'me.cuberoot.app', clientId: input.clientId };
    expect(parsePushDevice(device)?.secretHash).toBe(createHash('sha256').update(device.secret).digest('hex'));
    for (const override of [{ secret: '' }, { installationId: 'bad' }, { appId: 'foreign' }, { userId: 99 }, { clientId: 'short' }]) {
      expect(parsePushDevice({ ...device, ...override })).toBeNull();
    }
    expect(parsePushDevice({ installationId: device.installationId, secret: device.secret }, true)).toBeTruthy();
  });
});
