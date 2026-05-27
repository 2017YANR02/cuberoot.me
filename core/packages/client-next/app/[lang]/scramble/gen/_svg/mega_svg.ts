/**
 * Megaminx puzzle — TS port of tnoodle-lib `MegaminxPuzzle.java`
 * (D:\cube\tnoodle-lib\scrambles\src\main\java\.../puzzle/MegaminxPuzzle.java).
 *
 * Replaces the cubing.js TwistyPlayer-based extraction (which was 15 s+ per
 * mega attempt and intermittently produced empty SVGs) with a synchronous,
 * recolorable, per-call ~1 ms generator.
 *
 * Ports verbatim:
 *   - 12-face × 11-sticker state model (10 outer wedges + 1 center)
 *   - turn() face permutation table for U / BL / BR / R / F / L
 *   - bigTurn() for Pochmann R / D ("R++" / "R--" / "D++" / "D--")
 *   - getFaceBoundaries() pentagon-cluster layout
 *   - drawPentagon() 11-path subdivision (5 corners + 5 edges + center)
 *
 * Scramble token grammar follows the WCA mega convention emitted by both
 * cubing.js and tnoodle: R++ R-- D++ D-- U U' U2 U2' (whitespace-separated,
 * newline allowed between cycles).
 */

const FACE_NAMES = ['U', 'BL', 'BR', 'R', 'F', 'L', 'D', 'DR', 'DBR', 'B', 'DBL', 'DL'] as const;
export type MegaFaceKey = typeof FACE_NAMES[number];

/** Verbatim from tnoodle MegaminxPuzzle.java defaultColorScheme. */
export const DEFAULT_MEGA_COLORS: Record<MegaFaceKey, string> = {
  U:   '#ffffff',
  BL:  '#ffcc00',
  BR:  '#0000b3',
  R:   '#dd0000',
  F:   '#006600',
  L:   '#8a1aff',
  D:   '#999999',
  DR:  '#ffffb3',
  DBR: '#ff99ff',
  B:   '#71e600',
  DBL: '#ff8433',
  DL:  '#88ddff',
};

// Face ordinals
const U = 0, BL = 1, BR = 2, R = 3, F = 4, L = 5, D = 6, DR = 7, DBR = 8, B = 9, DBL = 10, DL = 11;
void BL; void BR; void R; void F; void L; void DR; void DBR; void B; void DBL; void DL;

/** 12 × 11 image: image[face][slot]. Slots 0..9 = outer wedges, 10 = center. */
export type MegaState = number[][];

function solvedState(): MegaState {
  const out: MegaState = [];
  for (let f = 0; f < 12; f++) {
    const row: number[] = new Array(11);
    for (let s = 0; s < 11; s++) row[s] = f;
    out.push(row);
  }
  return out;
}

// ─── State mutators (verbatim port) ─────────────────────────────────────
function swap5(image: MegaState, f1: number, s1: number, f2: number, s2: number, f3: number, s3: number, f4: number, s4: number, f5: number, s5: number): void {
  const t = image[f1][s1];
  image[f1][s1] = image[f2][s2];
  image[f2][s2] = image[f3][s3];
  image[f3][s3] = image[f4][s4];
  image[f4][s4] = image[f5][s5];
  image[f5][s5] = t;
}

function swapOnSide(image: MegaState, b: number, f1: number, s1: number, f2: number, s2: number, f3: number, s3: number, f4: number, s4: number, f5: number, s5: number): void {
  for (let i = 0; i < 3; i++) {
    const t = image[(f1 + b) % 12][(s1 + i) % 10];
    image[(f1 + b) % 12][(s1 + i) % 10] = image[(f2 + b) % 12][(s2 + i) % 10];
    image[(f2 + b) % 12][(s2 + i) % 10] = image[(f3 + b) % 12][(s3 + i) % 10];
    image[(f3 + b) % 12][(s3 + i) % 10] = image[(f4 + b) % 12][(s4 + i) % 10];
    image[(f4 + b) % 12][(s4 + i) % 10] = image[(f5 + b) % 12][(s5 + i) % 10];
    image[(f5 + b) % 12][(s5 + i) % 10] = t;
  }
}

function swapOnFace(image: MegaState, f: number, s1: number, s2: number, s3: number, s4: number, s5: number): void {
  const t = image[f][s1];
  image[f][s1] = image[f][s2];
  image[f][s2] = image[f][s3];
  image[f][s3] = image[f][s4];
  image[f][s4] = image[f][s5];
  image[f][s5] = t;
}

