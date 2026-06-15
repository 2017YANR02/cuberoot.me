// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  transftoWCA,
  conjugateRotationToWCA,
  doubleMoveRemover,
  threeswap,
  fourswap,
  firstLayerList,
  randomFirstLayer,
} from '@/app/[lang]/trainer/skewb/_lib/scramble';
import { ALL_ALGS } from '@/app/[lang]/trainer/skewb/_lib/algs';

// ---------------------------------------------------------------------------
// VERBATIM JS reference implementations copied from skewbskillsscripts.js
// (annikastein/SkewbPage). These are the ground truth the TS port must match
// byte-for-byte. They are pure (no DOM). Kept exactly as the source; eslint /
// style deviations here are intentional fidelity to the original.
// ---------------------------------------------------------------------------

/* eslint-disable */
// @ts-nocheck

function refThreeswap(listname, i, j, k) {
  [listname[j], listname[k]] = [listname[k], listname[j]];
  [listname[i], listname[j]] = [listname[j], listname[i]];
}

function refFourswap(listname, i, j, k, l) {
  [listname[k], listname[l]] = [listname[l], listname[k]];
  [listname[j], listname[k]] = [listname[k], listname[j]];
  [listname[i], listname[j]] = [listname[j], listname[i]];
}

function refTransftoWCA(scr) {
  var stickercol = ["o", "a", "a", "a", "a", "g", "a", "a", "a", "a", "y", "a", "a", "a", "a",
    "w", "a", "a", "a", "a", "r", "a", "a", "a", "a", "b", "a", "a", "a", "a"];
  var finalscr = "";
  var scrsplit = scr.split(" ");
  var allcycles = [];
  for (var i of scrsplit) {
    var previous = stickercol.slice();
    var thecycledcolors = [];
    if (i == "x") {
      refFourswap(stickercol, 15, 25, 10, 5);
    } else if (i == "x'") {
      refFourswap(stickercol, 5, 10, 25, 15);
    } else if (i == "x2") {
      refFourswap(stickercol, 5, 10, 25, 15);
      refFourswap(stickercol, 5, 10, 25, 15);
    } else if (i == "y") {
      refFourswap(stickercol, 25, 20, 5, 0);
    } else if (i == "y'") {
      refFourswap(stickercol, 0, 5, 20, 25);
    } else if (i == "y2") {
      refFourswap(stickercol, 0, 5, 20, 25);
      refFourswap(stickercol, 0, 5, 20, 25);
    } else if (i == "z") {
      refFourswap(stickercol, 15, 20, 10, 0);
    } else if (i == "z'") {
      refFourswap(stickercol, 0, 10, 20, 15);
    } else if (i == "z2") {
      refFourswap(stickercol, 0, 10, 20, 15);
      refFourswap(stickercol, 0, 10, 20, 15);
    } else if (i == "r" || i == "r'2") {
      refThreeswap(stickercol, 10, 20, 25);
    } else if (i == "r'" || i == "r2") {
      refThreeswap(stickercol, 25, 20, 10);
    } else if (i == "R" || i == "R'2") {
      refThreeswap(stickercol, 15, 25, 20);
    } else if (i == "R'" || i == "R2") {
      refThreeswap(stickercol, 20, 25, 15);
    } else if (i == "l" || i == "L" || i == "l'2" || i == "L'2") {
      refThreeswap(stickercol, 0, 5, 10);
    } else if (i == "l'" || i == "L'" || i == "l2" || i == "L2") {
      refThreeswap(stickercol, 10, 5, 0);
    } else if (i == "f" || i == "f'2") {
      refThreeswap(stickercol, 5, 20, 10);
    } else if (i == "f'" || i == "f2") {
      refThreeswap(stickercol, 10, 20, 5);
    } else if (i == "B" || i == "U" || i == "B'2" || i == "U'2") {
      refThreeswap(stickercol, 0, 25, 15);
    } else if (i == "B'" || i == "U'" || i == "B2" || i == "U2") {
      refThreeswap(stickercol, 15, 25, 0);
    } else if (i == "b" || i == "b'2") {
      refThreeswap(stickercol, 0, 10, 25);
    } else {
      refThreeswap(stickercol, 25, 10, 0);
    }
    if (["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"].includes(i) === false) {
      for (var j of [0, 5, 10, 15, 20, 25]) {
        if (previous[j] == stickercol[j]) {
          continue;
        } else {
          thecycledcolors.push([previous[j], stickercol[j]]);
        }
      }
      allcycles.push(thecycledcolors);
    }
  }
  var stickercolWCA = ["o", "a", "a", "a", "a", "g", "a", "a", "a", "a", "y", "a", "a", "a", "a",
    "w", "a", "a", "a", "a", "r", "a", "a", "a", "a", "b", "a", "a", "a", "a"];
  for (var o in allcycles) {
    var first = stickercolWCA.indexOf(allcycles[o][0][1]);
    var second = stickercolWCA.indexOf(allcycles[o][0][0]);
    var third;
    if ((stickercolWCA.indexOf(allcycles[o][1][0]) == first) || (stickercolWCA.indexOf(allcycles[o][1][0]) == second)) {
      third = stickercolWCA.indexOf(allcycles[o][2][0]);
    } else {
      third = stickercolWCA.indexOf(allcycles[o][1][0]);
    }
    if ([first, second, third].every(function (element, index) { return element === [20, 25, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 10, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 20, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 15, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 5, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 0, 15][index]; })) {
      finalscr = finalscr + "R ";
      refThreeswap(stickercolWCA, 10, 20, 25);
    } else if ([first, second, third].every(function (element, index) { return element === [10, 25, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 10, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 20, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 15, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 5, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 0, 5][index]; })) {
      finalscr += "R' ";
      refThreeswap(stickercolWCA, 25, 20, 10);
    } else if ([first, second, third].every(function (element, index) { return element === [0, 5, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 10, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 0, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 25, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 20, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 15, 25][index]; })) {
      finalscr += "L ";
      refThreeswap(stickercolWCA, 0, 5, 10);
    } else if ([first, second, third].every(function (element, index) { return element === [10, 5, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 10, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 0, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 25, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 20, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 15, 20][index]; })) {
      finalscr += "L' ";
      refThreeswap(stickercolWCA, 10, 5, 0);
    } else if ([first, second, third].every(function (element, index) { return element === [15, 0, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 25, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 15, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 20, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 10, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 5, 20][index]; })) {
      finalscr += "U ";
      refThreeswap(stickercolWCA, 0, 25, 15);
    } else if ([first, second, third].every(function (element, index) { return element === [25, 0, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 25, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 15, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 20, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 10, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 5, 10][index]; })) {
      finalscr += "U' ";
      refThreeswap(stickercolWCA, 15, 25, 0);
    } else if ([first, second, third].every(function (element, index) { return element === [25, 0, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 10, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 25, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 20, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 5, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 15, 20][index]; })) {
      finalscr += "B ";
      refThreeswap(stickercolWCA, 0, 10, 25);
    } else if ([first, second, third].every(function (element, index) { return element === [10, 0, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 10, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 25, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 20, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 5, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 15, 5][index]; })) {
      finalscr += "B' ";
      refThreeswap(stickercolWCA, 25, 10, 0);
    }
  }
  return (finalscr);
}

