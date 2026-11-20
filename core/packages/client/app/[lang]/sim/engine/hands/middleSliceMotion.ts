import { sampleFingerPose } from './markedFingerMotion';
import {
  downRing, backRing, ringPad, relayRing, relayPinky, downApproach, backApproach, padApproach, relayRingApproach,
  padReturn, relayPinkyApproach, relayPinkyReturn, relayGrip,
} from './middleSlicePoses';

export const M_RELAY_SHIFT = { x: 36, y: 34 };
// Contact windows are measured in actual three-layer turn degrees.
export const M_SINGLE = { rollStart: 54, nail: 60, release: 70 } as const;
// The four-layer inner sweep has a different reach.
export const FOUR_INNER_ROLL = { startDegrees: 19, endDegrees: 49 } as const;
type MiddleSliceStyle = 'middleSliceNail' | 'middleSlicePad';
export function isMiddleSliceStroke(style: string | null | undefined): style is MiddleSliceStyle {
  return style === 'middleSliceNail' || style === 'middleSlicePad';
}
function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** Keep the resting pads on the same points of the two fixed outer layers
 * as the palm comes into reach of the second stroke. */
export function middleSliceSupport(finger: 'thumb' | 'index' | 'middle', seat: number): number[] {
  return sampleFingerPose(relayGrip[finger], seat);
}

/** Layer angles drive the two sweeps. Reach and recovery only seat or release the hand. */
export function middleSlicePose(style: MiddleSliceStyle, second: boolean, relay: boolean, degrees: number,
  reach: number, recovery: number, home: readonly number[], order = 3): number[] {
  const single = !relay && order === 3;
  const down = style === 'middleSliceNail';
  const rows = second ? relayPinky : relay ? relayRing : single ? (down ? downRing : backRing) : ringPad;
  const arc = Math.max(0, degrees - (second ? 90 : 0));
  // The tail beyond the quarter turn is played on the existing recovery clock.
  // Continue from the displayed angle so the sticker release and commit join continuously.
  if (single && arc >= M_SINGLE.release && recovery < 1) {
    const start = Math.min(arc, 90);
    return sampleFingerPose(rows, start + (rows[rows.length - 1][0] - start) * (1 - recovery));
  }
  let pose = second && degrees < 90 ? sampleFingerPose(relayPinkyApproach, degrees) : sampleFingerPose(rows, arc);
  if (reach < 1) {
    if (second) {
      pose = pose.map((value, i) => home[i] + smooth(reach) * (value - home[i]));
    } else {
      const preparation = relay ? relayRingApproach : single ? (down ? downApproach : backApproach) : padApproach;
      const approach = sampleFingerPose(preparation, 100 * reach);
      pose = pose.map((value, i) => approach[i] + smooth(reach) * (value - rows[0][i + 1]));
    }
  }
  if (recovery < 1) {
    if (!single && style === 'middleSlicePad' && (second || !relay) && arc > 60) {
      const retreat = second ? relayPinkyReturn : padReturn;
      const next = sampleFingerPose(retreat, 100 * (1 - recovery));
      return next.map((value, i) => value + smooth(recovery) * (pose[i] - retreat[0][i + 1]));
    }
    return pose.map((value, i) => home[i] + smooth(recovery) * (value - home[i]));
  }
  return pose;
}
