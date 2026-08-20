'use client';

import { type ReactNode, type RefObject } from 'react';
import type FtoTwister from '@/app/[lang]/sim/engine/fto/FtoTwister';
import type { FtoAnimationMove } from '@/app/[lang]/sim/engine/fto/ftoAnimation';
import { parseFtoEifMoveGroups } from '@/app/[lang]/sim/engine/fto/ftoEifMoves';
import ReconPlayerBase, { type ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';
import { useT } from '@/hooks/useT';
import { invertFtoEifAlgorithm } from '@cuberoot/shared/fto-notation';

type FtoMoveGroup = FtoAnimationMove[];

interface FtoReconCube {
  twister: FtoTwister;
}

function parseStrictGroups(algorithm: string): FtoMoveGroup[] | null {
  const parsed = parseFtoEifMoveGroups(algorithm);
  return parsed.invalid.length === 0 ? parsed.groups : null;
}

/** FTO recon preview using the same grouped EIF bridge as the /sim engine. */
export default function FtoReconPlayer({
  scramble,
  alg,
  anchorAtEnd = false,
  fillPane = false,
  hideControls = false,
  playerRef,
  fullscreenButton,
}: {
  scramble: string;
  alg: string;
  anchorAtEnd?: boolean;
  fillPane?: boolean;
  hideControls?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  fullscreenButton?: ReactNode;
}) {
  const t = useT();
  const adapter: ReconPlayerAdapter<FtoMoveGroup> = {
    kind: 'fto',
    backView: false,
    faceHints: false,
    deps: [anchorAtEnd],
    parseMoves: (text) => parseStrictGroups(text) ?? [],
    setupPuzzle: (world) => {
      if (world.puzzleKind !== 'fto') world.setPuzzle('fto');
    },
    applyPrefix: (world, sc, moves, n) => {
      if (world.puzzleKind !== 'fto') return;
      const baseText = anchorAtEnd ? `${sc} ${invertFtoEifAlgorithm(alg)}`.trim() : sc;
      const base = parseStrictGroups(baseText);
      if (!base) return;
      const target = Math.max(0, Math.min(n, moves.length));
      const cube = world.cube as unknown as FtoReconCube;
      cube.twister.setupMoves([
        ...base.flat(),
        ...moves.slice(0, target).flat(),
      ], baseText);
      world.dirty = true;
      return target;
    },
    pushMove: (world, moves) => {
      if (world.puzzleKind !== 'fto') return false;
      (world.cube as unknown as FtoReconCube).twister.pushMoves(moves);
      return true;
    },
    playbackDelayMs: (moves) => Math.max(1, moves.length) * 520,
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
      ariaLabel={t('FTO 复盘', 'FTO reconstruction')}
    />
  );
}
