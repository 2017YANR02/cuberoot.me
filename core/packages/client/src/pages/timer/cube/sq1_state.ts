/** Square-1 scramble simulator — bit-exact port of cstimer's slice/turn model.
 *
 * State model (mirrors cstimer's SqCubie):
 *   - 24 piece slots indexed 0..23.
 *       0..5   = ul (top, "back-left half" of top layer)
 *       6..11  = ur (top, "front-right half" of top layer)
 *       12..17 = dl (bottom, "front-left half" of bottom layer)
 *       18..23 = dr (bottom, "back-right half" of bottom layer)
 *     Slot 0 / slot 12 sit at angle 0 on each layer ring; index increases CW
 *     when looking down at the puzzle from above.
 *   - Each slot holds a piece id 0..15:
 *       0..7  = top-set pieces  (W on outward face)
 *       8..15 = bot-set pieces  (Y on outward face)
 *     Even ids = edges (1 slot each). Odd ids = corners (2 adjacent slots
 *     hold the same id; both halves move together).
 *   - `ml` bit 0/1 tracks the slice-line orientation. Toggled on each `/`.
 *
 * Solved layout:
 *     pieces  = [0,1,1,2,3,3, 4,5,5,6,7,7, 9,9,8,11,11,10, 13,13,12,15,15,14]
 *     ml      = 0
 *
 *   Top:    UB UBL UBL UL UFL UFL UF UFR UFR UR UBR UBR
 *   Bot:    DBR DBR DR DFR DFR DF DFL DFL DL DBL DBL DB
 *
 * Moves:
 *   Top rotation by `t` (WCA-signed, positive = CW from above) shifts the top
 *   array such that new[i] = old[(i + ((12 - t) mod 12)) mod 12], i.e. slot
 *   contents move to slot+t (mod 12). Bottom rotation works the same way on
 *   the bottom array. Slice (`/`) swaps pieces[6..11] with pieces[12..17] and
 *   toggles `ml`. This is the exact algorithm cstimer's SqCubie.doMove uses,
 *   just expressed on a flat array instead of packed hex words.
 *
 *   Note: WCA-valid Sq1 scrambles never request a top/bottom rotation that
 *   would cut a corner, so the slice always finds a clean cut. If the
 *   notation supplied here ever does cut a corner, the renderer falls back
 *   to drawing the corner halves as if they were separate pieces (no crash).
 */

export type FaceColor = 'W' | 'Y';
export type SideColor = 'F' | 'B' | 'L' | 'R';

export interface Sq1State {
  pieces: number[]; // length 24
  ml: 0 | 1;
}

/** Piece id catalog. Index = piece id; value = side-sticker colors going CW
 *  from the angular position where this piece sits in solved state. Edges
 *  have a single colour; corners have two (first half then second half). */
const PIECE_SIDES: SideColor[][] = [
  ['B'],            // 0  UB
  ['B', 'L'],       // 1  UBL
  ['L'],            // 2  UL
  ['L', 'F'],       // 3  UFL
  ['F'],            // 4  UF
  ['F', 'R'],       // 5  UFR
  ['R'],            // 6  UR
  ['R', 'B'],       // 7  UBR
  ['R'],            // 8  DR
  ['B', 'R'],       // 9  DBR
  ['F'],            // 10 DF
  ['R', 'F'],       // 11 DFR
  ['L'],            // 12 DL
  ['F', 'L'],       // 13 DFL
  ['B'],            // 14 DB
  ['L', 'B'],       // 15 DBL
];

const SOLVED_PIECES: number[] = [
  // top layer (slots 0..11)
  0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7,
  // bottom layer (slots 12..23)
  9, 9, 8, 11, 11, 10, 13, 13, 12, 15, 15, 14,
];

export function sq1Solved(): Sq1State {
  return { pieces: SOLVED_PIECES.slice(), ml: 0 };
}

function isCorner(pieceId: number): boolean {
  return (pieceId & 1) === 1;
}

/** True if the layer has no corner pair straddling its boundary i.e. the
 *  cut between layer-low-half (idx 0..5 for top, 12..17 for bottom) and
 *  layer-high-half (6..11 / 18..23) is clean. cstimer's data layout splits
 *  each layer into two 6-slot halves; the slice cut runs between them. */
function isLayerSliceClean(state: Sq1State, layer: 'top' | 'bot'): boolean {
  const baseLow = layer === 'top' ? 0 : 12;
  const baseHigh = layer === 'top' ? 6 : 18;
  // boundary between slots 5 and 6 (top) or 17 and 18 (bot)
  const ePrev = state.pieces[baseLow + 5];
  const eNext = state.pieces[baseHigh + 0];
  if (ePrev === eNext && isCorner(ePrev)) return false;
  // wrap boundary between slots 11/0 (top) or 23/12 (bot)
  const wPrev = state.pieces[baseHigh + 5];
  const wNext = state.pieces[baseLow + 0];
  if (wPrev === wNext && isCorner(wPrev)) return false;
  return true;
}

/** Rotate a layer (12 contiguous slots starting at `base`) so that the
 *  contents shift toward higher slot indices by `t` positions (mod 12).
 *  Matches cstimer convention: stored shift amount = (12 - t_wca) mod 12,
 *  applied as a left-rotate of the array. We accept WCA-signed `t` directly. */
function rotateLayer(pieces: number[], base: number, t: number): void {
  const k = ((-t % 12) + 12) % 12;
  if (k === 0) return;
  const ring = pieces.slice(base, base + 12);
  for (let i = 0; i < 12; i++) {
    pieces[base + i] = ring[(i + k) % 12];
  }
}

