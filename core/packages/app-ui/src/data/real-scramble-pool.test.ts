import { describe, expect, it, vi } from 'vitest';

import {
  fetchRealScrambles,
  isAllTimeRealScrambleDateSource,
  mergeRealScramblePool,
  realScrambleSourceKey,
  readRealScrambleCache,
  writeRealScrambleCache,
  RealScrambleFetchError,
  type RealScramble,
} from './real-scramble-pool';

const sample333: RealScramble = {
  competitionId: 'Example2016',
  competitionName: 'Example Open 2016',
  eventId: '333',
  groupId: 'A',
  roundTypeId: '1',
  scramble: "R U R'",
  scrambleNumber: 1,
  isExtra: false,
};

const sample222: RealScramble = {
  ...sample333,
  eventId: '222',
  scramble: "R U2 F'",
};

const noBar222 = "R' U' F U F R' U2 F U2";

function noBarExamples(count: number) {
  const idMeta: Record<string, [string, string, number, string, string, 0]> = {};
  const rows: [string, string, string][] = [];
  for (let index = 1; index <= count; index++) {
    const id = `row${index}`;
    const scramble = `${"U U' ".repeat(index)}${noBar222}`;
    idMeta[id] = ['Pocket2026', '222', index, 'f', 'A', 0];
    rows.push([id, scramble, scramble]);
  }
  return {
    meta: { generated_at: '2026-08-22T00:00:00Z' },
    puzzles: {
      222: {
        comps: { Pocket2026: ['Pocket Open 2026', '2026-08-22'] },
        idMeta,
        types: { nobar: rows },
      },
    },
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    data,
  };
}

