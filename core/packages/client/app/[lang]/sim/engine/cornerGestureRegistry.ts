import DinoCube from './dino/DinoCube';
import MagicCube from '@cuberoot/puzzle-render-core/engine/magic/MagicCube';
import { magicMoveToString, type MagicMove } from '@cuberoot/puzzle-solvers/magic';
import { magicPickHit, magicResolveMove, type MagicPickHit } from '@cuberoot/puzzle-render-core/engine/magic/magicDrag';
import DuoCube from '@cuberoot/puzzle-render-core/engine/duo/DuoCube';
import { duoMoveToString, type DuoMove } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { duoPickHit, duoResolveLive, duoResolveMove, type DuoPickHit } from '@/components/puzzle-models/gestures/duoDrag';
import { dinoPickHit, dinoResolveLive, dinoResolveMove, type DinoPickHit } from './dino/dinoDrag';
import { dinoMoveToString, type DinoMove } from './dino/dinoState';
import FtoCube from './fto/FtoCube';
import GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';
import { ghostMoveToString, type GhostMove } from '@cuberoot/puzzle-render-core/engine/ghost/ghostState';
import { ghostPickHit, ghostResolveLive, ghostResolveMove, type GhostPickHit } from './ghost/ghostDrag';
import { ftoPickHit, ftoResolveLive, ftoResolveMove, type FtoPickHit } from './fto/ftoDrag';
import { ftoMoveToString, type FtoMove } from './fto/ftoState';
import GearCube from './gear/GearCube';
import { gearPickHit, gearResolveLive, gearResolveMove, type GearPickHit } from './gear/gearDrag';
import { gearMoveToString, type GearMove } from './gear/gearState';
import HeliCube from './heli/HeliCube';
import { heliPickHit, heliResolveLive, heliResolveMove, type HeliPickHit } from './heli/heliDrag';
import { heliMoveToString, type HeliMove } from './heli/heliState';
import IvyCube, { type IvyMove } from './ivy/IvyCube';
import { ivyPickHit, ivyResolveLive, ivyResolveMove, type IvyHit } from './ivy/ivyDrag';
import MegaminxCube from './mega/MegaminxCube';
import {
  megaPickHit,
  megaResolveLive,
  megaResolveMove,
  megaResolveWcaLive,
  megaResolveWcaMove,
  type MegaPickHit,
} from './mega/megaDrag';
import { megaMoveToString, type MegaMove } from './mega/megaState';
import PyraCube from './pyra/PyraCube';
import { pyraPickHit, pyraResolveLive, pyraResolveMove, type PyraPickHit } from './pyra/pyraDrag';
import { pyraMoveToString, type PyraMove } from './pyra/pyraState';
import RediCube from './redi/RediCube';
import { rediPickHit, rediResolveLive, rediResolveMove, type RediPickHit } from './redi/rediDrag';
import { rediMoveToString, type RediMove } from './redi/rediState';
import RexCube from './rex/RexCube';
import { rexPickHit, rexResolveLive, rexResolveMove, type RexPickHit } from './rex/rexDrag';
import { rexMoveToString, type RexMove } from './rex/rexState';
import SkewbCube from './skewb/SkewbCube';
import { skewbPickHit, skewbResolveLive, skewbResolveMove, type SkewbPickHit } from './skewb/skewbDrag';
import { skewbMoveToString, type SkewbMove } from './skewb/skewbState';
import {
  CornerTurnGesture,
  type CornerGestureCtx,
  type CornerGestureHandle,
  type CornerTurnAdapter,
} from './cornerTurnGesture';

/**
 * Canonical registry for every discrete corner/edge-turning `/sim` puzzle.
 * SimPage and embedded players share these adapters so picking, drag direction,
 * animation and emitted notation cannot drift between pages.
 */
