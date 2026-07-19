import { describe, it, expect, beforeAll } from 'vitest';
import type { PyraMove } from '@/app/[lang]/sim/engine/pyra/pyraState';

// GOLD validation of the whole binding: tie the abstract group theory to the *actual
// rendered engine*. We scramble the real PyraCube, mirror its moves into PG, ask PG
// (BSGS) for a solution, replay that solution on the engine, and require the engine to
// be geometrically solved (`complete`). If the bridge were a wrong map, the PG-computed
// solution would not solve the engine and this would fail — so it certifies the bridge
// + factorizer end-to-end, against geometry rather than against more group theory.
describe('pyraminx PG binding — closed loop vs the rendered engine', () => {
  beforeAll(() => {
    // The engine's tweener schedules a rAF at import; applyMoveInstant bakes
    // synchronously, so a no-op shim is enough to run it headless.
    (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = () => 0;
    (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = () => {};
  });

  // Corner turns + FACE turns (Dw/Lw/Rw/Fw — they permute corners/tips between
  // vertices and reach the reorientation coset) + whole-puzzle ROTATIONS sprinkled in
  // (letters after a rotation are world-fixed, so this certifies the engine's
  // letter→physical remap ≡ the bridge's φ-fold — a mismatch desyncs the mirror and
  // the PG solution fails to solve). Rotations are neutralized (exact inverses, LIFO)
  // before the tips so the PG solution replays at the home orientation.
  const randScramble = (n: number): PyraMove[] => {
    const out: PyraMove[] = [];
    const rots: PyraMove[] = [];
    let last = -1;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.3) {
        const r: PyraMove = { vertex: Math.floor(Math.random() * 4), part: 'rot', dir: Math.random() < 0.5 ? 1 : -1 };
        out.push(r); rots.push(r);
        continue;
      }
      let v: number;
      do { v = Math.floor(Math.random() * 4); } while (v === last);
      last = v;
      const part = Math.random() < 0.4 ? 'face' : 'corner';
      out.push({ vertex: v, part, dir: Math.random() < 0.5 ? 1 : -1 });
    }
    for (const r of rots.reverse()) out.push({ ...r, dir: r.dir === 1 ? -1 : 1 });
    for (let v = 0; v < 4; v++) {
      const t = Math.floor(Math.random() * 3);
      for (let i = 0; i < t; i++) out.push({ vertex: v, part: 'tip', dir: 1 });
    }
    return out;
  };

  it('PG-computed solve actually solves the engine; group-solved ⇔ geometry-solved', async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { pyraPgBridge } = await import('@/app/[lang]/sim/engine/pyra/pyraPgBridge');

    const binding = new PgEngineBinding(pyraPgBridge);
    // Full pyraminx group: the face-turn generators (Dw/Lw/Rw/Fw) reach the 12 whole-
    // puzzle reorientations, so |G| = 12 × the pure turning group (75,582,720) —
    // exactly PG's precomputed facts order (index 192 was already computed over this).
    expect(binding.order).toBe(906992640n);

    for (let t = 0; t < 20; t++) {
      const cube = new PyraCube();
      for (const m of randScramble(14)) cube.applyMoveInstant(m);

      // mirror from the engine's own move record via the bridge's φ-parse (the
      // production path — rotations fold into the letter remap), assert faithfulness:
      // group identity ⇔ every pivot at home. (`complete` is deliberately looser — it
      // also accepts the 11 non-identity reorientations, e.g. U Dw'; solved ⇒ complete.)
      binding.rebuildFromString(cube.history.moves.join(' '));
      const IDENT = cube.quaternion.clone().identity();
      const atHome = [...cube.tips, ...cube.corners, ...cube.edges]
        .every((p) => p.pivot.quaternion.angleTo(IDENT) < 0.05);
      expect(binding.solved).toBe(atHome);
      if (binding.solved) expect(cube.complete).toBe(true);

      const solution = binding.solveMoves();
      for (const m of solution) cube.applyMoveInstant(m);
      expect(cube.complete).toBe(true);

      binding.rebuildFromString(cube.history.moves.join(' '));
      expect(binding.solved).toBe(true);
    }
  }, 60000);

  it('rotations: re-holds are complete-immune and the bridge mirrors letters faithfully', async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { pyraPgBridge } = await import('@/app/[lang]/sim/engine/pyra/pyraPgBridge');
    const binding = new PgEngineBinding(pyraPgBridge);

    // A pure re-hold sequence: solved geometrically (pieces untouched) AND in the group.
    const c1 = new PyraCube();
    c1.twister.setup("y Lv Rv' Bv y'");
    expect(c1.complete).toBe(true);
    binding.rebuild(pyraPgBridge.parse("y Lv Rv' Bv y'"));
    expect(binding.solved).toBe(true);

    // y L y' L': the two L letters hit DIFFERENT physical vertices, so this is NOT the
    // identity. Engine and group mirror must agree — a naive "drop the rotations"
    // bridge (the skewb shortcut) would wrongly cancel it to solved.
    const c2 = new PyraCube();
    c2.twister.setup("y L y' L'");
    expect(c2.complete).toBe(false);
    binding.rebuild(pyraPgBridge.parse("y L y' L'"));
    expect(binding.solved).toBe(false);

    // z is the Bv' alias end-to-end: z Bv = Bv' Bv = identity re-hold on both sides.
    const c3 = new PyraCube();
    c3.twister.setup('z Bv');
    expect(c3.complete).toBe(true);
    binding.rebuild(pyraPgBridge.parse('z Bv'));
    expect(binding.solved).toBe(true);
    // z alone is a re-hold: like y/Bv' it folds out of the group mirror (empty word),
    // and the engine stays complete (pieces untouched).
    const c4 = new PyraCube();
    c4.twister.setup('z');
    expect(c4.complete).toBe(true);
    binding.rebuild(pyraPgBridge.parse('z'));
    expect(binding.solved).toBe(true);
    // its two-layer expansion Fw B' (= Bv') IS the order-3 reorientation element
    binding.rebuild(pyraPgBridge.parse("Fw B'"));
    expect(binding.solved).toBe(false);
    expect(binding.currentOrder()).toBe(3);
  });

  it("user spec: a rotation IS its two-layer expansion — y ≡ U Dw', Lv ≡ L Rw', Rv ≡ R Lw', Bv ≡ B Fw'", async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { pyraPgBridge } = await import('@/app/[lang]/sim/engine/pyra/pyraPgBridge');
    type Cube = InstanceType<typeof PyraCube>;
    // World-space rotation of every piece (group ∘ pivot) — equal per index ⇔ the two
    // cubes render pixel-identically (geometry is baked per index in home coords).
    const worldQuats = (c: Cube) =>
      [...c.tips, ...c.corners, ...c.edges].map((p) => c.quaternion.clone().multiply(p.pivot.quaternion));
    const pairs: Array<[rot: string, layers: string, stillSolved: boolean]> = [
      ['y', "U Dw'", true],
      ['Lv', "L Rw'", true],
      ['Rv', "R Lw'", true],
      ['Bv', "B Fw'", true],
      // and letters stay world-fixed across BOTH forms: the trailing L hits the same layer
      ['y L', "U Dw' L", false],
    ];
    for (const [rot, layers, stillSolved] of pairs) {
      const a = new PyraCube(); a.twister.setup(rot);
      const b = new PyraCube(); b.twister.setup(layers);
      const wa = worldQuats(a), wb = worldQuats(b);
      wa.forEach((q, i) => expect(q.angleTo(wb[i])).toBeLessThan(1e-6));
      // a bare reorientation is NOT a scramble — both forms agree on solved
      expect(a.complete).toBe(stillSolved);
      expect(b.complete).toBe(stillSolved);
    }
    // Group side: the two forms differ only in bookkeeping — "y" φ-folds to the
    // identity, "U Dw'" IS the reorientation element: non-identity, order 3.
    const binding = new PgEngineBinding(pyraPgBridge);
    binding.rebuild(pyraPgBridge.parse('y'));
    expect(binding.solved).toBe(true);
    binding.rebuild(pyraPgBridge.parse("U Dw'"));
    expect(binding.solved).toBe(false);
    expect(binding.currentOrder()).toBe(3);
  });

  it('face turns on the engine: order 3, and Dw really leaves solved', async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { parsePyraMoves } = await import('@/app/[lang]/sim/engine/pyra/pyraState');
    const cube = new PyraCube();
    for (const m of parsePyraMoves('Dw')) cube.applyMoveInstant(m);
    expect(cube.complete).toBe(false); // permutes the 3 base corners/tips + 3 edges
    for (const m of parsePyraMoves('Dw Dw')) cube.applyMoveInstant(m);
    expect(cube.complete).toBe(true); // Dw³ = identity
    for (const m of parsePyraMoves("Lw Rw Fw Fw' Rw' Lw'")) cube.applyMoveInstant(m);
    expect(cube.complete).toBe(true);
  });

  it('PG random-STATE scramble reaches non-trivial states the solver then undoes', async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { pyraPgBridge } = await import('@/app/[lang]/sim/engine/pyra/pyraPgBridge');

    const binding = new PgEngineBinding(pyraPgBridge);
    let scrambledCount = 0;
    for (let t = 0; t < 15; t++) {
      const cube = new PyraCube();
      const scramble = binding.scrambleMoves(); // uniform random STATE
      for (const m of scramble) cube.applyMoveInstant(m);
      if (!cube.complete) scrambledCount++;
      // solve it back
      binding.rebuildFromString(cube.history.moves.join(' '));
      for (const m of binding.solveMoves()) cube.applyMoveInstant(m);
      expect(cube.complete).toBe(true);
    }
    expect(scrambledCount).toBeGreaterThan(13); // essentially always non-trivial
  }, 60000);
});
