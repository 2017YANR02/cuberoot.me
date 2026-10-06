import { simulateNxN } from '@cuberoot/shared/nnn-sim';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { cube222StateFlagsOfScramble } from '@cuberoot/puzzle-solvers/cube222';

/** Each face is row-major. Only shared edges count; diagonals and other faces do not. */
export function hasNoAdjacentColors(stickers: ArrayLike<number>, size: number): boolean {
  if (stickers.length !== 6 * size * size) throw new Error('Invalid sticker count');
  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const i = face * size * size + row * size + col;
        if (col + 1 < size && stickers[i] === stickers[i + 1]) return false;
        if (row + 1 < size && stickers[i] === stickers[i + size]) return false;
      }
    }
  }
  return true;
}

export function isNoBarScramble(scramble: string, size: 2 | 3): boolean {
  if (!scramble.trim()) throw new Error('Empty scramble');
  if (size === 2) {
    // The timer and the existing WCA 222_types.csv already use this classifier.
    const flags = cube222StateFlagsOfScramble(scramble);
    if (!flags) throw new Error(`Invalid 2x2 scramble: ${scramble}`);
    return flags.nobar;
  }
  // Preserve wide-turn effects (BLD) and FMC moves; remove only the final reference-frame rotation.
  const normalized = normalizeWcaScramble(scramble);
  if (normalized === null) throw new Error(`Invalid 3x3 scramble: ${scramble}`);
  return hasNoAdjacentColors(simulateNxN(3, normalized), 3);
}