export function createCornerGestureResolver(
  ctx: CornerGestureCtx,
  options: { megaminxWcaNotation?: boolean } = {},
) {
  const ivyAdapter: CornerTurnAdapter<IvyCube, IvyMove, IvyHit> = {
    match: (cube): cube is IvyCube => cube instanceof IvyCube,
    pickHit: ivyPickHit,
    resolveLive: ivyResolveLive,
    resolveMove: ivyResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: move => move.name,
    fullPx: 150,
    threshold: 6,
  };
  const dinoAdapter: CornerTurnAdapter<DinoCube, DinoMove, DinoPickHit> = {
    match: (cube): cube is DinoCube => cube instanceof DinoCube,
    pickHit: dinoPickHit,
    resolveLive: dinoResolveLive,
    resolveMove: dinoResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: dinoMoveToString,
    fullPx: 150,
    threshold: 6,
  };
  const rediAdapter: CornerTurnAdapter<RediCube, RediMove, RediPickHit> = {
    match: (cube): cube is RediCube => cube instanceof RediCube,
    pickHit: rediPickHit,
    resolveLive: rediResolveLive,
    resolveMove: rediResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: rediMoveToString,
    fullPx: 150,
    threshold: 6,
  };
  const rexAdapter: CornerTurnAdapter<RexCube, RexMove, RexPickHit> = {
    match: (cube): cube is RexCube => cube instanceof RexCube,
    pickHit: rexPickHit,
    resolveLive: rexResolveLive,
    resolveMove: rexResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: rexMoveToString,
    fullPx: 150,
    threshold: 6,
  };
  const heliAdapter: CornerTurnAdapter<HeliCube, HeliMove, HeliPickHit> = {
    match: (cube): cube is HeliCube => cube instanceof HeliCube,
    pickHit: heliPickHit,
    resolveLive: heliResolveLive,
    resolveMove: heliResolveMove,
    beginMove: (cube, move, dir) => cube.beginMove(move, dir),
    moveToString: heliMoveToString,
    fullPx: 200,
    threshold: 6,
  };
  const gearAdapter: CornerTurnAdapter<GearCube, GearMove, GearPickHit> = {
    match: (cube): cube is GearCube => cube instanceof GearCube,
    pickHit: gearPickHit,
    resolveLive: gearResolveLive,
    resolveMove: gearResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: gearMoveToString,
    fullPx: 260,
    threshold: 6,
  };
  const skewbAdapter: CornerTurnAdapter<SkewbCube, SkewbMove, SkewbPickHit> = {
    match: (cube): cube is SkewbCube => cube instanceof SkewbCube,
    pickHit: skewbPickHit,
    resolveLive: skewbResolveLive,
    resolveMove: skewbResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: skewbMoveToString,
    fullPx: 150,
    threshold: 6,
  };
  const pyraAdapter: CornerTurnAdapter<PyraCube, PyraMove, PyraPickHit> = {
    match: (cube): cube is PyraCube => cube instanceof PyraCube,
    pickHit: pyraPickHit,
    resolveLive: pyraResolveLive,
    resolveMove: pyraResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: pyraMoveToString,
    fullPx: 150,
    threshold: 6,
  };
  const megaAdapter: CornerTurnAdapter<MegaminxCube, MegaMove, MegaPickHit> = {
    match: (cube): cube is MegaminxCube => cube instanceof MegaminxCube,
    pickHit: megaPickHit,
    resolveLive: options.megaminxWcaNotation ? megaResolveWcaLive : megaResolveLive,
    resolveMove: options.megaminxWcaNotation ? megaResolveWcaMove : megaResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: megaMoveToString,
    fullPx: 130,
    threshold: 6,
  };
  const ftoAdapter: CornerTurnAdapter<FtoCube, FtoMove, FtoPickHit> = {
    match: (cube): cube is FtoCube => cube instanceof FtoCube,
    pickHit: ftoPickHit,
    resolveLive: ftoResolveLive,
    resolveMove: ftoResolveMove,
    beginMove: (cube, move) => cube.beginMove(move),
    moveToString: ftoMoveToString,
    fullPx: 140,
    threshold: 6,
  };

  const magicGesture = new CornerTurnGesture<MagicCube, MagicMove, MagicPickHit>({
    match: (cube): cube is MagicCube => cube instanceof MagicCube,
    pickHit: magicPickHit, resolveMove: magicResolveMove, resolveLive: () => null,
    beginMove: (cube, move) => cube.beginMove(move), moveToString: magicMoveToString,
    fullPx: 180, threshold: 8,
  }, { ...ctx, settings: () => ({ ...ctx.settings(), holdPartialTurn: false }) });
  const gestures = {
    magic: magicGesture,
    mmagic: magicGesture,
    pyraminx_duo: new CornerTurnGesture<DuoCube, DuoMove, DuoPickHit>({
      match: (cube): cube is DuoCube => cube instanceof DuoCube,
      pickHit: duoPickHit, resolveLive: duoResolveLive, resolveMove: duoResolveMove,
      beginMove: (cube, move) => cube.beginMove(move), moveToString: duoMoveToString,
      fullPx: 150, threshold: 6,
    }, ctx),
    ghost: new CornerTurnGesture<GhostCube, GhostMove, GhostPickHit>({
      match: (cube): cube is GhostCube => cube instanceof GhostCube,
      pickHit: ghostPickHit, resolveLive: ghostResolveLive, resolveMove: ghostResolveMove,
      beginMove: (cube, move) => cube.beginMove(move), moveToString: ghostMoveToString,
      fullPx: 150, threshold: 6,
    }, ctx),
    ivy: new CornerTurnGesture(ivyAdapter, ctx),
    dino: new CornerTurnGesture(dinoAdapter, ctx),
    redi: new CornerTurnGesture(rediAdapter, ctx),
    rex: new CornerTurnGesture(rexAdapter, ctx),
    heli: new CornerTurnGesture(heliAdapter, ctx),
    gear: new CornerTurnGesture(gearAdapter, ctx),
    skewb: new CornerTurnGesture(skewbAdapter, ctx),
    pyraminx: new CornerTurnGesture(pyraAdapter, ctx),
    megaminx: new CornerTurnGesture(megaAdapter, ctx),
    fto: new CornerTurnGesture(ftoAdapter, ctx),
  };

  return (puzzle: unknown): CornerGestureHandle | null => (
    typeof puzzle === 'string' && Object.prototype.hasOwnProperty.call(gestures, puzzle)
      ? gestures[puzzle as keyof typeof gestures]
      : null
  );
}
