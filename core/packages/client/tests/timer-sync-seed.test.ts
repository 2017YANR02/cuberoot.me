import { describe, expect, it } from 'vitest';
import { generateSeededTimerScramble } from '@cuberoot/shared/timer/seeded/generate';
import { TIMER_SCRAMBLE_CAPABILITIES, SCRAMBLE_222_TYPES } from '@cuberoot/shared/timer';
import { mergeTimerSeedProgress, consumeTimerSeed, normalizeTimerSyncSeed, resetTimerSyncSeed, timerSeedTicket } from '@cuberoot/shared/timer/sync-seed';
import type { EventId } from '@cuberoot/shared/timer';

describe('shared displayed seed sequence', () => {
  it('sphere shares the exact seeded 3x3 sequence without changing its event identity', () => {
    const ticket = { seed: 'sphere sequence', index: 7, revision: 0 };
    const sphere = generateSeededTimerScramble({ event: 'sphere', ticket });
    expect(sphere).toEqual(generateSeededTimerScramble({ event: '333', ticket }));
    expect(sphere.scramble).toMatch(/^[URFDLB][2']?(?: [URFDLB][2']?)+$/);
  });
  it('normalizes legacy state and invalidates the same-seed reset', () => {
    const state = normalizeTimerSyncSeed({ syncSeed: 'same', syncSeedCounter: -1 });
    const ticket = timerSeedTicket(state)!;
    expect(ticket.index).toBe(0);
    expect(consumeTimerSeed(resetTimerSyncSeed(state), ticket)).toBeNull();
    const next = consumeTimerSeed(state, ticket)!;
    expect(next.syncSeedCounter).toBe(1);
    expect(consumeTimerSeed(next, ticket)?.syncSeedCounter).toBe(1);
    expect(consumeTimerSeed(state, { ...ticket, index: 2 })).toBeNull();
  });
  it('merges committed position without overwriting newer settings or a reset', () => {
    const current = { ...normalizeTimerSyncSeed({ syncSeed: 'seed' }), theme: 'dark' };
    const committed = consumeTimerSeed(current, timerSeedTicket(current)!)!;
    const merged = mergeTimerSeedProgress(current, committed);
    expect(merged.theme).toBe('dark');
    expect(timerSeedTicket(merged)?.index).toBe(1);
    expect(mergeTimerSeedProgress(resetTimerSyncSeed(current), committed).syncSeedCounter).toBe(0);
  });
  for (const event of Object.keys(TIMER_SCRAMBLE_CAPABILITIES) as EventId[]) {
    it(`${event}: same occurrence survives unrelated generation and warm caches`, () => {
      const request = { event, ticket: { seed: 'CubeRoot 中文 seed', index: 4, revision: 0 } };
      const first = generateSeededTimerScramble(request);
      generateSeededTimerScramble({ ...request, ticket: { ...request.ticket, index: 5 } });
      expect(generateSeededTimerScramble(request)).toEqual(first);
      expect(first.scramble.length > 0).toBe(event !== 'custom');
    }, 120_000);
  }
  for (const scramble222Type of SCRAMBLE_222_TYPES) {
    it(`222 ${scramble222Type}: deterministic specialist`, () => {
      const request = { event: '222' as const, scramble222Type, ticket: { seed: '222', index: 2, revision: 0 } };
      expect(generateSeededTimerScramble(request)).toEqual(generateSeededTimerScramble(request));
    }, 120_000);
  }
  it('retains the selected drill case and color-neutral RNG', () => {
    const request = { event: 'oll' as const, drill: { type: 'oll' as const, id: 'OLL 1' }, ticket: { seed: 'drill', index: 0, revision: 0 } };
    const result = generateSeededTimerScramble(request);
    expect(generateSeededTimerScramble(request)).toEqual(result);
    expect(result.caseId).toBe('OLL 1');
  });
});