function rotateFace(image: MegaState, face: number): void {
  swapOnFace(image, face, 0, 8, 6, 4, 2);
  swapOnFace(image, face, 1, 9, 7, 5, 3);
}

function turnOnce(image: MegaState, face: number): void {
  const s = face;
  const b = s >= 6 ? 6 : 0;
  switch (s % 6) {
    case 0: swapOnSide(image, b, 1, 6, 5, 4, 4, 2, 3, 0, 2, 8); break;
    case 1: swapOnSide(image, b, 0, 0, 2, 0, 9, 6, 10, 6, 5, 2); break;
    case 2: swapOnSide(image, b, 0, 2, 3, 2, 8, 4, 9, 4, 1, 4); break;
    case 3: swapOnSide(image, b, 0, 4, 4, 4, 7, 2, 8, 2, 2, 6); break;
    case 4: swapOnSide(image, b, 0, 6, 5, 6, 11, 0, 7, 0, 3, 8); break;
    case 5: swapOnSide(image, b, 0, 8, 1, 8, 10, 8, 11, 8, 4, 0); break;
  }
  rotateFace(image, face);
}

function turn(image: MegaState, face: number, dir: number): void {
  const d = ((dir % 5) + 5) % 5;
  for (let i = 0; i < d; i++) turnOnce(image, face);
}

function swap5Centers(image: MegaState, f1: number, f2: number, f3: number, f4: number, f5: number): void {
  swap5(image, f1, 10, f2, 10, f3, 10, f4, 10, f5, 10);
}

function swapWholeFace(image: MegaState, f1: number, s1: number, f2: number, s2: number, f3: number, s3: number, f4: number, s4: number, f5: number, s5: number): void {
  for (let i = 0; i < 10; i++) {
    const t = image[f1 % 12][(s1 + i) % 10];
    image[f1 % 12][(s1 + i) % 10] = image[f2 % 12][(s2 + i) % 10];
    image[f2 % 12][(s2 + i) % 10] = image[f3 % 12][(s3 + i) % 10];
    image[f3 % 12][(s3 + i) % 10] = image[f4 % 12][(s4 + i) % 10];
    image[f4 % 12][(s4 + i) % 10] = image[f5 % 12][(s5 + i) % 10];
    image[f5 % 12][(s5 + i) % 10] = t;
  }
  swap5Centers(image, f1, f2, f3, f4, f5);
}

function bigTurnOnce(image: MegaState, face: number): void {
  if (face === DBR) {
    for (let i = 0; i < 7; i++) {
      swap5(image, 0, (1 + i) % 10, 4, (3 + i) % 10, 11, (1 + i) % 10, 10, (1 + i) % 10, 1, (1 + i) % 10);
    }
    swap5Centers(image, 0, 4, 11, 10, 1);
    swapWholeFace(image, 2, 0, 3, 0, 7, 0, 6, 8, 9, 8);
    rotateFace(image, DBR);
  } else if (face === D) {
    for (let i = 0; i < 7; i++) {
      swap5(image, 1, (9 + i) % 10, 2, (1 + i) % 10, 3, (3 + i) % 10, 4, (5 + i) % 10, 5, (7 + i) % 10);
    }
    swap5Centers(image, 1, 2, 3, 4, 5);
    swapWholeFace(image, 11, 0, 10, 8, 9, 6, 8, 4, 7, 2);
    rotateFace(image, D);
  }
}

function bigTurn(image: MegaState, face: number, dir: number): void {
  const d = ((dir % 5) + 5) % 5;
  for (let i = 0; i < d; i++) bigTurnOnce(image, face);
}

/** Apply a WCA-spec mega scramble. Recognized tokens: R++ R-- D++ D-- U U' U2 U2'. */
export function applyMegaScramble(scramble: string): MegaState {
  const state = solvedState();
  const tokens = scramble.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  for (const tok of tokens) {
    switch (tok) {
      case 'R++':  bigTurn(state, DBR, 2); break;
      case 'R--':  bigTurn(state, DBR, 3); break;  // -2 mod 5
      case 'R+':   bigTurn(state, DBR, 1); break;
      case 'R-':   bigTurn(state, DBR, 4); break;
      case 'D++':  bigTurn(state, D, 2); break;
      case 'D--':  bigTurn(state, D, 3); break;
      case 'D+':   bigTurn(state, D, 1); break;
      case 'D-':   bigTurn(state, D, 4); break;
      case 'U':    turn(state, U, 1); break;
      case "U'":   turn(state, U, 4); break;
      case 'U2':   turn(state, U, 2); break;
      case "U2'":  turn(state, U, 3); break;
      // Other Carrot/full-face moves are not used in WCA scrambles; ignore.
    }
  }
  return state;
}

