import { describe, it, expect } from 'vitest';
import { FtoModel, enumerateCells } from './_fto_model';
import { randomFtoScramble, invertFtoMoves } from '@/app/[lang]/sim/engine/fto/ftoState';

describe('FTO geometry (octahedron deep cut at R_IN/3)', () => {
  const cells = enumerateCells();
  const visible = cells.filter((c) => c.stickerFaces.length > 0);

  it('enumerates 42 visible pieces + 9 internal/core cells', () => {
    expect(cells).toHaveLength(51);
    expect(visible).toHaveLength(42);
    expect(cells.length - visible.length).toBe(9);
  });

  it('piece inventory: 6 corners (4 stickers), 12 edges (2), 24 centres (1)', () => {
    const byStk = (k: number): number => visible.filter((c) => c.stickerFaces.length === k).length;
    expect(byStk(4)).toBe(6);   // corners (octahedron vertices, ℤ₄)
    expect(byStk(2)).toBe(12);  // edges
    expect(byStk(1)).toBe(24);  // centres (CENTERS + CENTERS2)
    expect(byStk(3)).toBe(0);   // no 3-sticker pieces on an octahedron
    // 72 stickers total = 8 faces × 9 facelets.
    expect(visible.reduce((a, c) => a + c.stickerFaces.length, 0)).toBe(72);
    // corners are cap of 4, edges cap of 2, centres cap of 3.
    for (const c of visible) {
      if (c.stickerFaces.length === 4) expect(c.cap).toHaveLength(4);
      if (c.stickerFaces.length === 2) expect(c.cap).toHaveLength(2);
      if (c.stickerFaces.length === 1) expect(c.cap).toHaveLength(3);
    }
  });

  it('cap-membership margin is unambiguous (no piece centre near a cut plane)', () => {
    expect(new FtoModel().minCutMargin()).toBeGreaterThan(0.05);
  });

  it('every face turn has order 3 (turn³ = solved, not before)', () => {
    for (let f = 0; f < 8; f++) {
      const m = new FtoModel();
      m.apply({ face: f, dir: 1 }); expect(m.solved).toBe(false);
      m.apply({ face: f, dir: 1 }); expect(m.solved).toBe(false);
      m.apply({ face: f, dir: 1 }); expect(m.solved).toBe(true);
    }
  });

  it('a face turn keeps its cap invariant (cap pieces map among themselves → zero穿模)', () => {
    for (let f = 0; f < 8; f++) {
      const m = new FtoModel();
      const before = new Set(m.capPieces(f));
      m.apply({ face: f, dir: 1 });
      const after = new Set(m.capPieces(f));
      expect(after.size).toBe(before.size);
      for (const p of after) expect(before.has(p)).toBe(true);
    }
  });

  it('random scramble + exact inverse returns to solved; a single turn does not', () => {
    for (let t = 0; t < 25; t++) {
      const scr = randomFtoScramble(30);
      const m = new FtoModel();
      m.applyAll([...scr, ...invertFtoMoves(scr)]);
      expect(m.solved).toBe(true);
      const m2 = new FtoModel();
      m2.apply(scr[0]);
      expect(m2.solved).toBe(false);
    }
  });
});
