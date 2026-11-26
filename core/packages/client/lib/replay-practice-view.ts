import { relabelYMoveString } from '@cuberoot/shared/alg-notation';
import { compactCubeRotations } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import type { F2lSlotId } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { reviewSlotYaw } from '@cuberoot/timer-ui/reconstruct/replay-view';

export function practiceSlot(value: unknown): F2lSlotId | undefined {
  if (value === 'FR' || value === 'FL' || value === 'BR' || value === 'BL') return value;
}

export function scopedPracticeSlot(scope: string) {
  try {
    const stage = JSON.parse(scope)?.[1];
    return typeof stage === 'string' && stage.startsWith('slot-') ? practiceSlot(stage.slice(5)) : undefined;
  } catch { return undefined; }
}

// Library pairs are set up for FR. Conjugate the whole line so the same case
// lands in its recorded slot while the six centres keep their original colours.
export function inPracticeSlot(line: string, slot?: F2lSlotId) {
  if (!line || !slot || slot === 'FR') return line;
  const yaw = reviewSlotYaw[slot];
  const back = yaw === 'y' ? "y'" : yaw === "y'" ? 'y' : yaw;
  try {
    return relabelYMoveString(line, yaw === "y'" ? 1 : yaw === 'y' ? -1 : 2);
  } catch {
    return [yaw, line, back].join(' ');
  }
}

// Translate a written route into the grip shown by the review camera.
export function inViewerGrip(line: string, slot?: F2lSlotId) {
  if (!slot || slot === 'FR') return line;
  const yaw = reviewSlotYaw[slot];
  try {
    return relabelYMoveString(line, yaw === 'y' ? 1 : yaw === "y'" ? -1 : 2);
  } catch {
    return undefined;
  }
}

// The player starts white-up and includes its own colour rotation. A trainer
// scramble is read holding white down already; remove only that initial frame.
export function whiteBottomScramble(reviewSetup: string) {
  const lead = reviewSetup.match(/^(?:[xyz](?:2'?|'?)(?:\s+|$))+/)?.[0] ?? '';
  return [compactCubeRotations('z2 ' + lead), reviewSetup.slice(lead.length)].filter(Boolean).join(' ');
}
