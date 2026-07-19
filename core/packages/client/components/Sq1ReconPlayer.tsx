'use client';

/**
 * Sq1ReconPlayer — read-only Square-1 preview for the recon submit/detail flow.
 *
 * cubing.js TwistyPlayer renders SQ1 poorly, so the recon pages reuse the local
 * cuber WebGL engine (the same one /sim?puzzle=sq1 drives) to show the scramble +
 * solution with play / step / scrub controls. The back-view mini window is
 * optional here (the recon submit form forces it on; detail / SolutionView omit it).
 *
 * Thin adapter over ReconPlayerBase — see there for the shared player lifecycle.
 * Cursor sync: exposes `{ __kind: 'sq1', jumpToMoveCount(n) }` on playerRef so the
 * form's caret handler can scrub the cube as the user clicks the solution text.
 */

import { type ReactNode, type RefObject } from 'react';
import type World from '@/app/[lang]/sim/engine/world';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type { Sq1Move } from '@/app/[lang]/sim/engine/sq1/sq1State';
import { parseSq1Tokens } from '@/lib/sq1-svg';
import ReconPlayerBase, { type ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';

export default function Sq1ReconPlayer({
  scramble, alg, fillPane = false, playerRef, backView = false, hideControls = false, fullscreenButton,
}: {
  scramble: string;
  alg: string;
  fillPane?: boolean;
  /** Show an always-on back-view mini window (recon submit forces it). */
  backView?: boolean;
  /** 隐藏底部完整控制条,改用画面内居中播放/暂停浮层(嵌成绩弹窗预览时用)。 */
  hideControls?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  fullscreenButton?: ReactNode;
}) {
  const adapter: ReconPlayerAdapter<Sq1Move> = {
    kind: 'sq1',
    backView,
    parseMoves: (a) => parseSq1Tokens(a) as Sq1Move[],
    setupPuzzle: (world: World) => {
      if (world.puzzleKind !== 'sq1') world.setPuzzle('sq1');
    },
    applyPrefix: (world, sc, moves, n) => {
      if (world.puzzleKind !== 'sq1') return;
      const cube = world.cube as Sq1Cube;
      cube.twister.finish();
      cube.twister.setup(sc);
      const target = Math.max(0, Math.min(n, moves.length));
      for (let i = 0; i < target; i++) cube.applyMoveInstant(moves[i]);
      world.dirty = true;
      return target;
    },
    pushMove: (world, move) => {
      if (world.puzzleKind !== 'sq1') return false;
      (world.cube as Sq1Cube).twister.twist(move, false, true);
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
