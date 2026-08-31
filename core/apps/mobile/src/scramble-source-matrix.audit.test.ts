import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  EVENTS,
  TIMER_SCRAMBLE_CAPABILITIES,
  TIMER_TRAINER_EVENT_IDS,
  TIMER_WCA_SCRAMBLE_EVENT_MAP,
  generateTimerScramble,
  timerScrambleAllowsEmptySlot,
  timerSupportsRealWcaScrambles,
  type EventId,
} from '@cuberoot/shared/timer';

type Source = 'real' | 'random' | 'manual';
type RouteOutcome = 'real-pool' | 'same-event-local' | 'manual-queue' | 'provider-missing';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

const CURRENT_LOCAL_PROVIDERS: readonly EventId[] = [
  '222', '333', '444', '555', '666', '777',
  '333oh', '333bld', '333mbld', '333ni', '333fm', '333mr',
  '444bld', '555bld', '666bld', '777bld',
  'pyra', 'skewb', 'sq1', 'mega', 'clock',
  'magic', 'mmagic',
  'fto', 'kilominx', 'gear', 'ivy', 'redi', 'mpyram',
  'r3', 'r4', 'r5', 'cross', 'f2l',
  'll', 'oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2',
];

const CURRENT_MISSING_LOCAL_PROVIDERS: readonly EventId[] = [];

function currentMobileOutcome(event: EventId, source: Source): RouteOutcome {
  if (source === 'manual') return 'manual-queue';
  if (source === 'real' && timerSupportsRealWcaScrambles(event)) return 'real-pool';
  const capability = TIMER_SCRAMBLE_CAPABILITIES[event];
  return capability.kind === 'cubing'
      || capability.kind === 'shared'
      || capability.kind === 'compound'
    ? 'same-event-local'
    : 'provider-missing';
}

