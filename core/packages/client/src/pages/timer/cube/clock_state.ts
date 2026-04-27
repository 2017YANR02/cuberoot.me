/** Clock scramble simulator (simplified, region-based).
 *
 * State: 18 dials = front[0..8] (3×3) + back[0..8] (3×3), each storing
 * an integer in [0..11] for the hour the dial is pointing to (0 = 12 o'clock).
 *
 * Front 3×3 grid layout:
 *     0(TL) 1(TC) 2(TR)
 *     3(ML) 4(MC) 5(MR)
 *     6(BL) 7(BC) 8(BR)
 * Back grid uses the same indexing (mirrored visually but sharing index
 * scheme for simplicity).
 *
 * Tokens accepted:
 *   `URk+` `URk-` `ULk+` `ULk-` `DRk+` `DRk-` `DLk+` `DLk-` `ALLk+` `ALLk-`
 *     where k ∈ 1..9, sign ∈ {+, -}. Comma after token is allowed.
 *   `y2` flips the active side (front ↔ back). Subsequent moves apply
 *     to the back side until another flip.
 *   Standalone pin tokens like `UR DR DL UL` (without trailing digits) at
 *     the end of a scramble describe pin-up positions; we ignore them
 *     since this simplified simulator does not track pin-gated motion.
 *
 * Simplification: in real WCA clock, only dials whose nearest peg is up
 * actually rotate; tracking that perfectly requires per-pin DOWN/UP
 * bookkeeping that interacts with each move. Here we treat each move as
 * "rotate the 4 dials in the implied corner region" (2×2 sub-grid for
 * UR/UL/DR/DL, all 9 for ALL). This is enough to give a recognisably
 * scrambled clock display for preview purposes — see task spec.
 */

export type ClockSide = 'front' | 'back';

export interface ClockState {
  front: number[];  // length 9
  back: number[];   // length 9
}

export function clockSolved(): ClockState {
  return {
    front: Array<number>(9).fill(0),
    back: Array<number>(9).fill(0),
  };
}

type Region = 'UR' | 'UL' | 'DR' | 'DL' | 'ALL';

// Indices of the 4 dials in each 2×2 corner region of the 3×3 grid.
const REGION_DIALS: Record<Region, number[]> = {
  UL: [0, 1, 3, 4],
  UR: [1, 2, 4, 5],
  DL: [3, 4, 6, 7],
  DR: [4, 5, 7, 8],
  ALL: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function rotateDials(dials: number[], idxs: number[], delta: number): void {
  const d = ((delta % 12) + 12) % 12;
  if (d === 0) return;
  for (const i of idxs) dials[i] = (dials[i] + d) % 12;
}

interface ParsedTurn {
  kind: 'turn';
  region: Region;
  delta: number; // signed, -11..11 (mod 12 applied later)
}
interface ParsedFlip {
  kind: 'flip';
}
type ParsedMove = ParsedTurn | ParsedFlip;

const TOKEN_RE = /^(UR|UL|DR|DL|ALL)([0-9]+)([+-])$/;

/** Tokenise on whitespace and commas. */
function tokenise(s: string): string[] {
  return s.split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 0);
}

export function parseClockScramble(s: string): ParsedMove[] {
  const out: ParsedMove[] = [];
  if (!s) return out;
  for (const tok of tokenise(s)) {
    if (tok === 'y2' || tok === 'y2+' || tok === 'y2-') {
      out.push({ kind: 'flip' });
      continue;
    }
    const m = TOKEN_RE.exec(tok);
    if (m) {
      const region = m[1] as Region;
      const k = parseInt(m[2], 10);
      const sign = m[3] === '+' ? 1 : -1;
      out.push({ kind: 'turn', region, delta: sign * k });
      continue;
    }
    // Bare `UR`/`UL`/etc. (pin-state markers) and anything else: ignore.
  }
  return out;
}

export function applyClockScramble(scramble: string): ClockState {
  const state = clockSolved();
  let side: ClockSide = 'front';
  for (const m of parseClockScramble(scramble)) {
    if (m.kind === 'flip') {
      side = side === 'front' ? 'back' : 'front';
      continue;
    }
    const dials = side === 'front' ? state.front : state.back;
    rotateDials(dials, REGION_DIALS[m.region], m.delta);
  }
  return state;
}
