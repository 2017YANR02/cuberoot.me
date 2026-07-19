'use client';

/**
 * CuberReconPlayer — read-only NxN preview for the recon flow, driven by the
 * local cuber WebGL engine (the same one /sim uses for NxN). It's the NxN
 * counterpart to Sq1ReconPlayer, offered as an alternative to the cubing.js
 * TwistySection so recon previews can match /sim exactly. The back-view mini
 * window is always on here (the recon flow forces it, no toggle).
 *
 * Thin adapter over ReconPlayerBase — see there for the shared player lifecycle.
 * Cursor sync: exposes `{ __kind: 'nxn-cuber', jumpToMoveCount(n) }` on playerRef
 * so the form's caret handler can scrub the cube as the user clicks the solution.
 */

import { type ReactNode, type RefObject } from 'react';
import type World from '@/app/[lang]/sim/engine/world';
import type NxnCube from '@/app/[lang]/sim/engine/nxn/cube';
import ReconPlayerBase, { type ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';

/** Whitespace-tokenize an alg into individual moves (matches the form's caret
 *  move-count which splits on /\s+/). */
function tokenize(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean);
}

export default function CuberReconPlayer({
  scramble, alg, order, fillPane = false, playerRef, hideControls = false, fullscreenButton,
}: {
  scramble: string;
  alg: string;
  /** NxN order (2..7). */
  order: number;
  fillPane?: boolean;
  /** 隐藏底部完整控制条,改用画面内居中播放/暂停浮层(嵌成绩弹窗预览时用)。 */
  hideControls?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  fullscreenButton?: ReactNode;
}) {
  const adapter: ReconPlayerAdapter<string> = {
    kind: 'nxn-cuber',
    backView: true,
    deps: [order],
    parseMoves: tokenize,
    setupPuzzle: (world: World) => {
      if (world.puzzleKind !== order) world.setPuzzle(order);
    },
    applyPrefix: (world, sc, moves, n) => {
      if (world.puzzleKind === 'sq1') return;
      const cube = world.cube as NxnCube;
      const target = Math.max(0, Math.min(n, moves.length));
      const prefix = moves.slice(0, target).join(' ');
      cube.twister.setup((sc + ' ' + prefix).trim());
      world.dirty = true;
      return target;
    },
    pushMove: (world, move) => {
      if (world.puzzleKind === 'sq1') return false;
      (world.cube as NxnCube).twister.push(move);
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
      fullscreenButton={fullscreenButton}
    />
  );
}
