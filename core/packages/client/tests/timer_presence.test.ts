import { describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';
import {
  battlePresenceMix,
  sendTimerPresenceHeartbeat,
  type TimerPresenceReport,
} from '@/app/[lang]/timer/_lib/presence';
import { workspaceFixturePath } from './workspace-fixture-path';

const { createTimerPresenceRoutes, TIMER_PRESENCE_TTL_MS } = await import(
  pathToFileURL(
    workspaceFixturePath('@cuberoot/server', 'src', 'routes', 'timer_presence.ts'),
  ).href,
);

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
      identifyLocation: async () => ({ en: 'United States Test City', zh: '美国 测试市', precision: 'city' }),
    });
    const post = (id: string, normal: number, smart: number, details = {}) => routes.request('/timer/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, normal, smart, ...details }),
    });

    const heartbeat = await post(IDS[0], 0, 1, {
      mode: 'solo',
      players: 1,
      events: ['333'],
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
        players: 1,
        events: ['333'],
        ip: '203.0.113.10',
        location: { en: 'United States Test City', zh: '美国 测试市', precision: 'city' },
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
      identifyLocation: async () => null,
    });
    const post = (normal: number, smart: number) => routes.request('/timer/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: IDS[0], normal, smart, mode: 'local' }),
    });

    expect((await post(2, 0)).status).toBe(204);
    expect((await post(1, 1)).status).toBe(204);
    const active = await (await routes.request('/timer/presence')).json() as {
      sessions: Array<{ account: unknown; ip: string; location: unknown; players: number; events: string[] }>;
      total: number;
    };
    expect(active.total).toBe(2);
    expect(active.sessions[0]).toMatchObject({
      account: null,
      ip: '198.51.100.4',
      location: null,
      players: 2,
      events: [],
    });
    expect((await post(0, 0)).status).toBe(204);
    expect(await (await routes.request('/timer/presence')).json()).toMatchObject({ total: 0, sessions: [] });
  });

  it('keeps the heartbeat alive when local city lookup fails', async () => {
    const routes = createTimerPresenceRoutes({
      authorizeAdmin: async () => {},
      identifyUser: async () => null,
      identifyIp: () => '203.0.113.20',
      identifyLocation: async () => { throw new Error('database unavailable'); },
    });
    const response = await routes.request('/timer/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: IDS[0], normal: 1, smart: 0 }),
    });

    expect(response.status).toBe(204);
    expect(await (await routes.request('/timer/presence')).json()).toMatchObject({
      sessions: [{ ip: '203.0.113.20', location: null }],
    });
  });

  it('rejects invalid core fields but keeps counts when optional details are malformed', async () => {
    const routes = createTimerPresenceRoutes({ authorizeAdmin: async () => {} });
    const post = (body: object) => routes.request('/timer/presence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    expect((await post({ id: 'x', normal: 1, smart: 0 })).status).toBe(400);
    expect((await post({ id: IDS[0], normal: 4, smart: 1 })).status).toBe(400);
    expect((await post({ id: IDS[0], normal: 1, smart: 0, mode: 'other' })).status).toBe(400);
    expect((await post({
      id: IDS[0],
      normal: 0,
      smart: 1,
      players: 99,
      events: ['333', '333', 'x'.repeat(50), '', null],
      results: [{ event: '333', timeMs: -1, penalty: 'ok' }],
      devices: [{ name: 'GAN'.repeat(100), id: 'opaque-'.repeat(100) }, { name: '' }],
    })).status).toBe(204);
    const snapshot = await (await routes.request('/timer/presence')).json() as {
      smart: number;
      sessions: Array<{
        players: number;
        events: string[];
        results: unknown[];
        devices: Array<{ name: string; id?: string }>;
      }>;
    };
    expect(snapshot.smart).toBe(1);
    expect(snapshot.sessions[0].players).toBe(8);
    expect(snapshot.sessions[0].events).toEqual(['333', 'x'.repeat(32)]);
    expect(snapshot.sessions[0].results).toEqual([]);
    expect(snapshot.sessions[0].devices).toEqual([{
      name: 'GAN'.repeat(100).slice(0, 128),
      id: 'opaque-'.repeat(100).slice(0, 512),
    }]);
  });
});

describe('timer presence heartbeat', () => {
  it('retries a rejected detailed heartbeat with the core count only', async () => {
    const responses = [new Response(null, { status: 400 }), new Response(null, { status: 204 })];
    const bodies: unknown[] = [];
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return responses.shift()!;
    });
    const report: TimerPresenceReport = {
      normal: 0,
      smart: 1,
      mode: 'solo',
      players: 1,
      events: ['333'],
      results: [],
      devices: [{ name: 'Smart cube', id: 'opaque-id' }],
    };

    await sendTimerPresenceHeartbeat(IDS[0], report, false, request);

    expect(request).toHaveBeenCalledTimes(2);
    expect(bodies[0]).toEqual({ id: IDS[0], ...report });
    expect(bodies[1]).toEqual({
      id: IDS[0], normal: 0, smart: 1, mode: 'solo', players: 1, events: ['333'], results: [], devices: [],
    });
  });
});

describe('local battle presence mix', () => {
  it('counts each connected cube in own mode and only the shared cube in shared mode', () => {
    expect(battlePresenceMix(4, 'own', [true, false, true, false])).toEqual({ normal: 2, smart: 2 });
    expect(battlePresenceMix(4, 'shared', [true, true, true, true])).toEqual({ normal: 3, smart: 1 });
    expect(battlePresenceMix(2, 'shared', [false, true])).toEqual({ normal: 2, smart: 0 });
  });
});
