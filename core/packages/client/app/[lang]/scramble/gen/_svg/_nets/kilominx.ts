/**
 * Kilominx — corners-only megaminx (megaminx face-turn notation R++ / D-- / U).
 *
 * Group-theoretic source (orbits + generators in cycle notation) — the canonical,
 * self-contained definition of this puzzle's scramble-preview model. Derived once
 * from cubing.js by scripts/gen-net.ts and verified equal to cubing.js's KPuzzle
 * over random scrambles (state + every sticker color); cubing.js is NOT a runtime
 * dependency here. A scramble token resolves to a base generator raised to a power
 * (X' = inverse, X2 = square, X-- = (X++)⁻¹); see lib/puzzle-group.
 *
 * Orbits used in the 2D net: corners. Net geometry (polygon
 * coordinates) is plain data, extracted from cubing.js's own SVG net.
 */
import type { PuzzleGroup } from '@/lib/puzzle-group';
import type { PuzzleNet, PuzzleNetDef } from '../_net_render';

export const KILOMINX_GROUP: PuzzleGroup = {
  orbits: {
    corners: { size: 20, ori: 3 },
  },
  gens: {
    "D++": {
      corners: { cycles: [[3,11,19,5,12], [4,13,8,10,14], [9,15,17,18,16]] },
    },
    "R++": {
      corners: { cycles: [[2,9,6,8,10], [7,17,11,19,18], [12,16,13,14,15]], twist: { 2: 1, 6: 1, 7: 2, 8: 2, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 15: 1, 17: 2, 18: 2, 19: 2 } },
    },
    U: {
      corners: { cycles: [[0,2,7,6,1]] },
    },
  },
};

