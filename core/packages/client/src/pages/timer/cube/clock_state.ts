/** Clock scramble simulator — ported from cstimer/scramble/clock.js.
 *
 * Model: 14 independent dials matching cstimer's solver layout.
 *   slot  0..8  : front 3x3 in row-major order
 *                 0=TL 1=TC 2=TR 3=ML 4=MC 5=MR 6=BL 7=BC 8=BR
 *   slot  9..12 : back-side 4 corners (TL TR BL BR in back-view orientation)
 *   slot  13    : back-side centre
 * Each dial value is in 0..11 (hour the hand points to; 0 = 12 o'clock).
 *
 * The 4 non-corner back-edge dials (top/bottom/left/right of back grid) are
 * gear-coupled to the corresponding front-edge dials and are not stored
 * independently; ClockFace derives them from the front-edge slots.
 *
 * Pins: 4 corner pins (UR, DR, DL, UL) — each up or down. WCA notation
 * embeds pin configuration in the move letter:
 *
 *   UR / DR / DL / UL : that single corner pin up, others down
 *   U                 : both top pins up (UR + UL)
 *   R                 : both right pins up (UR + DR)
 *   D                 : both bottom pins up (DR + DL)
 *   L                 : both left pins up (UL + DL)
 *   ALL               : all 4 pins up
 *
 * `y2` flips the puzzle. Pin labels are interpreted in the currently-
 * facing side's frame; under the hood this selects rows 9..17 of moveArr.
 * After `y2`, an optional trailing pin descriptor like `UR DL` lists which
 * pins the user wants up at the end of the scramble (for the solver). For
 * visualisation we honour it as the final pin state.
 */

export type ClockSide = 'front' | 'back';

export interface ClockState {
  /** 14 independent dials; see slot map above. */
  dials: number[];
  /** Pin up/down — indexed [UR, DR, DL, UL] in front-frame. true = up. */
  pinsFront: [boolean, boolean, boolean, boolean];
}

// moveArr ported verbatim from cstimer/src/js/scramble/clock.js.
//   rows  0..8  apply on the side currently facing the solver (front-frame)
//   rows  9..17 apply on the opposite side (after `y2`)
//   row order within each block: UR DR DL UL U R D L ALL
const MOVE_ARR: ReadonlyArray<ReadonlyArray<number>> = [
  [ 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], // UR
  [ 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0], // DR
  [ 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0], // DL
  [ 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], // UL
  [ 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], // U
  [ 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0], // R
  [ 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // D
  [ 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0], // L
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // ALL
  [11, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0], // UR (back)
  [ 0, 0, 0, 0, 0, 0,11, 0, 0, 0, 0, 1, 1, 1], // DR (back)
  [ 0, 0, 0, 0, 0, 0, 0, 0,11, 0, 1, 1, 0, 1], // DL (back)
  [ 0, 0,11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0], // UL (back)
  [11, 0,11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0], // U  (back)
  [11, 0, 0, 0, 0, 0,11, 0, 0, 1, 0, 1, 1, 1], // R  (back)
  [ 0, 0, 0, 0, 0, 0,11, 0,11, 0, 1, 1, 1, 1], // D  (back)
  [ 0, 0,11, 0, 0, 0, 0, 0,11, 1, 1, 1, 0, 1], // L  (back)
  [11, 0,11, 0, 0, 0,11, 0,11, 1, 1, 1, 1, 1], // ALL(back)
];

const MOVE_INDEX: Record<string, number> = {
  UR: 0, DR: 1, DL: 2, UL: 3, U: 4, R: 5, D: 6, L: 7, ALL: 8,
};

// Pin index in pinsFront: 0=UR, 1=DR, 2=DL, 3=UL.
const PIN_FOR_MOVE: Record<string, [boolean, boolean, boolean, boolean]> = {
  UR:  [true,  false, false, false],
  DR:  [false, true,  false, false],
  DL:  [false, false, true,  false],
  UL:  [false, false, false, true ],
  U:   [true,  false, false, true ],
  R:   [true,  true,  false, false],
  D:   [false, true,  true,  false],
  L:   [false, false, true,  true ],
  ALL: [true,  true,  true,  true ],
};

export function clockSolved(): ClockState {
  return {
    dials: Array<number>(14).fill(0),
    pinsFront: [false, false, false, false],
  };
}

interface ParsedTurn {
  kind: 'turn';
  move: keyof typeof MOVE_INDEX;
  delta: number; // signed, will be reduced mod 12
}
interface ParsedFlip { kind: 'flip'; }
interface ParsedPinDescriptor {
  kind: 'pins';
  pins: [boolean, boolean, boolean, boolean];
}
type ParsedMove = ParsedTurn | ParsedFlip | ParsedPinDescriptor;

const TURN_RE = /^(UR|UL|DR|DL|ALL|U|R|D|L)([0-9]+)([+-])$/;
const BARE_PIN_RE = /^(UR|UL|DR|DL)$/;

function tokenise(s: string): string[] {
  return s.split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 0);
}

