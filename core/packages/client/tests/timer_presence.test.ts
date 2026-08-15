import { describe, expect, it } from 'vitest';
import { battlePresenceMix } from '@/app/[lang]/timer/_lib/presence';
import { createTimerPresenceRoutes, TIMER_PRESENCE_TTL_MS } from '../../server/src/routes/timer_presence';

const IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

describe('timer presence API', () => {
  it('returns no snapshot from public heartbeats and exposes live details only through the admin read', async () => {
    let now = 1_000;
    let adminChecks = 0;
    const routes = createTimerPresenceRoutes({
      now: () => now,
      authorizeAdmin: async () => { adminChecks += 1; },
      identifyUser: async () => ({ wcaId: 'u42', name: 'Timer User', uid: 42, realWcaId: '2024TEST01' }),
      identifyIp: () => '203.0.113.10',
    });
    const post = (id: string, normal: number, smart: number, details = {}) => routes.request('/timer/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, normal, smart, ...details }),
    });

    const heartbeat = await post(IDS[0], 0, 1, {
      mode: 'solo',
      ip: 'forged',
      account: { name: 'forged' },
      results: [{ event: '333', timeMs: 8123, penalty: 'ok', at: 900 }],
      devices: [{ name: 'GAN 12 ui', id: 'origin-device-id' }],
    });
    expect(heartbeat.status).toBe(204);
    expect(await heartbeat.text()).toBe('');

    const read = await routes.request('/timer/presence');
    expect(adminChecks).toBe(1);
    expect(read.headers.get('Cache-Control')).toBe('no-store');
    expect(await read.json()).toEqual({
      normal: 0,
      smart: 1,
      total: 1,
      sessions: [{
        sessionId: IDS[0],
        normal: 0,
        smart: 1,
        mode: 'solo',
        ip: '203.0.113.10',
        account: { ownerId: 'u42', name: 'Timer User', wcaId: '2024TEST01' },
        results: [{ event: '333', timeMs: 8123, penalty: 'ok', at: 900 }],
        devices: [{ name: 'GAN 12 ui', id: 'origin-device-id' }],
        seenAt: 1_000,
      }],
    });

    now += TIMER_PRESENCE_TTL_MS;
    expect(await (await routes.request('/timer/presence')).json()).toEqual({
      normal: 0, smart: 0, total: 0, sessions: [],
    });
  });

  it('updates a tab in place, removes it explicitly, and derives anonymous identity server-side', async () => {
    const routes = createTimerPresenceRoutes({
      authorizeAdmin: async () => {},
      identifyUser: async () => null,
      identifyIp: () => '198.51.100.4',
    });
    const post = (normal: number, smart: number) => routes.request('/timer/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: IDS[0], normal, smart, mode: 'local' }),
    });

    expect((await post(2, 0)).status).toBe(204);
    expect((await post(1, 1)).status).toBe(204);
    const active = await (await routes.request('/timer/presence')).json() as { sessions: Array<{ account: unknown; ip: string }>; total: number };
    expect(active.total).toBe(2);
    expect(active.sessions[0]).toMatchObject({ account: null, ip: '198.51.100.4' });
    expect((await post(0, 0)).status).toBe(204);
    expect(await (await routes.request('/timer/presence')).json()).toMatchObject({ total: 0, sessions: [] });
  });

  it('rejects invalid identifiers, counts, modes, results, and devices', async () => {
    const routes = createTimerPresenceRoutes();
    const post = (body: object) => routes.request('/timer/presence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    expect((await post({ id: 'x', normal: 1, smart: 0 })).status).toBe(400);
    expect((await post({ id: IDS[0], normal: 4, smart: 1 })).status).toBe(400);
    expect((await post({ id: IDS[0], normal: 1, smart: 0, mode: 'other' })).status).toBe(400);
    expect((await post({ id: IDS[0], normal: 1, smart: 0, results: [{ event: '333', timeMs: -1, penalty: 'ok' }] })).status).toBe(400);
    expect((await post({ id: IDS[0], normal: 0, smart: 1, devices: [{ name: '' }] })).status).toBe(400);
  });
});

describe('local battle presence mix', () => {
  it('counts each connected cube in own mode and only the shared cube in shared mode', () => {
    expect(battlePresenceMix(4, 'own', [true, false, true, false])).toEqual({ normal: 2, smart: 2 });
    expect(battlePresenceMix(4, 'shared', [true, true, true, true])).toEqual({ normal: 3, smart: 1 });
    expect(battlePresenceMix(2, 'shared', [false, true])).toEqual({ normal: 2, smart: 0 });
  });
});
