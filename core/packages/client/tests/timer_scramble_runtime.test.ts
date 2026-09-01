import { describe, expect, it, vi } from 'vitest';

import {
  EVENTS,
  TIMER_SCRAMBLE_CAPABILITIES,
  generateTimerScramble,
  timerScrambleCapability,
  type EventId,
  type TimerCompoundScrambleEventId,
  type TimerCompoundScrambleProviderId,
  type TimerCubingScrambleEventId,
  type TimerSharedScrambleProviderId,
} from '@cuberoot/shared/timer';
import {
  GEAR_TIMER_MIN_LENGTH,
  generateGearTimerScramble,
  solveGear,
} from '@cuberoot/puzzle-solvers/gear';
import {
  IVY_TIMER_MIN_LENGTH,
  generateIvyTimerScramble,
  solveIvy,
} from '@cuberoot/puzzle-solvers/ivy';

const CUBING_EVENTS: Readonly<Partial<Record<EventId, TimerCubingScrambleEventId>>> = {
  '333': '333',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  '333oh': '333oh',
  '333bld': '333bf',
  '333ni': '333bf',
  '333fm': '333fm',
  '333mr': '333',
  '444bld': '444bf',
  '555bld': '555bf',
  pyra: 'pyram',
  skewb: 'skewb',
  sq1: 'sq1',
  mega: 'minx',
  clock: 'clock',
  fto: 'fto',
  redi: 'redi_cube',
  cross: '333',
  f2l: '333',
};

const SHARED_EVENTS: Readonly<Partial<Record<EventId, TimerSharedScrambleProviderId>>> = {
  '222': 'wca-pocket',
  ll: 'trainer-case',
  oll: 'trainer-case',
  pll: 'trainer-case',
  coll: 'trainer-case',
  cmll: 'trainer-case',
  zbll: 'trainer-case',
  eg1: 'trainer-case',
  eg2: 'trainer-case',
  gear: 'small-puzzle-random-state',
  ivy: 'small-puzzle-random-state',
  kilominx: 'cstimer-nonwca',
  mpyram: 'cstimer-nonwca',
};

const COMPOUND_EVENTS: Readonly<
  Partial<Record<EventId, TimerCompoundScrambleProviderId>>
> = {
  '333mbld': 'timer-compound',
  '666bld': 'timer-compound',
  '777bld': 'timer-compound',
  magic: 'timer-compound',
  mmagic: 'timer-compound',
  r3: 'timer-compound',
  r4: 'timer-compound',
  r5: 'timer-compound',
};

const UNSUPPORTED_EVENTS: readonly EventId[] = [];

const COMPOUND_FIXTURES: readonly {
  event: TimerCompoundScrambleEventId;
  random: number;
  calls: readonly string[];
  scramble: string;
}[] = [
  {
    event: '333mbld',
    random: 0,
    calls: ['cubing:333:333', 'cubing:333:333', 'cubing:333:333'],
    scramble: [
      'Solve 1 of 3: 333@333#1',
      'Solve 2 of 3: 333@333#2',
      'Solve 3 of 3: 333@333#3',
    ].join('\n'),
  },
  {
    event: '666bld',
    random: 0,
    calls: ['cubing:666:666'],
    scramble: '666@666#1 3Rw Uw',
  },
  {
    event: '777bld',
    random: 0,
    calls: ['cubing:777:777'],
    scramble: '777@777#1 3Rw 3Uw',
  },
  {
    event: 'r3',
    random: 0,
    calls: ['shared:wca-pocket:222', 'cubing:333:333'],
    scramble: '2x2: 222@wca-pocket#1\n3x3: 333@333#1',
  },
  {
    event: 'r4',
    random: 0,
    calls: ['shared:wca-pocket:222', 'cubing:333:333', 'cubing:444:444'],
    scramble: '2x2: 222@wca-pocket#1\n3x3: 333@333#1\n4x4: 444@444#1',
  },
  {
    event: 'r5',
    random: 0,
    calls: [
      'shared:wca-pocket:222',
      'cubing:333:333',
      'cubing:444:444',
      'cubing:555:555',
    ],
    scramble: [
      '2x2: 222@wca-pocket#1',
      '3x3: 333@333#1',
      '4x4: 444@444#1',
      '5x5: 555@555#1',
    ].join('\n'),
  },
  {
    event: 'magic',
    random: 0,
    calls: [],
    scramble: 'Forward',
  },
  {
    event: 'mmagic',
    random: 0.75,
    calls: [],
    scramble: 'M Backward',
  },
];

