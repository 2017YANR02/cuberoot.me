import { describe, expect, it } from 'vitest';

import {
  activeTimerSolves,
  createTimerStoreData,
  decodeTimerStoreData,
  parseTimerStoreJson,
  serializeTimerStoreData,
} from '@cuberoot/shared/timer';

describe('shared timer persistence schema', () => {
  it('round-trips a valid, chronologically normalized store', () => {
    const data = createTimerStoreData(100, 'session', 'zh');
    data.dataBySession.session['333'] = [
      { id: 'later', timeMs: 2_000, penalty: '+2', scramble: 'R', event: '333', ts: 20 },
      { id: 'first', timeMs: 1_000, penalty: 'ok', scramble: 'U', event: '333', ts: 10 },
    ];

    const parsed = parseTimerStoreJson(serializeTimerStoreData(data));
    expect(parsed?.settings.language).toBe('zh');
    expect(activeTimerSolves(parsed!, '333').map((solve) => solve.id)).toEqual(['first', 'later']);
  });

  it('rejects invalid JSON, unknown versions and missing sessions', () => {
    expect(parseTimerStoreJson('{')).toBeNull();
    expect(decodeTimerStoreData({ schemaVersion: 2 })).toBeNull();
    expect(decodeTimerStoreData({ schemaVersion: 1, sessions: [] })).toBeNull();
  });

  it('rejects orphaned active sessions and duplicate ids', () => {
    const orphaned = createTimerStoreData(0, 'a');
    orphaned.activeSessionId = 'missing';
    expect(decodeTimerStoreData(orphaned)).toBeNull();

    const duplicated = createTimerStoreData(0, 'a');
    duplicated.sessions.push({ ...duplicated.sessions[0] });
    expect(decodeTimerStoreData(duplicated)).toBeNull();
  });

  it('rejects invalid solve ranges and event mismatches', () => {
    const negative = createTimerStoreData(0, 'a');
    negative.dataBySession.a['333'] = [
      { id: 'x', timeMs: -1, penalty: 'ok', scramble: '', event: '333', ts: 0 },
    ];
    expect(decodeTimerStoreData(negative)).toBeNull();

    const mismatched = createTimerStoreData(0, 'a');
    mismatched.dataBySession.a['333'] = [
      { id: 'x', timeMs: 1, penalty: 'ok', scramble: '', event: '222', ts: 0 },
    ];
    expect(decodeTimerStoreData(mismatched)).toBeNull();
  });

  it('refuses to serialize a mutated invalid store', () => {
    const data = createTimerStoreData(0, 'a');
    data.settings.holdMs = Number.NaN;
    expect(() => serializeTimerStoreData(data)).toThrow('invalid timer data');
  });
});
