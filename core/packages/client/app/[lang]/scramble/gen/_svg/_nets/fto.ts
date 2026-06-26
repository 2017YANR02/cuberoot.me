/**
 * FTO — Face-Turning Octahedron, face-turning group ⟨U,F,L,R,B,BL,BR,D⟩ (each turn order 3).
 *
 * Group-theoretic source (orbits + generators in cycle notation) — the canonical,
 * self-contained definition of this puzzle's scramble-preview model. Derived once
 * from cubing.js by scripts/gen-net.ts and verified equal to cubing.js's KPuzzle
 * over random scrambles (state + every sticker color); cubing.js is NOT a runtime
 * dependency here. A scramble token resolves to a base generator raised to a power
 * (X' = inverse, X2 = square, X-- = (X++)⁻¹); see lib/puzzle-group.
 *
 * Orbits used in the 2D net: corners, edges, centers. Net geometry (polygon
 * coordinates) is plain data, extracted from cubing.js's own SVG net.
 */
import type { PuzzleGroup } from '@/lib/puzzle-group';
import type { PuzzleNet, PuzzleNetDef } from '../_net_render';

export const FTO_GROUP: PuzzleGroup = {
  orbits: {
    corners: { size: 6, ori: 4 },
    edges: { size: 12, ori: 2 },
    centers: { size: 24, ori: 1 },
  },
  gens: {
    B: {
      corners: { cycles: [[3,5,4]], twist: { 3: 2, 4: 3, 5: 3 } },
      edges: { cycles: [[2,9,8]] },
      centers: { cycles: [[2,16,22], [10,13,12], [15,19,23]] },
    },
    BL: {
      corners: { cycles: [[0,3,4]], twist: { 0: 3, 3: 3, 4: 2 } },
      edges: { cycles: [[3,7,9]] },
      centers: { cycles: [[3,19,16], [8,9,12], [13,17,18]] },
    },
    BR: {
      corners: { cycles: [[2,4,5]], twist: { 2: 2, 4: 3, 5: 3 } },
      edges: { cycles: [[2,4,5]] },
      centers: { cycles: [[2,4,15], [5,6,13], [8,10,11]] },
    },
    D: {
      corners: { cycles: [[0,4,2]] },
      edges: { cycles: [[1,3,5]] },
      centers: { cycles: [[1,3,15], [4,14,16], [6,17,8]] },
    },
    F: {
      corners: { cycles: [[0,2,1]], twist: { 0: 2, 1: 3, 2: 3 } },
      edges: { cycles: [[0,10,1]] },
      centers: { cycles: [[0,14,1], [6,7,9], [11,21,17]] },
    },
    L: {
      corners: { cycles: [[0,1,3]], twist: { 0: 3, 1: 2, 3: 3 } },
      edges: { cycles: [[7,10,11]] },
      centers: { cycles: [[0,22,3], [9,21,18], [14,20,19]] },
    },
    R: {
      corners: { cycles: [[1,2,5]], twist: { 1: 3, 2: 3, 5: 2 } },
      edges: { cycles: [[0,4,6]] },
      centers: { cycles: [[0,4,23], [1,2,20], [5,7,11]] },
    },
    U: {
      corners: { cycles: [[1,5,3]] },
      edges: { cycles: [[6,8,11]] },
      centers: { cycles: [[5,12,21], [7,10,18], [20,23,22]] },
    },
  },
};

