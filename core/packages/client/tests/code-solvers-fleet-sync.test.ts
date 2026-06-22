// /code/solvers fleet guard. The dashboard's NONWCA_TS array (app/[lang]/code/
// solvers/_fleet.ts) is a hand-maintained mirror of the pure-TS non-WCA solver
// fleet. The single source of truth for "which non-WCA puzzles have an in-site
// solver" is CSTIMER_SOLVABLE_IDS (lib/cstimer-scramble.ts, derived from the
// `solvable:true` flags). This test keeps the dashboard honest:
//   1. the set of NONWCA_TS event ids EXACTLY equals CSTIMER_SOLVABLE_IDS
//      — a solvable puzzle with no row (missing), or a row for a non-solvable
//      id (extra), is CI red;
//   2. NONWCA_TS_PLANNED ("not built yet") ids are disjoint from the solvable
//      set — a built/solvable puzzle must not still be listed "planned".
//
// Fix when red: wiring a non-WCA solver INCLUDES adding its row to NONWCA_TS in
// app/[lang]/code/solvers/_fleet.ts (data from the solver's file header +
// solver/NONWCA_PUZZLE_LOOP.md §1/§2); and drop it from NONWCA_TS_PLANNED.
import { describe, it, expect } from 'vitest';
import { NONWCA_TS, NONWCA_TS_PLANNED } from '@/app/[lang]/code/solvers/_fleet';
import { CSTIMER_SOLVABLE_IDS } from '@/lib/cstimer-scramble';

describe('/code/solvers fleet stays in sync with the pure-TS non-WCA solvers', () => {
  it('found a meaningful number of solvable non-WCA puzzles', () => {
    expect(CSTIMER_SOLVABLE_IDS.size).toBeGreaterThanOrEqual(18);
  });

  it('no duplicate event ids in NONWCA_TS', () => {
    const ids = NONWCA_TS.map((s) => s.event);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate NONWCA_TS rows: ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });

  it('NONWCA_TS event ids exactly equal CSTIMER_SOLVABLE_IDS', () => {
    const rows = new Set(NONWCA_TS.map((s) => s.event));
    const solvable = CSTIMER_SOLVABLE_IDS;
    // solvable but no dashboard row → add one to _fleet.ts NONWCA_TS
    const missing = [...solvable].filter((id) => !rows.has(id)).sort();
    // dashboard row but not solvable → stale row in _fleet.ts NONWCA_TS
    const extra = [...rows].filter((id) => !solvable.has(id)).sort();
    expect(
      { missing, extra },
      `\nNONWCA_TS (/code/solvers/_fleet.ts) is out of sync with CSTIMER_SOLVABLE_IDS:` +
        `\n  missing (solvable, no row — add to NONWCA_TS): ${missing.join(', ') || '(none)'}` +
        `\n  extra (row, not solvable — remove from NONWCA_TS): ${extra.join(', ') || '(none)'}`,
    ).toEqual({ missing: [], extra: [] });
  });

  it('NONWCA_TS_PLANNED is disjoint from the solvable set (no built puzzle still "planned")', () => {
    const builtButPlanned = NONWCA_TS_PLANNED
      .map((p) => p.event)
      .filter((id) => CSTIMER_SOLVABLE_IDS.has(id))
      .sort();
    expect(
      builtButPlanned,
      `these are solvable but still listed in NONWCA_TS_PLANNED — promote to NONWCA_TS: ${builtButPlanned.join(', ')}`,
    ).toEqual([]);
  });
});
