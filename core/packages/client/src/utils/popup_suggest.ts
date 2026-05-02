/**
 * Generate cubedb-style auto-fill popup suggestions for the recon textarea.
 *
 * Two popup kinds:
 *
 * 1. **Comment popup** — Tab on a line with moves but no `//`. Suggests stage
 *    labels (`// cross`, `// 1st pair`, `// OLL`, etc.). Suggestions are derived
 *    from cube-state-diff between the previous line's end state and the current
 *    line's end state. Each match also gets a `(N)` move-count variant.
 *
 * 2. **Alg popup** — Tab on a fresh blank line just after a labeled line.
 *    Filters algdb candidates by what (if anything) the user already typed
 *    on the line, prefix-matched move-by-move via cubing.js Alg.
 *
 * Returns ordered suggestion strings. Empty array = no popup.
 *
 * The order, aliases, and `(N)` suffix all match cubedb.net's actual output
 * (verified against the ground-truth dataset in `__fixtures__/cubedb_ground_truth.ts`).
 */
import type { KPattern } from 'cubing/kpuzzle';
import type { F2lSlotId, StageInfo } from './stage_detect';
import { detectStage, F2L_SLOT_DEFS } from './stage_detect';
import { EDGE_STICKERS } from './sticker_tables';

/** Ordinal naming for F2L pairs by index 1..4 */
const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

/** Detect WHICH F2L slot just became solved going prev → curr. */
function newlySolvedSlots(prev: StageInfo, curr: StageInfo): F2lSlotId[] {
  return curr.solvedSlots.filter(s => !prev.solvedSlots.includes(s));
}

/**
 * Stage transition from prev to current, named for popup-suggestion purposes.
 * Returns `null` when nothing meaningful changed (popup should be empty).
 */
type Transition =
  | { kind: 'inspection' }
  | { kind: 'cross' }
  | { kind: 'xcross' }
  | { kind: 'xxcross' }
  | { kind: 'xxxcross' }
  | { kind: 'pair'; slots: F2lSlotId[]; ordinalIndex: number }
  | { kind: 'oll' }
  | { kind: 'pll' }
  | null;

/**
 * Was the just-completed line the inspection rotation only (no real progress
 * made on the cube structurally)? Heuristic: prev and current both at 'none'
 * stage AND no new pieces solved.
 */
function isInspection(prev: StageInfo, curr: StageInfo, lineHasMoves: boolean): boolean {
  if (!lineHasMoves) return false;
  // Inspection moves are typically pure rotations. After applying them, cube
  // is structurally still scrambled but in a different orientation. Both
  // prev and curr will be 'none', and no F2L slots get solved.
  return prev.stage === 'none' && curr.stage === 'none' && curr.solvedSlots.length === 0;
}