describe('real scramble pool', () => {
  it('identifies only the all-time date source as eligible for finite progress', () => {
    expect(isAllTimeRealScrambleDateSource({
      event: '333', wcaScrambleMode: 'date', wcaUseOptimal: false,
    })).toBe(true);
    expect(isAllTimeRealScrambleDateSource({
      event: '333', wcaDateFrom: '2026-01-01', wcaScrambleMode: 'date', wcaUseOptimal: false,
    })).toBe(false);
    expect(isAllTimeRealScrambleDateSource({
      event: '333', wcaComp: 'Example2026', wcaScrambleMode: 'comp', wcaUseOptimal: false,
    })).toBe(false);
  });

  it('requests and parses the exact selected event without a 333 fallback', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        { scramble: 'R U', o: ' R U2 F’ ', ci: 'Example2016', cn: 'Example Open 2016', e: '222', r: '1', g: 'A', n: 1, x: 0 },
        { scramble: 'R U', ci: 'wrong-event', e: '333', r: '1', g: 'A', n: 2, x: 0 },
        { scramble: '', ci: 'bad', e: '222', r: '1', g: 'A', n: 3, x: 0 },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles('222', fetcher)).resolves.toEqual([sample222]);
    expect(fetcher).toHaveBeenCalledOnce();
    const requested = new URL(vi.mocked(fetcher).mock.calls[0][0] as string);
    expect(requested.searchParams.get('event')).toBe('222');
    expect(requested.searchParams.get('count')).toBe('50');
    expect(requested.searchParams.get('optimal')).toBe('1');
  });

  it('keeps WCA and optimal 2x2 modes distinct at the transport boundary', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{
        scramble: 'U R F',
        o: "R U2 F'",
        ci: 'Pocket2026',
        cn: 'Pocket 2026',
        e: '222',
        r: '1',
        g: 'A',
        n: 1,
        x: 0,
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'full',
    }, fetcher)).resolves.toMatchObject([{ scramble: 'U R F' }]);
    expect(new URL(vi.mocked(fetcher).mock.calls[0][0] as string).searchParams.has('optimal')).toBe(false);

    await expect(fetchRealScrambles({
      event: '222', scramble222Mode: 'optimal', scramble222Type: 'full',
    }, fetcher)).resolves.toMatchObject([{ scramble: "R U2 F'" }]);
    expect(new URL(vi.mocked(fetcher).mock.calls[1][0] as string).searchParams.get('optimal')).toBe('1');
  });

  it('keeps a raw-only direct competition response transient in optimal mode', async () => {
    const fetcher = (vi.fn()
      .mockResolvedValueOnce(new Response('proxy unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        event_id: '222', round_type_id: '1', group_id: 'A', is_extra: false,
        scramble_num: 1, scramble: 'R U F',
      }]), { status: 200 }))) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '222',
      scramble222Mode: 'optimal',
      scramble222Type: 'full',
      wcaScrambleMode: 'comp',
      wcaComp: 'RawOnly2026',
    }, fetcher)).rejects.toMatchObject({ kind: 'transient-error' });
  });

  it('accepts event-specific WCA notation without duplicating website parsers', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        { scramble: '(1,0) / (-3,2)', ci: 'Sq12024', cn: 'SQ1 Open', e: 'sq1', r: 'f', g: 'A', n: 1, x: 1 },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles('sq1', fetcher)).resolves.toEqual([{
      competitionId: 'Sq12024',
      competitionName: 'SQ1 Open',
      eventId: 'sq1',
      groupId: 'A',
      roundTypeId: 'f',
      scramble: '(1,0) / (-3,2)',
      scrambleNumber: 1,
      isExtra: true,
    }]);
  });

  it('sends the complete shared difficulty request to the canonical random endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{
        scramble: "R U R'",
        ci: 'Range2024',
        cn: 'Range Open 2024',
        e: '333',
        r: '1',
        g: 'A',
        n: 1,
        x: 0,
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    await fetchRealScrambles({
      event: '333',
      wcaScrambleMode: 'date',
      wcaDateFrom: '2024-01-02',
      wcaDateTo: '2024-03-04',
      wcaDifficultyOn: true,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffColors: 'WY',
      wcaDiffSteps: [4, 5, 6],
      wcaDiffMerged: true,
    }, fetcher);

    const url = new URL(vi.mocked(fetcher).mock.calls[0][0] as string);
    expect(url.searchParams.get('event')).toBe('333');
    expect(url.searchParams.get('from')).toBe('2024-01-02');
    expect(url.searchParams.get('to')).toBe('2024-03-04');
    expect(url.searchParams.get('optimal')).toBe('1');
    expect(url.searchParams.get('variant')).toBe('std');
    expect(url.searchParams.get('stage')).toBe('cross');
    expect(url.searchParams.get('colors')).toBe('WY');
    expect(url.searchParams.get('steps')).toBe('4,5,6');
    expect(url.searchParams.get('family')).toBe('1');
  });

  it('suppresses optimal only for the shared Length method', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{
        scramble: "R U R'",
        ci: 'Length2024',
        cn: 'Length Open 2024',
        e: '333',
        r: '1',
        g: 'A',
        n: 1,
        x: 0,
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    await fetchRealScrambles({
      event: '333',
      wcaScrambleMode: 'date',
      wcaDifficultyOn: true,
      wcaDiffVariant: 'length',
      wcaDiffStage: 'length',
      wcaDiffSteps: [18, 19],
    }, fetcher);

    const url = new URL(vi.mocked(fetcher).mock.calls[0][0] as string);
    expect(url.searchParams.has('optimal')).toBe(false);
    expect(url.searchParams.get('variant')).toBe('length');
    expect(url.searchParams.get('stage')).toBe('length');
    expect(url.searchParams.get('steps')).toBe('18,19');
  });

  it('loads a selected competition and filters its exact round and group', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      { event_id: '333', round_type_id: '1', group_id: 'A', is_extra: false, scramble_num: 1, scramble: 'wrong round' },
      { event_id: '333', round_type_id: '2', group_id: 'A', is_extra: false, scramble_num: 1, scramble: 'wrong group' },
      { event_id: '333', round_type_id: '2', group_id: 'B', is_extra: false, scramble_num: 2, scramble: "R U R'" },
      { event_id: '222', round_type_id: '2', group_id: 'B', is_extra: false, scramble_num: 2, scramble: 'wrong event' },
    ]), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '333',
      wcaUseOptimal: false,
      wcaScrambleMode: 'comp',
      wcaComp: 'Selected2026',
      wcaCompName: 'Selected Open 2026',
      wcaRound: '2',
      wcaGroup: 'B',
    }, fetcher)).resolves.toEqual([{
      competitionId: 'Selected2026',
      competitionName: 'Selected Open 2026',
      eventId: '333',
      groupId: 'B',
      roundTypeId: '2',
      scramble: "R U R'",
      scrambleNumber: 2,
      isExtra: false,
    }]);
    expect(String(vi.mocked(fetcher).mock.calls[0][0])).toContain('compId=Selected2026');
  });

  it('keeps every row beyond 50 and sorts a selected competition like Web', async () => {
    const rows = Array.from({ length: 55 }, (_, offset) => {
      const scrambleNumber = 55 - offset;
      return {
        event_id: '333',
        round_type_id: '1',
        group_id: 'A',
        is_extra: false,
        scramble_num: scrambleNumber,
        scramble: `R U row-${scrambleNumber}`,
      };
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify(rows), {
      status: 200,
    })) as unknown as typeof fetch;

    const result = await fetchRealScrambles({
      event: '333',
      wcaUseOptimal: false,
      wcaScrambleMode: 'comp',
      wcaComp: 'Large2026',
    }, fetcher);

    expect(result).toHaveLength(55);
    expect(result.map((row) => row.scrambleNumber)).toEqual(
      Array.from({ length: 55 }, (_, index) => index + 1),
    );
    expect(result[50]?.scramble).toBe('R U row-51');

    const refilled = mergeRealScramblePool(result.slice(47), result, result[46], true);
    expect(refilled).toHaveLength(54);
    expect(refilled.slice(0, 8).map((row) => row.scrambleNumber)).toEqual([
      48, 49, 50, 51, 52, 53, 54, 55,
    ]);
    expect(refilled[8]?.scrambleNumber).toBe(1);
    expect(refilled.some((row) => row.scrambleNumber === 55)).toBe(true);
  });

  it('orders selected rows by round, base-26 group, official/extra, then number', async () => {
    const source = [
      ['f', 'A', false, 1, 'final'],
      ['1', 'AA', false, 1, 'aa'],
      ['1', 'A', true, 1, 'extra'],
      ['1', 'B', false, 1, 'b'],
      ['1', 'A', false, 2, 'a2'],
      ['1', 'A', false, 1, 'a1'],
    ] as const;
    const fetcher = vi.fn(async () => new Response(JSON.stringify(source.map(
      ([round, group, extra, number, scramble]) => ({
        event_id: '333', round_type_id: round, group_id: group,
        is_extra: extra, scramble_num: number, scramble,
      }),
    )), { status: 200 })) as unknown as typeof fetch;

    const result = await fetchRealScrambles({
      event: '333', wcaUseOptimal: false, wcaScrambleMode: 'comp', wcaComp: 'Order2026',
    }, fetcher);
    expect(result.map((row) => row.scramble)).toEqual(['a1', 'a2', 'extra', 'b', 'aa', 'final']);
  });

  it('aborts a selected-competition request without starting direct fallback', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(
          Object.assign(new Error('cancelled'), { name: 'AbortError' }),
        ), { once: true });
      })
    )) as unknown as typeof fetch;
    const request = fetchRealScrambles({
      event: '333',
      wcaScrambleMode: 'comp',
      wcaComp: 'Abort2026',
    }, fetcher, controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps caches isolated by Timer EventId, including aliases that query 333', () => {
    const storage = memoryStorage();
    writeRealScrambleCache('333', [sample333], storage, 1000);
    writeRealScrambleCache('222', [sample222], storage, 1000);
    writeRealScrambleCache('333mr', [{ ...sample333, scramble: 'F R U' }], storage, 1000);
    writeRealScrambleCache('333ni', [{ ...sample333, scramble: 'L U F' }], storage, 1000);

    expect(readRealScrambleCache('333', storage, 1001)).toEqual([sample333]);
    expect(readRealScrambleCache('222', storage, 1001)).toEqual([sample222]);
    expect(readRealScrambleCache('333mr', storage, 1001)).toEqual([{ ...sample333, scramble: 'F R U' }]);
    expect(readRealScrambleCache('333ni', storage, 1001)).toEqual([{ ...sample333, scramble: 'L U F' }]);
    expect([...storage.data.keys()].sort()).toEqual(
      (['222', '333', '333mr', '333ni'] as const)
        .map((event) => `cuberoot.mobile.real-scrambles.${realScrambleSourceKey(event)}.v6`)
        .sort(),
    );
  });

  it('isolates every 2x2 mode/type cache identity and normalizes real 3-gen to full', () => {
    const storage = memoryStorage();
    const wcaFull = { event: '222' as const, scramble222Mode: 'wca' as const, scramble222Type: 'full' as const };
    const optimalFull = { ...wcaFull, scramble222Mode: 'optimal' as const };
    const optimalNoBar = { ...optimalFull, scramble222Type: 'nobar' as const };
    const noBar = { ...sample222, scramble: "R' U' F U F R' U2 F U2" };

    writeRealScrambleCache(wcaFull, [sample222], storage, 1000);
    writeRealScrambleCache(optimalFull, [{ ...sample222, scramble: 'U F R' }], storage, 1000);
    writeRealScrambleCache(optimalNoBar, [noBar], storage, 1000);

    expect(readRealScrambleCache(wcaFull, storage, 1001)).toMatchObject([{ scramble: sample222.scramble }]);
    expect(readRealScrambleCache(optimalFull, storage, 1001)).toMatchObject([{ scramble: 'U F R' }]);
    expect(readRealScrambleCache(optimalNoBar, storage, 1001)).toEqual([noBar]);
    expect(readRealScrambleCache({ ...optimalFull, scramble222Type: 'eg1' }, storage, 1001)).toEqual([]);
    expect(realScrambleSourceKey({ ...optimalFull, scramble222Type: '3gen' }))
      .toBe(realScrambleSourceKey(optimalFull));
  });

  it('keeps a bounded, official-slot-deduplicated seven-day cache', () => {
    const storage = memoryStorage();
    const many = Array.from({ length: 55 }, (_, index): RealScramble => ({
      ...sample333,
      scramble: `row-${index}`,
      scrambleNumber: index + 1,
    }));
    writeRealScrambleCache('333', [many[0], many[0], ...many], storage, 1000);
    const cached = readRealScrambleCache('333', storage, 1001);
    expect(cached).toHaveLength(50);
    expect(cached[0]).toEqual(many[0]);
    expect(new Set(cached.map((item) => item.scramble))).toHaveLength(50);
    expect(readRealScrambleCache('333', storage, 1000 + 7 * 24 * 60 * 60 * 1000 + 1)).toEqual([]);
  });

  it('merges by official occurrence and removes only the current slot', () => {
    const repeatedText = { ...sample333, scrambleNumber: 2 };
    const duplicateDelivery = { ...sample333, scramble: 'F R U' };

    expect(mergeRealScramblePool([], [sample333], sample333)).toEqual([sample333]);
    expect(mergeRealScramblePool([sample333], [duplicateDelivery, repeatedText]))
      .toEqual([sample333, repeatedText]);
    expect(mergeRealScramblePool([sample333], [duplicateDelivery, repeatedText], sample333))
      .toEqual([repeatedText]);
    expect(mergeRealScramblePool([repeatedText], [repeatedText])).toEqual([repeatedText]);
  });

  it('keeps repeated text in separate random/date slots and deduplicates one repeated slot', async () => {
    const onClosedSet = vi.fn();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        { scramble: 'R U', ci: 'Repeated2026', cn: 'Repeated 2026', e: '333', r: '1', g: 'A', n: 1, x: 0 },
        { scramble: 'R U', ci: 'Repeated2026', cn: 'Repeated 2026', e: '333', r: '1', g: 'A', n: 2, x: 0 },
        { scramble: 'F R', ci: 'Repeated2026', cn: 'Repeated 2026', e: '333', r: '1', g: 'A', n: 1, x: 0 },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    const result = await fetchRealScrambles({
      event: '333', wcaUseOptimal: false, wcaScrambleMode: 'date',
    }, fetcher, undefined, undefined, onClosedSet);
    expect(result).toHaveLength(2);
    expect(result.map((row) => [row.scrambleNumber, row.scramble])).toEqual([
      [1, 'R U'],
      [2, 'R U'],
    ]);
    expect(onClosedSet).toHaveBeenCalledOnce();
    expect(onClosedSet.mock.calls[0][0].map((row: RealScramble) => row.scrambleNumber))
      .toEqual([1, 2]);
  });

  it('does not close a bounded date source even when its response is short', async () => {
    const onClosedSet = vi.fn();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{
        scramble: 'R U', ci: 'Bounded2026', cn: 'Bounded 2026',
        e: '333', r: '1', g: 'A', n: 1, x: 0,
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    await fetchRealScrambles({
      event: '333',
      wcaDateFrom: '2026-01-01',
      wcaDateTo: '2026-01-31',
      wcaScrambleMode: 'date',
      wcaUseOptimal: false,
    }, fetcher, undefined, undefined, onClosedSet);
    expect(onClosedSet).not.toHaveBeenCalled();
  });

  it('preserves distinct official slots even when a competition repeats scramble text', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      { event_id: '333', round_type_id: '1', group_id: 'A', is_extra: false, scramble_num: 1, scramble: 'R U' },
      { event_id: '333', round_type_id: '1', group_id: 'A', is_extra: false, scramble_num: 2, scramble: 'R U' },
    ]), { status: 200 })) as unknown as typeof fetch;
    const result = await fetchRealScrambles({
      event: '333', wcaUseOptimal: false, wcaScrambleMode: 'comp', wcaComp: 'Repeated2026',
    }, fetcher);
    expect(result).toHaveLength(2);
    expect(result.map((row) => row.scrambleNumber)).toEqual([1, 2]);
  });

  it('round-trips duplicate competition text by official slot identity in cache', () => {
    const storage = memoryStorage();
    const spec = {
      event: '333' as const,
      wcaScrambleMode: 'comp' as const,
      wcaComp: 'Repeated2026',
    };
    const rows = [
      { ...sample333, competitionId: 'Repeated2026', scramble: 'R U', scrambleNumber: 1 },
      { ...sample333, competitionId: 'Repeated2026', scramble: 'R U', scrambleNumber: 2 },
    ];
    writeRealScrambleCache(spec, rows, storage, 1_000);
    expect(readRealScrambleCache(spec, storage, 1_001).map((row) => row.scrambleNumber))
      .toEqual([1, 2]);
  });

  it('restores repeated text occurrences from a random/date cache after restart', () => {
    const storage = memoryStorage();
    const rows = [
      { ...sample333, competitionId: 'Repeated2026', scramble: 'R U', scrambleNumber: 1 },
      { ...sample333, competitionId: 'Repeated2026', scramble: 'R U', scrambleNumber: 2 },
      // One endpoint/page may repeat an official slot. Its first delivery wins.
      { ...sample333, competitionId: 'Repeated2026', scramble: 'F R', scrambleNumber: 1 },
    ];
    writeRealScrambleCache({
      event: '333', wcaScrambleMode: 'date',
    }, rows, storage, 1_000);

    const restarted = memoryStorage();
    for (const [key, value] of storage.data) restarted.data.set(key, value);
    expect(readRealScrambleCache({
      event: '333', wcaScrambleMode: 'date',
    }, restarted, 1_001).map((row) => [row.scrambleNumber, row.scramble]))
      .toEqual([[1, 'R U'], [2, 'R U']]);
  });

  it('invalidates the v5 cache whose text-keyed writer could not preserve occurrences', () => {
    const storage = memoryStorage();
    const sourceKey = realScrambleSourceKey({
      event: '333', wcaScrambleMode: 'date',
    });
    storage.data.set(`cuberoot.mobile.real-scrambles.${sourceKey}.v5`, JSON.stringify({
      fetchedAt: 1_000,
      sourceKey,
      timerEventId: '333',
      wcaEventId: '333',
      scrambles: [sample333],
    }));

    expect(readRealScrambleCache({
      event: '333', wcaScrambleMode: 'date',
    }, storage, 1_001)).toEqual([]);
  });

  it('rejects impossible cache timestamps instead of extending the TTL', () => {
    const storage = memoryStorage();
    const sourceKey = realScrambleSourceKey('333');
    const key = `cuberoot.mobile.real-scrambles.${sourceKey}.v6`;
    const envelope = (fetchedAt: number) => JSON.stringify({
      fetchedAt,
      sourceKey,
      timerEventId: '333',
      wcaEventId: '333',
      scrambles: [sample333],
    });

    storage.data.set(key, envelope(-1));
    expect(readRealScrambleCache('333', storage, 10_000)).toEqual([]);

    storage.data.set(key, envelope(10_000 + 5 * 60 * 1000));
    expect(readRealScrambleCache('333', storage, 10_000)).toEqual([sample333]);

    storage.data.set(key, envelope(10_000 + 5 * 60 * 1000 + 1));
    expect(readRealScrambleCache('333', storage, 10_000)).toEqual([]);
  });

  it('rejects corrupt envelopes and filters corrupt rows without poisoning valid rows', () => {
    const storage = memoryStorage();
    const sourceKey = realScrambleSourceKey('333');
    const key = `cuberoot.mobile.real-scrambles.${sourceKey}.v6`;
    storage.data.set(key, '{broken');
    expect(readRealScrambleCache('333', storage, 1001)).toEqual([]);

    storage.data.set(key, JSON.stringify({
      fetchedAt: 1000,
      sourceKey,
      timerEventId: '222',
      wcaEventId: '333',
      scrambles: [sample333],
    }));
    expect(readRealScrambleCache('333', storage, 1001)).toEqual([]);

    storage.data.set(key, JSON.stringify({
      fetchedAt: 1000,
      sourceKey,
      timerEventId: '333',
      wcaEventId: '333',
      scrambles: [
        sample333,
        { ...sample333, eventId: '222', scramble: 'wrong event' },
        { ...sample333, scramble: '' },
        { ...sample333, competitionId: '!', scramble: 'strict-invalid slot' },
      ],
    }));
    expect(readRealScrambleCache('333', storage, 1001)).toEqual([sample333]);
  });

  it('filters a strict-invalid live slot without poisoning a valid row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        {
          scramble: "R U R'",
          ci: 'Example2016',
          cn: 'Example Open 2016',
          e: '333',
          r: '1',
          g: 'A',
          n: 1,
          x: 0,
        },
        {
          scramble: 'strict-invalid slot',
          ci: '!',
          cn: 'Invalid Competition',
          e: '333',
          r: '1',
          g: 'A',
          n: 2,
          x: 0,
        },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '333', wcaScrambleMode: 'date', wcaUseOptimal: false,
    }, fetcher)).resolves.toEqual([sample333]);
  });

  it('reads the original 333 cache without exposing it to aliases', () => {
    const storage = memoryStorage();
    storage.data.set('cuberoot.mobile.real-scrambles.333.v1', JSON.stringify({
      fetchedAt: 1000,
      scrambles: [sample333],
    }));

    expect(readRealScrambleCache('333', storage, 1001)).toEqual([sample333]);
    expect(readRealScrambleCache('333mr', storage, 1001)).toEqual([]);
    expect(readRealScrambleCache('333ni', storage, 1001)).toEqual([]);
  });

  it('rejects mismatched API rows instead of returning another event', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{ scramble: "R U R'", ci: 'wrong', e: '333', r: '1', g: 'A', n: 1, x: 0 }],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'full',
    }, fetcher)).rejects.toThrow('no valid 222 rows');
  });

  it('samples real 2x2 rows until the selected state family matches', async () => {
    const noBar = "R' U' F U F R' U2 F U2";
    const item = (scramble: string, n: number) => ({
      scramble, ci: 'Pocket2026', cn: 'Pocket 2026', e: '222', r: '1', g: 'A', n, x: 0,
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ scrambles: [item("R R'", 1)] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ scrambles: [item(noBar, 2)] }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'nobar',
    }, fetcher)).resolves.toMatchObject([{ scramble: noBar, scrambleNumber: 2 }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses the shared precomputed true-scramble bucket when a rare live refill fails', async () => {
    const noBar = "U R' F U F U' R U2 R' U2 R2";
    const optimalNoBar = "F U' R' U2 F R' F2 U2 R";
    const examplesFetcher = vi.fn(async () => new Response(JSON.stringify({
      meta: { generated_at: '2026-08-22T00:00:00Z' },
      puzzles: {
        222: {
          comps: { Pocket2026: ['Pocket Open 2026', '2026-08-22'] },
          idMeta: { row1: ['Pocket2026', '222', 3, 'f', 'A', 0] },
          types: { nobar: [['row1', noBar, optimalNoBar]] },
        },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const liveFetcher = vi.fn(async () => new Response('unavailable', { status: 503 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '222', scramble222Mode: 'optimal', scramble222Type: 'nobar',
    }, liveFetcher, undefined, examplesFetcher)).resolves.toMatchObject([{
      competitionId: 'Pocket2026',
      competitionName: 'Pocket Open 2026',
      eventId: '222',
      scramble: optimalNoBar,
      scrambleNumber: 3,
    }]);
    expect(examplesFetcher).toHaveBeenCalledOnce();
    expect(liveFetcher).toHaveBeenCalledOnce();
  });

  it('keeps duplicate-text 2x2 precomputed occurrences and drops only a repeated slot', async () => {
    const examplesFetcher = vi.fn(async () => new Response(JSON.stringify({
      meta: { generated_at: '2026-08-22T00:00:00Z' },
      puzzles: {
        222: {
          comps: { Pocket2026: ['Pocket Open 2026', '2026-08-22'] },
          idMeta: {
            first: ['Pocket2026', '222', 1, 'f', 'A', 0],
            second: ['Pocket2026', '222', 2, 'f', 'A', 0],
            firstAgain: ['Pocket2026', '222', 1, 'f', 'A', 0],
          },
          types: {
            nobar: [
              ['first', noBar222, noBar222],
              ['second', noBar222, noBar222],
              ['firstAgain', noBar222, noBar222],
            ],
          },
        },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const liveFetcher = vi.fn(async () => new Response('unavailable', {
      status: 503,
    })) as unknown as typeof fetch;

    const rows = await fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'nobar',
    }, liveFetcher, undefined, examplesFetcher);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.scrambleNumber).sort((left, right) => left - right))
      .toEqual([1, 2]);
    expect(new Set(rows.map((row) => row.scramble))).toEqual(new Set([noBar222]));
  });

  it('samples across the complete precomputed bucket instead of pinning the first 50 rows', async () => {
    const examplesFetcher = vi.fn(async () => new Response(
      JSON.stringify(noBarExamples(60)),
      { status: 200 },
    )) as unknown as typeof fetch;
    const liveFetcher = vi.fn(async () => new Response('unavailable', {
      status: 503,
    })) as unknown as typeof fetch;
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999999);

    try {
      const rows = await fetchRealScrambles({
        event: '222', scramble222Mode: 'wca', scramble222Type: 'nobar',
      }, liveFetcher, undefined, examplesFetcher);
      expect(rows).toHaveLength(50);
      expect(rows.some((row) => row.scramble.startsWith("U U' ".repeat(60)))).toBe(true);
      expect(new Set(rows.map((row) => row.scramble))).toHaveLength(50);
    } finally {
      random.mockRestore();
    }
  });

  it('admits a fresh live match even when the precomputed seed already fills the pool', async () => {
    const examplesFetcher = vi.fn(async () => new Response(
      JSON.stringify(noBarExamples(60)),
      { status: 200 },
    )) as unknown as typeof fetch;
    const liveScramble = `F F' ${noBar222}`;
    const liveFetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{
        scramble: liveScramble,
        ci: 'Live2026',
        cn: 'Live Open 2026',
        e: '222',
        r: '1',
        g: 'B',
        n: 1,
        x: 0,
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const rows = await fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'nobar',
    }, liveFetcher, undefined, examplesFetcher);
    expect(rows).toHaveLength(50);
    expect(rows[0]?.scramble).toBe(liveScramble);
  });

  it('keeps a finite live type-sampling miss transient even when examples load without that bucket', async () => {
    const examplesFetcher = vi.fn(async () => new Response(JSON.stringify({
      meta: { generated_at: '2026-08-22T00:00:00Z' },
      puzzles: { 222: { comps: {}, idMeta: {}, types: {} } },
    }), { status: 200 })) as unknown as typeof fetch;
    const item = { scramble: "R R'", ci: 'Pocket2026', e: '222', r: '1', g: 'A', n: 1, x: 0 };
    const liveFetcher = vi.fn(async () => new Response(JSON.stringify({ scrambles: [item] }), {
      status: 200,
    })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'nobar',
    }, liveFetcher, undefined, examplesFetcher)).rejects.toMatchObject({
      kind: 'transient-error',
    } satisfies Partial<RealScrambleFetchError>);
    expect(liveFetcher).toHaveBeenCalledTimes(30);
  });

  it('treats a live type-filter budget miss as transient when examples were unavailable', async () => {
    const item = { scramble: "R R'", ci: 'Pocket2026', e: '222', r: '1', g: 'A', n: 1, x: 0 };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ scrambles: [item] }), {
      status: 200,
    })) as unknown as typeof fetch;

    const result = fetchRealScrambles({
      event: '222', scramble222Mode: 'wca', scramble222Type: 'nobar',
    }, fetcher);
    await expect(result).rejects.toMatchObject({
      kind: 'transient-error',
    } satisfies Partial<RealScrambleFetchError>);
    expect(fetcher).toHaveBeenCalledTimes(30);
  });

  it('propagates cold network and response-shape failures without generating a substitute', async () => {
    const unavailable = vi.fn(async () => new Response('unavailable', { status: 503 })) as unknown as typeof fetch;
    await expect(fetchRealScrambles('222', unavailable)).rejects.toThrow(
      'real scramble request failed (503)',
    );
    expect(unavailable).toHaveBeenCalledOnce();

    const malformed = vi.fn(async () => new Response(JSON.stringify({ scrambles: 'not-an-array' }), {
      status: 200,
    })) as unknown as typeof fetch;
    await expect(fetchRealScrambles('222', malformed)).rejects.toThrow(
      'real scramble response is invalid',
    );
    expect(malformed).toHaveBeenCalledOnce();
  });

  it('rejects unsupported events before network or cache access', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const storage = memoryStorage();

    await expect(fetchRealScrambles('custom', fetcher)).rejects.toThrow(
      'real WCA scrambles unsupported for timer event custom',
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(readRealScrambleCache('custom', storage)).toEqual([]);
    writeRealScrambleCache('custom', [sample333], storage);
    expect(storage.data.size).toBe(0);
  });
});
