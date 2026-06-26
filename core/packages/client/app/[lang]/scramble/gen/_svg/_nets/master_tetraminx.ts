/**
 * Master Tetraminx — 4-layer face-turning tetrahedron (order-3 face + wide turns).
 *
 * Group-theoretic source (orbits + generators in cycle notation) — the canonical,
 * self-contained definition of this puzzle's scramble-preview model. Derived once
 * from cubing.js by scripts/gen-net.ts and verified equal to cubing.js's KPuzzle
 * over random scrambles (state + every sticker color); cubing.js is NOT a runtime
 * dependency here. A scramble token resolves to a base generator raised to a power
 * (X' = inverse, X2 = square, X-- = (X++)⁻¹); see lib/puzzle-group.
 *
 * Orbits used in the 2D net: edges, wings, corners, centers. Net geometry (polygon
 * coordinates) is plain data, extracted from cubing.js's own SVG net.
 */
import type { PuzzleGroup } from '@/lib/puzzle-group';
import type { PuzzleNet, PuzzleNetDef } from '../_net_render';

export const MASTER_TETRAMINX_GROUP: PuzzleGroup = {
  orbits: {
    edges: { size: 12, ori: 2 },
    wings: { size: 6, ori: 2 },
    corners: { size: 4, ori: 3 },
    centers: { size: 4, ori: 3 },
  },
  gens: {
    B: {
      edges: { cycles: [[1,5,10]], twist: { 1: 1, 10: 1 } },
      corners: { cycles: [], twist: { 1: 1 } },
    },
    L: {
      edges: { cycles: [[3,6,8]], twist: { 3: 1, 8: 1 } },
      corners: { cycles: [], twist: { 3: 1 } },
    },
    R: {
      edges: { cycles: [[2,7,11]] },
      corners: { cycles: [], twist: { 2: 1 } },
    },
    U: {
      edges: { cycles: [[0,9,4]] },
      corners: { cycles: [], twist: { 0: 1 } },
    },
    b: {
      edges: { cycles: [[1,5,10], [4,7,8]], twist: { 1: 1, 4: 1, 8: 1, 10: 1 } },
      wings: { cycles: [[1,3,4]], twist: { 1: 1, 4: 1 } },
      corners: { cycles: [], twist: { 1: 1 } },
      centers: { cycles: [[1,2,3]], twist: { 1: 2, 2: 2, 3: 2 } },
    },
    l: {
      edges: { cycles: [[0,10,2], [3,6,8]], twist: { 2: 1, 3: 1, 8: 1, 10: 1 } },
      wings: { cycles: [[0,4,2]], twist: { 2: 1, 4: 1 } },
      corners: { cycles: [], twist: { 3: 1 } },
      centers: { cycles: [[0,3,2]], twist: { 0: 2, 2: 2, 3: 2 } },
    },
    r: {
      edges: { cycles: [[2,7,11], [3,5,9]] },
      wings: { cycles: [[2,3,5]] },
      corners: { cycles: [], twist: { 2: 1 } },
      centers: { cycles: [[0,2,1]], twist: { 0: 2, 1: 2, 2: 2 } },
    },
    u: {
      edges: { cycles: [[0,9,4], [1,6,11]] },
      wings: { cycles: [[0,5,1]] },
      corners: { cycles: [], twist: { 0: 1 } },
      centers: { cycles: [[0,1,3]], twist: { 0: 2, 1: 2, 3: 2 } },
    },
  },
};

