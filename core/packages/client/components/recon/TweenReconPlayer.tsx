'use client';

/**
 * TweenReconPlayer — read-only recon preview for the "TweenTwister" family of
 * in-house engine puzzles (skewb / pyraminx / …). They all drive moves the same
 * way, so one generic adapter over ReconPlayerBase covers them; only the puzzle
 * kind + the string→move parser differ per puzzle:
 *   - snap a state instantly:  twister.finish() → twister.setup(scramble) →
 *                              applyMoveInstant per solution move
 *   - animate one move:        twister.twist(move, false, true)
 *
 * (SQ1 uses the same TweenTwister API but keeps its own Sq1ReconPlayer wrapper — its
 * moves come from parseSq1Tokens, not a per-puzzle engine parser. NxN uses a
 * different twister.setup(scramble+prefix)/push API — see CuberReconPlayer.)
 *
 * Dispatched from ReconEnginePlayer, which passes a stable `key` per puzzle so a
 * puzzle switch remounts (rebuilding the world + re-parsing with the new parser).
 */

import { type RefObject } from 'react';
import type { PuzzleKind } from '@/app/[lang]/sim/engine/world';
import ReconPlayerBase, { type ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';

/** The minimal move surface every TweenTwister puzzle cube shares (skewb / pyra / …). */
interface TweenTwisterCube<M> {
  twister: {
    finish(): void;
    setup(alg: string): void;
    twist(move: M, fast: boolean, force: boolean): boolean;
  };
  applyMoveInstant(move: M): void;
}

export default function TweenReconPlayer<M>({
  scramble, alg, puzzleKind, parseMoves, kind,
  fillPane = false, backView = false, hideControls = false, playerRef,
}: {
  scramble: string;
  alg: string;
  /** world.setPuzzle target for this puzzle (e.g. 'skewb', 'pyraminx'). */
  puzzleKind: PuzzleKind;
  /** Split the solution alg string into this puzzle's engine moves. */
  parseMoves: (alg: string) => M[];
  /** Imperative-handle tag exposed for caret-scrub (`__kind`). */
  kind: string;
  fillPane?: boolean;
  backView?: boolean;
  hideControls?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
}) {
  const adapter: ReconPlayerAdapter<M> = {
    kind,
    backView,
    deps: [puzzleKind],
    parseMoves,
    setupPuzzle: (world) => {
      if (world.puzzleKind !== puzzleKind) world.setPuzzle(puzzleKind);
    },
    applyPrefix: (world, sc, moves, n) => {
      if (world.puzzleKind !== puzzleKind) return;
      const cube = world.cube as unknown as TweenTwisterCube<M>;
      cube.twister.finish();
      cube.twister.setup(sc);
      const target = Math.max(0, Math.min(n, moves.length));
      for (let i = 0; i < target; i++) cube.applyMoveInstant(moves[i]);
      world.dirty = true;
      return target;
    },
    pushMove: (world, move) => {
      if (world.puzzleKind !== puzzleKind) return false;
      (world.cube as unknown as TweenTwisterCube<M>).twister.twist(move, false, true);
      return true;
    },
  };

  return (
    <ReconPlayerBase
      scramble={scramble}
      alg={alg}
      adapter={adapter}
      fillPane={fillPane}
      hideControls={hideControls}
      playerRef={playerRef}
    />
  );
}
