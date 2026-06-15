// Pure scramble / notation logic for the Skewb trainer.
// Faithful, framework-free TypeScript port of the pure functions in
// skewbskillsscripts.js (annikastein/SkewbPage). The move-filter and
// center-3-cycle logic is replicated EXACTLY — do not "optimize" it.

type Rng = () => number;

// ---------------------------------------------------------------------------
// cyclic permutations + Fisher-Yates shuffle (lines 2249-2286)
// ---------------------------------------------------------------------------

export function threeswap<T>(listname: T[], i: number, j: number, k: number): void {
  [listname[j], listname[k]] = [listname[k], listname[j]];
  [listname[i], listname[j]] = [listname[j], listname[i]];
}

export function fourswap<T>(listname: T[], i: number, j: number, k: number, l: number): void {
  [listname[k], listname[l]] = [listname[l], listname[k]];
  [listname[j], listname[k]] = [listname[k], listname[j]];
  [listname[i], listname[j]] = [listname[j], listname[i]];
}

export function shuffle<T>(array: T[], rng: Rng = Math.random): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ---------------------------------------------------------------------------
// transftoWCA (lines 588-923)
// RubiksSkewb notation (incl. lowercase r/l/f/b + rotations x/y/z) -> WCA
// R/U/L/B scramble, via center 3-cycles. Output is space-padded exactly as
// the source (each emitted move is followed by a trailing space).
// ---------------------------------------------------------------------------

