'use client';

/**
 * CuberReconPlayer — read-only NxN preview for the recon flow, driven by the
 * local cuber WebGL engine (the same one /sim uses for NxN). It's the NxN
 * counterpart to Sq1ReconPlayer, offered as an alternative to the cubing.js
 * TwistySection so recon previews can match /sim exactly. The back-view mini
 * window is on by default (the recon flow wants it); `backView={false}` drops it
 * for players too narrow to spare the corner, keeping the orientation letters.
 *
 * Thin adapter over ReconPlayerBase — see there for the shared player lifecycle.
 * Cursor sync: exposes `{ __kind: 'nxn-cuber', jumpToMoveCount(n) }` on playerRef
 * so the form's caret handler can scrub the cube as the user clicks the solution.
 */

import { type ReactNode, type RefObject } from 'react';
import type World from '@/app/[lang]/sim/engine/world';
import { applyPuzzleTransparency } from '@/app/[lang]/sim/engine/coreOpacity';
import type NxnCube from '@/app/[lang]/sim/engine/nxn/cube';
import { mergeStickeringMaskFns, stickeringMaskFn } from '@/app/[lang]/sim/engine/nxn/stickering';
import { resolveStageMaskFn } from '@/app/[lang]/sim/engine/nxn/vcStageMask';
import ReconPlayerBase, { type ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';
import { invertAlg } from '@/lib/cube3';

/** Whitespace-tokenize an alg into individual moves (matches the form's caret
 *  move-count which splits on /\s+/). */
function tokenize(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean);
}

export default function CuberReconPlayer({
  scramble, alg, order, fillPane = false, playerRef, hideControls = false, fullscreenButton,
  backView = true, anchorAtEnd = false, stickering = '', stickeringOrientation = '',
  stickeringMasks, transparent = false, ariaLabel,
}: {
  scramble: string;
  alg: string;
  /** Start from alg inverse and finish at the setup state. */
  anchorAtEnd?: boolean;
  /** NxN order (2..7). */
  order: number;
  /** 右上角背面小窗。默认开(复盘流程要它);嵌在窄栏里的小播放器可关掉 —— 小窗按主画布
   *  边长的三成走,300px 见方的画布上它会盖掉小半个魔方。方位字母不受影响,照常画。 */
  backView?: boolean;
  fillPane?: boolean;
  /** 隐藏底部完整控制条,改用画面内居中播放/暂停浮层(嵌成绩弹窗预览时用)。 */
  hideControls?: boolean;
  /** 与 /sim 同一套阶段遮罩；空值恢复完整配色。 */
  stickering?: string;
  stickeringOrientation?: string;
  /** Several stage masks displayed as a union, e.g. every selected cross colour. */
  stickeringMasks?: readonly { name: string; orientation?: string }[];
  /** 与 /predict 相同的透明核心视图。 */
  transparent?: boolean;
  ariaLabel?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  fullscreenButton?: ReactNode;
}) {
  const adapter: ReconPlayerAdapter<string> = {
    kind: 'nxn-cuber',
    backView,
    faceHints: true,
    deps: [
      order, anchorAtEnd, stickering, stickeringOrientation,
      stickeringMasks?.map(({ name, orientation }) => `${name}:${orientation ?? ''}`).join('|') ?? '',
      transparent,
    ],
    parseMoves: tokenize,
    setupPuzzle: (world: World) => {
      if (world.puzzleKind !== order) world.setPuzzle(order);
      if (world.puzzleKind === 'sq1') return;
      const descriptors = stickeringMasks?.length
        ? stickeringMasks
        : [{ name: stickering, orientation: stickeringOrientation }];
      const mask = mergeStickeringMaskFns(descriptors.map(({ name, orientation }) => (
        stickeringMaskFn(order, name, orientation)
          ?? resolveStageMaskFn(order, name, orientation)
      )));
      const cube = world.cube as NxnCube;
      cube.instancedRenderer.setStickering(mask);
      applyPuzzleTransparency(cube, transparent);
      world.dirty = true;
    },
    cleanupPuzzle: (world) => {
      applyPuzzleTransparency(world.cube, false);
    },
    applyPrefix: (world, sc, moves, n) => {
      if (world.puzzleKind === 'sq1') return;
      const cube = world.cube as NxnCube;
      const target = Math.max(0, Math.min(n, moves.length));
      const prefix = moves.slice(0, target).join(' ');
      const base = anchorAtEnd
        ? `${sc} ${invertAlg(moves.join(' '))}`.trim()
        : sc;
      cube.twister.setup(`${base} ${prefix}`.trim());
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
      ariaLabel={ariaLabel}
    />
  );
}