export const FTO_NET: PuzzleNet = {
  viewBox: "70 70 2228 1076",
  stroke: '#1a1a1a',
  strokeWidth: 9,
  solvedColor: {
    corners: [["#f4f400", "#ff8000", "#8800dd", "#44ee00"], ["#ffffff", "#ee0000", "#44ee00", "#8800dd"], ["#f4f400", "#44ee00", "#ee0000", "#aaaaaa"], ["#ffffff", "#8800dd", "#ff8000", "#2266ff"], ["#f4f400", "#aaaaaa", "#2266ff", "#ff8000"], ["#ffffff", "#2266ff", "#aaaaaa", "#ee0000"]],
    edges: [["#44ee00", "#ee0000"], ["#44ee00", "#f4f400"], ["#aaaaaa", "#2266ff"], ["#ff8000", "#f4f400"], ["#aaaaaa", "#ee0000"], ["#aaaaaa", "#f4f400"], ["#ffffff", "#ee0000"], ["#ff8000", "#8800dd"], ["#ffffff", "#2266ff"], ["#ff8000", "#2266ff"], ["#44ee00", "#8800dd"], ["#ffffff", "#8800dd"]],
    centers: [["#44ee00"], ["#44ee00"], ["#aaaaaa"], ["#ff8000"], ["#aaaaaa"], ["#ee0000"], ["#f4f400"], ["#ee0000"], ["#f4f400"], ["#8800dd"], ["#2266ff"], ["#ee0000"], ["#2266ff"], ["#2266ff"], ["#44ee00"], ["#aaaaaa"], ["#ff8000"], ["#f4f400"], ["#8800dd"], ["#ff8000"], ["#ffffff"], ["#8800dd"], ["#ffffff"], ["#ffffff"]],
  },
  facelets: [
    { orbit: "corners", piece: 4, orient: 3, pts: "1800,608 1960,448 1960,768" },
    { orbit: "edges", piece: 9, orient: 0, pts: "1960,448 2120,288 2120,608" },
    { orbit: "centers", piece: 16, orient: 0, pts: "2120,608 1960,448 1960,768" },
    { orbit: "edges", piece: 3, orient: 0, pts: "1960,768 2120,608 2120,928" },
    { orbit: "corners", piece: 3, orient: 2, pts: "2120,288 2280,128 2280,448" },
    { orbit: "centers", piece: 19, orient: 0, pts: "2280,448 2120,288 2120,608" },
    { orbit: "edges", piece: 7, orient: 0, pts: "2120,608 2280,448 2280,768" },
    { orbit: "centers", piece: 3, orient: 0, pts: "2280,768 2120,608 2120,928" },
    { orbit: "corners", piece: 0, orient: 1, pts: "2120,928 2280,768 2280,1088" },
    { orbit: "corners", piece: 4, orient: 0, pts: "1760,648 1920,808 1600,808" },
    { orbit: "edges", piece: 3, orient: 1, pts: "1920,808 2080,968 1760,968" },
    { orbit: "centers", piece: 8, orient: 0, pts: "1760,968 1920,808 1600,808" },
    { orbit: "edges", piece: 5, orient: 1, pts: "1600,808 1760,968 1440,968" },
    { orbit: "corners", piece: 0, orient: 0, pts: "2080,968 2240,1128 1920,1128" },
    { orbit: "centers", piece: 17, orient: 0, pts: "1920,1128 2080,968 1760,968" },
    { orbit: "edges", piece: 1, orient: 1, pts: "1760,968 1920,1128 1600,1128" },
    { orbit: "centers", piece: 6, orient: 0, pts: "1600,1128 1760,968 1440,968" },
    { orbit: "corners", piece: 2, orient: 0, pts: "1440,968 1600,1128 1280,1128" },
    { orbit: "corners", piece: 4, orient: 1, pts: "1720,608 1560,448 1560,768" },
    { orbit: "edges", piece: 2, orient: 0, pts: "1560,448 1400,288 1400,608" },
    { orbit: "centers", piece: 15, orient: 0, pts: "1400,608 1560,448 1560,768" },
    { orbit: "edges", piece: 5, orient: 0, pts: "1560,768 1400,608 1400,928" },
    { orbit: "corners", piece: 5, orient: 2, pts: "1400,288 1240,128 1240,448" },
    { orbit: "centers", piece: 2, orient: 0, pts: "1240,448 1400,288 1400,608" },
    { orbit: "edges", piece: 4, orient: 0, pts: "1400,608 1240,448 1240,768" },
    { orbit: "centers", piece: 4, orient: 0, pts: "1240,768 1400,608 1400,928" },
    { orbit: "corners", piece: 2, orient: 3, pts: "1400,928 1240,768 1240,1088" },
    { orbit: "corners", piece: 4, orient: 2, pts: "1760,568 1920,408 1600,408" },
    { orbit: "edges", piece: 9, orient: 1, pts: "1920,408 2080,248 1760,248" },
    { orbit: "centers", piece: 13, orient: 0, pts: "1760,248 1920,408 1600,408" },
    { orbit: "edges", piece: 2, orient: 1, pts: "1600,408 1760,248 1440,248" },
    { orbit: "corners", piece: 3, orient: 3, pts: "2080,248 2240,88 1920,88" },
    { orbit: "centers", piece: 12, orient: 0, pts: "1920,88 2080,248 1760,248" },
    { orbit: "edges", piece: 8, orient: 1, pts: "1760,248 1920,88 1600,88" },
    { orbit: "centers", piece: 10, orient: 0, pts: "1600,88 1760,248 1440,248" },
    { orbit: "corners", piece: 5, orient: 1, pts: "1440,248 1600,88 1280,88" },
    { orbit: "corners", piece: 1, orient: 1, pts: "648,608 808,448 808,768" },
    { orbit: "edges", piece: 6, orient: 1, pts: "808,448 968,288 968,608" },
    { orbit: "centers", piece: 7, orient: 0, pts: "968,608 808,448 808,768" },
    { orbit: "edges", piece: 0, orient: 1, pts: "808,768 968,608 968,928" },
    { orbit: "corners", piece: 5, orient: 3, pts: "968,288 1128,128 1128,448" },
    { orbit: "centers", piece: 5, orient: 0, pts: "1128,448 968,288 968,608" },
    { orbit: "edges", piece: 4, orient: 1, pts: "968,608 1128,448 1128,768" },
    { orbit: "centers", piece: 11, orient: 0, pts: "1128,768 968,608 968,928" },
    { orbit: "corners", piece: 2, orient: 2, pts: "968,928 1128,768 1128,1088" },
    { orbit: "corners", piece: 1, orient: 2, pts: "608,648 768,808 448,808" },
    { orbit: "edges", piece: 0, orient: 0, pts: "768,808 928,968 608,968" },
    { orbit: "centers", piece: 0, orient: 0, pts: "608,968 768,808 448,808" },
    { orbit: "edges", piece: 10, orient: 0, pts: "448,808 608,968 288,968" },
    { orbit: "corners", piece: 2, orient: 1, pts: "928,968 1088,1128 768,1128" },
    { orbit: "centers", piece: 1, orient: 0, pts: "768,1128 928,968 608,968" },
    { orbit: "edges", piece: 1, orient: 0, pts: "608,968 768,1128 448,1128" },
    { orbit: "centers", piece: 14, orient: 0, pts: "448,1128 608,968 288,968" },
    { orbit: "corners", piece: 0, orient: 3, pts: "288,968 448,1128 128,1128" },
    { orbit: "corners", piece: 1, orient: 3, pts: "568,608 408,448 408,768" },
    { orbit: "edges", piece: 11, orient: 1, pts: "408,448 248,288 248,608" },
    { orbit: "centers", piece: 21, orient: 0, pts: "248,608 408,448 408,768" },
    { orbit: "edges", piece: 10, orient: 1, pts: "408,768 248,608 248,928" },
    { orbit: "corners", piece: 3, orient: 1, pts: "248,288 88,128 88,448" },
    { orbit: "centers", piece: 18, orient: 0, pts: "88,448 248,288 248,608" },
    { orbit: "edges", piece: 7, orient: 1, pts: "248,608 88,448 88,768" },
    { orbit: "centers", piece: 9, orient: 0, pts: "88,768 248,608 248,928" },
    { orbit: "corners", piece: 0, orient: 2, pts: "248,928 88,768 88,1088" },
    { orbit: "corners", piece: 1, orient: 0, pts: "608,568 768,408 448,408" },
    { orbit: "edges", piece: 6, orient: 0, pts: "768,408 928,248 608,248" },
    { orbit: "centers", piece: 20, orient: 0, pts: "608,248 768,408 448,408" },
    { orbit: "edges", piece: 11, orient: 0, pts: "448,408 608,248 288,248" },
    { orbit: "corners", piece: 5, orient: 0, pts: "928,248 1088,88 768,88" },
    { orbit: "centers", piece: 23, orient: 0, pts: "768,88 928,248 608,248" },
    { orbit: "edges", piece: 8, orient: 0, pts: "608,248 768,88 448,88" },
    { orbit: "centers", piece: 22, orient: 0, pts: "448,88 608,248 288,248" },
    { orbit: "corners", piece: 3, orient: 0, pts: "288,248 448,88 128,88" },
  ],
};

export const FTO: PuzzleNetDef = { group: FTO_GROUP, net: FTO_NET };