// ─── SVG renderer ────────────────────────────────────────────────────────
const PI = Math.PI;
const GAP = 2;
const MINX_RAD = 30;
const UNFOLD_HEIGHT = 2 + 3 * Math.sin(0.3 * PI) + Math.sin(0.1 * PI);
const UNFOLD_WIDTH = 4 * Math.cos(0.1 * PI) + 2 * Math.cos(0.3 * PI);
const W = Math.floor(UNFOLD_WIDTH * 2 * MINX_RAD + 3 * GAP);
const H = Math.floor(UNFOLD_HEIGHT * MINX_RAD + 2 * GAP);

const X_DIST = MINX_RAD * Math.sqrt(2 * (1 - Math.cos(0.6 * PI)));
const A = MINX_RAD * Math.cos(0.1 * PI);
const BB = X_DIST * Math.cos(0.1 * PI);
const C = X_DIST * Math.cos(0.3 * PI);
const Dconst = X_DIST * Math.sin(0.1 * PI);
const E = X_DIST * Math.sin(0.3 * PI);

const LEFT_CX = GAP + A + BB + Dconst / 2;
const LEFT_CY = GAP + X_DIST + MINX_RAD - Dconst;

const F_COS = Math.cos(0.1 * PI);
const G_COS = Math.cos(0.2 * PI);
const MAGIC_SHIFT = Dconst * 0.6 + MINX_RAD * (F_COS + G_COS);
const SHIFT = LEFT_CX + MAGIC_SHIFT;

interface FaceCenter { cx: number; cy: number; up: boolean; }
const FACE_CENTERS: FaceCenter[] = [
  /* U   */ { cx: LEFT_CX,             cy: LEFT_CY,                          up: true },
  /* BL  */ { cx: LEFT_CX - C,         cy: LEFT_CY - E,                      up: false },
  /* BR  */ { cx: LEFT_CX + C,         cy: LEFT_CY - E,                      up: false },
  /* R   */ { cx: LEFT_CX + BB,        cy: LEFT_CY + Dconst,                 up: false },
  /* F   */ { cx: LEFT_CX,             cy: LEFT_CY + X_DIST,                 up: false },
  /* L   */ { cx: LEFT_CX - BB,        cy: LEFT_CY + Dconst,                 up: false },
  /* D   */ { cx: SHIFT + GAP + A + BB,        cy: GAP + X_DIST + MINX_RAD,         up: false },
  /* DR  */ { cx: SHIFT + GAP + A + BB - C,    cy: GAP + X_DIST + E + MINX_RAD,     up: true },
  /* DBR */ { cx: SHIFT + GAP + A,             cy: GAP + X_DIST - Dconst + MINX_RAD,up: true },
  /* B   */ { cx: SHIFT + GAP + A + BB,        cy: GAP + MINX_RAD,                  up: true },
  /* DBL */ { cx: SHIFT + GAP + A + 2 * BB,    cy: GAP + X_DIST - Dconst + MINX_RAD,up: true },
  /* DL  */ { cx: SHIFT + GAP + A + BB + C,    cy: GAP + X_DIST + E + MINX_RAD,     up: true },
];

function det(a: number, b: number, c: number, d: number): number {
  return a * d - b * c;
}

function lineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): [number, number] {
  const denom = det(x1 - x2, y1 - y2, x3 - x4, y3 - y4);
  const xnum = det(det(x1, y1, x2, y2), x1 - x2, det(x3, y3, x4, y4), x3 - x4);
  const ynum = det(det(x1, y1, x2, y2), y1 - y2, det(x3, y3, x4, y4), y3 - y4);
  return [xnum / denom, ynum / denom];
}

