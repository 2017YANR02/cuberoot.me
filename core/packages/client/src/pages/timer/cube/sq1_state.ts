/** Square-1 scramble simulator (state-based, simplified for preview).
 *
 * Model: 24 unit-slots (12 top + 12 bottom), each spanning 30° of arc.
 * A solved layer has 4 corners (each 60° = 2 slots) and 4 edges (each 30° =
 * 1 slot), in alternating C-C-E pattern around the ring.
 *
 * Each slot stores:
 *   kind     'E'  edge piece (occupies this single slot)
 *            'CL' corner lead-half (lower-angle half of a 60° corner wedge)
 *            'CT' corner trail-half (higher-angle half)
 *   topColor 'W' or 'Y' — colour visible on the up-facing face of this slot
 *            (in solved state, top layer is all W; bottom layer all Y).
 *   sideColor 'F'|'B'|'L'|'R' — the side-band colour at the rim of this slot.
 *
 * Moves we accept:
 *   `(a,b)`           rotate top by a × 30°, bottom by b × 30° (positive
 *                     means cyclic shift of the slot array forward by 1).
 *   `/`               slice: swap top[0..5] with bottom[0..5] straight,
 *                     toggling each swapped slot's topColor (W↔Y) and corner
 *                     half-type (CL↔CT) so the visual mixing matches a real
 *                     scrambled square-1.
 *
 * This is a simplification — a true slice is a 180° rotation around the
 * front-back horizontal axis, which would reverse slot order within the
 * swapped half. We use the simpler "straight swap" form because the visual
 * outcome (mixed pieces, mixed W/Y on each face) is recognisably square-1
 * and the task spec explicitly allows it.
 */

export type SideColor = 'F' | 'B' | 'L' | 'R';
export type FaceColor = 'W' | 'Y';
export type SlotKind = 'E' | 'CL' | 'CT';

export interface Sq1Slot {
  kind: SlotKind;
  topColor: FaceColor;
  sideColor: SideColor;
}

export interface Sq1State {
  top: Sq1Slot[];     // length 12
  bottom: Sq1Slot[];  // length 12
}

/** Build a solved layer ring for the given face colour.
 *
 * Layout going CW from the angular start (front-right area):
 *   slot 0  CL of UFR — side F
 *   slot 1  CT of UFR — side R
 *   slot 2  E  UR     — side R
 *   slot 3  CL of UBR — side R
 *   slot 4  CT of UBR — side B
 *   slot 5  E  UB     — side B
 *   slot 6  CL of UBL — side B
 *   slot 7  CT of UBL — side L
 *   slot 8  E  UL     — side L
 *   slot 9  CL of UFL — side L
 *   slot 10 CT of UFL — side F
 *   slot 11 E  UF     — side F
 */
function solvedLayer(face: FaceColor): Sq1Slot[] {
  const sides: SideColor[] = ['F', 'R', 'R', 'R', 'B', 'B', 'B', 'L', 'L', 'L', 'F', 'F'];
  const kinds: SlotKind[] = ['CL', 'CT', 'E', 'CL', 'CT', 'E', 'CL', 'CT', 'E', 'CL', 'CT', 'E'];
  return sides.map((side, i) => ({ kind: kinds[i], topColor: face, sideColor: side }));
}

export function sq1Solved(): Sq1State {
  return { top: solvedLayer('W'), bottom: solvedLayer('Y') };
}

function flipSlot(s: Sq1Slot): Sq1Slot {
  let kind: SlotKind = s.kind;
  if (kind === 'CL') kind = 'CT';
  else if (kind === 'CT') kind = 'CL';
  const topColor: FaceColor = s.topColor === 'W' ? 'Y' : 'W';
  return { kind, topColor, sideColor: s.sideColor };
}

function rotateLayer(layer: Sq1Slot[], n: number): Sq1Slot[] {
  const k = ((n % 12) + 12) % 12;
  if (k === 0) return layer.slice();
  return layer.slice(-k).concat(layer.slice(0, -k));
}

function applyTurns(state: Sq1State, a: number, b: number): Sq1State {
  return {
    top: rotateLayer(state.top, a),
    bottom: rotateLayer(state.bottom, b),
  };
}

function applySlice(state: Sq1State): Sq1State {
  const top = state.top.slice();
  const bot = state.bottom.slice();
  for (let i = 0; i < 6; i++) {
    const a = top[i];
    const b = bot[i];
    top[i] = flipSlot(b);
    bot[i] = flipSlot(a);
  }
  return { top, bottom: bot };
}

interface ParsedTurn {
  kind: 'turn';
  a: number;
  b: number;
}
interface ParsedSlice {
  kind: 'slice';
}
type ParsedMove = ParsedTurn | ParsedSlice;

/** Parse a sq1 scramble into a sequence of (a,b) turns and slices.
 *
 * Accepts forms like `(1, 0) / (3,3) /` etc. Whitespace tolerant; `/`
 * is the slice token; everything inside parens is split on `,` into
 * two integers. Unknown fragments are skipped.
 */
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
    if (m.kind === 'turn') state = applyTurns(state, m.a, m.b);
    else state = applySlice(state);
  }
  return state;
}
