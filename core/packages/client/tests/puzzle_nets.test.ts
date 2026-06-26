import { describe, it, expect } from 'vitest';
import { applyScramble, solvedState } from '@/lib/puzzle-group';
import { renderNet, type PuzzleNetDef } from '@/app/[lang]/scramble/gen/_svg/_net_render';
import { FTO } from '@/app/[lang]/scramble/gen/_svg/_nets/fto';
import { BABY_FTO } from '@/app/[lang]/scramble/gen/_svg/_nets/baby_fto';
import { MASTER_TETRAMINX } from '@/app/[lang]/scramble/gen/_svg/_nets/master_tetraminx';
import { KILOMINX } from '@/app/[lang]/scramble/gen/_svg/_nets/kilominx';
import { REDI_CUBE } from '@/app/[lang]/scramble/gen/_svg/_nets/redi_cube';

/**
 * Group-theoretic net regression for the 5 non-WCA puzzles whose scramble preview
 * is rendered from a permutation group (lib/puzzle-group) + net geometry. The group
 * source is derived from cubing.js by scripts/gen-net.mts and verified equal to
 * cubing.js's KPuzzle at gen time; this committed test re-locks it with cubing-free
 * algebraic invariants plus a golden fill sequence per puzzle.
 */

/** Fills in net order, as emitted by the renderer. */
function fills(def: PuzzleNetDef, scramble: string): string[] {
  const svg = renderNet(def, scramble);
  return [...svg.matchAll(/<polygon points="[^"]*" fill="([^"]+)"\/>/g)].map((m) => m[1]);
}
const tally = (a: string[]): Map<string, number> =>
  a.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());

/** Inverse of a single scramble token, matching the engine's resolveToken rules. */
function invertToken(t: string): string {
  if (t.endsWith("'")) return t.slice(0, -1);
  if (t.endsWith('++')) return t.slice(0, -2) + '--';
  if (t.endsWith('--')) return t.slice(0, -2) + '++';
  if (t.endsWith('2')) return t;
  return t + "'";
}
const invert = (scr: string): string =>
  scr.trim().split(/\s+/).filter(Boolean).reverse().map(invertToken).join(' ');

interface Case { name: string; def: PuzzleNetDef; facelets: number; scramble: string; golden: string; }

const CASES: Case[] = [
  {
    name: 'fto', def: FTO, facelets: 72,
    scramble: 'R BL F U B L R BR D F BL U R B L F D BR U R F BL',
    golden: '#aaaaaa|#aaaaaa|#ff8000|#ff8000|#ffffff|#ff8000|#ff8000|#44ee00|#44ee00|#ee0000|#8800dd|#f4f400|#f4f400|#f4f400|#ee0000|#f4f400|#2266ff|#f4f400|#ffffff|#aaaaaa|#ffffff|#ff8000|#ff8000|#ff8000|#ffffff|#aaaaaa|#44ee00|#2266ff|#ee0000|#2266ff|#2266ff|#ee0000|#8800dd|#8800dd|#2266ff|#8800dd|#f4f400|#8800dd|#8800dd|#ee0000|#2266ff|#ee0000|#2266ff|#8800dd|#8800dd|#aaaaaa|#ffffff|#aaaaaa|#44ee00|#ff8000|#ffffff|#aaaaaa|#aaaaaa|#aaaaaa|#2266ff|#ee0000|#ee0000|#f4f400|#8800dd|#f4f400|#2266ff|#f4f400|#ee0000|#ff8000|#44ee00|#44ee00|#44ee00|#ffffff|#ffffff|#ffffff|#44ee00|#44ee00',
  },
  {
    name: 'baby_fto', def: BABY_FTO, facelets: 32,
    scramble: "U L F R U' L' F R BR U F R'",
    golden: '#aaaaaa|#44ee00|#ffffff|#aaaaaa|#ee0000|#f4f400|#8800dd|#2266ff|#ffffff|#ffffff|#ff8000|#ff8000|#2266ff|#ee0000|#2266ff|#8800dd|#8800dd|#ee0000|#f4f400|#8800dd|#44ee00|#ffffff|#44ee00|#ff8000|#f4f400|#f4f400|#ee0000|#2266ff|#ff8000|#44ee00|#aaaaaa|#aaaaaa',
  },
  {
    name: 'master_tetraminx', def: MASTER_TETRAMINX, facelets: 60,
    scramble: "U L R B u l r b U' L' R' B' u' l' r' b'",
    golden: '#ff0000|#2266ff|#44ee00|#44ee00|#44ee00|#f4f400|#ff0000|#f4f400|#44ee00|#ff0000|#44ee00|#44ee00|#2266ff|#2266ff|#2266ff|#ff0000|#f4f400|#2266ff|#f4f400|#f4f400|#f4f400|#ff0000|#2266ff|#f4f400|#ff0000|#2266ff|#ff0000|#ff0000|#ff0000|#ff0000|#2266ff|#f4f400|#2266ff|#ff0000|#ff0000|#44ee00|#ff0000|#f4f400|#ff0000|#f4f400|#44ee00|#44ee00|#f4f400|#f4f400|#f4f400|#44ee00|#f4f400|#2266ff|#2266ff|#2266ff|#44ee00|#44ee00|#2266ff|#2266ff|#ff0000|#2266ff|#f4f400|#44ee00|#44ee00|#44ee00',
  },
  {
    name: 'kilominx', def: KILOMINX, facelets: 60,
    scramble: "R++ D-- R++ D-- R++ D-- R++ D-- R++ D-- U R-- D++ R-- D++ R-- D++ R-- D++ R-- D++ U'",
    golden: '#99ff00|#0000ff|#ff0000|#ffffff|#ffff00|#3399ff|#ffffff|#ff66cc|#008800|#ff66cc|#8800dd|#8800dd|#99ff00|#ffff00|#8800dd|#008800|#99ff00|#ffff00|#ffffd0|#ff0000|#99ff00|#008800|#ff66cc|#999999|#3399ff|#ff6633|#0000ff|#ff66cc|#999999|#ff0000|#ffffd0|#ffffd0|#ffffd0|#ff6633|#ffffd0|#3399ff|#0000ff|#8800dd|#ffff00|#ffff00|#ffffff|#ffffff|#99ff00|#ff6633|#ffffff|#8800dd|#ff0000|#ff0000|#0000ff|#ff6633|#3399ff|#999999|#3399ff|#999999|#ff66cc|#0000ff|#008800|#008800|#999999|#ff6633',
  },
  {
    name: 'redi_cube', def: REDI_CUBE, facelets: 48,
    scramble: "UR B U D F L UR' UL F' U' D' B'",
    golden: '#ffffff|#ff0000|#32cd32|#ffffff|#2266ff|#ff0000|#ffffff|#ffa500|#2266ff|#ffa500|#ffffff|#32cd32|#ffff00|#32cd32|#ff0000|#32cd32|#ffff00|#ffa500|#ffff00|#2266ff|#ffa500|#ffff00|#ff0000|#2266ff|#ffff00|#2266ff|#ff0000|#2266ff|#2266ff|#ffa500|#ffffff|#ffa500|#ff0000|#ffffff|#ffa500|#32cd32|#ffffff|#2266ff|#ffff00|#ffa500|#32cd32|#ff0000|#ffff00|#32cd32|#ffffff|#32cd32|#ff0000|#ffff00',
  },
];

