'use client';

/**
 * ReconEnginePlayer — the shared engine-dispatch for recon 3D previews. Given an
 * event + scramble + solution, it renders the right player, all on the in-house
 * "cuber" WebGL engine (the /sim look) except where a puzzle has no cuber recon
 * player yet:
 *   - sq1       → Sq1ReconPlayer
 *   - NxN       → CuberReconPlayer
 *   - skewb     → TweenReconPlayer(skewb)     — WCA R/U/L/B notation, engine-verified vs cubing.js
 *   - pyraminx  → TweenReconPlayer(pyraminx)  — WCA U/L/R/B + tips
 *   - else      → cubing.js TwistySection     — megaminx (needs a notation converter) + clock
 * NxN / skewb / pyra solutions run through cleanForPlayer; sq1 keeps its raw tokens.
 *
 * cubing.js (TwistySection) is now only the fallback for megaminx and clock; migrating
 * megaminx onto the cuber engine needs a WCA(R++/D--)→MegaMove converter (its scramble
 * and solution notation don't match the engine parser), tracked as a follow-up.
 *
 * Both recon dispatchers wrap this and differ ONLY in state ownership + framing:
 *   - ReconPlayerPane   (submit / alt-solution forms) — debounces scramble/solution,
 *     forces the back-view mini window.
 *   - ReconPlayerCanvas (detail page / AttemptPopover) — takes pre-resolved values,
 *     supports the in-frame play/pause overlay (hideControls).
 * The selection switch itself lives here so it isn't copy-pasted between them.
 */

import { type RefObject } from 'react';
import { getPuzzleId } from '@/lib/recon-utils';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { parseSkewbMoves } from '@/app/[lang]/sim/engine/skewb/skewbState';
import { parsePyraMoves } from '@/app/[lang]/sim/engine/pyra/pyraState';
import TwistySection from '@/components/TwistySection';
import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';
import CuberReconPlayer from '@/components/CuberReconPlayer';
import TweenReconPlayer from './TweenReconPlayer';

/** 2..7-order NxN cube ids (2x2x2 .. 7x7x7). */
const NXN_RE = /^[2-7]x[2-7]x[2-7]$/;

export default function ReconEnginePlayer({
  event, scramble, solution, playerRef, fillPane = false, backView, hideControls = false,
}: {
  event: string;
  scramble: string;
  /** Solution to play. sq1 gets it raw; NxN / skewb / pyra go through cleanForPlayer. */
  solution: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  fillPane?: boolean;
  /** Force the back-view mini window on the sq1 / cubing.js players.
   *  undefined = leave each player's own default (CuberReconPlayer always shows it;
   *  skewb / pyra omit it — ReconPlayerBase's face-hint letters are NxN-shaped). */
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
  if (puzzleId === 'skewb') {
    return (
      <TweenReconPlayer
        key="skewb"
        puzzleKind="skewb"
        kind="skewb"
        parseMoves={parseSkewbMoves}
        scramble={scramble}
        alg={cleanForPlayer(solution)}
        playerRef={playerRef}
        fillPane={fillPane}
        hideControls={hideControls}
      />
    );
  }
  if (puzzleId === 'pyraminx') {
    return (
      <TweenReconPlayer
        key="pyraminx"
        puzzleKind="pyraminx"
        kind="pyra"
        parseMoves={parsePyraMoves}
        scramble={scramble}
        alg={cleanForPlayer(solution)}
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
