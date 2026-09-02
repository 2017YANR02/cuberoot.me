import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TIMER_AUTO_MARK_WCA_SCRAMBLE,
  TimerWcaFinitePoolProgressTracker,
  createTimerStoreData,
  decodeTimerStoreData,
  decodeTimerWcaCompetitionScrambleSlotIdentity,
  decodeTimerWcaScrambleMarkKey,
  decodeTimerWcaScrambleMarksResponse,
  fetchTimerWcaScrambleMarks,
  postTimerWcaScrambleMark,
  shouldAutoMarkTimerWcaScramble,
  timerWcaScrambleMarkWriteMode,
  timerWcaCompetitionScrambleSlotIdentity,
  updateTimerWcaScrambleMarkIfExists,
  type TimerWcaCompetitionScrambleSlot,
} from '@cuberoot/shared/timer';

const first: TimerWcaCompetitionScrambleSlot = {
  competitionId: 'BrockportBolt2025',
  eventId: '333',
  roundTypeId: 'f',
  groupId: 'A',
  isExtra: false,
  scrambleNumber: 1,
};

describe('shared timer WCA practice contract', () => {
  it('tracks official occurrences rather than repeated scramble text', () => {
    const second = { ...first, scrambleNumber: 2 };
    const firstIdentity = timerWcaCompetitionScrambleSlotIdentity(first);
    expect(decodeTimerWcaCompetitionScrambleSlotIdentity(firstIdentity)).toEqual(first);
    expect(decodeTimerWcaCompetitionScrambleSlotIdentity(
      '["x","333","f","A",0,1,99]',
    )).toBeNull();
    expect(decodeTimerWcaCompetitionScrambleSlotIdentity(
      '["x","333","f","A",false,1]',
    )).toBeNull();

    const sameTextOccurrences = [
      { ...first, scramble: "R U R'" },
      { ...second, scramble: "R U R'" },
    ];
    const progress = new TimerWcaFinitePoolProgressTracker();
    expect(progress.registerClosedSet('source', sameTextOccurrences)).toBe(true);
    expect(progress.get('source')).toEqual({ seen: 0, total: 2, done: false });
    expect(progress.noteServed('source', firstIdentity)).toBe(true);
    expect(progress.get('source')).toEqual({ seen: 1, total: 2, done: false });
    expect(progress.noteServed('source', second)).toBe(true);
    expect(progress.get('source')).toEqual({ seen: 2, total: 2, done: true });
    expect(progress.get('other')).toBeNull();
  });

  it('validates mark keys and response payloads', () => {
    const key = {
      ci: first.competitionId,
      e: '333',
      r: 'f',
      g: 'A',
      x: 0 as const,
      n: 1,
    };
    expect(decodeTimerWcaScrambleMarkKey(key)).toEqual(key);
    expect(decodeTimerWcaScrambleMarkKey({ ...key, n: '1' })).toBeNull();
    expect(decodeTimerWcaScrambleMarksResponse({
      count: 1,
      marks: [{
        wcaId: '2017YANR02',
        name: 'Daniel Yan',
        country: 'CN',
        timeCs: 1_234,
        createdAt: 1,
      }],
    })).toEqual({
      count: 1,
      marks: [{
        wcaId: '2017YANR02',
        name: 'Daniel Yan',
        country: 'CN',
        timeCs: 1_234,
        createdAt: 1,
      }],
    });
    expect(decodeTimerWcaScrambleMarksResponse({ count: 0, marks: [{}] })).toBeNull();
  });

  it('owns the marks HTTP boundary', async () => {
    const requests: Array<{
      input: string;
      init?: { method?: string; headers?: Record<string, string>; body?: string };
    }> = [];
    const fetcher = vi.fn(async (
      input: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string },
    ) => {
      requests.push({ input, init });
      if (init?.method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, updated: false, createdAt: null }),
        };
      }
      return init?.method === 'POST'
        ? { ok: true, status: 200, json: async () => ({ ok: true, createdAt: 42 }) }
        : { ok: true, status: 200, json: async () => ({ count: 0, marks: [] }) };
    });
    const key = {
      ci: first.competitionId,
      e: '333',
      r: 'f',
      g: 'A',
      x: 0 as const,
      n: 1,
    };

    await expect(fetchTimerWcaScrambleMarks(key, {
      apiBase: 'https://api.cuberoot.me/',
      fetcher,
    })).resolves.toEqual({ count: 0, marks: [] });
    await expect(postTimerWcaScrambleMark(key, { timeCs: 1_234, country: 'CN' }, {
      apiBase: 'https://api.cuberoot.me',
      fetcher,
      token: 'token',
    })).resolves.toBe(42);
    expect(requests[0]?.input).toMatch(/^https:\/\/api\.cuberoot\.me\/v1\/scramble-marks\?/);
    expect(requests[1]?.init?.headers?.Authorization).toBe('Bearer token');
    await expect(updateTimerWcaScrambleMarkIfExists(
      key,
      { timeCs: 1_234, country: '' },
      { apiBase: 'https://api.cuberoot.me/', fetcher, token: 'token' },
    )).resolves.toBe(false);
    expect(requests[2]?.init?.method).toBe('PATCH');
    expect(JSON.parse(requests[2]?.init?.body ?? '')).toEqual({
      ...key,
      timeCs: 1_234,
      country: '',
    });
  });

  it('selects an authenticated upsert or update-only write without exposing ownership', () => {
    expect(timerWcaScrambleMarkWriteMode({
      penalty: 'ok', signedIn: true, enabled: true,
    })).toBe('upsert');
    expect(timerWcaScrambleMarkWriteMode({
      penalty: '+2', signedIn: true, enabled: false,
    })).toBe('update-only');
    expect(timerWcaScrambleMarkWriteMode({
      penalty: 'DNF', signedIn: true, enabled: true,
    })).toBeNull();
    expect(timerWcaScrambleMarkWriteMode({
      penalty: 'ok', signedIn: false, enabled: true,
    })).toBeNull();
  });

  it.each([
    ['ok', true, true, false, true],
    ['+2', true, true, false, true],
    ['DNF', true, true, true, false],
    ['DNS', true, true, true, false],
    ['ok', false, true, true, false],
    ['ok', true, false, false, false],
    ['ok', true, false, true, true],
  ] as const)(
    'gates auto mark for penalty=%s signedIn=%s enabled=%s alreadyMine=%s',
    (penalty, signedIn, enabled, alreadyMine, expected) => {
      expect(shouldAutoMarkTimerWcaScramble({
        penalty,
        signedIn,
        enabled,
        alreadyMine,
      })).toBe(expected);
    },
  );

  it('defaults legacy persistence to auto-mark on and rejects an invalid setting', () => {
    const fresh = createTimerStoreData(0, 'default');
    expect(fresh.settings.autoMarkWcaScramble).toBe(DEFAULT_TIMER_AUTO_MARK_WCA_SCRAMBLE);
    const legacy = structuredClone(fresh) as unknown as { settings: Record<string, unknown> };
    delete legacy.settings.autoMarkWcaScramble;
    expect(decodeTimerStoreData(legacy)?.settings.autoMarkWcaScramble).toBe(true);
    expect(decodeTimerStoreData({
      ...fresh,
      settings: { ...fresh.settings, autoMarkWcaScramble: 'yes' },
    })).toBeNull();
  });
});
