import { practiceState, practiceTargetStates } from '../../lib/practice-state';

// Track actual sticker identities, independently of rendering colors and masks.
// All lower-layer stickers and centers are protected; the last layer is unrestricted.
const goalStickers = Array.from({ length: 54 }, (_, i) => {
  const face = Math.floor(i / 9), position = i % 9;
  return position === 4 || face === 3 || (face !== 0 && position >= 3) ? String(i) : '-';
});
const solvedStates = practiceTargetStates(goalStickers, '');

export function isF2lPracticeSolved(alg: string): boolean {
  return solvedStates.has(practiceState(goalStickers, alg));
}
