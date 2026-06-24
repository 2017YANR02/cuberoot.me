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

  const randScramble = (n: number): PyraMove[] => {
    const out: PyraMove[] = [];
    let last = -1;
    for (let i = 0; i < n; i++) {
      let v: number;
      do { v = Math.floor(Math.random() * 4); } while (v === last);
      last = v;
      out.push({ vertex: v, tip: false, dir: Math.random() < 0.5 ? 1 : -1 });
    }
    for (let v = 0; v < 4; v++) {
      const t = Math.floor(Math.random() * 3);
      for (let i = 0; i < t; i++) out.push({ vertex: v, tip: true, dir: 1 });
    }
    return out;
  };

  it('PG-computed solve actually solves the engine; group-solved ⇔ geometry-solved', async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { pyraPgBridge } = await import('@/app/[lang]/sim/engine/pyra/pyraPgBridge');
    const { parsePyraMoves } = await import('@/app/[lang]/sim/engine/pyra/pyraState');

    const binding = new PgEngineBinding(pyraPgBridge);
    expect(binding.order).toBe(75582720n);

    for (let t = 0; t < 20; t++) {
      const cube = new PyraCube();
      for (const m of randScramble(14)) cube.applyMoveInstant(m);

      // mirror from the engine's own move record, then assert faithfulness
      binding.rebuild(parsePyraMoves(cube.history.moves.join(' ')));
      expect(binding.solved).toBe(cube.complete);

      const solution = binding.solveMoves();
      for (const m of solution) cube.applyMoveInstant(m);
      expect(cube.complete).toBe(true);

      binding.rebuild(parsePyraMoves(cube.history.moves.join(' ')));
      expect(binding.solved).toBe(true);
    }
  }, 60000);

  it('PG random-STATE scramble reaches non-trivial states the solver then undoes', async () => {
    const { default: PyraCube } = await import('@/app/[lang]/sim/engine/pyra/PyraCube');
    const { PgEngineBinding } = await import('@/app/[lang]/sim/engine/pgBinding');
    const { pyraPgBridge } = await import('@/app/[lang]/sim/engine/pyra/pyraPgBridge');
    const { parsePyraMoves } = await import('@/app/[lang]/sim/engine/pyra/pyraState');

    const binding = new PgEngineBinding(pyraPgBridge);
    let scrambledCount = 0;
    for (let t = 0; t < 15; t++) {
      const cube = new PyraCube();
      const scramble = binding.scrambleMoves(); // uniform random STATE
      for (const m of scramble) cube.applyMoveInstant(m);
      if (!cube.complete) scrambledCount++;
      // solve it back
      binding.rebuild(parsePyraMoves(cube.history.moves.join(' ')));
      for (const m of binding.solveMoves()) cube.applyMoveInstant(m);
      expect(cube.complete).toBe(true);
    }
    expect(scrambledCount).toBeGreaterThan(13); // essentially always non-trivial
  }, 60000);
});