function refConjugateRotationToWCA(scr) {
  var stickercol = ["o", "a", "a", "a", "a", "g", "a", "a", "a", "a", "y", "a", "a", "a", "a",
    "w", "a", "a", "a", "a", "r", "a", "a", "a", "a", "b", "a", "a", "a", "a"];
  var finalscr = "";
  var scrsplit = scr.split(" ");
  var allcycles = [];
  for (var i of scrsplit) {
    var previous = stickercol.slice();
    var thecycledcolors = [];
    if (i == "x") {
      refFourswap(stickercol, 15, 25, 10, 5);
    } else if (i == "x'") {
      refFourswap(stickercol, 5, 10, 25, 15);
    } else if (i == "x2") {
      refFourswap(stickercol, 5, 10, 25, 15);
      refFourswap(stickercol, 5, 10, 25, 15);
    } else if (i == "y") {
      refFourswap(stickercol, 25, 20, 5, 0);
    } else if (i == "y'") {
      refFourswap(stickercol, 0, 5, 20, 25);
    } else if (i == "y2") {
      refFourswap(stickercol, 0, 5, 20, 25);
      refFourswap(stickercol, 0, 5, 20, 25);
    } else if (i == "z") {
      refFourswap(stickercol, 15, 20, 10, 0);
    } else if (i == "z'") {
      refFourswap(stickercol, 0, 10, 20, 15);
    } else if (i == "z2") {
      refFourswap(stickercol, 0, 10, 20, 15);
      refFourswap(stickercol, 0, 10, 20, 15);
    } else if (i == "R" || i == "R'2") {
      refThreeswap(stickercol, 20, 25, 10);
    } else if (i == "R'" || i == "R2") {
      refThreeswap(stickercol, 10, 25, 20);
    } else if (i == "L" || i == "L'2") {
      refThreeswap(stickercol, 0, 5, 10);
    } else if (i == "L'" || i == "L2") {
      refThreeswap(stickercol, 10, 5, 0);
    } else if (i == "U" || i == "U'2") {
      refThreeswap(stickercol, 0, 25, 15);
    } else if (i == "U'" || i == "U2") {
      refThreeswap(stickercol, 15, 25, 0);
    } else if (i == "B" || i == "B'2") {
      refThreeswap(stickercol, 0, 10, 25);
    } else if (i == "B'" || i == "B2") {
      refThreeswap(stickercol, 25, 10, 0);
    }
    if (["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"].includes(i) === false) {
      for (var j of [0, 5, 10, 15, 20, 25]) {
        if (previous[j] == stickercol[j]) {
          continue;
        } else {
          thecycledcolors.push([previous[j], stickercol[j]]);
        }
      }
      allcycles.push(thecycledcolors);
    }
  }
  var stickercolWCA = ["o", "a", "a", "a", "a", "g", "a", "a", "a", "a", "y", "a", "a", "a", "a",
    "w", "a", "a", "a", "a", "r", "a", "a", "a", "a", "b", "a", "a", "a", "a"];
  for (var o in allcycles) {
    var first = stickercolWCA.indexOf(allcycles[o][0][1]);
    var second = stickercolWCA.indexOf(allcycles[o][0][0]);
    var third;
    if ((stickercolWCA.indexOf(allcycles[o][1][0]) == first) || (stickercolWCA.indexOf(allcycles[o][1][0]) == second)) {
      third = stickercolWCA.indexOf(allcycles[o][2][0]);
    } else {
      third = stickercolWCA.indexOf(allcycles[o][1][0]);
    }
    if ([first, second, third].every(function (element, index) { return element === [20, 25, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 10, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 20, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 15, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 5, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 0, 15][index]; })) {
      finalscr = finalscr + "R ";
      refThreeswap(stickercolWCA, 10, 20, 25);
    } else if ([first, second, third].every(function (element, index) { return element === [10, 25, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 10, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 20, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 15, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 5, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 0, 5][index]; })) {
      finalscr += "R' ";
      refThreeswap(stickercolWCA, 25, 20, 10);
    } else if ([first, second, third].every(function (element, index) { return element === [0, 5, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 10, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 0, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 25, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 20, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 15, 25][index]; })) {
      finalscr += "L ";
      refThreeswap(stickercolWCA, 0, 5, 10);
    } else if ([first, second, third].every(function (element, index) { return element === [10, 5, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 10, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 0, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 25, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 20, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 15, 20][index]; })) {
      finalscr += "L' ";
      refThreeswap(stickercolWCA, 10, 5, 0);
    } else if ([first, second, third].every(function (element, index) { return element === [15, 0, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 25, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 15, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 20, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 10, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 5, 20][index]; })) {
      finalscr += "U ";
      refThreeswap(stickercolWCA, 0, 25, 15);
    } else if ([first, second, third].every(function (element, index) { return element === [25, 0, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 25, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 15, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 20, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 10, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 5, 10][index]; })) {
      finalscr += "U' ";
      refThreeswap(stickercolWCA, 15, 25, 0);
    } else if ([first, second, third].every(function (element, index) { return element === [25, 0, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 10, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [10, 25, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 20, 5][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 5, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 15, 20][index]; })) {
      finalscr += "B ";
      refThreeswap(stickercolWCA, 0, 10, 25);
    } else if ([first, second, third].every(function (element, index) { return element === [10, 0, 25][index]; })
      || [first, second, third].every(function (element, index) { return element === [25, 10, 0][index]; })
      || [first, second, third].every(function (element, index) { return element === [0, 25, 10][index]; })
      || [first, second, third].every(function (element, index) { return element === [5, 20, 15][index]; })
      || [first, second, third].every(function (element, index) { return element === [15, 5, 20][index]; })
      || [first, second, third].every(function (element, index) { return element === [20, 15, 5][index]; })) {
      finalscr += "B' ";
      refThreeswap(stickercolWCA, 25, 10, 0);
    }
  }
  return (finalscr);
}

function refDoubleMoveRemover(scramble) {
  var newScr = [];
  var newScrString = "";
  var scrSplit = [];
  scrSplit = (scramble.split(" ")).slice(0, -1);
  for (var i = 0; i < scrSplit.length; i++) {
    if (newScr.length >= 1) {
      if (newScr[newScr.length - 1] == scrSplit[i]) {
        if ((scrSplit[i]).length == 1) {
          newScr.pop();
          newScr.push(scrSplit[i] + "'");
        } else {
          newScr.pop();
          newScr.push(scrSplit[i].charAt(0));
        }
      } else {
        if (newScr[newScr.length - 1].charAt(0) == scrSplit[i].charAt(0)) {
          newScr.pop();
        } else {
          newScr.push(scrSplit[i]);
        }
      }
    } else {
      newScr.push(scrSplit[i]);
    }
  }
  for (var move of newScr) {
    newScrString += move + " ";
  }
  return (newScrString);
}
/* eslint-enable */

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Rotation prefixes/suffixes to exercise the rotation paths inside transftoWCA.
const ROTATION_WRAPS: [string, string][] = [
  ['', ''],
  ['x ', " x'"],
  ['z2 ', ' z2'],
  ['y2 ', ' y2'],
  ['x2 y ', " y' x2"],
  ["x' ", ' x'],
  ['z ', " z'"],
];

describe('threeswap / fourswap match the reference cyclic permutations', () => {
  it('threeswap', () => {
    const a = [0, 1, 2, 3, 4];
    const b = [0, 1, 2, 3, 4];
    threeswap(a, 0, 2, 4);
    refThreeswap(b, 0, 2, 4);
    expect(a).toEqual(b);
  });

  it('fourswap', () => {
    const a = [0, 1, 2, 3, 4, 5];
    const b = [0, 1, 2, 3, 4, 5];
    fourswap(a, 0, 1, 3, 5);
    refFourswap(b, 0, 1, 3, 5);
    expect(a).toEqual(b);
  });
});

describe('transftoWCA byte-identical to reference', () => {
  it('matches on every alg setup', () => {
    expect(ALL_ALGS.length).toBeGreaterThan(0);
    for (const c of ALL_ALGS) {
      expect(transftoWCA(c.setup)).toBe(refTransftoWCA(c.setup));
    }
  });

  it('matches on every alg setup wrapped in fixed rotations', () => {
    for (const c of ALL_ALGS) {
      for (const [pre, post] of ROTATION_WRAPS) {
        const input = pre + c.setup + post;
        expect(transftoWCA(input)).toBe(refTransftoWCA(input));
      }
    }
  });
});

describe('conjugateRotationToWCA byte-identical to reference', () => {
  // Build inputs from transftoWCA outputs (WCA upper-case moves) wrapped in rotations.
  it('matches on transftoWCA outputs wrapped in rotations', () => {
    for (const c of ALL_ALGS) {
      const wca = refTransftoWCA(c.setup).trim();
      if (wca.length === 0) continue;
      for (const [pre, post] of ROTATION_WRAPS) {
        const input = (pre + wca + post).trim();
        expect(conjugateRotationToWCA(input)).toBe(refConjugateRotationToWCA(input));
      }
    }
  });

  it('matches on fixed hand-crafted WCA inputs', () => {
    const inputs = [
      'R',
      "R'",
      'R U L B',
      "R' U' L' B'",
      'x R U L B',
      'z2 R U L B y',
      "x2 y R' U' B' L'",
      "U R' L B U' R",
    ];
    for (const input of inputs) {
      expect(conjugateRotationToWCA(input)).toBe(refConjugateRotationToWCA(input));
    }
  });
});

describe('doubleMoveRemover byte-identical to reference', () => {
  it('matches on crafted strings (note: slices off the trailing token)', () => {
    const inputs = [
      'R R L L U B ',
      "R R' L U U ",
      'R R R L ',
      "U U U' B B ",
      'R L L L U ',
      "B' B' R U ",
      'R ',
      '',
      'R U L B ',
      "L L' R R ",
    ];
    for (const input of inputs) {
      expect(doubleMoveRemover(input)).toBe(refDoubleMoveRemover(input));
    }
  });

  it('matches when fed transftoWCA + rotation output (the real pipeline)', () => {
    for (const c of ALL_ALGS) {
      for (const [pre, post] of ROTATION_WRAPS) {
        const wca = refTransftoWCA(pre + c.setup + post);
        expect(doubleMoveRemover(wca)).toBe(refDoubleMoveRemover(wca));
      }
    }
  });
});

describe('firstLayerList enumeration', () => {
  it('has count 8 * 6^(n-1) and no consecutive same-face moves', () => {
    for (let n = 1; n <= 5; n++) {
      const list = firstLayerList(n);
      expect(list.length).toBe(8 * 6 ** (n - 1));
      for (const entry of list) {
        const moves = entry.split(' ');
        expect(moves.length).toBe(n);
        for (let k = 1; k < moves.length; k++) {
          expect(moves[k].charAt(0)).not.toBe(moves[k - 1].charAt(0));
        }
      }
    }
  });

  it('returns the same memoized array on repeat calls', () => {
    expect(firstLayerList(3)).toBe(firstLayerList(3));
  });
});

describe('randomFirstLayer', () => {
  it('produces correct length and no consecutive same-face moves', () => {
    for (let iter = 0; iter < 2000; iter++) {
      const n = 1 + (iter % 7);
      const seq = randomFirstLayer(n);
      const moves = seq.split(' ');
      expect(moves.length).toBe(n);
      for (let k = 0; k < moves.length; k++) {
        expect(['R', 'L', 'U', 'B']).toContain(moves[k].charAt(0));
        if (k > 0) {
          expect(moves[k].charAt(0)).not.toBe(moves[k - 1].charAt(0));
        }
      }
    }
  });
});