export function parseClockScramble(s: string): ParsedMove[] {
  const out: ParsedMove[] = [];
  if (!s) return out;
  const toks = tokenise(s);
  // Trailing bare pin tokens (UR / UL / DR / DL with no digit/sign): merge
  // into a single pin descriptor so we know to apply them at the end.
  let trailingPins: [boolean, boolean, boolean, boolean] | null = null;
  while (toks.length > 0 && BARE_PIN_RE.test(toks[toks.length - 1])) {
    const t = toks.pop()!;
    if (!trailingPins) trailingPins = [false, false, false, false];
    if (t === 'UR') trailingPins[0] = true;
    else if (t === 'DR') trailingPins[1] = true;
    else if (t === 'DL') trailingPins[2] = true;
    else if (t === 'UL') trailingPins[3] = true;
  }
  for (const tok of toks) {
    if (tok === 'y2' || tok === 'y2+' || tok === 'y2-') {
      out.push({ kind: 'flip' });
      continue;
    }
    const m = TURN_RE.exec(tok);
    if (m) {
      const move = m[1] as keyof typeof MOVE_INDEX;
      const k = parseInt(m[2], 10);
      const sign = m[3] === '+' ? 1 : -1;
      out.push({ kind: 'turn', move, delta: sign * k });
      continue;
    }
    // Unknown token (including stray bare pin in the middle): skip silently.
  }
  if (trailingPins) {
    out.push({ kind: 'pins', pins: trailingPins });
  }
  return out;
}

function applyTurn(
  dials: number[],
  move: keyof typeof MOVE_INDEX,
  delta: number,
  flipped: boolean,
): void {
  const rowIdx = MOVE_INDEX[move] + (flipped ? 9 : 0);
  const row = MOVE_ARR[rowIdx];
  const d = ((delta % 12) + 12) % 12;
  if (d === 0) return;
  for (let i = 0; i < 14; i++) {
    if (row[i] === 0) continue;
    // row[i] is 1 or 11 (= -1 mod 12). Multiply by delta.
    const step = row[i] === 1 ? d : ((-d % 12) + 12) % 12;
    dials[i] = (dials[i] + step) % 12;
  }
}

export function applyClockScramble(scramble: string): ClockState {
  const state = clockSolved();
  let flipped = false;
  let lastPins: [boolean, boolean, boolean, boolean] | null = null;
  let trailingPins: [boolean, boolean, boolean, boolean] | null = null;
  for (const m of parseClockScramble(scramble)) {
    if (m.kind === 'flip') {
      flipped = !flipped;
      continue;
    }
    if (m.kind === 'pins') {
      trailingPins = m.pins;
      continue;
    }
    applyTurn(state.dials, m.move, m.delta, flipped);
    // Pin config implied by the move letter — interpret in front-frame.
    // When flipped, the move's UR is geometrically the front-UL etc., so
    // we mirror left-right. Mapping under y2 flip:
    //   UR <-> UL,  DR <-> DL  (top/bottom unchanged, left/right swap)
    const movePins = PIN_FOR_MOVE[m.move];
    if (flipped) {
      // movePins ordering [UR, DR, DL, UL] in current (back) frame.
      // Front-frame: [UR, DR, DL, UL] = [UL_back, DL_back, DR_back, UR_back]
      lastPins = [movePins[3], movePins[2], movePins[1], movePins[0]];
    } else {
      lastPins = [...movePins];
    }
  }
  if (trailingPins) {
    state.pinsFront = trailingPins;
  } else if (lastPins) {
    state.pinsFront = lastPins;
  }
  return state;
}