function classifyTransition(
  prev: StageInfo,
  curr: StageInfo,
  lineHasMoves: boolean,
): Transition {
  // Ordinal index = how many F2L pairs were already solved before this line.
  // (Derived from the cube state, not from text labels — much more reliable.)
  const totalSolveCountBeforeLine = prev.solvedSlots.length;
  if (isInspection(prev, curr, lineHasMoves)) return { kind: 'inspection' };

  // Need at least cross solved for any meaningful transition.
  const nowCrossOk = curr.stage !== 'none';
  if (!nowCrossOk) return null;

  // Pair stage transitions
  if (curr.stage === 'oll' && prev.stage !== 'oll' && prev.stage !== 'pll' && prev.stage !== 'solved') {
    // OLL just got solved (along the way to OLL)
    return { kind: 'oll' };
  }
  if (curr.stage === 'oll') {
    // already in OLL; line probably just permuted top — treat as PLL? No, OLL
    // stage means top is oriented. If prev was oll and curr still oll, no
    // progress.
    return null;
  }
  if (curr.stage === 'solved' && (prev.stage === 'oll' || prev.stage === 'pll')) {
    return { kind: 'pll' };
  }
  if (curr.stage === 'solved' && prev.stage === 'f2l') {
    // Skipped OLL → went directly to solved. Treat as OLL+PLL combined,
    // or PLL skip after OLL... cubedb shows OLL labels typically. Use OLL.
    return { kind: 'oll' };
  }

  // Cross-only transitions
  const newSlots = newlySolvedSlots(prev, curr);
  const totalSlotsAfter = curr.solvedSlots.length;

  if (curr.stage === 'cross' && prev.stage !== 'cross') {
    return { kind: 'cross' };
  }
  if (curr.stage === 'xcross' && newSlots.length === 1 && prev.stage === 'none') {
    return { kind: 'xcross' };
  }
  if (curr.stage === 'xxcross' && prev.stage === 'none' && totalSlotsAfter === 2) {
    return { kind: 'xxcross' };
  }
  if (curr.stage === 'xxxcross' && prev.stage === 'none' && totalSlotsAfter === 3) {
    return { kind: 'xxxcross' };
  }

  // F2L pair line (cross was already done before this line)
  if (newSlots.length >= 1 && prev.stage !== 'none') {
    const ordinalIndex = totalSolveCountBeforeLine + 1; // approximate index
    return { kind: 'pair', slots: newSlots, ordinalIndex };
  }

  return null;
}

/**
 * Slot color pair, named by the edge cubie's intrinsic stickers (not slot
 * adjacency). E.g. the GR cubie always names a "GR Pair" regardless of which
 * slot or rotation it ends up at.
 *
 * Order convention: matches cubedb's labelling (see ground-truth fixture).
 * For each pair the two stickers are emitted in the order shown by the slot
 * the cubie sits in *in canonical post-bestOrientation frame*. cubedb's order
 * priority for slot faces: F < L < R < B, i.e., the "more front" sticker
 * comes first. (For an FR pair: F-side first; BL pair: L-side first; etc.)
 */
const COLOR_BY_PIECE: Record<number, string> = {
  0: 'White', 1: 'Red', 2: 'Green', 3: 'Orange', 4: 'Blue', 5: 'Yellow',
};
const COLOR_LETTER: Record<number, string> = {
  0: 'W', 1: 'R', 2: 'G', 3: 'O', 4: 'B', 5: 'Y',
};

/**
 * For each F2L slot id, the [firstFace, secondFace] order used to read out
 * the cubie's two visible stickers. cubedb's priority: B > {R,L} > F. So:
 *   FR = [R, F]       // R first, F last.
 *   FL = [L, F]
 *   BR = [B, R]       // B first, R last.
 *   BL = [B, L]
 */
const SLOT_FACE_ORDER: Record<F2lSlotId, [number, number]> = {
  FR: [1, 2],  // R-face, F-face
  FL: [3, 2],  // L, F
  BR: [4, 1],  // B, R
  BL: [4, 3],  // B, L
};

function slotColors(p: KPattern, slotId: F2lSlotId): { pair: string; full: string } {
  // Find the actual edge piece sitting at this slot in the canonical pattern.
  const def = F2L_SLOT_DEFS.find(d => d.id === slotId)!;
  const piece = p.patternData.EDGES.pieces[def.edgeSlot];
  const ori = p.patternData.EDGES.orientation[def.edgeSlot] ?? 0;

  // The slot's primary/secondary face indices (per cubing.js).
  const [slotPri, slotSec] = EDGE_STICKERS[def.edgeSlot];
  // The piece's two sticker colors, indexed by sticker label.
  const [piecePri, pieceSec] = EDGE_STICKERS[piece];

  // Which sticker color is on each of the slot's two faces?
  const colorOnPri = ori === 0 ? piecePri : pieceSec;
  const colorOnSec = ori === 0 ? pieceSec : piecePri;
  const colorAt: Record<number, number> = { [slotPri]: colorOnPri, [slotSec]: colorOnSec };

  // Read out in cubedb's preferred face order.
  const [faceA, faceB] = SLOT_FACE_ORDER[slotId];
  const cA = colorAt[faceA];
  const cB = colorAt[faceB];

  return {
    pair: `${COLOR_LETTER[cA] ?? '?'}${COLOR_LETTER[cB] ?? '?'}`,
    full: `${COLOR_BY_PIECE[cA] ?? '?'} ${COLOR_BY_PIECE[cB] ?? '?'}`,
  };
}

