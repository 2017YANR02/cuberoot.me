import { describe, it, expect, beforeAll } from 'vitest';
import type { SkewbMove } from '@/app/[lang]/sim/engine/skewb/skewbState';

// Closed loop tying the PG group theory to the *actual rendered SkewbCube engine*, whose
// whole-cube rotations use a LIVE geometric grip remap (argmax over the group quaternion).
// We scramble the real cube with x/y/z rotations mixed in, mirror its move history through
// the bridge's φ-fold (a PURE table), ask PG for a solution, replay it, and require the
// engine solved. This certifies the pure ROT_GRIP_TAU table ≡ the engine's geometry: a
// drift would desync the mirror and the BSGS solve would not solve the cube.
describe('Skewb PG bridge — rotation-faithful closed loop vs the rendered engine', () => {
  beforeAll(() => {
    (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = () => 0;
    (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = () => {};
  });

  const invRot = (r: SkewbMove & { rot: 0 | 1 | 2 }): SkewbMove =>
    ({ rot: r.rot, dir: r.dir === 2 ? 2 : r.dir === 1 ? -1 : 1 });

  // Corner grips + whole-cube rotations sprinkled in; rotations are neutralized (exact
  // inverses, LIFO) before the end so the PG solution replays at the home orientation.
  const randScramble = (n: number): SkewbMove[] => {
    const out: SkewbMove[] = [];
    const rots: Array<SkewbMove & { rot: 0 | 1 | 2 }> = [];
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.3) {
        const r = {
          rot: Math.floor(Math.random() * 3) as 0 | 1 | 2,
          dir: ([1, -1, 2] as const)[Math.floor(Math.random() * 3)],
        };
        out.push(r); rots.push(r);
        continue;
      }
      out.push({ corner: Math.floor(Math.random() * 8), dir: Math.random() < 0.5 ? 1 : -1 });
    }
    for (const r of rots.reverse()) out.push(invRot(r));
    return out;
  };

  it('PG-computed solve solves the engine; group-solved ⇔ engine-solved (with rotations)', async () => {
    const { default: SkewbCube } = await import('@/app/[lang]/sim/engine/skewb/SkewbCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { skewbPgBridge } = await import('@/app/[lang]/sim/engine/skewb/skewbPgBridge');

    const binding = new PgEngineBinding(skewbPgBridge);
    for (let t = 0; t < 20; t++) {
      const cube = new SkewbCube();
      for (const m of randScramble(16)) cube.applyMoveInstant(m);

      // mirror from the engine's own recorded history via the bridge φ-fold (production
      // path) — the rotation tokens fold into the grip remap, corner letters world-fixed.
      binding.rebuildFromString(cube.history.moves.join(' '));
      expect(binding.solved).toBe(cube.complete);

      for (const m of binding.solveMoves()) cube.applyMoveInstant(m);
      expect(cube.complete).toBe(true);
    }
  }, 60000);

  it("adversarial: y R y' R' stays scrambled on BOTH engine and mirror (drop-bridge lied)", async () => {
    const { default: SkewbCube } = await import('@/app/[lang]/sim/engine/skewb/SkewbCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { skewbPgBridge } = await import('@/app/[lang]/sim/engine/skewb/skewbPgBridge');
    const { parseSkewbMoves } = await import('@/app/[lang]/sim/engine/skewb/skewbState');
    const binding = new PgEngineBinding(skewbPgBridge);

    // y sends world-R to a different physical grip, so the two R's don't cancel: the net
    // is two distinct grip twists. A bridge that dropped rotations would see "R R'" and
    // wrongly report solved.
    const cube = new SkewbCube();
    for (const m of parseSkewbMoves("y R y' R'")) cube.applyMoveInstant(m);
    expect(cube.complete).toBe(false);
    binding.rebuild(skewbPgBridge.parse("y R y' R'"));
    expect(binding.solved).toBe(false);

    // control: a pure rotation round-trip is a re-hold — solved on both sides.
    const c2 = new SkewbCube();
    for (const m of parseSkewbMoves("x y z z' y' x'")) c2.applyMoveInstant(m);
    expect(c2.complete).toBe(true);
    binding.rebuild(skewbPgBridge.parse("x y z z' y' x'"));
    expect(binding.solved).toBe(true);

    // and R alone is non-trivial in both (guards against a mirror that folds too much).
    const c3 = new SkewbCube();
    for (const m of parseSkewbMoves('R')) c3.applyMoveInstant(m);
    expect(c3.complete).toBe(false);
    binding.rebuild(skewbPgBridge.parse('R'));
    expect(binding.solved).toBe(false);
  });

  it('rotation grip remap ≡ the engine: after x, typed U/R/F… drive the geometrically remapped grip', async () => {
    const { default: SkewbCube } = await import('@/app/[lang]/sim/engine/skewb/SkewbCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { skewbPgBridge } = await import('@/app/[lang]/sim/engine/skewb/skewbPgBridge');
    const { parseSkewbMoves } = await import('@/app/[lang]/sim/engine/skewb/skewbState');
    const binding = new PgEngineBinding(skewbPgBridge);

    // For every rotation and every grip letter, "<rot> <letter> <rot⁻¹>" turns exactly one
    // grip (the one the engine geometrically remapped to) and re-holds home. The mirror
    // agrees with the engine (both non-solved) iff the pure table matches the live remap.
    const invOf = (rot: string): string =>
      rot.includes('2') ? rot : rot.endsWith("'") ? rot[0] : `${rot}'`;
    for (const rot of ['x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2']) {
      for (const letter of ['U', 'R', 'F', 'B', 'L', 'D', 'UL', 'UR']) {
        const cube = new SkewbCube();
        for (const m of parseSkewbMoves(`${rot} ${letter} ${invOf(rot)}`)) cube.applyMoveInstant(m);
        binding.rebuildFromString(cube.history.moves.join(' '));
        expect(cube.complete).toBe(false);          // a single grip twist scrambles it
        expect(binding.solved).toBe(cube.complete);  // mirror ≡ engine
      }
    }
  });
});
