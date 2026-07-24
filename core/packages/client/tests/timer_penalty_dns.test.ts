/**
 * DNS (Did Not Start) penalty — WCA 9f2 / A1a4.
 *
 * DNS scores exactly like a DNF everywhere; the distinction is display-only.
 * The whole mechanism rides on ONE line: `effectiveMs` returns Infinity for
 * DNS, placed before the DNF branch. `stats.ts` never inspects `penalty`
 * except in `summarize().solved`, so that single return makes DNS behave
 * correctly in every average — these tests pin exactly that.
 *
 * csTimer has no DNS code, so we export DNS as a DNF (-1) whose comment is
 * prefixed "DNS " and sniff the prefix back off on import.
 */

import { describe, it, expect } from 'vitest';
import type { Penalty, Solve } from '@/app/[lang]/timer/_lib/types';
import { effectiveMs } from '@/app/[lang]/timer/_lib/types';
import { averageOfN, meanOfN, penaltyLabel, summarize } from '@/app/[lang]/timer/_lib/stats';

/* ------------------------------------------------------------------ */
/* Fake localStorage — exportCstimerJson reads the real v3 store.      */
/* ------------------------------------------------------------------ */

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}
const g = globalThis as unknown as {
  window?: unknown;
  localStorage?: ReturnType<typeof makeLocalStorage>;
};
g.window = g.window ?? { addEventListener() {} };
g.localStorage = makeLocalStorage();

const { exportCstimerJson } = await import('@/app/[lang]/timer/_lib/storage/export_cstimer');
const { parseCstimerExport } = await import('@/app/[lang]/timer/_lib/storage/import_cstimer');
const { importCstimerJson, exportSpeedstacks } = await import('@/app/[lang]/timer/_lib/storage/import_export');

/* ------------------------------------------------------------------ */

let seq = 0;
function mk(timeMs: number, penalty: Penalty, comment?: string): Solve {
  seq++;
  return {
    id: 's' + seq,
    timeMs,
    penalty,
    scramble: "R U R' U'",
    event: '333',
    ts: 1_700_000_000_000 + seq * 1000,
    ...(comment !== undefined ? { comment } : {}),
  };
}

describe('effectiveMs', () => {
  it('returns Infinity for DNS, ignoring the recorded time', () => {
    expect(effectiveMs(mk(5000, 'DNS'))).toBe(Infinity);
    expect(effectiveMs(mk(0, 'DNS'))).toBe(Infinity);
  });

  it('still returns Infinity for DNF and the raw/+2 values otherwise', () => {
    expect(effectiveMs(mk(5000, 'DNF'))).toBe(Infinity);
    expect(effectiveMs(mk(5000, 'ok'))).toBe(5000);
    expect(effectiveMs(mk(5000, '+2'))).toBe(7000);
  });
});

describe('averages treat DNS exactly like DNF', () => {
  it('one DNS in an ao5 is trimmed as the worst solve', () => {
    const solves = [
      mk(10_000, 'ok'), mk(11_000, 'ok'), mk(12_000, 'DNS'),
      mk(13_000, 'ok'), mk(14_000, 'ok'),
    ];
    // sorted = [10000, 11000, 13000, 14000, Inf]; trim 1 each side →
    // mean(11000, 13000, 14000) = 12666.67 → truncated to cs = 12660.
    expect(averageOfN(solves, 5)).toBe(12_660);
  });

  it('one DNS AND one DNF exceeds the single-DNF cap → the ao5 is DNF', () => {
    const solves = [
      mk(10_000, 'ok'), mk(11_000, 'DNF'), mk(12_000, 'DNS'),
      mk(13_000, 'ok'), mk(14_000, 'ok'),
    ];
    expect(averageOfN(solves, 5)).toBe(Infinity);
  });

  it('two DNS also exceed the cap', () => {
    const solves = [
      mk(10_000, 'DNS'), mk(11_000, 'ok'), mk(12_000, 'DNS'),
      mk(13_000, 'ok'), mk(14_000, 'ok'),
    ];
    expect(averageOfN(solves, 5)).toBe(Infinity);
  });

  it('any DNS kills an untrimmed mean, same as a DNF', () => {
    expect(meanOfN([mk(10_000, 'ok'), mk(11_000, 'ok'), mk(12_000, 'DNS')], 3)).toBe(Infinity);
  });
});

describe('summarize().solved', () => {
  it('counts DNS as unsolved alongside DNF', () => {
    const solves = [
      mk(10_000, 'ok'), mk(11_000, '+2'), mk(12_000, 'DNF'),
      mk(13_000, 'DNS'), mk(14_000, 'ok'),
    ];
    const s = summarize(solves);
    expect(s.count).toBe(5);
    expect(s.solved).toBe(3); // ok, +2, ok
  });
});