describe('adversarial 43 × 3 Mobile scramble-source matrix', () => {
  it('enumerates every event/source cell exactly once', () => {
    const matrix = EVENTS.flatMap(({ id }) => (
      (['real', 'random', 'manual'] as const).map((source) => ({
        event: id,
        outcome: currentMobileOutcome(id, source),
        source,
      }))
    ));

    expect(EVENTS).toHaveLength(43);
    expect(matrix).toHaveLength(129);
    expect(new Set(matrix.map(({ event, source }) => `${event}:${source}`))).toHaveLength(129);
  });

  it('keeps the real route at 19 isolated WCA pools, 23 same-event fallbacks, and custom manual-only', () => {
    const mapped = EVENTS.filter(({ id }) => currentMobileOutcome(id, 'real') === 'real-pool')
      .map(({ id }) => id);
    const local = EVENTS.filter(({ id }) => currentMobileOutcome(id, 'real') === 'same-event-local')
      .map(({ id }) => id);
    const missing = EVENTS.filter(({ id }) => currentMobileOutcome(id, 'real') === 'provider-missing')
      .map(({ id }) => id);

    expect(mapped.sort()).toEqual(Object.keys(TIMER_WCA_SCRAMBLE_EVENT_MAP).sort());
    expect(mapped).toHaveLength(19);
    expect(local.sort()).toEqual([
      '666bld', '777bld', 'magic', 'mmagic',
      'r3', 'r4', 'r5',
      'cross', 'f2l', 'fto', 'kilominx', 'gear', 'ivy', 'redi', 'mpyram',
      'll', 'oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2',
    ].sort());
    // Custom's empty user-supplied source remains explicit; it is never a 333
    // fallback and is intentionally not a random generator.
    expect(missing.sort()).toEqual([
      ...CURRENT_MISSING_LOCAL_PROVIDERS,
      'custom',
    ].sort());
    expect(local).toHaveLength(23);
    expect(missing).toHaveLength(1);
  });

  it('records the current random-provider gap instead of treating catalog presence as support', () => {
    const local = EVENTS.filter(({ id }) => currentMobileOutcome(id, 'random') === 'same-event-local')
      .map(({ id }) => id);
    const missing = EVENTS.filter(({ id }) => currentMobileOutcome(id, 'random') === 'provider-missing')
      .map(({ id }) => id);

    expect(local.sort()).toEqual([...CURRENT_LOCAL_PROVIDERS].sort());
    expect(missing.sort()).toEqual([...CURRENT_MISSING_LOCAL_PROVIDERS, 'custom'].sort());
    expect(local).toHaveLength(42);
    expect(missing).toHaveLength(1);
  });

  it.each(['kilominx', 'mpyram'] as const)(
    'keeps $event identity through the shared worker provider seam',
    async (event) => {
      const result = await generateTimerScramble(
        { event },
        {
          generateSharedScramble: async (provider, requestedEvent) => (
            `${provider}:${requestedEvent}`
          ),
        },
      );
      expect(result).toEqual({
        ok: true,
        event,
        kind: 'generated',
        provider: 'cstimer-nonwca',
        scramble: `cstimer-nonwca:${event}`,
      });
    },
  );

  it('generates every trainer event through the shared runtime with case metadata', async () => {
    for (const event of TIMER_TRAINER_EVENT_IDS) {
      const result = await generateTimerScramble({ event }, { random: () => 0.25 });
      expect(result.ok).toBe(true);
      if (result.ok && result.kind === 'generated') {
        expect(result.event).toBe(event);
        expect(result.provider).toBe('trainer-case');
        expect(result.scramble).not.toBe('');
        expect(result.metadata?.caseId).not.toBe('');
        expect(result.metadata?.solutionAlg).not.toBe('');
      }
    }
  });

  it('routes manual through one queue for all 43 events, including custom and empty input', () => {
    const outcomes = EVENTS.map(({ id }) => currentMobileOutcome(id, 'manual'));
    expect(outcomes).toHaveLength(43);
    expect(new Set(outcomes)).toEqual(new Set<RouteOutcome>(['manual-queue']));
  });

  it('treats custom Random/retained-Real as a ready empty slot, not a missing provider', async () => {
    await expect(generateTimerScramble({ event: 'custom' })).resolves.toEqual({
      event: 'custom',
      kind: 'manual',
      ok: true,
      scramble: '',
    });
    expect(timerScrambleAllowsEmptySlot('custom', 'random')).toBe(true);
    expect(timerScrambleAllowsEmptySlot('custom', 'wca')).toBe(true);
    expect(timerScrambleAllowsEmptySlot('333', 'manual')).toBe(true);
    expect(timerScrambleAllowsEmptySlot('333', 'random')).toBe(false);

    expect(appSource).toMatch(/if \(result\.kind === 'manual'\)[\s\S]*?availability: 'ready',[\s\S]*?scramble: ''/);
    expect(appSource).not.toMatch(/if \(result\.kind === 'manual'\)[\s\S]{0,300}?availability: 'unsupported'/);
  });

  it('keeps the Mobile adapter on exact shared event identities', () => {
    expect(appSource).toMatch(
      /if \(!timerSupportsRealWcaScrambles\(event\)\) \{\s*generateRandomScramble\(entry, requestId\);\s*return;/,
    );
    expect(appSource).toContain('const request = {');
    expect(appSource).toContain('event,');
    expect(appSource).toContain('generateTimerScramble(request, specialistDependencies)');
    expect(appSource).not.toContain('generateTimerScramble({ event: \'333\' })');
    expect(appSource).not.toContain('scramble333');
  });

  it('rejects stale real/random completions by request, event, and source identity', () => {
    expect(appSource).toContain('requestId !== scrambleRequestRef.current');
    expect(appSource).toContain('activeEventRef.current !== event');
    expect(appSource).toContain('scrambleSourceRef.current !== expectedSource');
    expect(appSource).toContain("scrambleSourceRef.current !== 'wca'");
    expect(appSource).toContain('new Map<string, RealPoolRequest>()');
    expect(appSource).toContain('new Map<string, RealScramble[]>()');
    expect(appSource).toContain('realScrambleSourceKey(realSpec)');
  });

  it('turns a mapped cold-network failure into an error without local fallback', () => {
    const coldRealStart = appSource.indexOf('void refillRealPool(realSpec).then((outcome) => {');
    const coldRealEnd = appSource.indexOf('\n\n  useEffect(() => {', coldRealStart);
    const coldRealBranch = appSource.slice(coldRealStart, coldRealEnd);
    expect(coldRealStart).toBeGreaterThan(-1);
    expect(coldRealEnd).toBeGreaterThan(coldRealStart);
    expect(coldRealBranch).toContain("replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'error' })");
    expect(coldRealBranch).not.toContain('generateRandomScramble(');
  });
});
