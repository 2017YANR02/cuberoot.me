import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import { histBack, histPush } from '@cuberoot/shared/timer';

const fetchWcaScramblesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/wca-results-api', () => ({
  fetchWcaScrambles: fetchWcaScramblesMock,
}));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `http://test${path}` }));

const STORE_KEY = 'cuberoot.wca-pool.v1';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const baseSpec: WcaSourceSpec = {
  event: '333',
  mode: 'comp',
  comp: 'LongCompetition2026',
  compName: 'Long Competition 2026',
  round: '',
  group: '',
  from: '',
  to: '',
  optimal: false,
};

function competitionRows(count: number, scrambleFor = (index: number) => `S${String(index + 1).padStart(2, '0')}`) {
  return Array.from({ length: count }, (_, index) => ({
    event_id: '333',
    round_type_id: '1',
    group_id: 'A',
    is_extra: false,
    scramble_num: index + 1,
    scramble: scrambleFor(index),
    optimal_scramble: null,
  }));
}

async function freshPool() {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/scramble/wca_pool');
}

let storage: MemoryStorage;

beforeEach(() => {
  vi.useFakeTimers();
  fetchWcaScramblesMock.mockReset();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WCA competition pool persistence', () => {
  it('keeps a failed competition fetch transient and retries the next request', async () => {
    fetchWcaScramblesMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(competitionRows(1));
    const { isWcaSourceEmpty, nextWca } = await freshPool();

    expect(await nextWca(baseSpec)).toBeNull();
    expect(isWcaSourceEmpty(baseSpec)).toBe(false);
    expect(await nextWca(baseSpec)).toBe('S01');
    expect(fetchWcaScramblesMock).toHaveBeenCalledTimes(2);
  });

  it('keeps an authoritative empty competition closed without refetching', async () => {
    fetchWcaScramblesMock.mockResolvedValue([]);
    const { isWcaSourceEmpty, nextWca } = await freshPool();

    expect(await nextWca(baseSpec)).toBeNull();
    expect(isWcaSourceEmpty(baseSpec)).toBe(true);
    expect(await nextWca(baseSpec)).toBeNull();
    expect(fetchWcaScramblesMock).toHaveBeenCalledOnce();
  });

  it('does not cache a partial difficulty-bin failure as an empty competition', async () => {
    let failSecondBin = true;
    let dataCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/by-difficulty') && url.searchParams.get('pageSize') === '200') {
        dataCalls += 1;
        if (failSecondBin && url.searchParams.get('bin') === '5') {
          return new Response('unavailable', { status: 503 });
        }
        if (url.searchParams.get('bin') === '4') {
          return new Response(JSON.stringify({
            page: 1,
            pageSize: 200,
            scrambles: [{
              scramble: 'R U', ci: difficultySpec.comp, cn: difficultySpec.compName,
              e: '333', r: '1', g: 'A', n: 1, x: 0,
            }],
            total: 1,
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          page: 1, pageSize: 200, scrambles: [], total: 0,
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));
    const difficultySpec: WcaSourceSpec = {
      ...baseSpec,
      diff: {
        colors: 'BGORWY', merged: false, stage: 'cross', steps: [4, 5], variant: 'std',
      },
    };
    const { isWcaSourceEmpty, nextWca } = await freshPool();

    expect(await nextWca(difficultySpec)).toBeNull();
    expect(isWcaSourceEmpty(difficultySpec)).toBe(false);
    failSecondBin = false;
    expect(await nextWca(difficultySpec)).toBe('R U');
    expect(isWcaSourceEmpty(difficultySpec)).toBe(false);
    expect(dataCalls).toBe(4);
  });

  it('resumes the uncached tail of a 60-row competition before cycling after reload', async () => {
    fetchWcaScramblesMock.mockResolvedValue(competitionRows(60));
    const firstModule = await freshPool();

    expect(await firstModule.nextWca(baseSpec)).toBe('S01');
    await vi.advanceTimersByTimeAsync(600);

    const persisted = JSON.parse(storage.getItem(STORE_KEY)!) as {
      comp: Record<string, unknown[]>;
    };
    expect(Object.values(persisted.comp)).toHaveLength(1);
    expect(Object.values(persisted.comp)[0]).toHaveLength(50);

    const reloadedModule = await freshPool();
    const afterReload: Array<string | null> = [];
    for (let index = 1; index < 60; index++) {
      afterReload.push(await reloadedModule.nextWca(baseSpec));
    }

    expect(afterReload).toEqual(
      Array.from({ length: 59 }, (_, index) => `S${String(index + 2).padStart(2, '0')}`),
    );
    expect(fetchWcaScramblesMock).toHaveBeenCalledTimes(2);
  });

  it('returns metadata for each official slot when two slots have identical text', async () => {
    fetchWcaScramblesMock.mockResolvedValue(competitionRows(2, () => 'R U'));
    const { nextWcaRow, wcaMetaFor, wcaMetaForSlot } = await freshPool();

    const first = await nextWcaRow(baseSpec);
    expect(first?.scramble).toBe('R U');
    expect(wcaMetaFor(first!)).toMatchObject({
      ci: 'LongCompetition2026', r: '1', g: 'A', n: 1, x: 0,
    });

    const second = await nextWcaRow(baseSpec);
    expect(second?.scramble).toBe('R U');
    expect(wcaMetaFor(second!)).toMatchObject({
      ci: 'LongCompetition2026', r: '1', g: 'A', n: 2, x: 0,
    });

    // The string compatibility API now points at the most recently dispensed
    // occurrence, but both retained rows — and a ← history navigation — keep
    // their own immutable provenance.
    const history = histPush({ list: [first!], idx: 0 }, second!);
    const back = histBack(history)!;
    expect(wcaMetaFor(back.list[back.idx]!)).toMatchObject({ n: 1 });
    expect(wcaMetaFor(second!)).toMatchObject({ n: 2 });
    expect(wcaMetaForSlot(first!.slot!)).toMatchObject({ n: 1 });
    expect(wcaMetaForSlot(second!.slot!)).toMatchObject({ n: 2 });
  });

  it('skips one malformed persisted slot without abandoning later valid rows', async () => {
    fetchWcaScramblesMock.mockResolvedValue(competitionRows(60));
    const firstModule = await freshPool();
    expect(await firstModule.nextWca(baseSpec)).toBe('S01');
    await vi.advanceTimersByTimeAsync(600);

    const persisted = JSON.parse(storage.getItem(STORE_KEY)!) as {
      comp: Record<string, Array<[string, Record<string, unknown>]>>;
    };
    const rows = Object.values(persisted.comp)[0]!;
    rows[0]![1].e = 'event-id-is-too-long';
    storage.setItem(STORE_KEY, JSON.stringify(persisted));

    const reloadedModule = await freshPool();
    expect(await reloadedModule.nextWca(baseSpec)).toBe('S03');
    expect(fetchWcaScramblesMock).toHaveBeenCalledTimes(1);
  });

  it('keeps occurrence rows in the SoloView history consumer', () => {
    const source = readFileSync(
      new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('wca: WcaDispensedScramble | null;');
    expect(source).toContain('const row = peekWcaRow(wcaSpecRef.current);');
    expect(source).toContain('const real = await nextWcaRow(sourceSpec);');
    expect(source).toContain('wcaMetaFor(currentScrambleEntry.wca ?? scramble)');
  });

  it('keeps the existing eight-source and fifty-row storage caps', async () => {
    fetchWcaScramblesMock.mockResolvedValue(competitionRows(60));
    const { nextWca } = await freshPool();

    for (let index = 0; index < 9; index++) {
      await nextWca({
        ...baseSpec,
        comp: `Competition${index}`,
        compName: `Competition ${index}`,
      });
    }
    await vi.advanceTimersByTimeAsync(600);

    const persisted = JSON.parse(storage.getItem(STORE_KEY)!) as {
      comp: Record<string, unknown[]>;
    };
    expect(Object.keys(persisted.comp)).toHaveLength(8);
    for (const rows of Object.values(persisted.comp)) expect(rows).toHaveLength(50);
  });
});