/**
 * Build suggestion strings for a given stage transition.
 * Each entry includes both bare and `(N)` variants where N = move count of the line.
 */
export interface SuggestArgs {
  /** Cube pattern at end of previous labeled line (or default if first line). */
  prevPattern: KPattern;
  /** Cube pattern at end of current line. */
  currPattern: KPattern;
  /** Whether the current line had any moves (false for purely-comment lines). */
  lineHasMoves: boolean;
  /** Move count to display in `(N)` suffix. */
  moveCount: number;
}

export async function buildCommentSuggestions(args: SuggestArgs): Promise<string[]> {
  const { prevPattern, currPattern, lineHasMoves, moveCount } = args;
  const prev = await detectStage(prevPattern);
  const curr = await detectStage(currPattern);
  const t = classifyTransition(prev, curr, lineHasMoves);
  if (!t) return [];

  const N = moveCount;
  const out: string[] = [];

  const pushPair = (bare: string) => {
    out.push(`// ${bare}`);
    out.push(`// ${bare} (${N})`);
  };

  if (t.kind === 'inspection') {
    out.push('// inspection');
    return out;
  }

  if (t.kind === 'cross') {
    pushPair('cross');
    if (curr.crossColor) pushPair(`${curr.crossColor.name} cross`);
    return out;
  }
  if (t.kind === 'xcross') {
    pushPair('xcross');
    if (curr.crossColor) pushPair(`${curr.crossColor.name} xcross`);
    return out;
  }
  if (t.kind === 'xxcross') {
    pushPair('xxcross');
    if (curr.crossColor) pushPair(`${curr.crossColor.name} xxcross`);
    return out;
  }
  if (t.kind === 'xxxcross') {
    pushPair('xxxcross');
    if (curr.crossColor) pushPair(`${curr.crossColor.name} xxxcross`);
    return out;
  }
  if (t.kind === 'oll') {
    out.push('// OLL');
    out.push('// OLL(CP)');
    return out;
  }
  if (t.kind === 'pll') {
    out.push('// PLL');
    return out;
  }
  if (t.kind === 'pair') {
    // Pair color naming uses curr.canonicalPattern (post-bestOrientation),
    // since slot ids are in canonical frame.
    if (t.slots.length === 1) {
      const slot = t.slots[0];
      const colors = slotColors(curr.canonicalPattern, slot);
      const ordinal = ORDINALS[t.ordinalIndex] ?? String(t.ordinalIndex);
      pushPair(`${ordinal} pair`);
      pushPair(`${colors.pair} Pair`);
      pushPair(`${colors.full} Pair`);
      return out;
    }
    if (t.slots.length === 2) {
      const i1 = t.ordinalIndex;
      const i2 = t.ordinalIndex + 1;
      const o1 = ORDINALS[i1] ?? String(i1);
      const o2 = ORDINALS[i2] ?? String(i2);
      pushPair(`${o1} & ${o2} pairs`);
      const c1 = slotColors(curr.canonicalPattern, t.slots[0]);
      const c2 = slotColors(curr.canonicalPattern, t.slots[1]);
      pushPair(`${c1.pair} & ${c2.pair} Pairs`);
      pushPair(`${c1.full} & ${c2.full} Pairs`);
      return out;
    }
  }
  return out;
}

// Re-export commonly used types
export type { F2lSlotId, StageInfo };
export { F2L_SLOT_DEFS };
