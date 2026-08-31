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