function drawPentagon(
  parts: string[],
  cx: number, cy: number, pointup: boolean,
  faceState: number[],
  rotateCCW: number,
  label: string | null,
  colors: Record<string, string>,
): void {
  const angs = [1.3, 1.7, 0.1, 0.5, 0.9];
  if (pointup) for (let i = 0; i < 5; i++) angs[i] -= 0.2;
  const xpts: number[] = new Array(5);
  const ypts: number[] = new Array(5);
  for (let i = 0; i < 5; i++) {
    xpts[i] = cx + MINX_RAD * Math.cos(angs[i] * PI);
    ypts[i] = cy + MINX_RAD * Math.sin(angs[i] * PI);
  }

  const xs: number[] = new Array(10);
  const ys: number[] = new Array(10);
  for (let i = 0; i < 5; i++) {
    xs[i]     = 0.4 * xpts[(i + 1) % 5] + 0.6 * xpts[i];
    ys[i]     = 0.4 * ypts[(i + 1) % 5] + 0.6 * ypts[i];
    xs[i + 5] = 0.6 * xpts[(i + 1) % 5] + 0.4 * xpts[i];
    ys[i + 5] = 0.6 * ypts[(i + 1) % 5] + 0.4 * ypts[i];
  }

  const intpent: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    intpent.push(lineIntersection(
      xs[i],           ys[i],           xs[5 + (3 + i) % 5], ys[5 + (3 + i) % 5],
      xs[(i + 1) % 5], ys[(i + 1) % 5], xs[5 + (4 + i) % 5], ys[5 + (4 + i) % 5],
    ));
  }

  // Build the 11 paths (10 outer stickers + 1 center pentagon)
  const ds: string[] = new Array(11);
  // ps[10] — center pentagon
  {
    let d = `M ${intpent[0][0]} ${intpent[0][1]}`;
    for (let i = 1; i < 5; i++) d += ` L ${intpent[i][0]} ${intpent[i][1]}`;
    ds[10] = d + ' Z';
  }
  for (let i = 0; i < 5; i++) {
    // ps[2*i] — corner sticker
    ds[2 * i] =
      `M ${xpts[i]} ${ypts[i]}` +
      ` L ${xs[i]} ${ys[i]}` +
      ` L ${intpent[i][0]} ${intpent[i][1]}` +
      ` L ${xs[5 + (4 + i) % 5]} ${ys[5 + (4 + i) % 5]} Z`;
    // ps[2*i+1] — edge sticker
    ds[2 * i + 1] =
      `M ${xs[i]} ${ys[i]}` +
      ` L ${xs[i + 5]} ${ys[i + 5]}` +
      ` L ${intpent[(i + 1) % 5][0]} ${intpent[(i + 1) % 5][1]}` +
      ` L ${intpent[i][0]} ${intpent[i][1]} Z`;
  }

  for (let i = 0; i < 11; i++) {
    let j = i;
    if (j < 10) j = (j + 2 * rotateCCW) % 10;
    const stateFace = faceState[j];
    const colorName = FACE_NAMES[stateFace];
    const fill = colors[colorName] ?? DEFAULT_MEGA_COLORS[colorName as MegaFaceKey] ?? '#888';
    parts.push(
      `<path d="${ds[i]}" fill="${fill}" stroke="#000" stroke-width="1" stroke-linejoin="round" />`,
    );
  }

  if (label) {
    let lcx = 0, lcy = 0;
    let minY = Infinity, maxY = -Infinity;
    for (const p of intpent) {
      lcx += p[0]; lcy += p[1];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    lcx /= 5; lcy /= 5;
    const dy = Math.round(Math.abs(maxY - minY) * 0.2);
    parts.push(
      `<text x="${lcx}" y="${lcy}" text-anchor="middle" font-family="sans-serif" dy="${dy}px" fill="#000">${label}</text>`,
    );
  }
}

export function renderMegaSvg(state: MegaState, colors: Record<string, string>): string {
  const parts: string[] = [];
  for (let f = 0; f < 12; f++) {
    const fc = FACE_CENTERS[f];
    const rotateCCW = f === 0 ? 0 : (f >= 1 && f <= 5 ? 1 : 2);
    const label = f === 0 ? 'U' : (f === 4 ? 'F' : null);
    drawPentagon(parts, fc.cx, fc.cy, fc.up, state[f], rotateCCW, label, colors);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" stroke-linecap="round" style="width:100%;height:100%">${parts.join('')}</svg>`;
}

/** Convenience: scramble string + colors → final SVG. */
export function renderMegaScrambleSvg(scramble: string, colors: Record<string, string>): string {
  return renderMegaSvg(applyMegaScramble(scramble), colors);
}