export const MASTER_TETRAMINX_NET: PuzzleNet = {
  viewBox: "129.96 12.4 540.09 468.8",
  stroke: '#1a1a1a',
  strokeWidth: 2,
  solvedColor: {
    edges: [["#ff0000", "#44ee00"], ["#2266ff", "#ff0000"], ["#f4f400", "#44ee00"], ["#f4f400", "#44ee00"], ["#2266ff", "#ff0000"], ["#2266ff", "#f4f400"], ["#ff0000", "#44ee00"], ["#2266ff", "#f4f400"], ["#f4f400", "#ff0000"], ["#44ee00", "#2266ff"], ["#f4f400", "#ff0000"], ["#44ee00", "#2266ff"]],
    wings: [["#ff0000", "#44ee00"], ["#2266ff", "#ff0000"], ["#f4f400", "#44ee00"], ["#2266ff", "#f4f400"], ["#f4f400", "#ff0000"], ["#44ee00", "#2266ff"]],
    corners: [["#44ee00", "#ff0000", "#2266ff"], ["#f4f400", "#2266ff", "#ff0000"], ["#f4f400", "#44ee00", "#2266ff"], ["#f4f400", "#ff0000", "#44ee00"]],
    centers: [["#44ee00", "#44ee00", "#44ee00"], ["#2266ff", "#2266ff", "#2266ff"], ["#f4f400", "#f4f400", "#f4f400"], ["#ff0000", "#ff0000", "#ff0000"]],
  },
  facelets: [
    { orbit: "edges", piece: 0, orient: 1, pts: "336.26,133.2 368.13,78 400,133.2" },
    { orbit: "wings", piece: 0, orient: 1, pts: "368.13,188.4 336.26,133.2 400,133.2" },
    { orbit: "edges", piece: 6, orient: 1, pts: "304.39,188.4 336.26,133.2 368.13,188.4" },
    { orbit: "corners", piece: 0, orient: 0, pts: "368.13,78 400,22.8 431.87,78 400,133.2" },
    { orbit: "corners", piece: 3, orient: 2, pts: "336.26,243.6 272.52,243.6 304.39,188.4 368.13,188.4" },
    { orbit: "edges", piece: 2, orient: 1, pts: "463.74,243.6 400,243.6 431.87,188.4" },
    { orbit: "wings", piece: 2, orient: 1, pts: "431.87,188.4 400,243.6 368.13,188.4" },
    { orbit: "edges", piece: 3, orient: 1, pts: "400,243.6 336.26,243.6 368.13,188.4" },
    { orbit: "corners", piece: 2, orient: 1, pts: "495.61,188.4 527.48,243.6 463.74,243.6 431.87,188.4" },
    { orbit: "edges", piece: 9, orient: 0, pts: "431.87,78 463.74,133.2 400,133.2" },
    { orbit: "wings", piece: 5, orient: 0, pts: "400,133.2 463.74,133.2 431.87,188.4" },
    { orbit: "edges", piece: 11, orient: 0, pts: "463.74,133.2 495.61,188.4 431.87,188.4" },
    { orbit: "centers", piece: 0, orient: 0, pts: "368.13,188.4 400,133.2 431.87,188.4" },
    { orbit: "centers", piece: 0, orient: 1, pts: "368.13,188.4 400,133.2 431.87,188.4" },
    { orbit: "centers", piece: 0, orient: 2, pts: "368.13,188.4 400,133.2 431.87,188.4" },
    { orbit: "edges", piece: 2, orient: 0, pts: "400,256.4 463.74,256.4 431.87,311.6" },
    { orbit: "wings", piece: 2, orient: 0, pts: "368.13,311.6 400,256.4 431.87,311.6" },
    { orbit: "edges", piece: 3, orient: 0, pts: "336.26,256.4 400,256.4 368.13,311.6" },
    { orbit: "corners", piece: 2, orient: 0, pts: "463.74,256.4 527.48,256.4 495.61,311.6 431.87,311.6" },
    { orbit: "corners", piece: 3, orient: 0, pts: "304.39,311.6 272.52,256.4 336.26,256.4 368.13,311.6" },
    { orbit: "edges", piece: 10, orient: 0, pts: "368.13,422 336.26,366.8 400,366.8" },
    { orbit: "wings", piece: 4, orient: 0, pts: "400,366.8 336.26,366.8 368.13,311.6" },
    { orbit: "edges", piece: 8, orient: 0, pts: "336.26,366.8 304.39,311.6 368.13,311.6" },
    { orbit: "corners", piece: 1, orient: 0, pts: "431.87,422 400,477.2 368.13,422 400,366.8" },
    { orbit: "edges", piece: 7, orient: 1, pts: "495.61,311.6 463.74,366.8 431.87,311.6" },
    { orbit: "wings", piece: 3, orient: 1, pts: "431.87,311.6 463.74,366.8 400,366.8" },
    { orbit: "edges", piece: 5, orient: 1, pts: "463.74,366.8 431.87,422 400,366.8" },
    { orbit: "centers", piece: 2, orient: 0, pts: "431.87,311.6 400,366.8 368.13,311.6" },
    { orbit: "centers", piece: 2, orient: 1, pts: "431.87,311.6 400,366.8 368.13,311.6" },
    { orbit: "centers", piece: 2, orient: 2, pts: "431.87,311.6 400,366.8 368.13,311.6" },
    { orbit: "edges", piece: 6, orient: 0, pts: "325.18,126.8 293.31,182 261.44,126.8" },
    { orbit: "wings", piece: 0, orient: 0, pts: "293.31,71.6 325.18,126.8 261.44,126.8" },
    { orbit: "edges", piece: 0, orient: 0, pts: "357.05,71.6 325.18,126.8 293.31,71.6" },
    { orbit: "corners", piece: 3, orient: 1, pts: "293.31,182 261.44,237.2 229.57,182 261.44,126.8" },
    { orbit: "corners", piece: 0, orient: 1, pts: "325.18,16.4 388.91,16.4 357.05,71.6 293.31,71.6" },
    { orbit: "edges", piece: 1, orient: 1, pts: "197.7,16.4 261.44,16.4 229.57,71.6" },
    { orbit: "wings", piece: 1, orient: 1, pts: "229.57,71.6 261.44,16.4 293.31,71.6" },
    { orbit: "edges", piece: 4, orient: 1, pts: "261.44,16.4 325.18,16.4 293.31,71.6" },
    { orbit: "corners", piece: 1, orient: 2, pts: "165.83,71.6 133.96,16.4 197.7,16.4 229.57,71.6" },
    { orbit: "edges", piece: 8, orient: 1, pts: "229.57,182 197.7,126.8 261.44,126.8" },
    { orbit: "wings", piece: 4, orient: 1, pts: "261.44,126.8 197.7,126.8 229.57,71.6" },
    { orbit: "edges", piece: 10, orient: 1, pts: "197.7,126.8 165.83,71.6 229.57,71.6" },
    { orbit: "centers", piece: 3, orient: 0, pts: "293.31,71.6 261.44,126.8 229.57,71.6" },
    { orbit: "centers", piece: 3, orient: 1, pts: "293.31,71.6 261.44,126.8 229.57,71.6" },
    { orbit: "centers", piece: 3, orient: 2, pts: "293.31,71.6 261.44,126.8 229.57,71.6" },
    { orbit: "edges", piece: 9, orient: 1, pts: "474.82,126.8 442.95,71.6 506.69,71.6" },
    { orbit: "wings", piece: 5, orient: 1, pts: "538.56,126.8 474.82,126.8 506.69,71.6" },
    { orbit: "edges", piece: 11, orient: 1, pts: "506.69,182 474.82,126.8 538.56,126.8" },
    { orbit: "corners", piece: 0, orient: 2, pts: "442.95,71.6 411.09,16.4 474.82,16.4 506.69,71.6" },
    { orbit: "corners", piece: 2, orient: 2, pts: "570.43,182 538.56,237.2 506.69,182 538.56,126.8" },
    { orbit: "edges", piece: 5, orient: 0, pts: "634.17,71.6 602.3,126.8 570.43,71.6" },
    { orbit: "wings", piece: 3, orient: 0, pts: "570.43,71.6 602.3,126.8 538.56,126.8" },
    { orbit: "edges", piece: 7, orient: 0, pts: "602.3,126.8 570.43,182 538.56,126.8" },
    { orbit: "corners", piece: 1, orient: 1, pts: "602.3,16.4 666.04,16.4 634.17,71.6 570.43,71.6" },
    { orbit: "edges", piece: 4, orient: 0, pts: "474.82,16.4 538.56,16.4 506.69,71.6" },
    { orbit: "wings", piece: 1, orient: 0, pts: "506.69,71.6 538.56,16.4 570.43,71.6" },
    { orbit: "edges", piece: 1, orient: 0, pts: "538.56,16.4 602.3,16.4 570.43,71.6" },
    { orbit: "centers", piece: 1, orient: 0, pts: "570.43,71.6 538.56,126.8 506.69,71.6" },
    { orbit: "centers", piece: 1, orient: 1, pts: "570.43,71.6 538.56,126.8 506.69,71.6" },
    { orbit: "centers", piece: 1, orient: 2, pts: "570.43,71.6 538.56,126.8 506.69,71.6" },
  ],
};

export const MASTER_TETRAMINX: PuzzleNetDef = { group: MASTER_TETRAMINX_GROUP, net: MASTER_TETRAMINX_NET };