export const KILOMINX_NET: PuzzleNet = {
  viewBox: "10.18 56.78 779.63 386.43",
  stroke: '#1a1a1a',
  strokeWidth: 3,
  solvedColor: {
    corners: [["#ffffff", "#008800", "#8800dd"], ["#ffffff", "#8800dd", "#ffff00"], ["#ffffff", "#ff0000", "#008800"], ["#3399ff", "#8800dd", "#008800"], ["#8800dd", "#3399ff", "#ff6633"], ["#ff6633", "#ffff00", "#8800dd"], ["#ffffff", "#ffff00", "#0000ff"], ["#ffffff", "#0000ff", "#ff0000"], ["#008800", "#ffffd0", "#3399ff"], ["#999999", "#ff6633", "#3399ff"], ["#ffff00", "#ff6633", "#99ff00"], ["#99ff00", "#0000ff", "#ffff00"], ["#ff66cc", "#ff0000", "#0000ff"], ["#0000ff", "#99ff00", "#ff66cc"], ["#ff0000", "#ff66cc", "#ffffd0"], ["#999999", "#ff66cc", "#99ff00"], ["#999999", "#ffffd0", "#ff66cc"], ["#999999", "#3399ff", "#ffffd0"], ["#999999", "#99ff00", "#ff6633"], ["#ffffd0", "#008800", "#ff0000"]],
  },
  facelets: [
    { orbit: "corners", piece: 7, orient: 0, pts: "247.94,89.86 283.5,115.7 269.92,157.5 212.38,138.81" },
    { orbit: "corners", piece: 1, orient: 0, pts: "154.85,157.5 141.26,115.7 176.82,89.86 212.38,138.81" },
    { orbit: "corners", piece: 6, orient: 0, pts: "176.82,89.86 212.38,64.03 247.94,89.86 212.38,138.81" },
    { orbit: "corners", piece: 0, orient: 0, pts: "212.38,199.3 168.43,199.3 154.85,157.5 212.38,138.81" },
    { orbit: "corners", piece: 2, orient: 0, pts: "269.92,157.5 256.33,199.3 212.38,199.3 212.38,138.81" },
    { orbit: "corners", piece: 8, orient: 0, pts: "247.94,319.26 212.38,345.1 176.82,319.26 212.38,270.32" },
    { orbit: "corners", piece: 2, orient: 2, pts: "212.38,209.82 256.33,209.82 269.92,251.63 212.38,270.32" },
    { orbit: "corners", piece: 19, orient: 1, pts: "269.92,251.63 283.5,293.43 247.94,319.26 212.38,270.32" },
    { orbit: "corners", piece: 0, orient: 1, pts: "154.85,251.63 168.43,209.82 212.38,209.82 212.38,270.32" },
    { orbit: "corners", piece: 3, orient: 2, pts: "176.82,319.26 141.26,293.43 154.85,251.63 212.38,270.32" },
    { orbit: "corners", piece: 4, orient: 0, pts: "87.3,290.18 43.35,290.18 29.77,248.37 87.3,229.68" },
    { orbit: "corners", piece: 0, orient: 2, pts: "122.86,180.74 158.42,206.57 144.84,248.37 87.3,229.68" },
    { orbit: "corners", piece: 3, orient: 1, pts: "144.84,248.37 131.26,290.18 87.3,290.18 87.3,229.68" },
    { orbit: "corners", piece: 1, orient: 1, pts: "51.74,180.74 87.3,154.9 122.86,180.74 87.3,229.68" },
    { orbit: "corners", piece: 5, orient: 2, pts: "29.77,248.37 16.18,206.57 51.74,180.74 87.3,229.68" },
    { orbit: "corners", piece: 10, orient: 0, pts: "700.48,172.22 664.92,198.06 629.36,172.22 664.92,123.28" },
    { orbit: "corners", piece: 1, orient: 2, pts: "664.92,62.78 708.87,62.78 722.46,104.59 664.92,123.28" },
    { orbit: "corners", piece: 5, orient: 1, pts: "722.46,104.59 736.04,146.39 700.48,172.22 664.92,123.28" },
    { orbit: "corners", piece: 6, orient: 1, pts: "607.38,104.59 620.97,62.78 664.92,62.78 664.92,123.28" },
    { orbit: "corners", piece: 11, orient: 2, pts: "629.36,172.22 593.8,146.39 607.38,104.59 664.92,123.28" },
    { orbit: "corners", piece: 13, orient: 0, pts: "545.87,172.22 510.32,198.06 474.76,172.22 510.32,123.28" },
    { orbit: "corners", piece: 6, orient: 2, pts: "510.32,62.78 554.27,62.78 567.85,104.59 510.32,123.28" },
    { orbit: "corners", piece: 11, orient: 1, pts: "567.85,104.59 581.43,146.39 545.87,172.22 510.32,123.28" },
    { orbit: "corners", piece: 7, orient: 1, pts: "452.78,104.59 466.36,62.78 510.32,62.78 510.32,123.28" },
    { orbit: "corners", piece: 12, orient: 2, pts: "474.76,172.22 439.2,146.39 452.78,104.59 510.32,123.28" },
    { orbit: "corners", piece: 12, orient: 1, pts: "373.02,180.74 408.58,206.57 395,248.37 337.46,229.68" },
    { orbit: "corners", piece: 2, orient: 1, pts: "279.92,248.37 266.34,206.57 301.9,180.74 337.46,229.68" },
    { orbit: "corners", piece: 7, orient: 2, pts: "301.9,180.74 337.46,154.9 373.02,180.74 337.46,229.68" },
    { orbit: "corners", piece: 19, orient: 2, pts: "337.46,290.18 293.51,290.18 279.92,248.37 337.46,229.68" },
    { orbit: "corners", piece: 14, orient: 0, pts: "395,248.37 381.41,290.18 337.46,290.18 337.46,229.68" },
    { orbit: "corners", piece: 16, orient: 1, pts: "347.22,395.41 333.64,437.22 289.68,437.22 289.69,376.72" },
    { orbit: "corners", piece: 19, orient: 0, pts: "254.13,327.78 289.68,301.94 325.24,327.78 289.69,376.72" },
    { orbit: "corners", piece: 14, orient: 2, pts: "325.24,327.78 360.8,353.61 347.22,395.41 289.69,376.72" },
    { orbit: "corners", piece: 8, orient: 1, pts: "232.15,395.41 218.57,353.61 254.13,327.78 289.69,376.72" },
    { orbit: "corners", piece: 17, orient: 2, pts: "289.68,437.22 245.73,437.22 232.15,395.41 289.69,376.72" },
    { orbit: "corners", piece: 17, orient: 1, pts: "192.62,395.41 179.03,437.22 135.08,437.22 135.08,376.72" },
    { orbit: "corners", piece: 3, orient: 0, pts: "99.52,327.78 135.08,301.94 170.64,327.78 135.08,376.72" },
    { orbit: "corners", piece: 8, orient: 2, pts: "170.64,327.78 206.2,353.61 192.62,395.41 135.08,376.72" },
    { orbit: "corners", piece: 4, orient: 1, pts: "77.54,395.41 63.96,353.61 99.52,327.78 135.08,376.72" },
    { orbit: "corners", piece: 9, orient: 2, pts: "135.08,437.22 91.13,437.22 77.54,395.41 135.08,376.72" },
    { orbit: "corners", piece: 18, orient: 2, pts: "677.14,319.26 641.58,293.43 655.16,251.63 712.7,270.32" },
    { orbit: "corners", piece: 4, orient: 2, pts: "770.23,251.63 783.82,293.43 748.26,319.26 712.7,270.32" },
    { orbit: "corners", piece: 9, orient: 1, pts: "748.26,319.26 712.7,345.1 677.14,319.26 712.7,270.32" },
    { orbit: "corners", piece: 5, orient: 0, pts: "712.7,209.82 756.65,209.82 770.23,251.63 712.7,270.32" },
    { orbit: "corners", piece: 10, orient: 1, pts: "655.16,251.63 668.74,209.82 712.7,209.82 712.7,270.32" },
    { orbit: "corners", piece: 15, orient: 2, pts: "587.62,290.18 543.66,290.18 530.08,248.37 587.62,229.68" },
    { orbit: "corners", piece: 10, orient: 2, pts: "623.18,180.74 658.74,206.57 645.15,248.37 587.62,229.68" },
    { orbit: "corners", piece: 18, orient: 1, pts: "645.15,248.37 631.57,290.18 587.62,290.18 587.62,229.68" },
    { orbit: "corners", piece: 11, orient: 0, pts: "552.06,180.74 587.62,154.9 623.18,180.74 587.62,229.68" },
    { orbit: "corners", piece: 13, orient: 1, pts: "530.08,248.37 516.5,206.57 552.06,180.74 587.62,229.68" },
    { orbit: "corners", piece: 16, orient: 2, pts: "498.1,319.26 462.54,345.1 426.98,319.26 462.54,270.32" },
    { orbit: "corners", piece: 13, orient: 2, pts: "462.54,209.82 506.49,209.82 520.08,251.63 462.54,270.32" },
    { orbit: "corners", piece: 15, orient: 1, pts: "520.08,251.63 533.66,293.43 498.1,319.26 462.54,270.32" },
    { orbit: "corners", piece: 12, orient: 0, pts: "405,251.63 418.59,209.82 462.54,209.82 462.54,270.32" },
    { orbit: "corners", piece: 14, orient: 1, pts: "426.98,319.26 391.42,293.43 405,251.63 462.54,270.32" },
    { orbit: "corners", piece: 18, orient: 0, pts: "587.62,300.7 631.57,300.7 645.15,342.5 587.62,361.2" },
    { orbit: "corners", piece: 16, orient: 0, pts: "552.06,410.14 516.5,384.3 530.08,342.5 587.62,361.2" },
    { orbit: "corners", piece: 15, orient: 0, pts: "530.08,342.5 543.66,300.7 587.62,300.7 587.62,361.2" },
    { orbit: "corners", piece: 17, orient: 0, pts: "623.18,410.14 587.62,435.97 552.06,410.14 587.62,361.2" },
    { orbit: "corners", piece: 9, orient: 0, pts: "645.15,342.5 658.74,384.3 623.18,410.14 587.62,361.2" },
  ],
};

export const KILOMINX: PuzzleNetDef = { group: KILOMINX_GROUP, net: KILOMINX_NET };
