'use client';

/**
 * ReconEnginePlayer — the shared engine-dispatch for recon 3D previews. Given an
 * event + scramble + solution, it renders the right player:
 *   - sq1      → Sq1ReconPlayer   (in-house cuber engine)
 *   - NxN      → CuberReconPlayer (in-house cuber engine)
 *   - else     → cubing.js TwistySection
 * NxN / other solutions run through cleanForPlayer; sq1 keeps its raw tokens.
 *
 * The recon flow uses the in-house cuber engine (the /sim look) for everything it
 * can; cubing.js (TwistySection) is only the fallback for puzzles without an
 * in-house recon player yet — currently pyraminx / megaminx / skewb / clock.
 * (pyraminx / megaminx / skewb / minx are next to migrate off cubing.js; clock stays.)
 *
 * Both recon dispatchers wrap this and differ ONLY in state ownership + framing:
 *   - ReconPlayerPane   (submit / alt-solution forms) — debounces scramble/solution
 *     internally, forces the back-view mini window.
 *   - ReconPlayerCanvas (detail page / AttemptPopover) — takes pre-resolved values,
 *     supports the in-frame play/pause overlay (hideControls).
 * The selection switch itself lives here so it isn't copy-pasted between them.
 */

import { type RefObject } from 'react';
import { getPuzzleId } from '@/lib/recon-utils';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import TwistySection from '@/components/TwistySection';
import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';
import CuberReconPlayer from '@/components/CuberReconPlayer';

/** 2..7-order NxN cube ids (2x2x2 .. 7x7x7). */
const NXN_RE = /^[2-7]x[2-7]x[2-7]$/;

export default function ReconEnginePlayer({
  event, scramble, solution, playerRef, fillPane = false, backView, hideControls = false,
}: {
  event: string;
  scramble: string;
  /** Solution to play. sq1 gets it raw; NxN / other go through cleanForPlayer. */
  solution: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  fillPane?: boolean;
  /** Force the back-view mini window on the sq1 / cubing.js players.
   *  undefined = leave each player's own default (CuberReconPlayer always shows it). */
  backView?: boolean;
  hideControls?: boolean;
}) {
  const puzzleId = getPuzzleId(event);

  if (event === 'sq1') {
    return (
      <Sq1ReconPlayer
        scramble={scramble}
        alg={solution}
        playerRef={playerRef}
        fillPane={fillPane}
        backView={backView}
        hideControls={hideControls}
      />
    );
  }
  if (NXN_RE.test(puzzleId)) {
    return (
      <CuberReconPlayer
        scramble={scramble}
        alg={cleanForPlayer(solution)}
        order={parseInt(puzzleId, 10)}
        playerRef={playerRef}
        fillPane={fillPane}
        hideControls={hideControls}
      />
    );
  }
  return (
    <TwistySection
      puzzle={puzzleId}
      scramble={scramble}
      alg={cleanForPlayer(solution)}
      playerRef={playerRef}
      fillPane={fillPane}
      backView={backView}
      hideControls={hideControls}
    />
  );
}
