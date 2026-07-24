/**
 * Round simulation — WCA round formats, cutoffs, time limits, projections.
 *
 * Every expectation cites the clause it pins, from the Regulations snapshot in
 * `app/[lang]/regulation/_data/reg-source.snapshot.md`.
 *
 * Times are written in ms. The engine's averages ROUND to the nearest
 * hundredth (9f1) — `_lib/stats.ts` truncates instead, so the parity block at
 * the bottom deliberately uses windows where the two agree.
 */

import { describe, it, expect } from 'vitest';
import type { Penalty, Solve } from '@/app/[lang]/timer/_lib/types';
import {
  DEFAULT_ROUND_CONFIG,
  roundAttempts,
  roundResult,
  roundCutoffMade,
  roundProjection,
  type RoundConfig,
} from '@/app/[lang]/timer/_lib/round';
import { bpa as statsBpa, wpa as statsWpa } from '@/app/[lang]/timer/_lib/stats';

let seq = 0;
function mk(timeMs: number, penalty: Penalty = 'ok'): Solve {
  seq++;
  return {
    id: 's' + seq,
    timeMs,
    penalty,
    scramble: "R U R' U'",
    event: '333',
    ts: 1_700_000_000_000 + seq * 1000,
  };
}
const dnf = (elapsed = 30_000) => mk(elapsed, 'DNF');
const dns = () => mk(0, 'DNS');

function cfg(patch: Partial<RoundConfig> = {}): RoundConfig {
  return { ...DEFAULT_ROUND_CONFIG, on: true, ...patch };
}

/* ------------------------------------------------------------------ */
/* Format allotments — 9f6 / 9f8 / 9f10                                */
/* ------------------------------------------------------------------ */

