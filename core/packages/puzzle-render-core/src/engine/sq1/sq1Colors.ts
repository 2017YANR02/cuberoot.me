/**
 * Square-1's fixed sticker scheme — the sim's sq1 3D uses THIS, not the user's
 * `faceColors` palette (unlike NxN cubes). Kept THREE-free so the image panel
 * (PuzzleImage → sr-puzzlegen preview) can import it for colour-exact matching
 * without pulling three.js into the client bundle.
 */
export const SQ1_COLORS = {
  L: 0x1f4dff,
  B: 0xff8000,
  R: 0x00b53d,
  F: 0xd0021b,
  U: 0x141414,
  D: 0xf0f0f0,
  BODY: 0x0a0a0a,
} as const;
