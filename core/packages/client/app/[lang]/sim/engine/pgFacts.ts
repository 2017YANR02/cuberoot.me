/**
 * Precomputed group-theory facts for every PG-bound /sim puzzle.
 *
 * WHY PRECOMPUTE (read before adding a puzzle): the STATIC facts — |G| (Schreier-Sims),
 * the orbit / wreath structure, the unconstrained reassembly count and the constraint
 * index — depend ONLY on the puzzle, never on the live cube state. Computing them at
 * runtime runs Schreier-Sims in the browser, which freezes the tab (helicopter ≈ 1s,
 * megaminx ≈ seconds, a 7x7 ≈ 8s). They are deterministic constants, so we bake them in.
 * Only the STATE-dependent parts stay live (cheap): the current element's order, the
 * group-solved test, and — for small groups — the BSGS scramble/solve.
 *
 * The table below (`pgFacts.generated.ts`) is produced offline by the exact same
 * `PgEngineBinding.facts()` path, so precomputed == live by construction. Regenerate it
 * whenever a bridge's generators / pgName change:
 *   pnpm --filter @cuberoot/client exec vitest run tests/gen_pg_facts.gen.test.ts
 *
 * ANY new PG-bound puzzle MUST add its facts here (its bridge is picked up automatically
 * by the generator). See skill `sim-add-puzzle`.
 */
import type { PgGroupFacts } from './pgBackbone';
import { PRECOMPUTED_PG_FACTS } from './pgFacts.generated';

/** JSON-safe form (bigints → decimal strings) for the baked table. */
export interface SerializedPgFacts {
  order: string;
  turningOrder: string;
  reorientations: string;
  reassembly: string;
  index: string;
  orbits: { name: string; pieces: number; oriMod: number }[];
  moveNames: string[];
}

export function serializePgFacts(f: PgGroupFacts): SerializedPgFacts {
  return {
    order: f.order.toString(),
    turningOrder: f.turningOrder.toString(),
    reorientations: f.reorientations.toString(),
    reassembly: f.reassembly.toString(),
    index: f.index.toString(),
    orbits: f.orbits.map((o) => ({ name: o.name, pieces: o.pieces, oriMod: o.oriMod })),
    moveNames: f.moveNames.slice(),
  };
}

export function deserializePgFacts(s: SerializedPgFacts): PgGroupFacts {
  return {
    order: BigInt(s.order),
    turningOrder: BigInt(s.turningOrder),
    reorientations: BigInt(s.reorientations),
    reassembly: BigInt(s.reassembly),
    index: BigInt(s.index),
    orbits: s.orbits.map((o) => ({ name: o.name, pieces: o.pieces, oriMod: o.oriMod })),
    moveNames: s.moveNames.slice(),
  };
}

/** Precomputed facts for a binding key (= bridge.pgName), or null if not baked. */
export function precomputedFacts(key: string): PgGroupFacts | null {
  const s = PRECOMPUTED_PG_FACTS[key];
  return s ? deserializePgFacts(s) : null;
}
