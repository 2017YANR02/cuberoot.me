import { describe, expect, it } from 'vitest';

import {
  activateTimerSession,
  activateTimerSessionForEvent,
  associateTimerSessionEvent,
  clearTimerSession,
  createAndActivateTimerSession,
  createTimerSession,
  deleteTimerSession,
  moveTimerSolveToSession,
  renameTimerSession,
  selectTimerEventSession,
  timerSessionEvent,
  timerSessionSelectedEvent,
  type TimerDatabase,
} from '@cuberoot/shared/timer';

function solve(id: string, event: '222' | '333', ts: number) {
  return { id, event, ts, timeMs: ts * 100, penalty: 'ok' as const, scramble: id };
}

function database(): TimerDatabase {
  return {
    version: 3,
    sessions: [
      { id: 'a', name: 'A', createdTs: 1, event: '333' },
      { id: 'b', name: 'B', createdTs: 2 },
      { id: 'c', name: 'C', createdTs: 3 },
    ],
    activeSessionId: 'a',
    dataBySession: {
      a: { '333': [solve('a1', '333', 20)] },
      b: { '222': [solve('b1', '222', 10)] },
      c: {},
    },
  };
}

function frozenDatabase(): TimerDatabase {
  const value = database();
  for (const byEvent of Object.values(value.dataBySession)) {
    for (const solves of Object.values(byEvent)) {
      for (const item of solves ?? []) Object.freeze(item);
      Object.freeze(solves);
    }
    Object.freeze(byEvent);
  }
  for (const session of value.sessions) Object.freeze(session);
  Object.freeze(value.sessions);
  Object.freeze(value.dataBySession);
  return Object.freeze(value);
}

