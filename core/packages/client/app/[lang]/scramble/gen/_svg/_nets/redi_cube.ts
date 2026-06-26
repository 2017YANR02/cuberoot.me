/**
 * Redi Cube — corner-turning cube ⟨U,D,F,L,B,UR,UL⟩.
 *
 * Group-theoretic source (orbits + generators in cycle notation) — the canonical,
 * self-contained definition of this puzzle's scramble-preview model. Derived once
 * from cubing.js by scripts/gen-net.ts and verified equal to cubing.js's KPuzzle
 * over random scrambles (state + every sticker color); cubing.js is NOT a runtime
 * dependency here. A scramble token resolves to a base generator raised to a power
 * (X' = inverse, X2 = square, X-- = (X++)⁻¹); see lib/puzzle-group.
 *
 * Orbits used in the 2D net: corners, edges. Net geometry (polygon
 * coordinates) is plain data, extracted from cubing.js's own SVG net.
 */
import type { PuzzleGroup } from '@/lib/puzzle-group';
import type { PuzzleNet, PuzzleNetDef } from '../_net_render';

export const REDI_CUBE_GROUP: PuzzleGroup = {
  orbits: {
    corners: { size: 8, ori: 3 },
    edges: { size: 12, ori: 2 },
  },
  gens: {
    B: {
      corners: { cycles: [], twist: { 6: 1 } },
      edges: { cycles: [[6,7,11]], twist: { 6: 1, 7: 1 } },
    },
    D: {
      corners: { cycles: [], twist: { 4: 1 } },
      edges: { cycles: [[4,5,8]], twist: { 4: 1, 5: 1 } },
    },
    F: {
      corners: { cycles: [], twist: { 0: 1 } },
      edges: { cycles: [[0,8,1]], twist: { 1: 1, 8: 1 } },
    },
    L: {
      corners: { cycles: [], twist: { 5: 1 } },
      edges: { cycles: [[4,9,7]], twist: { 7: 1, 9: 1 } },
    },
    R: {
      corners: { cycles: [], twist: { 7: 1 } },
      edges: { cycles: [[5,6,10]], twist: { 5: 1, 10: 1 } },
    },
    U: {
      corners: { cycles: [], twist: { 2: 1 } },
      edges: { cycles: [[2,11,3]], twist: { 3: 1, 11: 1 } },
    },
    UL: {
      corners: { cycles: [], twist: { 3: 1 } },
      edges: { cycles: [[0,3,9]], twist: { 0: 1, 3: 1 } },
    },
    UR: {
      corners: { cycles: [], twist: { 1: 1 } },
      edges: { cycles: [[1,10,2]], twist: { 1: 1, 2: 1 } },
    },
  },
};