describe('shared timer scramble runtime', () => {
  it('declares exactly one capability for every EventId', () => {
    expect(Object.keys(TIMER_SCRAMBLE_CAPABILITIES).sort()).toEqual(
      EVENTS.map(({ id }) => id).sort(),
    );
    expect(Object.entries(TIMER_SCRAMBLE_CAPABILITIES)
      .filter(([, capability]) => capability.kind === 'cubing')
      .map(([event]) => event)
      .sort()).toEqual(Object.keys(CUBING_EVENTS).sort());
    expect(Object.entries(TIMER_SCRAMBLE_CAPABILITIES)
      .filter(([, capability]) => capability.kind === 'shared')
      .map(([event]) => event)
      .sort()).toEqual(Object.keys(SHARED_EVENTS).sort());
    expect(Object.entries(TIMER_SCRAMBLE_CAPABILITIES)
      .filter(([, capability]) => capability.kind === 'compound')
      .map(([event]) => event)
      .sort()).toEqual(Object.keys(COMPOUND_EVENTS).sort());
    expect(EVENTS
      .filter(({ id }) => timerScrambleCapability(id)?.kind === 'unsupported')
      .map(({ id }) => id)
      .sort()).toEqual([...UNSUPPORTED_EVENTS].sort());
    expect(TIMER_SCRAMBLE_CAPABILITIES.custom).toEqual({ kind: 'manual' });
  });

  it('passes each supported event through its exact cubing.js mapping', async () => {
    const generate = vi.fn(async (cubingEventId: TimerCubingScrambleEventId) => (
      `  ${cubingEventId} scramble  `
    ));

    for (const [event, cubingEventId] of Object.entries(CUBING_EVENTS)) {
      const result = await generateTimerScramble(
        { event: event as EventId },
        { generateCubingScramble: generate },
      );
      expect(result).toEqual({
        ok: true,
        event,
        kind: 'generated',
        provider: 'cubing',
        scramble: `${cubingEventId} scramble`,
      });
      expect(generate).toHaveBeenLastCalledWith(cubingEventId, event);
    }
    expect(generate).toHaveBeenCalledTimes(21);
  });

  it('routes 222 through the shared TNoodle WCA provider, never cubing.js', async () => {
    const generateCubingScramble = vi.fn(async () => 'L U L2');
    const generateSharedScramble = vi.fn(async () => "R U F2 R' U2 F R2 U' F' R U");

    await expect(generateTimerScramble(
      { event: '222' },
      { generateCubingScramble, generateSharedScramble },
    )).resolves.toEqual({
      ok: true,
      event: '222',
      kind: 'generated',
      provider: 'wca-pocket',
      scramble: "R U F2 R' U2 F R2 U' F' R U",
    });
    expect(generateSharedScramble).toHaveBeenCalledWith('wca-pocket', '222', { event: '222' });
    expect(generateCubingScramble).not.toHaveBeenCalled();
  });

  it('defaults 222 to the website optimal style and still supports exact WCA 11-move mode', async () => {
    const result = await generateTimerScramble({ event: '222' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('generated');
    if (result.kind !== 'generated') return;
    expect(result.provider).toBe('wca-pocket');
    const moves = result.scramble.split(' ');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(11);
    for (const [index, move] of moves.entries()) {
      expect(move).toMatch(/^[URF](?:2|')?$/);
      if (index > 0) expect(move[0]).not.toBe(moves[index - 1][0]);
    }

    const wca = await generateTimerScramble({ event: '222', scramble222Mode: 'wca' });
    expect(wca.ok).toBe(true);
    if (wca.ok && wca.kind === 'generated') expect(wca.scramble.split(' ')).toHaveLength(11);
  });

  it.each([
    {
      event: 'gear' as const,
      expected: generateGearTimerScramble,
      minLength: GEAR_TIMER_MIN_LENGTH,
      optimalDistance: (scramble: string) => solveGear(scramble).length,
    },
    {
      event: 'ivy' as const,
      expected: generateIvyTimerScramble,
      minLength: IVY_TIMER_MIN_LENGTH,
      optimalDistance: (scramble: string) => solveIvy(scramble).length,
    },
  ])(
    'routes $event through the canonical shared random-state engine',
    async ({ event, expected, minLength, optimalDistance }) => {
      const sample = 0.375;
      const result = await generateTimerScramble({ event }, { random: () => sample });
      expect(result).toEqual({
        ok: true,
        event,
        kind: 'generated',
        provider: 'small-puzzle-random-state',
        scramble: expected(() => sample),
      });
      if (!result.ok || result.kind !== 'generated') return;
      expect(result.scramble.split(' ')).toHaveLength(minLength);
      expect(optimalDistance(result.scramble)).toBeGreaterThan(0);
    },
  );

  it.each(['kilominx', 'mpyram'] as const)(
    'keeps $event identity through the shared csTimer worker seam',
    async (event) => {
      const generateSharedScramble = vi.fn(async (
        provider: TimerSharedScrambleProviderId,
        requestedEvent: EventId,
      ) => (
        `${requestedEvent}@${provider}`
      ));
      await expect(generateTimerScramble(
        { event },
        { generateSharedScramble },
      )).resolves.toEqual({
        ok: true,
        event,
        kind: 'generated',
        provider: 'cstimer-nonwca',
        scramble: `${event}@cstimer-nonwca`,
      });
      expect(generateSharedScramble).toHaveBeenCalledWith(
        'cstimer-nonwca',
        event,
        { event },
      );
    },
  );

  it.each(COMPOUND_FIXTURES)(
    'keeps $event identity while composing its exact child providers and format',
    async ({ event, random, calls: expectedCalls, scramble }) => {
      const calls: string[] = [];
      const occurrences = new Map<string, number>();
      const nextOccurrence = (key: string): number => {
        const next = (occurrences.get(key) ?? 0) + 1;
        occurrences.set(key, next);
        return next;
      };
      const generateCubingScramble = vi.fn(async (
        cubingEventId: TimerCubingScrambleEventId,
        requestedEvent: EventId,
      ) => {
        calls.push(`cubing:${cubingEventId}:${requestedEvent}`);
        return `${requestedEvent}@${cubingEventId}#${nextOccurrence(requestedEvent)}`;
      });
      const generateSharedScramble = vi.fn(async (
        provider: TimerSharedScrambleProviderId,
        requestedEvent: EventId,
      ) => {
        calls.push(`shared:${provider}:${requestedEvent}`);
        return `${requestedEvent}@${provider}#${nextOccurrence(requestedEvent)}`;
      });

      await expect(generateTimerScramble(
        { event, scramble222Mode: 'wca', scramble222Type: 'eg1' },
        {
          generateCubingScramble,
          generateSharedScramble,
          random: () => random,
        },
      )).resolves.toEqual({
        ok: true,
        event,
        kind: 'generated',
        provider: 'timer-compound',
        scramble,
      });
      expect(calls).toEqual(expectedCalls);
      if (event === 'r3' || event === 'r4' || event === 'r5') {
        expect(generateSharedScramble).toHaveBeenCalledWith(
          'wca-pocket',
          '222',
          {
            event: '222',
            scramble222Mode: 'wca',
            scramble222Type: 'full',
          },
        );
      }
    },
  );

  it('represents custom as manual without calling a generator', async () => {
    const generate = vi.fn(async () => 'must not run');
    await expect(generateTimerScramble(
      { event: 'custom' },
      { generateCubingScramble: generate },
    )).resolves.toEqual({ ok: true, event: 'custom', kind: 'manual', scramble: '' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('reports unsupported and unknown events without falling back to 333', async () => {
    const generate = vi.fn(async () => '333 fallback');
    for (const event of UNSUPPORTED_EVENTS) {
      await expect(generateTimerScramble(
        { event },
        { generateCubingScramble: generate },
      )).resolves.toEqual({
        ok: false,
        event,
        code: 'unsupported-event',
        retryable: false,
      });
    }

    const unknown = 'not-a-timer-event';
    expect(timerScrambleCapability(unknown)).toBeNull();
    await expect(generateTimerScramble(
      { event: unknown as EventId },
      { generateCubingScramble: generate },
    )).resolves.toEqual({
      ok: false,
      event: unknown,
      code: 'unsupported-event',
      retryable: false,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns typed provider failures instead of changing event', async () => {
    await expect(generateTimerScramble(
      { event: 'sq1' },
      { generateCubingScramble: async () => '   ' },
    )).resolves.toEqual({
      ok: false,
      event: 'sq1',
      code: 'empty-result',
      retryable: true,
    });

    await expect(generateTimerScramble(
      { event: 'clock' },
      { generateCubingScramble: async () => { throw new Error('worker failed'); } },
    )).resolves.toEqual({
      ok: false,
      event: 'clock',
      code: 'generation-failed',
      retryable: true,
    });

    let mbldChild = 0;
    await expect(generateTimerScramble(
      { event: '333mbld' },
      {
        generateCubingScramble: async () => (++mbldChild === 2 ? '   ' : 'R U'),
      },
    )).resolves.toEqual({
      ok: false,
      event: '333mbld',
      code: 'empty-result',
      retryable: true,
    });

    await expect(generateTimerScramble(
      { event: 'magic' },
      { random: () => 1 },
    )).resolves.toEqual({
      ok: false,
      event: 'magic',
      code: 'generation-failed',
      retryable: true,
    });
  });

  it('turns a stalled provider into a retryable failure', async () => {
    await expect(generateTimerScramble(
      { event: '333' },
      {
        generateCubingScramble: () => new Promise<string>(() => undefined),
        requestTimeoutMs: 1,
      },
    )).resolves.toEqual({
      ok: false,
      event: '333',
      code: 'generation-failed',
      retryable: true,
    });
  });
});