/** Derive a 9-cell back-grid view from the 14-slot state.
 * Back-grid row-major (TL TC TR ML MC MR BL BC BR):
 *   corners come from slots 9..12 (back TL/TR/BL/BR),
 *   centre comes from slot 13,
 *   edges are gear-coupled from front edges (front[1,3,5,7]) and
 *   appear horizontally mirrored when viewed from the back.
 * For our visualisation we copy front-edge values straight across; the
 * gear-coupling means the back-edge dial reads the same hour as the
 * matching front edge.
 */
export function backGridDisplay(state: ClockState): number[] {
  const d = state.dials;
  const f = d;
  return [
    d[9],          // TL back corner
    f[1],          // TC = front TC (gear coupled)
    d[10],         // TR back corner
    f[5],          // ML = front MR (mirrored)
    d[13],         // MC back centre
    f[3],          // MR = front ML (mirrored)
    d[11],         // BL back corner
    f[7],          // BC = front BC
    d[12],         // BR back corner
  ];
}

/** Front 3x3 grid is just slots 0..8. */
export function frontGridDisplay(state: ClockState): number[] {
  return state.dials.slice(0, 9);
}

// ---------------------------------------------------------------------------
// Self-check (executed lazily, only when explicitly invoked) — verifies the
// porting against a known scramble + its inverse round-tripping to solved.
// ---------------------------------------------------------------------------

function statesEqual(a: ClockState, b: ClockState): boolean {
  for (let i = 0; i < 14; i++) if (a.dials[i] !== b.dials[i]) return false;
  return true;
}

function invertScramble(s: string): string {
  // Invert each turn: flip the sign. Keep `y2` and bare pin tokens untouched.
  // To invert order we also reverse the token sequence, but `y2` must stay
  // partitioning front/back blocks — for clock the inverse of a full
  // scramble (front-block + y2 + back-block) is (inverted-back-block + y2 +
  // inverted-front-block).
  const toks = tokenise(s);
  // Strip trailing bare pins (don't affect dials).
  while (toks.length > 0 && BARE_PIN_RE.test(toks[toks.length - 1])) toks.pop();
  const yIdx = toks.indexOf('y2');
  const front = yIdx >= 0 ? toks.slice(0, yIdx) : toks.slice();
  const back = yIdx >= 0 ? toks.slice(yIdx + 1) : [];
  const invertBlock = (blk: string[]) =>
    blk.slice().reverse().map((t) => {
      const m = TURN_RE.exec(t);
      if (!m) return t;
      const sign = m[3] === '+' ? '-' : '+';
      return `${m[1]}${m[2]}${sign}`;
    });
  const parts = [...invertBlock(back)];
  if (yIdx >= 0) parts.push('y2');
  parts.push(...invertBlock(front));
  return parts.join(' ');
}

/** Returns null on success or an error message string. */
export function clockStateSelfCheck(): string | null {
  const scramble = 'UR3+ DR2- DL1+ UL5+ U4- R3+ D2- L1- ALL2+ y2 U3+ R5- D2+ L4+ ALL3-';
  const after = applyClockScramble(scramble);
  // Apply the inverse on top — should return to solved.
  // We do this by simulating both forward then inverse on a fresh state.
  const combined = `${scramble} ${invertScramble(scramble)}`;
  const round = applyClockScramble(combined);
  const solved = clockSolved();
  if (!statesEqual(round, solved)) {
    return `roundtrip failed: dials=${round.dials.join(',')}`;
  }
  // Spot-check: applying just `UR3+` from solved should rotate slots 1,2,4,5
  // by +3 and leave others alone (per moveArr row 0).
  const ur = applyClockScramble('UR3+');
  const expected = [0, 3, 3, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 14; i++) {
    if (ur.dials[i] !== expected[i]) {
      return `UR3+ slot ${i}: got ${ur.dials[i]}, expected ${expected[i]}`;
    }
  }
  // Spot-check: after `y2 ALL3+` from solved, all back slots advance +3 and
  // the 4 front corners go -3 (= 9), per moveArr row 17.
  const allBack = applyClockScramble('y2 ALL3+');
  const expectedBack = [9, 0, 9, 0, 0, 0, 9, 0, 9, 3, 3, 3, 3, 3];
  for (let i = 0; i < 14; i++) {
    if (allBack.dials[i] !== expectedBack[i]) {
      return `y2 ALL3+ slot ${i}: got ${allBack.dials[i]}, expected ${expectedBack[i]}`;
    }
  }
  // Also exercise the visible scramble result so `after` isn't unused.
  if (after.dials.length !== 14) return 'dial length wrong';
  return null;
}