export const REDI_CUBE_NET: PuzzleNet = {
  viewBox: "-4 -4 512 384",
  stroke: '#1a1a1a',
  strokeWidth: 2,
  solvedColor: {
    corners: [["#ffffff", "#ff0000", "#32cd32"], ["#ffffff", "#2266ff", "#ff0000"], ["#ffffff", "#ffa500", "#2266ff"], ["#ffffff", "#32cd32", "#ffa500"], ["#ffff00", "#32cd32", "#ff0000"], ["#ffff00", "#ffa500", "#32cd32"], ["#ffff00", "#2266ff", "#ffa500"], ["#ffff00", "#ff0000", "#2266ff"]],
    edges: [["#ffffff", "#32cd32"], ["#ffffff", "#ff0000"], ["#ffffff", "#2266ff"], ["#ffffff", "#ffa500"], ["#ffff00", "#32cd32"], ["#ffff00", "#ff0000"], ["#ffff00", "#2266ff"], ["#ffff00", "#ffa500"], ["#32cd32", "#ff0000"], ["#32cd32", "#ffa500"], ["#2266ff", "#ff0000"], ["#2266ff", "#ffa500"]],
  },
  facelets: [
    { orbit: "corners", piece: 0, orient: 0, pts: "208,80 248,80 248,120 208,120" },
    { orbit: "corners", piece: 0, orient: 1, pts: "256,128 296,128 296,168 256,168" },
    { orbit: "corners", piece: 0, orient: 2, pts: "208,128 248,128 248,168 208,168" },
    { orbit: "corners", piece: 1, orient: 0, pts: "208,0 248,0 248,40 208,40" },
    { orbit: "corners", piece: 1, orient: 1, pts: "384,128 424,128 424,168 384,168" },
    { orbit: "corners", piece: 1, orient: 2, pts: "336,128 376,128 376,168 336,168" },
    { orbit: "corners", piece: 2, orient: 0, pts: "128,0 168,0 168,40 128,40" },
    { orbit: "corners", piece: 2, orient: 1, pts: "0,128 40,128 40,168 0,168" },
    { orbit: "corners", piece: 2, orient: 2, pts: "464,128 504,128 504,168 464,168" },
    { orbit: "corners", piece: 3, orient: 0, pts: "128,80 168,80 168,120 128,120" },
    { orbit: "corners", piece: 3, orient: 1, pts: "128,128 168,128 168,168 128,168" },
    { orbit: "corners", piece: 3, orient: 2, pts: "80,128 120,128 120,168 80,168" },
    { orbit: "corners", piece: 4, orient: 0, pts: "208,256 248,256 248,296 208,296" },
    { orbit: "corners", piece: 4, orient: 1, pts: "208,208 248,208 248,248 208,248" },
    { orbit: "corners", piece: 4, orient: 2, pts: "256,208 296,208 296,248 256,248" },
    { orbit: "corners", piece: 5, orient: 0, pts: "128,256 168,256 168,296 128,296" },
    { orbit: "corners", piece: 5, orient: 1, pts: "80,208 120,208 120,248 80,248" },
    { orbit: "corners", piece: 5, orient: 2, pts: "128,208 168,208 168,248 128,248" },
    { orbit: "corners", piece: 6, orient: 0, pts: "128,336 168,336 168,376 128,376" },
    { orbit: "corners", piece: 6, orient: 1, pts: "464,208 504,208 504,248 464,248" },
    { orbit: "corners", piece: 6, orient: 2, pts: "0,208 40,208 40,248 0,248" },
    { orbit: "corners", piece: 7, orient: 0, pts: "208,336 248,336 248,376 208,376" },
    { orbit: "corners", piece: 7, orient: 1, pts: "336,208 376,208 376,248 336,248" },
    { orbit: "corners", piece: 7, orient: 2, pts: "384,208 424,208 424,248 384,248" },
    { orbit: "edges", piece: 0, orient: 0, pts: "168,80 188,60 208,80 208,120 168,120" },
    { orbit: "edges", piece: 0, orient: 1, pts: "168,128 208,128 208,168 188,188 168,168" },
    { orbit: "edges", piece: 1, orient: 0, pts: "208,40 248,40 248,80 208,80 188,60" },
    { orbit: "edges", piece: 1, orient: 1, pts: "296,128 336,128 336,168 316,188 296,168" },
    { orbit: "edges", piece: 2, orient: 0, pts: "168,0 208,0 208,40 188,60 168,40" },
    { orbit: "edges", piece: 2, orient: 1, pts: "424,128 464,128 464,168 444,188 424,168" },
    { orbit: "edges", piece: 3, orient: 0, pts: "128,40 168,40 188,60 168,80 128,80" },
    { orbit: "edges", piece: 3, orient: 1, pts: "40,128 80,128 80,168 60,188 40,168" },
    { orbit: "edges", piece: 4, orient: 0, pts: "168,256 208,256 208,296 188,316 168,296" },
    { orbit: "edges", piece: 4, orient: 1, pts: "168,208 188,188 208,208 208,248 168,248" },
    { orbit: "edges", piece: 5, orient: 0, pts: "208,296 248,296 248,336 208,336 188,316" },
    { orbit: "edges", piece: 5, orient: 1, pts: "296,208 316,188 336,208 336,248 296,248" },
    { orbit: "edges", piece: 6, orient: 0, pts: "168,336 188,316 208,336 208,376 168,376" },
    { orbit: "edges", piece: 6, orient: 1, pts: "424,208 444,188 464,208 464,248 424,248" },
    { orbit: "edges", piece: 7, orient: 0, pts: "128,296 168,296 188,316 168,336 128,336" },
    { orbit: "edges", piece: 7, orient: 1, pts: "40,208 60,188 80,208 80,248 40,248" },
    { orbit: "edges", piece: 8, orient: 0, pts: "208,168 248,168 248,208 208,208 188,188" },
    { orbit: "edges", piece: 8, orient: 1, pts: "256,168 296,168 316,188 296,208 256,208" },
    { orbit: "edges", piece: 9, orient: 0, pts: "128,168 168,168 188,188 168,208 128,208" },
    { orbit: "edges", piece: 9, orient: 1, pts: "80,168 120,168 120,208 80,208 60,188" },
    { orbit: "edges", piece: 10, orient: 0, pts: "384,168 424,168 444,188 424,208 384,208" },
    { orbit: "edges", piece: 10, orient: 1, pts: "336,168 376,168 376,208 336,208 316,188" },
    { orbit: "edges", piece: 11, orient: 0, pts: "464,168 504,168 504,208 464,208 444,188" },
    { orbit: "edges", piece: 11, orient: 1, pts: "0,168 40,168 60,188 40,208 0,208" },
  ],
};

export const REDI_CUBE: PuzzleNetDef = { group: REDI_CUBE_GROUP, net: REDI_CUBE_NET };