describe('shared timer session operations', () => {
  it('creates with canonical trimming/fallback without mutating the caller', () => {
    const input = frozenDatabase();
    const created = createTimerSession(input, {
      id: 'd',
      name: '   ',
      fallbackName: ' New session ',
      createdTs: 4,
      event: '222',
    });

    expect(created).toMatchObject({ changed: true, failure: null, sessionId: 'd' });
    expect(created.database.sessions.at(-1)).toEqual({
      id: 'd', name: 'New session', createdTs: 4, event: '222',
    });
    expect(created.database.dataBySession.d).toEqual({});
    expect(input.sessions).toHaveLength(3);
    expect(input.dataBySession).not.toHaveProperty('d');

    const duplicate = createTimerSession(input, {
      id: 'a', name: 'Again', fallbackName: 'Fallback', createdTs: 5,
    });
    expect(duplicate).toMatchObject({ changed: false, failure: 'duplicate-session-id' });
    expect(duplicate.database).toBe(input);

    const activated = createAndActivateTimerSession(input, {
      id: 'd', name: 'D', fallbackName: 'Fallback', createdTs: 4, event: '222',
    });
    expect(activated).toMatchObject({
      changed: true, failure: null, activeSessionId: 'd', sessionId: 'd',
    });
    expect(activated.database.sessions.at(-1)?.event).toBe('222');
    expect(input.activeSessionId).toBe('a');
  });

  it('trims rename, rejects empty/unknown names, and clears only the target data', () => {
    const input = frozenDatabase();
    const renamed = renameTimerSession(input, 'b', '  Pocket  ');
    expect(renamed.database.sessions.find((session) => session.id === 'b')?.name).toBe('Pocket');
    expect(input.sessions.find((session) => session.id === 'b')?.name).toBe('B');
    expect(renameTimerSession(input, 'b', ' ')).toMatchObject({
      changed: false, failure: 'empty-name',
    });
    expect(renameTimerSession(input, 'missing', 'X')).toMatchObject({
      changed: false, failure: 'unknown-session',
    });

    const cleared = clearTimerSession(input, 'b');
    expect(cleared.database.dataBySession.b).toEqual({});
    expect(cleared.database.dataBySession.a).toEqual(input.dataBySession.a);
    expect(input.dataBySession.b?.['222']).toHaveLength(1);
    expect(clearTimerSession(input, 'missing')).toMatchObject({
      changed: false, failure: 'unknown-session',
    });

    const emptyBucket: TimerDatabase = {
      ...database(),
      dataBySession: { ...database().dataBySession, c: { '333': [] } },
    };
    expect(clearTimerSession(emptyBucket, 'c')).toMatchObject({ changed: true, failure: null });
    expect(clearTimerSession(emptyBucket, 'c').database.dataBySession.c).toEqual({});
  });

  it('refuses unknown/last deletes and falls active back to the first remaining session', () => {
    const input = frozenDatabase();
    const unknown = deleteTimerSession(input, 'missing');
    expect(unknown).toMatchObject({ changed: false, failure: 'unknown-session', sessionId: null });
    expect(unknown.database).toBe(input);

    const deleted = deleteTimerSession(input, 'a');
    expect(deleted).toMatchObject({
      changed: true, failure: null, activeSessionId: 'b', sessionId: 'b',
    });
    expect(deleted.database.sessions.map((session) => session.id)).toEqual(['b', 'c']);
    expect(deleted.database.dataBySession).not.toHaveProperty('a');
    expect(input.activeSessionId).toBe('a');

    const inactive = deleteTimerSession(input, 'c');
    expect(inactive).toMatchObject({
      changed: true, failure: null, activeSessionId: 'a', sessionId: null,
    });

    const only: TimerDatabase = {
      version: 3,
      sessions: [{ id: 'only', name: 'Only', createdTs: 1 }],
      activeSessionId: 'only',
      dataBySession: { only: {} },
    };
    const refused = deleteTimerSession(only, 'only');
    expect(refused).toMatchObject({
      changed: false, failure: 'last-session', activeSessionId: 'only', sessionId: null,
    });
    expect(refused.database).toBe(only);
  });

  it('keeps activation and association exhaustive for unknown ids', () => {
    const input = frozenDatabase();
    expect(activateTimerSession(input, 'missing')).toMatchObject({
      changed: false, failure: 'unknown-session', sessionId: null,
    });
    expect(associateTimerSessionEvent(input, 'missing', '222')).toMatchObject({
      changed: false, failure: 'unknown-session',
    });
    expect(timerSessionEvent(input, 'missing')).toBeNull();

    const active = activateTimerSession(input, 'b');
    expect(active).toMatchObject({ changed: true, activeSessionId: 'b', sessionId: 'b' });
    expect(input.activeSessionId).toBe('a');
    const associated = associateTimerSessionEvent(input, 'c', '222');
    expect(associated.database.sessions.find((session) => session.id === 'c')?.event).toBe('222');
    expect(input.sessions.find((session) => session.id === 'c')).not.toHaveProperty('event');
  });

  it('infers exactly one populated legacy event and persists it when activating for event', () => {
    const input = frozenDatabase();
    expect(timerSessionEvent(input, 'b')).toBe('222');
    expect(timerSessionEvent(input, 'c')).toBeNull();

    const activated = activateTimerSessionForEvent(input, '222');
    expect(activated).toMatchObject({
      changed: true, failure: null, sessionId: 'b', activeSessionId: 'b',
    });
    expect(activated.database.sessions.find((session) => session.id === 'b')?.event).toBe('222');
    expect(input.sessions.find((session) => session.id === 'b')).not.toHaveProperty('event');

    const mixed = database();
    mixed.dataBySession.b!['333'] = [solve('b2', '333', 30)];
    expect(timerSessionEvent(mixed, 'b')).toBeNull();
    expect(activateTimerSessionForEvent(mixed, '222')).toMatchObject({
      changed: false, failure: 'no-matching-session', sessionId: null,
    });
  });

  it('coordinates event-to-session and session-to-event policy once', () => {
    const input = frozenDatabase();
    const matched = selectTimerEventSession(input, '222', true);
    expect(matched).toMatchObject({ activeSessionId: 'b', sessionId: 'b', failure: null });

    const associated = selectTimerEventSession(input, 'fto', true);
    expect(associated).toMatchObject({ activeSessionId: 'a', sessionId: 'a', failure: null });
    expect(associated.database.sessions.find(session => session.id === 'a')?.event).toBe('fto');

    const manual = selectTimerEventSession(input, '222', false);
    expect(manual).toMatchObject({ activeSessionId: 'a', sessionId: 'a', failure: null });
    expect(manual.database.sessions.find(session => session.id === 'a')?.event).toBe('222');

    expect(timerSessionSelectedEvent(input, 'b', '333', true)).toBe('222');
    expect(timerSessionSelectedEvent(input, 'b', '333', false)).toBe('333');
    expect(timerSessionSelectedEvent(input, null, '333', true)).toBe('333');
  });

  it('moves a solve immutably, sorts the target, and associates an unbound target', () => {
    const input = frozenDatabase();
    const moved = moveTimerSolveToSession(input, 'a1', 'c');
    expect(moved).toMatchObject({ changed: true, failure: null });
    expect(moved.database.dataBySession.a?.['333']).toEqual([]);
    expect(moved.database.dataBySession.c?.['333']?.map((item) => item.id)).toEqual(['a1']);
    expect(moved.database.sessions.find((session) => session.id === 'c')?.event).toBe('333');
    expect(input.dataBySession.a?.['333']?.map((item) => item.id)).toEqual(['a1']);
    expect(input.dataBySession.c).toEqual({});

    expect(moveTimerSolveToSession(input, 'missing', 'c')).toMatchObject({
      changed: false, failure: 'unknown-solve',
    });
    expect(moveTimerSolveToSession(input, 'a1', 'missing')).toMatchObject({
      changed: false, failure: 'unknown-session',
    });
    expect(moveTimerSolveToSession(input, 'a1', 'a')).toMatchObject({
      changed: false, failure: 'same-session',
    });
  });
});
