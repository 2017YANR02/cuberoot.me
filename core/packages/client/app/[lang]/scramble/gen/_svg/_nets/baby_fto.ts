/**
 * Baby FTO — 2×2 Face-Turning Octahedron (corners + centers), each face turn order 3.
 *
 * Group-theoretic source (orbits + generators in cycle notation) — the canonical,
 * self-contained definition of this puzzle's scramble-preview model. Derived once
 * from cubing.js by scripts/gen-net.ts and verified equal to cubing.js's KPuzzle
 * over random scrambles (state + every sticker color); cubing.js is NOT a runtime
 * dependency here. A scramble token resolves to a base generator raised to a power
 * (X' = inverse, X2 = square, X-- = (X++)⁻¹); see lib/puzzle-group.
 *
 * Orbits used in the 2D net: corners, centers. Net geometry (polygon
 * coordinates) is plain data, extracted from cubing.js's own SVG net.
 */
import type { PuzzleGroup } from '@/lib/puzzle-group';
import type { PuzzleNet, PuzzleNetDef } from '../_net_render';

export const BABY_FTO_GROUP: PuzzleGroup = {
  orbits: {
    corners: { size: 6, ori: 4 },
    centers: { size: 8, ori: 3 },
  },
  gens: {
    BR: {
      corners: { cycles: [[1,4,2]], twist: { 1: 2, 2: 3, 4: 3 } },
      centers: { cycles: [[3,4,6]] },
    },
    F: {
      corners: { cycles: [[0,3,1]], twist: { 0: 3, 1: 3, 3: 2 } },
      centers: { cycles: [[3,5,4]] },
    },
    L: {
      corners: { cycles: [[0,5,3]], twist: { 0: 2, 3: 3, 5: 3 } },
      centers: { cycles: [[0,7,2]] },
    },
    R: {
      corners: { cycles: [[0,1,2]], twist: { 0: 3, 1: 3, 2: 2 } },
      centers: { cycles: [[0,1,7]] },
    },
    U: {
      corners: { cycles: [[0,2,5]] },
      centers: { cycles: [[3,6,5]] },
    },
  },
};

export const BABY_FTO_NET: PuzzleNet = {
  viewBox: "254 254 1860 708",
  stroke: '#1a1a1a',
  strokeWidth: 7,
  solvedColor: {
    corners: [["#ffffff", "#ee0000", "#44ee00", "#8800dd"], ["#f4f400", "#44ee00", "#ee0000", "#aaaaaa"], ["#ffffff", "#2266ff", "#aaaaaa", "#ee0000"], ["#f4f400", "#ff8000", "#8800dd", "#44ee00"], ["#f4f400", "#aaaaaa", "#2266ff", "#ff8000"], ["#ffffff", "#8800dd", "#ff8000", "#2266ff"]],
    centers: [["#44ee00", "#44ee00", "#44ee00"], ["#aaaaaa", "#aaaaaa", "#aaaaaa"], ["#ff8000", "#ff8000", "#ff8000"], ["#ee0000", "#ee0000", "#ee0000"], ["#f4f400", "#f4f400", "#f4f400"], ["#8800dd", "#8800dd", "#8800dd"], ["#2266ff", "#2266ff", "#2266ff"], ["#ffffff", "#ffffff", "#ffffff"]],
  },
  facelets: [
    { orbit: "corners", piece: 4, orient: 3, pts: "1780,608 1940,448 1940,768" },
    { orbit: "corners", piece: 5, orient: 2, pts: "1940,448 2100,288 2100,608" },
    { orbit: "centers", piece: 2, orient: 0, pts: "2100,608 1940,448 1940,768" },
    { orbit: "corners", piece: 3, orient: 1, pts: "1940,768 2100,608 2100,928" },
    { orbit: "corners", piece: 4, orient: 0, pts: "1760,628 1920,788 1600,788" },
    { orbit: "corners", piece: 3, orient: 0, pts: "1920,788 2080,948 1760,948" },
    { orbit: "centers", piece: 4, orient: 0, pts: "1760,948 1920,788 1600,788" },
    { orbit: "corners", piece: 1, orient: 0, pts: "1600,788 1760,948 1440,948" },
    { orbit: "corners", piece: 4, orient: 1, pts: "1740,608 1580,448 1580,768" },
    { orbit: "corners", piece: 2, orient: 2, pts: "1580,448 1420,288 1420,608" },
    { orbit: "centers", piece: 1, orient: 0, pts: "1420,608 1580,448 1580,768" },
    { orbit: "corners", piece: 1, orient: 3, pts: "1580,768 1420,608 1420,928" },
    { orbit: "corners", piece: 4, orient: 2, pts: "1760,588 1920,428 1600,428" },
    { orbit: "corners", piece: 5, orient: 3, pts: "1920,428 2080,268 1760,268" },
    { orbit: "centers", piece: 6, orient: 0, pts: "1760,268 1920,428 1600,428" },
    { orbit: "corners", piece: 2, orient: 1, pts: "1600,428 1760,268 1440,268" },
    { orbit: "corners", piece: 0, orient: 1, pts: "628,608 788,448 788,768" },
    { orbit: "corners", piece: 2, orient: 3, pts: "788,448 948,288 948,608" },
    { orbit: "centers", piece: 3, orient: 0, pts: "948,608 788,448 788,768" },
    { orbit: "corners", piece: 1, orient: 2, pts: "788,768 948,608 948,928" },
    { orbit: "corners", piece: 0, orient: 2, pts: "608,628 768,788 448,788" },
    { orbit: "corners", piece: 1, orient: 1, pts: "768,788 928,948 608,948" },
    { orbit: "centers", piece: 0, orient: 0, pts: "608,948 768,788 448,788" },
    { orbit: "corners", piece: 3, orient: 3, pts: "448,788 608,948 288,948" },
    { orbit: "corners", piece: 0, orient: 3, pts: "588,608 428,448 428,768" },
    { orbit: "corners", piece: 5, orient: 1, pts: "428,448 268,288 268,608" },
    { orbit: "centers", piece: 5, orient: 0, pts: "268,608 428,448 428,768" },
    { orbit: "corners", piece: 3, orient: 2, pts: "428,768 268,608 268,928" },
    { orbit: "corners", piece: 0, orient: 0, pts: "608,588 768,428 448,428" },
    { orbit: "corners", piece: 2, orient: 0, pts: "768,428 928,268 608,268" },
    { orbit: "centers", piece: 7, orient: 0, pts: "608,268 768,428 448,428" },
    { orbit: "corners", piece: 5, orient: 0, pts: "448,428 608,268 288,268" },
  ],
};

export const BABY_FTO: PuzzleNetDef = { group: BABY_FTO_GROUP, net: BABY_FTO_NET };
