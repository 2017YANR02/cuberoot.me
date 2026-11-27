import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { SIZE } from '../engine/define';
import type { FingerMark } from '@/lib/alg-finger-marks';
import { pushRule } from '@/lib/push-notation';
import { evenFingerExamples } from '../evenFingerNotation';
import { convertAction, TwistAction } from '../engine/nxn/nxnNotation';
import { classifyLayers, gestureForLayers, gripQuat, isBasicGrip, isNativeNailStroke, planHomeStroke, prefersLeftUpperRelay, type GripName } from '../engine/hands/handsRig';
import { eligibleMarkedFingerPlans } from '../engine/hands/markedFingerMotion';
import { MARKED_FINGER_PROFILES } from '../engine/hands/markedFingerPoses';
import type { FingerName } from '../engine/hands/handModel';
import { atlasCatalog, gripNames, type AtlasOrder } from './catalog';

export type Technique = 'middle' | 'thumb' | 'nail' | 'push';
export type Side = 'R' | 'L';
export type Pose = Record<Side, GripName>;
export const homePose: Pose = { L: 'home', R: 'home' };

interface Stroke {
  hand: Side;
  finger: FingerName;
  second?: FingerName;
  nail?: boolean;
  rollsToNail?: boolean;
  startSticker?: string;
  push?: boolean;
  marks?: FingerMark[];
  style: string;
}
export interface LessonMethod extends Stroke {
  id: string;
  move: string;
  pose: Pose;
  setup: { side: Side; grip: GripName }[];
}
const poses = gripNames.flatMap(L => gripNames.map(R => ({ L, R })));
const opposite = (side: Side) => side === 'L' ? 'R' : 'L';
const axes = ['x', 'y', 'z'] as const;
// Each listing describes the moving finger(s) at a seated pair of wrists. Geometry-only
// fallback sweeps and welded/supporting fingers have no place in a finger lesson.
function strokesAt(order: AtlasOrder, move: string, turns: ReturnType<typeof convertAction>, pose: Pose): Stroke[] {
  const axis = axes[turns[0].axis], layers = turns.map(t => t.layer);
  const dir = turns[0].twist > 0 ? 1 : -1, quarters = Math.abs(turns[0].twist);
  const cls = classifyLayers(layers, order);
  if (cls === 'whole') return [];
  const hand = dir > 0 ? 'R' : 'L', other = opposite(hand);
  const bothHome = pose.L === 'home' && pose.R === 'home';
  const result: Stroke[] = [];
  const push = pushRule(move + 'p');
  if (push && bothHome) result.push({ hand: push.hand, finger: push.finger, style: 'push', push: true, nail: true });

  if ((move === 'F' || move === "F'") && pose[other] === 'down' && (order !== 3 || isBasicGrip(pose[hand]))) {
    result.push({ hand: other, finger: 'thumb', marks: ['em'], style: 'thumbLift' });
  }
  if (order !== 3) {
    const examples = evenFingerExamples[order];
    if (examples.s.includes(move) && pose[hand] === (order === 2 ? 'up' : 'home') && pose[other] === 'home')
      result.push({ hand, finger: 'index', second: 'middle', style: order === 2 ? 'topPush' : 'hook', marks: ['s'] });
    if (examples.u.includes(move) && bothHome) {
      result.push(order === 2 ? { hand, finger: 'index', style: 'indexHook', nail: true, rollsToNail: true, marks: ['u'] }
        : { hand: layers[0] === 2 ? 'R' : 'L', finger: 'ring', second: 'pinky', style: 'middleSliceNail', nail: true, marks: ['u'] });
    }
  } else {
    if (axis === 'y' && cls === 'high' && layers.length === 1 && pose[hand] === 'home' && isBasicGrip(pose[other]))
      result.push(quarters === 1 ? { hand, finger: 'middle', style: 'marked', nail: true, rollsToNail: true, startSticker: hand === 'R' ? 'B0' : 'B2', marks: ['s'] }
        : { hand, finger: 'index', second: 'middle', style: 'downPush', nail: true, rollsToNail: true, marks: ['s'] });

    // S/S2 explicitly seat the index at home before contact. Other native nail
    // gestures select their own driver and support from the actual layer rules.
    const singleS = axis === 'z' && cls === 'mid';
    const nailHint = quarters === 1 || singleS || axis === 'y' && cls === 'high';
    if (nailHint && (!singleS || pose[other] === 'home' && isBasicGrip(pose[hand]))) {
      const g = gestureForLayers(axis, layers, dir, pose, { quarters, nail: true }, order);
      if (g.kind === 'flick' && g.style && isNativeNailStroke(g.style))
        result.push({ hand: g.hand, finger: g.finger, second: g.finger2, style: g.style, nail: true, marks: ['u'] });
    }
    if (quarters === 1 && layers.length === 2 && axis !== 'x') {
      const wrists = { L: gripQuat(pose.L), R: gripQuat(pose.R) };
      for (const contact of ['pad', 'nail'] as const) {
        const request = { axis, layers, dir, quarters, annotation: contact === 'nail' ? { contact } : {} } as const;
        for (const { hand, profile, start, normal } of eligibleMarkedFingerPlans(request, MARKED_FINGER_PROFILES, wrists)) {
          // At either half grip the transformed profile misses its first sticker on the real hand.
          if (!isBasicGrip(pose[hand])) continue;
          const marks: FingerMark[] = [profile.finger === 'middle' ? 's' : 'em'];
          if (contact === 'nail') marks.push('u');
          const face = normal.x > .9 ? 'R' : normal.x < -.9 ? 'L' : normal.y > .9 ? 'U' : normal.y < -.9 ? 'D' : normal.z > 0 ? 'F' : 'B';
          const cell = (n: number) => Math.max(0, Math.min(2, Math.round(n / SIZE) + 1));
          const startSticker = face + netIndexOf(cell(start.x), cell(start.y), cell(start.z), FACE[face], 2, 3);
          result.push({ hand, finger: profile.finger, nail: contact === 'nail' || !!profile.nailTransfer,
            rollsToNail: !!profile.nailTransfer, startSticker, style: profile.id, marks });
        }
      }
    }
  }

  // At a seated wrist ordinary turns use the same stroke planner as playback.
  // The unmarked upper half turn can choose the opposite arc in a mixed grip.
  const upperHalf = axis === 'y' && layers.length === 1 && cls === 'high' && quarters === 2;
  if (upperHalf && prefersLeftUpperRelay(pose) && (dir > 0 || pose.L !== 'home' && !(order === 2 && pose.L === 'up'))) return result;
  const planned = planHomeStroke(order, pose, axis, layers, dir, quarters);
  const g = planned?.gesture ?? gestureForLayers(axis, layers, dir, pose, { quarters }, order);
  if (g.kind !== 'flick' || !g.style || planned && pose[g.hand] !== planned.grip) return result;
  const rollsToNail = /^(U|U')$/.test(move) && g.style === 'indexHook' && pose[g.hand] === 'home'
    || order === 3 && (move === 'U' && g.style === 'topPush' && pose.R === 'up'
      || upperHalf && g.style === 'downPush'
      || axis === 'z' && cls === 'high' && layers.length === 1 && (g.style === 'topPush' || g.style === 'downPush')
      || cls === 'mid' && axis === 'x' && quarters === 1 && (g.style === 'middleSlicePad' || g.style === 'middleSliceNail'));
  const nail = isNativeNailStroke(g.style) || g.style === 'middleSliceNail' || rollsToNail;
  if (g.finger2 === 'middle' || g.finger === 'thumb' || nail) {
    if (!result.some(s => s.style === g.style && s.hand === g.hand))
      result.push({ hand: g.hand, finger: g.finger, second: g.finger2, style: g.style, nail, rollsToNail });
  }
  return result;
}

const cache = new Map<AtlasOrder, ReturnType<typeof buildCatalog>>();
function buildCatalog(order: AtlasOrder) {
  return atlasCatalog[order].moves.map(move => {
    const turns = convertAction(new TwistAction(move), order);
    return { move, variants: poses.flatMap(pose => strokesAt(order, move, turns, pose).map(stroke => ({ pose, stroke }))) };
  });
}
export function techniqueMoves(order: AtlasOrder, technique: Technique, nailOnly: boolean, start: Pose, directOnly: boolean) {
  const catalog = cache.get(order) ?? buildCatalog(order);
  cache.set(order, catalog);
  const choices: { move: string; methods: LessonMethod[] }[] = [];
  for (const { move, variants } of catalog) {
    const byMethod = new Map<string, LessonMethod>();
    for (const { pose, stroke } of variants) {
      const matches = technique === 'push' ? stroke.push : technique === 'nail' ? stroke.nail
        : stroke.finger === technique || stroke.second === technique;
      // A pad-to-nail finish is useful in the nail collection. The overlay asks
      // specifically for a nail-driven stroke by the selected digit.
      if (!matches || nailOnly && (!stroke.nail || (stroke.rollsToNail && !stroke.marks?.includes('u')) || stroke.finger !== technique)) continue;
      const setup = (['L', 'R'] as const).filter(side => pose[side] !== start[side]).map(side => ({ side, grip: pose[side] }));
      if (directOnly && setup.length) continue;
      const id = [stroke.hand, stroke.finger, stroke.second, stroke.style].join('-');
      const previous = byMethod.get(id);
      if (!previous || setup.length < previous.setup.length || setup.length === previous.setup.length && !previous.marks && stroke.marks)
        byMethod.set(id, { ...stroke, id, move: stroke.push ? move + 'p' : move, pose, setup });
    }
    const methods = [...byMethod.values()].sort((a, b) => a.setup.length - b.setup.length
      || Number(b.style === 'middle-nail-front-wide') - Number(a.style === 'middle-nail-front-wide')
      || Number(!!a.push) - Number(!!b.push) || Number(!!b.marks) - Number(!!a.marks));
    if (methods.length) choices.push({ move: technique === 'push' ? move + 'p' : move, methods });
  }
  return choices.sort((a, b) => a.methods[0].setup.length - b.methods[0].setup.length);
}
