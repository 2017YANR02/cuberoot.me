import { describe, it, expect } from 'vitest';
import { PgEngineBinding } from '@/app/[lang]/sim/engine/pgBinding';
import { dinoPgBridge } from '@/app/[lang]/sim/engine/dino/dinoPgBridge';
import { skewbPgBridge } from '@/app/[lang]/sim/engine/skewb/skewbPgBridge';
import { heliPgBridge } from '@/app/[lang]/sim/engine/heli/heliPgBridge';
import * as dino from '@/app/[lang]/sim/engine/dino/dinoState';
import * as skewb from '@/app/[lang]/sim/engine/skewb/skewbState';
import * as heli from '@/app/[lang]/sim/engine/heli/heliState';

// Closed loop against the engines' own STATE models: scramble the state, mirror the
// same moves into PG via the bridge, ask the BSGS for a solution, replay it on the
// state, and require the state to be solved. This certifies the bridge (letter-set
// match + chirality) AND the factorizer end-to-end — a wrong map would not solve.

describe('Dino PG bridge — group + closed loop', () => {
  const binding = new PgEngineBinding(dinoPgBridge);
  it('|G| (fixed-in-space) + solvable', () => {
    expect(binding.order).toBe(239500800n); // 12!/2 — includes whole-cube reorientations
    expect(binding.solvable).toBe(true);
  });
  it('PG solve solves the engine state (20 random scrambles)', () => {
    for (let t = 0; t < 20; t++) {
      const moves = dino.randomDinoScramble(15);
      let st = dino.applyDinoScramble(moves);
      binding.rebuild(moves);
      for (const m of binding.solveMoves()) st = dino.applyDinoMove(st, m);
      expect(dino.isSolved(st)).toBe(true);
    }
  });
  it('random-STATE scramble is reached then undone', () => {
    let nonTrivial = 0;
    for (let t = 0; t < 15; t++) {
      const scr = binding.scrambleMoves();
      let st = dino.solvedDino();
      for (const m of scr) st = dino.applyDinoMove(st, m);
      if (!dino.isSolved(st)) nonTrivial++;
      binding.rebuild(scr);
      for (const m of binding.solveMoves()) st = dino.applyDinoMove(st, m);
      expect(dino.isSolved(st)).toBe(true);
    }
    expect(nonTrivial).toBeGreaterThan(13);
  });
});

describe('Skewb PG bridge — group + closed loop', () => {
  const binding = new PgEngineBinding(skewbPgBridge);
  it('|G| (fixed-in-space) + solvable', () => {
    expect(binding.order).toBe(37791360n); // 12× the speedcuber 3,149,280
    expect(binding.solvable).toBe(true);
  });
  it('PG solve solves the engine state (20 random scrambles)', () => {
    for (let t = 0; t < 20; t++) {
      const moves = skewb.randomSkewbScramble(12);
      let st = skewb.applySkewbScramble(moves);
      binding.rebuild(moves);
      for (const m of binding.solveMoves()) st = skewb.applySkewbMove(st, m);
      expect(skewb.isSolved(st)).toBe(true);
    }
  });
});

describe('Helicopter PG bridge — facts + faithful live mirror (no BSGS)', () => {
  const binding = new PgEngineBinding(heliPgBridge);
  it('serves Schreier-Sims facts but opts out of the constructive BSGS', () => {
    expect(binding.solvable).toBe(false);
    expect(binding.order).toBe(284367878671564800000n); // |G| via Schreier-Sims
    expect(binding.solveMoves()).toEqual([]);
    expect(binding.scrambleMoves()).toEqual([]);
  });
  it('live mirror is faithful: moves then their reverse return to group-identity', () => {
    for (let t = 0; t < 20; t++) {
      const moves = heli.randomHeliScrambleMoves(16);
      const round = [...moves, ...moves.slice().reverse()]; // 180° involutions → identity
      let st = heli.solvedHeli();
      for (const m of round) st = heli.applyHeliMove(st, m);
      expect(heli.isSolvedHeli(st)).toBe(true);
      binding.rebuild(round);
      expect(binding.solved).toBe(true);
      // a single twist is non-trivial in both the engine and the group
      binding.rebuild([moves[0]]);
      expect(binding.solved).toBe(false);
    }
  });
});
