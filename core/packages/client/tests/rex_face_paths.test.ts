import { describe, it, expect } from 'vitest';
import { rexFaceRegions } from '@/app/[lang]/sim/engine/rex/rexFacePaths';

// The analytic Rex face tiling backs the smooth, extruded stickers (rexGeometry maps
// each region onto a face + to its piece). Lock its structure so a regression that
// drops/duplicates a region — which would mis-map a sticker or crash the build — fails
// here instead of silently in the browser.

const S = 1.3;
const GROOVE = 0.032;

describe('rexFaceRegions — structure', () => {
  const regions = rexFaceRegions(S, GROOVE);

  it('produces exactly 1 centre + 4 petals + 4 edges', () => {
    expect(regions.length).toBe(9);
    expect(regions.filter((r) => r.kind === 'center').length).toBe(1);
    expect(regions.filter((r) => r.kind === 'petal').length).toBe(4);
    expect(regions.filter((r) => r.kind === 'edge').length).toBe(4);
  });

  it('petals sit at the 4 corners, edges at the 4 side midpoints, centre at the origin', () => {
    const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
    expect(key(regions.find((r) => r.kind === 'center')!.pos)).toBe('0,0');
    const petals = new Set(regions.filter((r) => r.kind === 'petal').map((r) => key(r.pos)));
    expect(petals).toEqual(new Set(['1,1', '1,-1', '-1,1', '-1,-1']));
    const edges = new Set(regions.filter((r) => r.kind === 'edge').map((r) => key(r.pos)));
    expect(edges).toEqual(new Set(['1,0', '-1,0', '0,1', '0,-1']));
  });

  it('every outline is a closed loop of finite points inside the face square', () => {
    for (const r of regions) {
      expect(r.pts.length).toBeGreaterThanOrEqual(6);
      for (const [x, y] of r.pts) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(1.01);
        expect(Math.abs(y)).toBeLessThanOrEqual(1.01);
      }
    }
  });

  it('has NO spikes: every corner is rounded, so the turn at each vertex is gentle', () => {
    const maxTurnDeg = (pts: [number, number][]): number => {
      const n = pts.length;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
        const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
        const l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        const d = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
        m = Math.max(m, Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI);
      }
      return m;
    };
    // a spike/needle (the miter-offset bug, or an un-rounded acute tip) is a ~120-180°
    // turn at one vertex; rounded concentric arcs keep every turn gentle.
    for (const r of regions) expect(maxTurnDeg(r.pts)).toBeLessThan(50);
  });

  it('the centre is a 4-pointed star: its axis tips reach further than its diagonal dips', () => {
    const c = regions.find((r) => r.kind === 'center')!;
    const axisReach = Math.max(...c.pts.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
    const diagDip = Math.max(...c.pts.map(([x, y]) => Math.min(Math.abs(x), Math.abs(y))));
    expect(axisReach).toBeGreaterThan(diagDip + 0.1); // concave sides ⇒ star, not a convex blob
  });
});