describe.each(CASES)('puzzle net: $name', ({ def, facelets, scramble, golden }) => {
  const palette = new Set(Object.values(def.net.solvedColor).flat(2));

  it('group source is structurally valid (orbits, cycles, twist)', () => {
    for (const [token, gen] of Object.entries(def.group.gens)) {
      for (const [orbit, action] of Object.entries(gen)) {
        const spec = def.group.orbits[orbit];
        expect(spec, `${token}/${orbit}`).toBeTruthy();
        const seen = new Set<number>();
        for (const cyc of action.cycles) {
          expect(cyc.length).toBeGreaterThan(1);
          for (const i of cyc) {
            expect(i, `${token}/${orbit} idx`).toBeLessThan(spec.size);
            expect(seen.has(i), `${token}/${orbit} disjoint`).toBe(false);
            seen.add(i);
          }
        }
        for (const k of Object.keys(action.twist ?? {})) expect(+k).toBeLessThan(spec.size);
      }
    }
  });

  it(`renders ${facelets} polygons, every fill in palette`, () => {
    const f = fills(def, '');
    expect(f).toHaveLength(facelets);
    for (const c of f) expect(palette.has(c)).toBe(true);
  });

  it('conserves stickers: any scramble keeps the solved color multiset', () => {
    const solved = tally(fills(def, ''));
    const scrambled = tally(fills(def, scramble));
    expect(scrambled).toEqual(solved);
  });

  it('scramble followed by its inverse returns to solved', () => {
    expect(fills(def, `${scramble} ${invert(scramble)}`)).toEqual(fills(def, ''));
  });

  it('every base generator has finite order 2..6', () => {
    const solvedKey = JSON.stringify(solvedState(def.group));
    for (const token of Object.keys(def.group.gens)) {
      let order = 0;
      for (let k = 1; k <= 8; k++) {
        if (JSON.stringify(applyScramble(def.group, Array(k).fill(token).join(' '))) === solvedKey) { order = k; break; }
      }
      expect(order, `${token} order`).toBeGreaterThanOrEqual(2);
      expect(order, `${token} order`).toBeLessThanOrEqual(6);
    }
  });

  it('golden: matches the gen-time fill sequence', () => {
    expect(fills(def, scramble).join('|')).toBe(golden);
  });
});