describe('penaltyLabel', () => {
  it('shows DNS distinctly from DNF', () => {
    expect(penaltyLabel('DNS')).toBe('DNS');
    expect(penaltyLabel('DNF')).toBe('DNF');
    expect(penaltyLabel('+2')).toBe('+2');
    expect(penaltyLabel('ok')).toBe('OK');
  });
});

describe('exportSpeedstacks', () => {
  it('emits a DNS line', () => {
    const out = exportSpeedstacks([
      mk(12_340, 'ok'), mk(9_870, '+2'), mk(15_020, 'DNF'), mk(1_000, 'DNS'),
    ]);
    expect(out).toBe('00:12.340\n00:11.870+\nDNF\nDNS\n');
  });
});

/* ------------------------------------------------------------------ */
/* csTimer round trip                                                  */
/* ------------------------------------------------------------------ */

const DB_KEY = 'cuberoot-timer.v3';

/** Seed the real v3 store with one 333 session so exportCstimerJson sees it. */
function seedStore(solves: Solve[]): void {
  g.localStorage!.setItem(DB_KEY, JSON.stringify({
    version: 3,
    sessions: [{ id: 's1', name: 'test', createdTs: 1 }],
    activeSessionId: 's1',
    dataBySession: { s1: { '333': solves } },
  }));
}

describe('csTimer DNS round trip', () => {
  it('exports DNS as a -1 (DNF) tuple with a "DNS"-prefixed comment', async () => {
    seedStore([
      mk(12_340, 'ok'),
      mk(15_020, 'DNF', 'popped'),
      mk(1_000, 'DNS', 'arrived late'),
      mk(0, 'DNS'),
    ]);
    const { json, solveCount } = await exportCstimerJson();
    expect(solveCount).toBe(4);

    const outer = JSON.parse(json) as Record<string, string>;
    const tuples = JSON.parse(outer['session1']) as Array<[[number, number], string, string, number]>;
    expect(tuples.map(t => t[0][0])).toEqual([0, -1, -1, -1]);
    // Real csTimer, which knows nothing of DNS, reads these as DNFs with notes.
    expect(tuples.map(t => t[2])).toEqual(['', 'popped', 'DNS arrived late', 'DNS']);
  });

  it('recovers DNS (and the original comment) through parseCstimerExport', async () => {
    seedStore([
      mk(12_340, 'ok'),
      mk(15_020, 'DNF', 'popped'),
      mk(1_000, 'DNS', 'arrived late'),
      mk(0, 'DNS'),
    ]);
    const { json } = await exportCstimerJson();
    const sessions = parseCstimerExport(json);
    expect(sessions).toHaveLength(1);
    const solves = sessions[0].solves;
    expect(solves.map(s => s.penalty)).toEqual(['ok', 'DNF', 'DNS', 'DNS']);
    expect(solves.map(s => s.comment)).toEqual([undefined, 'popped', 'arrived late', undefined]);
    expect(solves.map(s => s.timeMs)).toEqual([12_340, 15_020, 1_000, 0]);
  });

  it('the second importer (importCstimerJson) agrees', async () => {
    seedStore([mk(12_340, 'ok'), mk(1_000, 'DNS', 'arrived late'), mk(15_020, 'DNF')]);
    const { json } = await exportCstimerJson();
    const byEvent = importCstimerJson(json);
    expect(byEvent).not.toBeNull();
    const solves = byEvent!['333'];
    expect(solves.map(s => s.penalty)).toEqual(['ok', 'DNS', 'DNF']);
    expect(solves.map(s => s.comment)).toEqual([undefined, 'arrived late', undefined]);
  });

  it('does not mistake a genuine csTimer comment for a DNS marker', () => {
    // Sniffing only fires on penalty -1, and only on the "DNS" word boundary.
    const raw = JSON.stringify({
      session1: JSON.stringify([
        [[0, 12_340], 'R U', 'DNS is a great song', 1_700_000_000],
        [[-1, 15_020], 'R U', 'DNSomething weird', 1_700_000_100],
      ]),
      properties: { sessionData: JSON.stringify({ '1': { name: '3x3', opt: { scrType: '333' }, rank: 1 } }) },
    });
    const solves = parseCstimerExport(raw)[0].solves;
    expect(solves.map(s => s.penalty)).toEqual(['ok', 'DNF']);
    expect(solves.map(s => s.comment)).toEqual(['DNS is a great song', 'DNSomething weird']);
  });
});
