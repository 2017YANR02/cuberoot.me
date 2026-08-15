import { describe, expect, it } from 'vitest';
import { battlePresenceMix } from '@/app/[lang]/timer/_lib/presence';
import { createTimerPresenceRoutes, TIMER_PRESENCE_TTL_MS } from '../../server/src/routes/timer_presence';

const IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

describe('timer presence API', () => {
  it('sums ordinary and smart users, updates a tab in place, and removes it explicitly', async () => {
    let now = 1_000;
    const routes = createTimerPresenceRoutes({ now: () => now });
    const post = (id: string, normal: number, smart: number) => routes.request('/timer/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, normal, smart }),
    });

    expect(await (await post(IDS[0], 1, 0)).json()).toEqual({ normal: 1, smart: 0, total: 1 });
    expect(await (await post(IDS[1], 0, 1)).json()).toEqual({ normal: 1, smart: 1, total: 2 });
    expect(await (await post(IDS[0], 0, 1)).json()).toEqual({ normal: 0, smart: 2, total: 2 });
    expect((await post(IDS[1], 0, 0)).headers.get('Cache-Control')).toBe('no-store');
    expect(await (await routes.request('/timer/presence')).json()).toEqual({ normal: 0, smart: 1, total: 1 });

    now += TIMER_PRESENCE_TTL_MS;
    expect(await (await routes.request('/timer/presence')).json()).toEqual({ normal: 0, smart: 0, total: 0 });
  });

  it('rejects invalid identifiers and out-of-range people counts', async () => {
    const routes = createTimerPresenceRoutes();
    const invalidId = await routes.request('/timer/presence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'x', normal: 1, smart: 0 }),
    });
    const tooMany = await routes.request('/timer/presence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: IDS[0], normal: 4, smart: 1 }),
    });
    expect(invalidId.status).toBe(400);
    expect(tooMany.status).toBe(400);
  });
});

describe('local battle presence mix', () => {
  it('counts each connected cube in own mode and only the shared cube in shared mode', () => {
    expect(battlePresenceMix(4, 'own', [true, false, true, false])).toEqual({ normal: 2, smart: 2 });
    expect(battlePresenceMix(4, 'shared', [true, true, true, true])).toEqual({ normal: 3, smart: 1 });
    expect(battlePresenceMix(2, 'shared', [false, true])).toEqual({ normal: 2, smart: 0 });
  });
});