function eq3(a: number[], b: number[]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function transftoWCA(scr: string): string {
  const stickercol = ['o', 'a', 'a', 'a', 'a', 'g', 'a', 'a', 'a', 'a', 'y', 'a', 'a', 'a', 'a',
    'w', 'a', 'a', 'a', 'a', 'r', 'a', 'a', 'a', 'a', 'b', 'a', 'a', 'a', 'a'];

  let finalscr = '';

  const scrsplit = scr.split(' ');

  const allcycles: [string, string][][] = [];

  for (const i of scrsplit) {
    const previous = stickercol.slice();
    const thecycledcolors: [string, string][] = [];

    if (i === 'x') {
      fourswap(stickercol, 15, 25, 10, 5);
    } else if (i === "x'") {
      fourswap(stickercol, 5, 10, 25, 15);
    } else if (i === 'x2') {
      fourswap(stickercol, 5, 10, 25, 15);
      fourswap(stickercol, 5, 10, 25, 15);
    } else if (i === 'y') {
      fourswap(stickercol, 25, 20, 5, 0);
    } else if (i === "y'") {
      fourswap(stickercol, 0, 5, 20, 25);
    } else if (i === 'y2') {
      fourswap(stickercol, 0, 5, 20, 25);
      fourswap(stickercol, 0, 5, 20, 25);
    } else if (i === 'z') {
      fourswap(stickercol, 15, 20, 10, 0);
    } else if (i === "z'") {
      fourswap(stickercol, 0, 10, 20, 15);
    } else if (i === 'z2') {
      fourswap(stickercol, 0, 10, 20, 15);
      fourswap(stickercol, 0, 10, 20, 15);
    } else if (i === 'r' || i === "r'2") {
      threeswap(stickercol, 10, 20, 25);
    } else if (i === "r'" || i === 'r2') {
      threeswap(stickercol, 25, 20, 10);
    } else if (i === 'R' || i === "R'2") {
      threeswap(stickercol, 15, 25, 20);
    } else if (i === "R'" || i === 'R2') {
      threeswap(stickercol, 20, 25, 15);
    } else if (i === 'l' || i === 'L' || i === "l'2" || i === "L'2") {
      threeswap(stickercol, 0, 5, 10);
    } else if (i === "l'" || i === "L'" || i === 'l2' || i === 'L2') {
      threeswap(stickercol, 10, 5, 0);
    } else if (i === 'f' || i === "f'2") {
      threeswap(stickercol, 5, 20, 10);
    } else if (i === "f'" || i === 'f2') {
      threeswap(stickercol, 10, 20, 5);
    } else if (i === 'B' || i === 'U' || i === "B'2" || i === "U'2") {
      threeswap(stickercol, 0, 25, 15);
    } else if (i === "B'" || i === "U'" || i === 'B2' || i === 'U2') {
      threeswap(stickercol, 15, 25, 0);
    } else if (i === 'b' || i === "b'2") {
      threeswap(stickercol, 0, 10, 25);
    } else {
      threeswap(stickercol, 25, 10, 0);
    }

    if (['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'].includes(i) === false) {
      for (const j of [0, 5, 10, 15, 20, 25]) {
        if (previous[j] === stickercol[j]) {
          continue;
        } else {
          thecycledcolors.push([previous[j], stickercol[j]]);
        }
      }
      allcycles.push(thecycledcolors);
    }
  }

  const stickercolWCA = ['o', 'a', 'a', 'a', 'a', 'g', 'a', 'a', 'a', 'a', 'y', 'a', 'a', 'a', 'a',
    'w', 'a', 'a', 'a', 'a', 'r', 'a', 'a', 'a', 'a', 'b', 'a', 'a', 'a', 'a'];

  for (const o in allcycles) {
    const first = stickercolWCA.indexOf(allcycles[o][0][1]);
    const second = stickercolWCA.indexOf(allcycles[o][0][0]);
    let third: number;
    if ((stickercolWCA.indexOf(allcycles[o][1][0]) === first) || (stickercolWCA.indexOf(allcycles[o][1][0]) === second)) {
      third = stickercolWCA.indexOf(allcycles[o][2][0]);
    } else {
      third = stickercolWCA.indexOf(allcycles[o][1][0]);
    }

    const fst = [first, second, third];
    if (eq3(fst, [20, 25, 10]) || eq3(fst, [25, 10, 20]) || eq3(fst, [10, 20, 25])
      || eq3(fst, [0, 15, 5]) || eq3(fst, [15, 5, 0]) || eq3(fst, [5, 0, 15])) {
      finalscr = finalscr + 'R ';
      threeswap(stickercolWCA, 10, 20, 25);
    } else if (eq3(fst, [10, 25, 20]) || eq3(fst, [20, 10, 25]) || eq3(fst, [25, 20, 10])
      || eq3(fst, [5, 15, 0]) || eq3(fst, [0, 5, 15]) || eq3(fst, [15, 0, 5])) {
      finalscr += "R' ";
      threeswap(stickercolWCA, 25, 20, 10);
    } else if (eq3(fst, [0, 5, 10]) || eq3(fst, [5, 10, 0]) || eq3(fst, [10, 0, 5])
      || eq3(fst, [15, 25, 20]) || eq3(fst, [25, 20, 15]) || eq3(fst, [20, 15, 25])) {
      finalscr += 'L ';
      threeswap(stickercolWCA, 0, 5, 10);
    } else if (eq3(fst, [10, 5, 0]) || eq3(fst, [0, 10, 5]) || eq3(fst, [5, 0, 10])
      || eq3(fst, [20, 25, 15]) || eq3(fst, [15, 20, 25]) || eq3(fst, [25, 15, 20])) {
      finalscr += "L' ";
      threeswap(stickercolWCA, 10, 5, 0);
    } else if (eq3(fst, [15, 0, 25]) || eq3(fst, [0, 25, 15]) || eq3(fst, [25, 15, 0])
      || eq3(fst, [5, 20, 10]) || eq3(fst, [20, 10, 5]) || eq3(fst, [10, 5, 20])) {
      finalscr += 'U ';
      threeswap(stickercolWCA, 0, 25, 15);
    } else if (eq3(fst, [25, 0, 15]) || eq3(fst, [15, 25, 0]) || eq3(fst, [0, 15, 25])
      || eq3(fst, [10, 20, 5]) || eq3(fst, [5, 10, 20]) || eq3(fst, [20, 5, 10])) {
      finalscr += "U' ";
      threeswap(stickercolWCA, 15, 25, 0);
    } else if (eq3(fst, [25, 0, 10]) || eq3(fst, [0, 10, 25]) || eq3(fst, [10, 25, 0])
      || eq3(fst, [15, 20, 5]) || eq3(fst, [20, 5, 15]) || eq3(fst, [5, 15, 20])) {
      finalscr += 'B ';
      threeswap(stickercolWCA, 0, 10, 25);
    } else if (eq3(fst, [10, 0, 25]) || eq3(fst, [25, 10, 0]) || eq3(fst, [0, 25, 10])
      || eq3(fst, [5, 20, 15]) || eq3(fst, [15, 5, 20]) || eq3(fst, [20, 15, 5])) {
      finalscr += "B' ";
      threeswap(stickercolWCA, 25, 10, 0);
    }
  }

  return finalscr;
}

// ---------------------------------------------------------------------------
// conjugateRotationToWCA (lines 925-1226)
// Same idea as transftoWCA, but input is already WCA upper-case moves +
// rotations (no lowercase RubiksSkewb moves). Used by One-Look mode.
// ---------------------------------------------------------------------------

export function conjugateRotationToWCA(scr: string): string {
  const stickercol = ['o', 'a', 'a', 'a', 'a', 'g', 'a', 'a', 'a', 'a', 'y', 'a', 'a', 'a', 'a',
    'w', 'a', 'a', 'a', 'a', 'r', 'a', 'a', 'a', 'a', 'b', 'a', 'a', 'a', 'a'];

  let finalscr = '';

  const scrsplit = scr.split(' ');

  const allcycles: [string, string][][] = [];

  for (const i of scrsplit) {
    const previous = stickercol.slice();
    const thecycledcolors: [string, string][] = [];

    if (i === 'x') {
      fourswap(stickercol, 15, 25, 10, 5);
    } else if (i === "x'") {
      fourswap(stickercol, 5, 10, 25, 15);
    } else if (i === 'x2') {
      fourswap(stickercol, 5, 10, 25, 15);
      fourswap(stickercol, 5, 10, 25, 15);
    } else if (i === 'y') {
      fourswap(stickercol, 25, 20, 5, 0);
    } else if (i === "y'") {
      fourswap(stickercol, 0, 5, 20, 25);
    } else if (i === 'y2') {
      fourswap(stickercol, 0, 5, 20, 25);
      fourswap(stickercol, 0, 5, 20, 25);
    } else if (i === 'z') {
      fourswap(stickercol, 15, 20, 10, 0);
    } else if (i === "z'") {
      fourswap(stickercol, 0, 10, 20, 15);
    } else if (i === 'z2') {
      fourswap(stickercol, 0, 10, 20, 15);
      fourswap(stickercol, 0, 10, 20, 15);
    } else if (i === 'R' || i === "R'2") {
      threeswap(stickercol, 20, 25, 10);
    } else if (i === "R'" || i === 'R2') {
      threeswap(stickercol, 10, 25, 20);
    } else if (i === 'L' || i === "L'2") {
      threeswap(stickercol, 0, 5, 10);
    } else if (i === "L'" || i === 'L2') {
      threeswap(stickercol, 10, 5, 0);
    } else if (i === 'U' || i === "U'2") {
      threeswap(stickercol, 0, 25, 15);
    } else if (i === "U'" || i === 'U2') {
      threeswap(stickercol, 15, 25, 0);
    } else if (i === 'B' || i === "B'2") {
      threeswap(stickercol, 0, 10, 25);
    } else if (i === "B'" || i === 'B2') {
      threeswap(stickercol, 25, 10, 0);
    }

    if (['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'].includes(i) === false) {
      for (const j of [0, 5, 10, 15, 20, 25]) {
        if (previous[j] === stickercol[j]) {
          continue;
        } else {
          thecycledcolors.push([previous[j], stickercol[j]]);
        }
      }
      allcycles.push(thecycledcolors);
    }
  }

  const stickercolWCA = ['o', 'a', 'a', 'a', 'a', 'g', 'a', 'a', 'a', 'a', 'y', 'a', 'a', 'a', 'a',
    'w', 'a', 'a', 'a', 'a', 'r', 'a', 'a', 'a', 'a', 'b', 'a', 'a', 'a', 'a'];

  for (const o in allcycles) {
    const first = stickercolWCA.indexOf(allcycles[o][0][1]);
    const second = stickercolWCA.indexOf(allcycles[o][0][0]);
    let third: number;
    if ((stickercolWCA.indexOf(allcycles[o][1][0]) === first) || (stickercolWCA.indexOf(allcycles[o][1][0]) === second)) {
      third = stickercolWCA.indexOf(allcycles[o][2][0]);
    } else {
      third = stickercolWCA.indexOf(allcycles[o][1][0]);
    }

    const fst = [first, second, third];
    if (eq3(fst, [20, 25, 10]) || eq3(fst, [25, 10, 20]) || eq3(fst, [10, 20, 25])
      || eq3(fst, [0, 15, 5]) || eq3(fst, [15, 5, 0]) || eq3(fst, [5, 0, 15])) {
      finalscr = finalscr + 'R ';
      threeswap(stickercolWCA, 10, 20, 25);
    } else if (eq3(fst, [10, 25, 20]) || eq3(fst, [20, 10, 25]) || eq3(fst, [25, 20, 10])
      || eq3(fst, [5, 15, 0]) || eq3(fst, [0, 5, 15]) || eq3(fst, [15, 0, 5])) {
      finalscr += "R' ";
      threeswap(stickercolWCA, 25, 20, 10);
    } else if (eq3(fst, [0, 5, 10]) || eq3(fst, [5, 10, 0]) || eq3(fst, [10, 0, 5])
      || eq3(fst, [15, 25, 20]) || eq3(fst, [25, 20, 15]) || eq3(fst, [20, 15, 25])) {
      finalscr += 'L ';
      threeswap(stickercolWCA, 0, 5, 10);
    } else if (eq3(fst, [10, 5, 0]) || eq3(fst, [0, 10, 5]) || eq3(fst, [5, 0, 10])
      || eq3(fst, [20, 25, 15]) || eq3(fst, [15, 20, 25]) || eq3(fst, [25, 15, 20])) {
      finalscr += "L' ";
      threeswap(stickercolWCA, 10, 5, 0);
    } else if (eq3(fst, [15, 0, 25]) || eq3(fst, [0, 25, 15]) || eq3(fst, [25, 15, 0])
      || eq3(fst, [5, 20, 10]) || eq3(fst, [20, 10, 5]) || eq3(fst, [10, 5, 20])) {
      finalscr += 'U ';
      threeswap(stickercolWCA, 0, 25, 15);
    } else if (eq3(fst, [25, 0, 15]) || eq3(fst, [15, 25, 0]) || eq3(fst, [0, 15, 25])
      || eq3(fst, [10, 20, 5]) || eq3(fst, [5, 10, 20]) || eq3(fst, [20, 5, 10])) {
      finalscr += "U' ";
      threeswap(stickercolWCA, 15, 25, 0);
    } else if (eq3(fst, [25, 0, 10]) || eq3(fst, [0, 10, 25]) || eq3(fst, [10, 25, 0])
      || eq3(fst, [15, 20, 5]) || eq3(fst, [20, 5, 15]) || eq3(fst, [5, 15, 20])) {
      finalscr += 'B ';
      threeswap(stickercolWCA, 0, 10, 25);
    } else if (eq3(fst, [10, 0, 25]) || eq3(fst, [25, 10, 0]) || eq3(fst, [0, 25, 10])
      || eq3(fst, [5, 20, 15]) || eq3(fst, [15, 5, 20]) || eq3(fst, [20, 15, 5])) {
      finalscr += "B' ";
      threeswap(stickercolWCA, 25, 10, 0);
    }
  }

  return finalscr;
}

// ---------------------------------------------------------------------------
// doubleMoveRemover (lines 1228-1263)
// Collapses adjacent same-face moves. NOTE: slices off the LAST token first
// (matching the source — the WCA strings it consumes carry a trailing space,
// so .split(" ").slice(0,-1) drops the empty tail token).
// ---------------------------------------------------------------------------

export function doubleMoveRemover(scramble: string): string {
  const newScr: string[] = [];
  let newScrString = '';
  const scrSplit = scramble.split(' ').slice(0, -1);

  for (let i = 0; i < scrSplit.length; i++) {
    if (newScr.length >= 1) {
      if (newScr[newScr.length - 1] === scrSplit[i]) {
        if (scrSplit[i].length === 1) {
          newScr.pop();
          newScr.push(scrSplit[i] + "'");
        } else {
          newScr.pop();
          newScr.push(scrSplit[i].charAt(0));
        }
      } else {
        if (newScr[newScr.length - 1].charAt(0) === scrSplit[i].charAt(0)) {
          newScr.pop();
        } else {
          newScr.push(scrSplit[i]);
        }
      }
    } else {
      newScr.push(scrSplit[i]);
    }
  }
  for (const move of newScr) {
    newScrString += move + ' ';
  }
  return newScrString;
}

// ---------------------------------------------------------------------------
// First-Layer move lists (lines 337-444)
// posschars = ["R","R'","L","L'","U","U'","B","B'"]; no two consecutive moves
// on the same face. Lists are memoized per length, built lazily.
// ---------------------------------------------------------------------------

const POSSCHARS = ['R', "R'", 'L', "L'", 'U', "U'", 'B', "B'"];

const flListCache = new Map<number, string[]>();

function buildFirstLayerLists(maxN: number): void {
  // length 1 (lines 339-342)
  let prev: string[] = [];
  for (let i = 0; i < POSSCHARS.length; i++) {
    prev.push(POSSCHARS[i]);
  }
  flListCache.set(1, prev.slice(0));

  // length 2 (lines 346-358): uses the indexOf-based same-face filter
  if (maxN >= 2 && !flListCache.has(2)) {
    const list2: string[] = [];
    for (let j = 0; j < prev.length; j++) {
      for (let i = 0; i < POSSCHARS.length; i++) {
        if (POSSCHARS[i].indexOf(prev[j]) !== -1) {
          continue;
        } else if (prev[j].indexOf(POSSCHARS[i]) !== -1) {
          continue;
        } else {
          list2.push(prev[j] + ' ' + POSSCHARS[i]);
        }
      }
    }
    flListCache.set(2, list2);
  }

  // lengths 3..maxN (lines 360-444): the charAt-based same-face filter
  let current = flListCache.get(2);
  for (let n = 3; n <= maxN; n++) {
    if (flListCache.has(n)) {
      current = flListCache.get(n);
      continue;
    }
    const src = current as string[];
    const next: string[] = [];
    for (let j = 0; j < src.length; j++) {
      for (let i = 0; i < POSSCHARS.length; i++) {
        if (src[j].charAt(src[j].length - 2) === ' ') {
          if (src[j].charAt(src[j].length - 1) === POSSCHARS[i].charAt(0)) {
            continue;
          }
        } else {
          if (src[j].charAt(src[j].length - 2) === POSSCHARS[i].charAt(0)) {
            continue;
          }
        }
        next.push(src[j] + ' ' + POSSCHARS[i]);
      }
    }
    flListCache.set(n, next);
    current = next;
  }
}

export function firstLayerList(n: number): string[] {
  if (!flListCache.has(n)) {
    buildFirstLayerLists(n);
  }
  return flListCache.get(n) as string[];
}

// ---------------------------------------------------------------------------
// randomFirstLayer: O(n) single random valid sequence (each move differs in
// face from the previous), space-joined. Same distribution as picking a random
// firstLayerList(n) entry, without enumerating the huge n=7 list.
// ---------------------------------------------------------------------------

export function randomFirstLayer(n: number, rng: Rng = Math.random): string {
  if (n <= 0) {
    return '';
  }
  const moves: string[] = [];
  let prevFace = '';
  for (let k = 0; k < n; k++) {
    // candidates whose face differs from prevFace (8 total, 6 valid after move 1)
    const candidates: string[] = [];
    for (const m of POSSCHARS) {
      if (m.charAt(0) !== prevFace) {
        candidates.push(m);
      }
    }
    const pick = candidates[Math.floor(rng() * candidates.length)];
    moves.push(pick);
    prevFace = pick.charAt(0);
  }
  return moves.join(' ');
}

// ---------------------------------------------------------------------------
// random rotation wrap (lines 1677-1692)
// ---------------------------------------------------------------------------

const FIRST_ROTATIONS = ['', 'x ', 'x2 ', "x' ", 'z ', "z' ", 'z2 '];
const FIRST_ROTATIONS_INV = ['', " x'", ' x2', ' x', " z'", ' z', ' z2'];
const SECOND_ROTATIONS = ['', 'y ', 'y2 ', "y' "];
const SECOND_ROTATIONS_INV = ['', " y'", ' y2', ' y'];

export function randomRotationWrap(rng: Rng = Math.random): { pre: string; post: string } {
  let firstRotationIndex = Math.floor(rng() * 6);
  let secondRotationIndex = Math.floor(rng() * 4);
  if (firstRotationIndex === 2 && secondRotationIndex === 2) {
    firstRotationIndex = 6;
    secondRotationIndex = 0;
  }
  const firstRotation = FIRST_ROTATIONS[firstRotationIndex];
  const secondRotation = SECOND_ROTATIONS[secondRotationIndex];
  const firstRotationInv = FIRST_ROTATIONS_INV[firstRotationIndex];
  const secondRotationInv = SECOND_ROTATIONS_INV[secondRotationIndex];
  const pre = firstRotation + secondRotation;
  const post = secondRotationInv + firstRotationInv;
  return { pre, post };
}

// ---------------------------------------------------------------------------
// buildAlgScramble — mirrors ScramblePlusColourAlg (lines 1662-1695):
// pre + setup + post -> transftoWCA -> doubleMoveRemover.
// ---------------------------------------------------------------------------

export function buildAlgScramble(setup: string, rng: Rng = Math.random): string {
  const { pre, post } = randomRotationWrap(rng);
  const wrapped = pre + setup + post;
  return doubleMoveRemover(transftoWCA(wrapped));
}

// ---------------------------------------------------------------------------
// buildOneLookScramble — mirrors changescrlenOL (1566-1611) +
// ScramblePlusColourOL (1709-1746): combined = transftoWCA(algSetup) +
// randomFirstLayer(extraMoves); wrap pre/post; conjugateRotationToWCA(trim);
// doubleMoveRemover.
// ---------------------------------------------------------------------------

export function buildOneLookScramble(algSetup: string, extraMoves: number, rng: Rng = Math.random): string {
  // changescrlenOL: completeScr = transftoWCA(L2L setup) + first-layer scramble.
  // transftoWCA carries a trailing space, so concatenation matches the source's
  // string + first-layer-list-entry join.
  const combined = transftoWCA(algSetup) + randomFirstLayer(extraMoves, rng);
  // ScramblePlusColourOL: wrap with random rotations, trim, conjugate, collapse.
  const { pre, post } = randomRotationWrap(rng);
  const wrapped = pre + combined + post;
  return doubleMoveRemover(conjugateRotationToWCA(wrapped.trim()));
}
