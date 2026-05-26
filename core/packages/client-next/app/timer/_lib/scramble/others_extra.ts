/**
 * Extra puzzle scrambles not covered by others.ts.
 *
 *   magic   — Rubik's Magic. cstimer convention: emit "Forward" or "Backward"
 *             for a 4-piece magic puzzle. We just pick one of those words.
 *   mmagic  — Master Magic (8-piece). Same pick, prefixed with "M ".
 *   custom  — empty string; UI lets the user type their own scramble.
 */

const MAGIC_DIRS = ['Forward', 'Backward'] as const;

export function scrambleMagic(rng: () => number): string {
  return MAGIC_DIRS[Math.floor(rng() * MAGIC_DIRS.length)];
}

export function scrambleMmagic(rng: () => number): string {
  return `M ${scrambleMagic(rng)}`;
}

// Underscore-prefixed param so eslint's no-unused-vars accepts it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function scrambleCustom(_rng: () => number): string {
  return '';
}
