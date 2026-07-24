import { describe, it, expect } from 'vitest';
import { mirrorTables, layerThickness } from '@/app/[lang]/sim/engine/mirror/mirrorGeometry';
import { SIZE } from '@/app/[lang]/sim/engine/define';

// Mirror Cube (Bump Cube) render tables — order 3 and order 2.
//
// The logical layer is a plain NxN; ALL the mirror-ness lives in these tables, so this
// file is the whole geometric contract. Baselines are `toBe()`-locked: changing a
// thickness is a deliberate look change and must show up as a failing test.

const AXES = [0, 1, 2] as const;
const AXIS_NAME = ['x (L→R)', 'y (D→U)', 'z (B→F)'];

/** Component-wise compare with float tolerance (SIZE=64 scaling leaves ~1e-14 dust). */
function expectVec(got: readonly number[], want: readonly number[], label = ''): void {
  expect(got.length, label).toBe(want.length);
  for (let i = 0; i < want.length; i++) expect(got[i], `${label}[${i}]`).toBeCloseTo(want[i], 9);
}

/** Layer boundaries along one axis, in cubie units, cube centred at 0. */
function boundaries(order: number, axis: number): number[] {
  const t = layerThickness(order, axis);
  const out = [-order / 2];
  let acc = -order / 2;
  for (const x of t) { acc += x; out.push(acc); }
  return out;
}

describe('mirror layer thickness', () => {
  it('order 3 matches the classic mirror-blocks baseline', () => {
    expect(layerThickness(3, 0)).toEqual([1.15, 1, 0.85]);
    expect(layerThickness(3, 1)).toEqual([1.45, 1, 0.55]);
    expect(layerThickness(3, 2)).toEqual([1.3, 1, 0.7]);
  });

  it('order 2 keeps the 3x3 eccentricity (same core offset as a fraction of the edge)', () => {
    expect(layerThickness(2, 0)).toEqual([1.1, 0.9]);
    expect(layerThickness(2, 1)).toEqual([1.3, 0.7]);
    expect(layerThickness(2, 2)).toEqual([1.2, 0.8]);
  });

  it.each([2, 3])('order %i: every axis sums to the order (pieces pack a perfect cube)', (order) => {
    for (const a of AXES) {
      const sum = layerThickness(order, a).reduce((p, q) => p + q, 0);
      expect(sum).toBeCloseTo(order, 12);
    }
  });

  it.each([2, 3])('order %i: the thick layer is on the L / D / B side', (order) => {
    for (const a of AXES) {
      const t = layerThickness(order, a);
      expect(t[0]).toBeGreaterThan(t[t.length - 1]);
    }
  });
});

describe('mirror core (turn-axis intersection)', () => {
  it('order 3 core sits at the classic offset', () => {
    expectVec(mirrorTables(3).pivot(), [0.15 * SIZE, 0.45 * SIZE, 0.3 * SIZE], 'pivot');
  });

  it('order 2 core sits at the same offset in world units (Cube scales by 3/order)', () => {
    const p3 = mirrorTables(3).pivot();
    const p2 = mirrorTables(2).pivot();
    for (const a of AXES) {
      // world offset = local offset × cube scale (3/order)
      expect(p2[a] * (3 / 2)).toBeCloseTo(p3[a] * (3 / 3), 10);
    }
  });

  // THE mechanical invariant. A mirror cube is a stock mechanism inside an offset shell:
  // relative to the core, the cut planes sit exactly where a uniform cube's cut planes sit
  // relative to its centre. That is what lets a layer turn about the core carry foreign-
  // shaped pieces into a slot — and why the pivot may not be the bounding-box centre.
  it.each([2, 3])('order %i: cut planes sit on the stock lattice around the core', (order) => {
    const p = mirrorTables(order).pivot();
    for (const a of AXES) {
      const cuts = boundaries(order, a).slice(1, -1); // interior boundaries only
      const rel = cuts.map((c) => c - p[a] / SIZE);
      const want = cuts.map((_, i) => i + 1 - order / 2);
      expectVec(rel, want, AXIS_NAME[a]);
    }
  });

  it('order 3 core is the dead-centre cubie’s centre (what enableMirror used to assume)', () => {
    const t = mirrorTables(3);
    const centreIdx = 1 + 1 * 3 + 1 * 9;
    expectVec(t.center(centreIdx), t.pivot(), 'centre cubie');
  });

  it('order 2 core is the single triple cut-plane intersection, shared by all 8 cubies', () => {
    const t = mirrorTables(2);
    const p = t.pivot();
    for (let i = 0; i < 8; i++) {
      const c = t.center(i);
      const s = t.scale(i);
      for (const a of AXES) {
        // the core is a corner of every cubie's box: |centre − core| = half its extent
        expect(Math.abs(c[a] - p[a])).toBeCloseTo((s[a] / 2) * SIZE, 10);
      }
    }
  });
});

describe('mirror slot tables', () => {
  it.each([2, 3])('order %i: slots tile the cube with no gap or overlap', (order) => {
    const t = mirrorTables(order);
    const n = order ** 3;
    for (const a of AXES) {
      const want = boundaries(order, a);
      // collect each layer's [lo, hi] from centre ± scale/2 and compare to the boundaries
      const seen = new Map<number, [number, number]>();
      for (let i = 0; i < n; i++) {
        const layer = a === 0 ? i % order : a === 1 ? Math.floor((i % (order * order)) / order) : Math.floor(i / (order * order));
        const c = t.center(i)[a] / SIZE;
        const s = t.scale(i)[a];
        seen.set(layer, [+(c - s / 2).toFixed(10), +(c + s / 2).toFixed(10)]);
      }
      for (let l = 0; l < order; l++) {
        expect(seen.get(l), `${AXIS_NAME[a]} layer ${l}`).toEqual([+want[l].toFixed(10), +want[l + 1].toFixed(10)]);
      }
    }
  });

  it.each([2, 3])('order %i: every cubie has a distinct shape (that is the puzzle)', (order) => {
    const t = mirrorTables(order);
    const shapes = new Set<string>();
    for (let i = 0; i < order ** 3; i++) shapes.add(t.scale(i).join(','));
    expect(shapes.size).toBe(order ** 3);
  });
});
