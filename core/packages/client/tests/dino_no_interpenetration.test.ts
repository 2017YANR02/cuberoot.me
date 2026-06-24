/**
 * Dino Cube zero-interpenetration guard.
 *
 * A twist about corner C rotates the 3 edge wedges adjacent to C about C's body
 * diagonal. Rotation about C keeps every point's C·v invariant, so the moving
 * wedges stay in the half-space C·v ≥ CUT·H for the whole turn. If every STATIONARY
 * wedge stays at C·v ≤ CUT·H, the cut plane C·v = CUT·H separates moving from
 * stationary solids → zero interpenetration (constructive, not "small enough").
 *
 * This holds iff CUT ≥ 1.0: a stationary wedge's peak C·v is (2−CUT)·H and the
 * moving floor is CUT·H, disjoint iff (2−CUT) ≤ CUT. CUT was lowered (1.2 → 1.07)
 * to thin the visible face "X", so lock the invariant here — any future CUT ≤ 1.0
 * (or geometry regression) turns this red.
 */
import { describe, it, expect } from 'vitest';
import { wedgeGeometry, CUT, H } from '@/app/[lang]/sim/engine/dino/dinoGeometry';
import { EDGE_NAMES, CORNER_AXIS, CORNER_CYCLE } from '@/app/[lang]/sim/engine/dino/dinoState';

describe('Dino geometry — zero interpenetration', () => {
  it('CUT keeps a positive gap (must stay > 1.0)', () => {
    expect(CUT).toBeGreaterThan(1.0);
  });

  it('every corner: moving wedges stay above the cut plane, stationary below', () => {
    const thresh = CUT * H;
    for (let c = 0; c < 8; c++) {
      const ax = CORNER_AXIS[c];
      const moving = new Set<number>(CORNER_CYCLE[c]); // the 3 edge slots this corner turns
      let minMoving = Infinity;
      let maxStationary = -Infinity;
      for (let slot = 0; slot < 12; slot++) {
        const { verts } = wedgeGeometry(EDGE_NAMES[slot]);
        for (const v of verts) {
          const cv = ax[0] * v.x + ax[1] * v.y + ax[2] * v.z;
          if (moving.has(slot)) minMoving = Math.min(minMoving, cv);
          else maxStationary = Math.max(maxStationary, cv);
        }
      }
      // Moving pieces never dip below the cut plane the stationary pieces stay under.
      expect(minMoving).toBeGreaterThanOrEqual(thresh - 1e-3);
      expect(maxStationary).toBeLessThan(thresh - 1e-3);
    }
  });
});
