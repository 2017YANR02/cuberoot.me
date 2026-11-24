import { sampleFingerPose } from './markedFingerMotion';
import {
  markedRingNail, markedRingApproach, downRing, backRing, ringPad, relayRing, relayPinky, downApproach, backApproach, padApproach, relayRingApproach,
  padReturn, relayPinkyApproach, relayPinkyReturn, relayGrip,
} from './middleSlicePoses';

export const M_RELAY_SHIFT = { x: 36, y: 34 };
// Contact windows are measured in actual three-layer turn degrees.
export const M_SINGLE = { rollStart: 54, nail: 60, release: 70 } as const;
// The four-layer inner sweep has a different reach.
export const FOUR_INNER_ROLL = { startDegrees: 19, endDegrees: 49 } as const;
export const MARKED_M_RELEASE = 42;
type MiddleSliceStyle = 'markedRingNail' | 'middleSliceNail' | 'middleSlicePad';
export function isMiddleSliceStroke(style: string | null | undefined): style is MiddleSliceStyle {
  return style === 'markedRingNail' || style === 'middleSliceNail' || style === 'middleSlicePad';
}
function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

// Normalized time and layer angle at changes in the calibrated single-M
// stroke. Allocate time to both layer travel and ring-joint travel so the
// short pad-to-nail roll gets enough frames within the same formula beat.
const singleTiming = {
  threeDown: [[0, 0], [.088, 2.25], [.176, 6.25], [.213, 11.25], [.3, 26.5], [.392, 31.25], [.476, 37.75], [.554, 49], [.655, 56], [.749, 65.5], [.8, 69], [.85, 71], [.919, 79], [1, 90]],
  threeBack: [[0, 0], [.059, 2.75], [.122, 7.5], [.203, 20.25], [.287, 29.75], [.4, 35.25], [.584, 39.5], [.72, 47], [.812, 63], [.925, 78], [1, 90]],
  fourDown: [[0, 0], [.208, 40.25], [.307, 52], [.355, 54.5], [.53, 59], [.571, 61], [.604, 63.75], [.675, 74.5], [.765, 84.25], [.959, 88], [1, 90]],
  fourBack: [[0, 0], [.192, 6.25], [.282, 15.5], [.356, 26.25], [.399, 29.5], [.644, 36], [.694, 39], [.788, 49.75], [1, 90]],
} as const;

// The ring and little finger cover different distances per layer degree.
// Give the nail roll and the handoff time within the original half-turn beat.
const relayTiming = [
  [0.0, 0], [0.01358, 4], [0.02598, 8], [0.04403, 12], [0.07016, 16], [0.11615, 20],
  [0.16871, 24], [0.19351, 28], [0.2102, 32], [0.22459, 36], [0.23896, 40], [0.26971, 44],
  [0.32754, 48], [0.37901, 52], [0.41145, 56], [0.43011, 60], [0.44693, 64], [0.46381, 68],
  [0.48213, 72], [0.49906, 76], [0.51399, 80], [0.53002, 84], [0.54604, 88], [0.58346, 92],
  [0.65249, 96], [0.693, 100], [0.71805, 104], [0.7416, 108], [0.76044, 112], [0.77505, 116],
  [0.78833, 120], [0.8011, 124], [0.81362, 128], [0.83292, 132], [0.85545, 136], [0.87617, 140],
  [0.88737, 144], [0.90131, 148], [0.91414, 152], [0.92462, 156], [0.93631, 160], [0.95022, 164],
  [0.96689, 168], [0.98123, 172], [0.99145, 176], [1.0, 180],
] as const;

export function middleSliceTiming(order: number, direction: number, relay = false): (progress: number) => number {
  const curve = relay ? relayTiming : order === 3 ? direction > 0 ? singleTiming.threeBack : singleTiming.threeDown
    : direction > 0 ? singleTiming.fourBack : singleTiming.fourDown;
  return progress => {
    const t = relay ? progress : smooth(progress);
    for (let i = 1; i < curve.length; i++) {
      const [end, angle] = curve[i];
      if (t <= end) {
        const [start, previous] = curve[i - 1];
        return (previous + (angle - previous) * ((t - start) / (end - start))) / (relay ? 180 : 90);
      }
    }
    return 1;
  };
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
  const down = style === 'middleSliceNail', marked = style === 'markedRingNail';
  const rows = marked ? markedRingNail : second ? relayPinky : relay ? relayRing : single ? (down ? downRing : backRing) : ringPad;
  const arc = Math.max(0, degrees - (second ? 90 : 0));
  // The tail beyond the quarter turn is played on the existing recovery clock.
  // Continue from the displayed angle so the sticker release and commit join continuously.
  if (single && !marked && arc >= M_SINGLE.release && recovery < 1) {
    const start = Math.min(arc, 90);
    return sampleFingerPose(rows, start + (rows[rows.length - 1][0] - start) * (1 - recovery));
  }
  let pose = second && degrees < 90 ? sampleFingerPose(relayPinkyApproach, degrees) : sampleFingerPose(rows, arc);
  if (reach < 1) {
    if (second) {
      pose = pose.map((value, i) => home[i] + smooth(reach) * (value - home[i]));
    } else {
      const preparation = marked ? markedRingApproach : relay ? relayRingApproach : single ? (down ? downApproach : backApproach) : padApproach;
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