/** Apply a `(a,b)` turn. */
export function applyTurn(state: Sq1State, a: number, b: number): Sq1State {
  const next = { pieces: state.pieces.slice(), ml: state.ml };
  if (a !== 0) rotateLayer(next.pieces, 0, a);
  if (b !== 0) rotateLayer(next.pieces, 12, b);
  return next;
}

/** Apply a slice. Swaps pieces[6..11] with pieces[12..17], toggles ml. */
export function applySlice(state: Sq1State): Sq1State {
  const next = { pieces: state.pieces.slice(), ml: (1 - state.ml) as 0 | 1 };
  for (let i = 0; i < 6; i++) {
    const tmp = next.pieces[6 + i];
    next.pieces[6 + i] = next.pieces[12 + i];
    next.pieces[12 + i] = tmp;
  }
  return next;
}

interface ParsedTurn { kind: 'turn'; a: number; b: number; }
interface ParsedSlice { kind: 'slice'; }
type ParsedMove = ParsedTurn | ParsedSlice;

/** Parse `(a,b)/...` notation. Whitespace tolerant, lone `/` is slice,
 *  `(a,b)` is a paired turn. Unknown fragments are skipped. */
export function parseSq1Scramble(s: string): ParsedMove[] {
  const out: ParsedMove[] = [];
  if (!s) return out;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '/') { out.push({ kind: 'slice' }); i++; continue; }
    if (ch === '(') {
      const close = s.indexOf(')', i);
      if (close < 0) break;
      const inner = s.slice(i + 1, close);
      const parts = inner.split(',').map((x) => x.trim());
      if (parts.length === 2) {
        const a = parseInt(parts[0], 10);
        const b = parseInt(parts[1], 10);
        if (Number.isFinite(a) && Number.isFinite(b)) out.push({ kind: 'turn', a, b });
      }
      i = close + 1;
      continue;
    }
    i++;
  }
  return out;
}

export function applySq1Scramble(scramble: string): Sq1State {
  let state = sq1Solved();
  const moves = parseSq1Scramble(scramble);
  for (const m of moves) {
    if (m.kind === 'turn') state = applyTurn(state, m.a, m.b);
    else state = applySlice(state);
  }
  return state;
}

/* ------------------------------------------------------------------ *
 * Rendering helpers                                                  *
 * ------------------------------------------------------------------ */

export type SlotKind = 'E' | 'CL' | 'CT';

export interface Sq1RenderSlot {
  kind: SlotKind;       // edge / corner-lead / corner-trail
  topColor: FaceColor;  // outward face colour (white or yellow)
  sideColor: SideColor; // rim band colour
}

/** Convert state into a 24-slot render description. Slots 0..11 are the top
 *  layer ring (CW from angle 0), 12..23 are the bottom layer ring. */
export function sq1RenderSlots(state: Sq1State): Sq1RenderSlot[] {
  const out: Sq1RenderSlot[] = [];
  for (let layer = 0; layer < 2; layer++) {
    const base = layer === 0 ? 0 : 12;
    for (let i = 0; i < 12; i++) {
      const idx = base + i;
      const pid = state.pieces[idx];
      const sides = PIECE_SIDES[pid] ?? ['F'];
      const topColor: FaceColor = pid < 8 ? 'W' : 'Y';
      let kind: SlotKind = 'E';
      let sideColor: SideColor = sides[0];
      if (isCorner(pid) && sides.length === 2) {
        // Determine first vs second half by checking ring neighbours.
        const nextIdx = base + ((i + 1) % 12);
        const prevIdx = base + ((i + 11) % 12);
        if (state.pieces[nextIdx] === pid) {
          // This slot starts the corner pair (CL = corner-lead).
          kind = 'CL';
          sideColor = sides[0];
        } else if (state.pieces[prevIdx] === pid) {
          // Trailing half.
          kind = 'CT';
          sideColor = sides[1];
        } else {
          // Lone corner half (shape-locked). Show as lead with first colour.
          kind = 'CL';
          sideColor = sides[0];
        }
      }
      out.push({ kind, topColor, sideColor });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Self-check (used by tests / dev assertions, not bundled per se)    *
 * ------------------------------------------------------------------ */

/** Apply the inverse of a parsed move list. Reverses order and negates each
 *  turn's (a,b); slices are self-inverse. */
export function inverseMoves(moves: ParsedMove[]): ParsedMove[] {
  const out: ParsedMove[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    if (m.kind === 'slice') out.push({ kind: 'slice' });
    else out.push({ kind: 'turn', a: -m.a, b: -m.b });
  }
  return out;
}

export function statesEqual(a: Sq1State, b: Sq1State): boolean {
  if (a.ml !== b.ml) return false;
  for (let i = 0; i < 24; i++) if (a.pieces[i] !== b.pieces[i]) return false;
  return true;
}

export function applyMoves(state: Sq1State, moves: ParsedMove[]): Sq1State {
  let s = state;
  for (const m of moves) {
    if (m.kind === 'turn') s = applyTurn(s, m.a, m.b);
    else s = applySlice(s);
  }
  return s;
}

/** Check that scramble + its inverse returns to solved. Returns true iff so. */
export function selfCheckScramble(scramble: string): boolean {
  const moves = parseSq1Scramble(scramble);
  const scrambled = applyMoves(sq1Solved(), moves);
  const back = applyMoves(scrambled, inverseMoves(moves));
  return statesEqual(back, sq1Solved());
}

/** Layer-clean predicate exposed for tooling/inspection. */
export function isSliceLegal(state: Sq1State): boolean {
  return isLayerSliceClean(state, 'top') && isLayerSliceClean(state, 'bot');
}