describe('format allotment (9f6 / 9f8 / 9f10)', () => {
  it('allots 1 / 3 / 3 / 5 attempts', () => {
    expect(roundAttempts('bo1')).toBe(1);
    expect(roundAttempts('bo3')).toBe(3);
    expect(roundAttempts('mo3')).toBe(3);
    expect(roundAttempts('ao5')).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/* ao5 — 9f8 / 9f9                                                     */
/* ------------------------------------------------------------------ */

describe('ao5 (9f8 drop best+worst, 9f9 DNF handling)', () => {
  const c = cfg({ format: 'ao5' });

  it('drops the best and the worst and means the middle three', () => {
    // 8.00 9.00 10.00 11.00 12.00 → drop 8 and 12 → (9+10+11)/3 = 10.00
    const r = roundResult([8000, 9000, 10_000, 11_000, 12_000].map(t => mk(t)), c);
    expect(r.official).toBe(10_000);
    expect(r.value).toBe(10_000);
    expect(r.status).toBe('done');
    expect(r.endedBy).toBe('format');
    expect(r.best).toBe(8000);
  });

  it('rounds the mean to the nearest hundredth (9f1), not down', () => {
    // (9004 + 9005 + 9006) / 3 = 9005 → 9.005 s rounds to 9.01 s
    const r = roundResult([1000, 9004, 9005, 9006, 20_000].map(t => mk(t)), c);
    expect(r.official).toBe(9010);
  });

  it('lets a single DNF become the dropped worst (9f9)', () => {
    const r = roundResult([mk(9000), mk(10_000), dnf(), mk(11_000), mk(8000)], c);
    // sorted: 8000 9000 10000 11000 DNF → middle (9+10+11)/3 = 10.00
    expect(r.official).toBe(10_000);
  });

  it('treats a DNS exactly like a DNF (9f9 names both)', () => {
    const r = roundResult([mk(9000), mk(10_000), dns(), mk(11_000), mk(8000)], c);
    expect(r.official).toBe(10_000);
  });

  it('is DNF with two or more DNF/DNS (9f9)', () => {
    expect(roundResult([mk(9000), dnf(), dnf(), mk(10_000), mk(11_000)], c).official).toBe(Infinity);
    expect(roundResult([mk(9000), dnf(), dns(), mk(10_000), mk(11_000)], c).official).toBe(Infinity);
  });

  it('is DNF when every attempt is a DNF', () => {
    const r = roundResult([dnf(), dnf(), dnf(), dnf(), dnf()], c);
    expect(r.official).toBe(Infinity);
    expect(r.best).toBe(Infinity);
  });

  it('has no official result until the allotment is complete (9f8)', () => {
    const r = roundResult([mk(9000), mk(10_000), mk(11_000)], c);
    expect(r.official).toBeNull();
    expect(r.done).toBe(3);
    expect(r.remaining).toBe(2);
    expect(r.status).toBe('running');
  });

  it('ignores attempts past the allotment (9f8 allots exactly 5)', () => {
    const six = [8000, 9000, 10_000, 11_000, 12_000, 1000].map(t => mk(t));
    expect(roundResult(six, c).official).toBe(10_000);
    expect(roundResult(six, c).list).toHaveLength(5);
  });
});

/* ------------------------------------------------------------------ */
/* mo3 / bo3 / bo1 — 9f10 / 9f11 / 9f6 / 9f7                           */
/* ------------------------------------------------------------------ */

describe('mo3 (9f10 mean of all 3, 9f11 any DNF ⇒ DNF)', () => {
  const c = cfg({ format: 'mo3' });

  it('means all three attempts', () => {
    expect(roundResult([9000, 10_000, 11_000].map(t => mk(t)), c).official).toBe(10_000);
  });

  it('is DNF with a single DNF — no drop exists (9f11)', () => {
    expect(roundResult([mk(9000), mk(10_000), dnf()], c).official).toBe(Infinity);
  });

  it('is DNF with a single DNS (9f11 names both)', () => {
    expect(roundResult([mk(9000), dns(), mk(10_000)], c).official).toBe(Infinity);
  });

  it('rounds the mean to the nearest hundredth (9f1)', () => {
    // (9000 + 9000 + 9005) / 3 = 9001.67 → 9.00 s
    expect(roundResult([9000, 9000, 9005].map(t => mk(t)), c).official).toBe(9000);
    // (9000 + 9010 + 9005) / 3 = 9005 → 9.01 s (rounds up, does not truncate)
    expect(roundResult([9000, 9010, 9005].map(t => mk(t)), c).official).toBe(9010);
  });
});

describe('bo3 / bo1 (9f6 best attempt, 9f7 DNF is worst)', () => {
  it('bo3 is the best single of the three', () => {
    const r = roundResult([11_000, 9000, 10_000].map(t => mk(t)), cfg({ format: 'bo3' }));
    expect(r.official).toBe(9000);
  });

  it('bo3 survives DNFs as long as one attempt lands (9f7)', () => {
    const r = roundResult([dnf(), mk(9000), dnf()], cfg({ format: 'bo3' }));
    expect(r.official).toBe(9000);
  });

  it('bo3 is DNF when nothing lands', () => {
    expect(roundResult([dnf(), dnf(), dnf()], cfg({ format: 'bo3' })).official).toBe(Infinity);
  });

  it('bo1 is the single attempt', () => {
    const r = roundResult([mk(9123)], cfg({ format: 'bo1' }));
    expect(r.official).toBe(9123);
    expect(r.complete).toBe(true);
  });

  it('bo1 applies the +2 before ranking', () => {
    expect(roundResult([mk(9000, '+2')], cfg({ format: 'bo1' })).official).toBe(11_000);
  });
});

/* ------------------------------------------------------------------ */
/* Boundaries                                                          */
/* ------------------------------------------------------------------ */

describe('boundaries', () => {
  it('zero solves — idle, no value, full allotment remaining', () => {
    const r = roundResult([], cfg({ format: 'ao5' }));
    expect(r.status).toBe('idle');
    expect(r.value).toBeNull();
    expect(r.official).toBeNull();
    expect(r.best).toBeNull();
    expect(r.done).toBe(0);
    expect(r.remaining).toBe(5);
    expect(r.list.every(a => a.state === 'pending')).toBe(true);
  });

  it('one solve of an ao5 — running value is that single, no official result', () => {
    const r = roundResult([mk(9000)], cfg({ format: 'ao5' }));
    expect(r.value).toBe(9000);
    expect(r.official).toBeNull();
    expect(r.status).toBe('running');
  });

  it('one DNF at 2/5 keeps a running value (9f9 allows one drop)', () => {
    const r = roundResult([mk(9000), dnf()], cfg({ format: 'ao5' }));
    expect(r.value).toBe(9000);
  });

  it('a lone DNF reads as DNF', () => {
    expect(roundResult([dnf()], cfg({ format: 'ao5' })).value).toBe(Infinity);
  });

  it('an average over 10 minutes rounds to the nearest second (9f2)', () => {
    const c = cfg({ format: 'mo3' });
    // (600_400 + 600_400 + 600_400) / 3 = 600_400 → 10:00.4 → 10:00
    expect(roundResult([600_400, 600_400, 600_400].map(t => mk(t)), c).official).toBe(600_000);
    // 600_600 → rounds up to 10:01
    expect(roundResult([600_600, 600_600, 600_600].map(t => mk(t)), c).official).toBe(601_000);
  });
});

/* ------------------------------------------------------------------ */
/* Cutoff — 9g                                                         */
/* ------------------------------------------------------------------ */

describe('cutoff (9g)', () => {
  const c = cfg({ format: 'ao5', cutoffMs: 10_000, cutoffAttempts: 2 });

  it('is made by a strictly better attempt', () => {
    expect(roundCutoffMade([mk(9990), mk(30_000)], c)).toBe(true);
    expect(roundResult([mk(9990)], c).cutoffMade).toBe(true);
  });

  it('is NOT made by equalling the cutoff — 9g says strictly better', () => {
    const r = roundResult([mk(10_000), mk(10_000)], c);
    expect(r.cutoffMade).toBe(false);
    expect(roundCutoffMade([mk(10_000), mk(10_000)], c)).toBe(false);
    expect(r.status).toBe('cut');
  });

  it('ends the round when the phase closes without the requirement met', () => {
    const r = roundResult([mk(11_000), mk(12_000)], c);
    expect(r.status).toBe('cut');
    expect(r.endedBy).toBe('cutoff');
    expect(r.complete).toBe(true);
    expect(r.remaining).toBe(0);
    expect(r.cutIndex).toBe(2);
    expect(r.list.slice(2).every(a => a.state === 'ineligible')).toBe(true);
  });

  it('leaves a cut ao5 with NO average (9f5+ — those attempts have no result)', () => {
    const r = roundResult([mk(11_000), mk(12_000)], c);
    expect(r.official).toBeNull();
    expect(r.best).toBe(11_000);
  });

  it('still ranks a cut "Best of X" on the attempts that were made (9f6)', () => {
    const bo3 = cfg({ format: 'bo3', cutoffMs: 10_000, cutoffAttempts: 1 });
    const r = roundResult([mk(12_000)], bo3);
    expect(r.status).toBe('cut');
    expect(r.official).toBe(12_000);
  });

  it('does not end the round while the phase is still open', () => {
    const r = roundResult([mk(11_000)], c);
    expect(r.status).toBe('running');
    expect(r.remaining).toBe(4);
  });

  it('counts cutoff-phase attempts towards the full format (9g)', () => {
    // 9.00 made the cutoff; all five attempts feed the ao5.
    const r = roundResult([9000, 30_000, 9000, 9000, 9000].map(t => mk(t)), c);
    expect(r.done).toBe(5);
    expect(r.official).toBe(9000); // drop 9.00 and 30.00 → (9+9+9)/3
  });

  it('discards attempts taken after a missed cutoff', () => {
    const r = roundResult([11_000, 12_000, 5000, 5000, 5000].map(t => mk(t)), c);
    expect(r.official).toBeNull();
    expect(r.done).toBe(2);
    expect(r.list[2].state).toBe('ineligible');
    expect(r.list[2].solve).not.toBeNull(); // kept for the greyed-out display
    expect(r.list[2].ms).toBeNull();
  });

  it('a busted time limit cannot satisfy the cutoff (A1a4 first, then 9g)', () => {
    const withLimit = cfg({ format: 'ao5', cutoffMs: 10_000, cutoffAttempts: 2, limitMs: 9500 });
    const r = roundResult([mk(9000), mk(9000)], withLimit);
    // 9.00 < 10.00 would pass, but 9.00 ≥ the 9.50 limit? no — it is under it.
    expect(r.cutoffMade).toBe(true);
    const busted = roundResult([mk(9600), mk(9700)], withLimit);
    expect(busted.list[0].overLimit).toBe(true);
    expect(busted.cutoffMade).toBe(false);
    expect(busted.status).toBe('cut');
  });

  it('is inactive when the format has a single attempt', () => {
    const r = roundResult([mk(30_000)], cfg({ format: 'bo1', cutoffMs: 10_000, cutoffAttempts: 1 }));
    expect(r.cutoffActive).toBe(false);
    expect(r.status).toBe('done');
    expect(roundCutoffMade([mk(30_000)], cfg({ format: 'bo1', cutoffMs: 10_000 }))).toBe(true);
  });

  it('clamps a phase that is not shorter than the round', () => {
    const r = roundResult([], cfg({ format: 'ao5', cutoffMs: 10_000, cutoffAttempts: 9 }));
    expect(r.cutoffPhase).toBe(4);
  });

  it('is inactive without a cutoff time, and "made" reads true', () => {
    const plain = cfg({ format: 'ao5' });
    expect(roundResult([], plain).cutoffActive).toBe(false);
    expect(roundCutoffMade([mk(60_000)], plain)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Time limits — A1a1 / A1a2 / A1a4 / A1a5                             */
/* ------------------------------------------------------------------ */

describe('per-attempt time limit (A1a1 / A1a4)', () => {
  const c = cfg({ format: 'mo3', limitMs: 60_000 });

  it('DNFs an attempt that reaches the limit', () => {
    const r = roundResult([mk(59_990), mk(60_000), mk(10_000)], c);
    expect(r.list[0].overLimit).toBe(false);
    expect(r.list[1].overLimit).toBe(true);
    expect(r.list[1].ms).toBe(Infinity);
    expect(r.official).toBe(Infinity); // 9f11
  });

  it('compares the POST-penalty result, per the A1a2++ example', () => {
    // 59.00 + 2 = 61.00 busts a 60.00 limit even though the raw time did not.
    const r = roundResult([mk(59_000, '+2'), mk(10_000), mk(10_000)], c);
    expect(r.list[0].overLimit).toBe(true);
  });
});

describe('cumulative time limit (A1a2 / A1a5)', () => {
  it('spends the post-penalty result of a finished attempt (A1a5)', () => {
    const c = cfg({ format: 'mo3', limitMs: 60_000, cumulative: true });
    const r = roundResult([mk(10_000), mk(10_000, '+2')], c);
    expect(r.usedMs).toBe(22_000);
    expect(r.budgetMs).toBe(38_000);
    expect(r.nextLimitMs).toBe(38_000);
  });

  it('spends the ELAPSED time of a DNF, and nothing for a DNS (A1a5)', () => {
    const c = cfg({ format: 'mo3', limitMs: 600_000, cumulative: true });
    const r = roundResult([dnf(45_000), dns(), mk(10_000)], c);
    expect(r.usedMs).toBe(55_000);
  });

  it('applies the leftover budget as the limit for the next attempt (A1a2)', () => {
    // 20:00 cumulative; 7:00 then 7:30 leaves 5:30 for the third attempt.
    const c = cfg({ format: 'mo3', limitMs: 1_200_000, cumulative: true });
    const ok = roundResult([mk(420_000), mk(450_000), mk(329_000)], c);
    expect(ok.list[2].overLimit).toBe(false);
    const bust = roundResult([mk(420_000), mk(450_000), mk(330_000)], c);
    expect(bust.list[2].overLimit).toBe(true);
  });

  it('records every remaining attempt as DNS once the budget is gone (A1a2+++++)', () => {
    const c = cfg({ format: 'ao5', limitMs: 30_000, cumulative: true });
    const r = roundResult([mk(10_000), mk(10_000), mk(10_000)], c);
    expect(r.endedBy).toBe('limit');
    expect(r.complete).toBe(true);
    expect(r.dnsCount).toBe(2);
    expect(r.list[3].state).toBe('dns');
    expect(r.list[4].state).toBe('dns');
    // Two DNS in an ao5 ⇒ DNF (9f9) — unlike a missed cutoff, these DO count.
    expect(r.official).toBe(Infinity);
  });

  it('the attempt that exhausts the budget busts its own limit too (A1a2 + A1a4)', () => {
    const c = cfg({ format: 'ao5', limitMs: 40_000, cumulative: true });
    const r = roundResult([mk(10_000), mk(10_000), mk(10_000), mk(10_000)], c);
    // A1a2 makes the 4th attempt's limit 40:00 − 30:00 = 10:00, and A1a4 DNFs
    // an attempt that REACHES its limit — so running the budget to zero always
    // costs the attempt that did it. One DNF plus one forced DNS ⇒ DNF (9f9).
    expect(r.list[3].overLimit).toBe(true);
    expect(r.dnsCount).toBe(1);
    expect(r.official).toBe(Infinity);
  });

  it('leaves the round alone while budget remains', () => {
    const c = cfg({ format: 'ao5', limitMs: 40_000, cumulative: true });
    const r = roundResult([mk(9000), mk(9000), mk(9000), mk(9000)], c);
    expect(r.dnsCount).toBe(0);
    expect(r.remaining).toBe(1);
    expect(r.budgetMs).toBe(4000);
    expect(r.nextLimitMs).toBe(4000);
    expect(r.endedBy).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

describe('projection (BPA / WPA)', () => {
  const c = cfg({ format: 'ao5' });

  it('agrees with stats.bpa / stats.wpa when exactly one attempt remains', () => {
    const solves = [10_000, 12_000, 11_000, 9000].map(t => mk(t));
    const p = roundProjection(solves, c);
    expect(p.remaining).toBe(1);
    expect(p.bpa).toBe(statsBpa(solves, 5));
    expect(p.wpa).toBe(statsWpa(solves, 5));
  });

  it('substitutes 0 / DNF for EVERY remaining attempt, not just one', () => {
    const solves = [10_000, 12_000, 20_000].map(t => mk(t));
    const p = roundProjection(solves, c);
    expect(p.remaining).toBe(2);
    // best case [0,0,10,12,20] → drop 0 and 20 → (0+10+12)/3 = 7.33
    expect(p.bpa).toBe(7330);
    // worst case: two DNFs ⇒ DNF (9f9)
    expect(p.wpa).toBe(Infinity);
  });

  it('collapses onto the result once the round is over', () => {
    const solves = [8000, 9000, 10_000, 11_000, 12_000].map(t => mk(t));
    const p = roundProjection(solves, c);
    expect(p.remaining).toBe(0);
    expect(p.bpa).toBe(10_000);
    expect(p.wpa).toBe(10_000);
  });

  it('BPA stays DNF when two DNFs are already banked', () => {
    const p = roundProjection([mk(9000), dnf(), dnf()], c);
    expect(p.bpa).toBe(Infinity);
    expect(p.wpa).toBe(Infinity);
  });
});

describe('projection (target plan)', () => {
  const c = cfg({ format: 'ao5' });

  it('reports a target already secured by the worst case', () => {
    // 4 done, all 9.00 → WPA drops the DNF ⇒ 9.00, so sub-10 is locked in.
    const p = roundProjection([9000, 9000, 9000, 9000].map(t => mk(t)), c, 10_000);
    expect(p.target?.achieved).toBe(true);
    expect(p.target?.impossible).toBe(false);
    expect(p.target?.needMs).toBeNull();
  });

  it('reports a target the best case can no longer reach', () => {
    const p = roundProjection([20_000, 20_000, 20_000, 20_000].map(t => mk(t)), c, 10_000);
    expect(p.target?.impossible).toBe(true);
    expect(p.target?.achieved).toBe(false);
    expect(p.target?.needMs).toBeNull();
  });

  it('needMs is the exact threshold — it passes and one ms more fails', () => {
    const solves = [9000, 10_000, 11_000, 12_000].map(t => mk(t));
    const p = roundProjection(solves, c, 10_000);
    const need = p.target?.needMs as number;
    expect(need).toBeGreaterThan(0);
    const at = roundResult([...solves, mk(need)], c).official as number;
    const over = roundResult([...solves, mk(need + 1)], c).official as number;
    expect(at).toBeLessThanOrEqual(10_000);
    expect(over).toBeGreaterThan(10_000);
  });

  it('needMs is per remaining attempt when several remain', () => {
    const solves = [10_000, 10_000, 10_000].map(t => mk(t));
    const p = roundProjection(solves, c, 10_000);
    expect(p.remaining).toBe(2);
    const need = p.target?.needMs as number;
    const at = roundResult([...solves, mk(need), mk(need)], c).official as number;
    const over = roundResult([...solves, mk(need + 1), mk(need + 1)], c).official as number;
    expect(at).toBeLessThanOrEqual(10_000);
    expect(over).toBeGreaterThan(10_000);
  });

  it('for a Best of X the target is simply the time to beat', () => {
    const p = roundProjection([mk(30_000)], cfg({ format: 'bo3' }), 10_000);
    expect(p.target?.needMs).toBe(10_000);
  });

  it('judges a finished round against the target directly', () => {
    const solves = [8000, 9000, 10_000, 11_000, 12_000].map(t => mk(t)); // 10.00
    expect(roundProjection(solves, c, 10_000).target?.achieved).toBe(true);
    expect(roundProjection(solves, c, 9990).target?.achieved).toBe(false);
    expect(roundProjection(solves, c, 9990).target?.impossible).toBe(true);
  });

  it('ignores a non-positive or absent target', () => {
    expect(roundProjection([mk(9000)], c, null).target).toBeNull();
    expect(roundProjection([mk(9000)], c, 0).target).toBeNull();
    expect(roundProjection([mk(9000)], c, -1).target).toBeNull();
  });

  it('does not project a target past a cut round', () => {
    const cut = cfg({ format: 'ao5', cutoffMs: 10_000, cutoffAttempts: 2 });
    const p = roundProjection([mk(11_000), mk(12_000)], cut, 10_000);
    expect(p.remaining).toBe(0);
    expect(p.target?.achieved).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Config defaults                                                     */
/* ------------------------------------------------------------------ */

describe('DEFAULT_ROUND_CONFIG', () => {
  it('is off, ao5, no cutoff and no limit', () => {
    expect(DEFAULT_ROUND_CONFIG).toEqual({
      on: false,
      format: 'ao5',
      cutoffMs: null,
      cutoffAttempts: 2,
      limitMs: null,
      cumulative: false,
    });
  });

  it('behaves as a plain ao5 when nothing else is configured', () => {
    const r = roundResult([8000, 9000, 10_000, 11_000, 12_000].map(t => mk(t)), DEFAULT_ROUND_CONFIG);
    expect(r.official).toBe(10_000);
    expect(r.cutoffActive).toBe(false);
    expect(r.budgetMs).toBeNull();
    expect(r.nextLimitMs).toBeNull();
  });
});
