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

/**
 * F2L slots in `curr` whose CUBIE PAIR wasn't already solved in `prev`.
 *
 * Slot IDs (FR/FL/BR/BL) are frame-relative — a `y2` between two recon lines
 * shifts the canonical frame and the same physical cubie ends up at a
 * different slot id. So we compare cubie identities (corner+edge piece IDs,
 * which are home-slot-based and therefore frame-invariant) instead of slot IDs.
 */
function newlySolvedSlots(prev: StageInfo, curr: StageInfo): F2lSlotId[] {
  const prevKeys = new Set(prev.solvedPairs.map(([c, e]) => `${c}.${e}`));
  const out: F2lSlotId[] = [];
  for (let i = 0; i < curr.solvedSlots.length; i++) {
    const [c, e] = curr.solvedPairs[i];
    if (!prevKeys.has(`${c}.${e}`)) out.push(curr.solvedSlots[i]);
  }
  return out;
}

/**
 * Stage transition from prev to current, named for popup-suggestion purposes.
 * Returns `null` when nothing meaningful changed (popup should be empty).
 */
type Transition =
  | { kind: 'inspection' }
  | { kind: 'pscross' }
  | { kind: 'cross' }
  | { kind: 'xcross' }
  | { kind: 'xxcross' }
  | { kind: 'xxxcross' }
  | { kind: 'pair'; slots: F2lSlotId[]; ordinalIndex: number }
  | { kind: 'oll' }
  | { kind: 'pll' }
  | null;

/**
 * Was the just-completed line ONLY rotation moves (x/y/z, possibly with
 * prime/2 modifiers)? The cube state alone can't distinguish "rotation +
 * nothing" from "face turns that scrambled further without making progress",
 * so we check the move text directly.
 */
function isInspectionMoves(lineMovesText: string): boolean {
  const tokens = lineMovesText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(t => /^[xyz]['2]?$/.test(t));
}

function classifyTransition(
  prev: StageInfo,
  curr: StageInfo,
  lineMovesText: string,
): Transition {
  // Ordinal index = which F2L pair (1..4) the user just solved.
  const totalSolveCountBeforeLine = prev.solvedSlots.length;
  if (isInspectionMoves(lineMovesText)) return { kind: 'inspection' };

  // Pscross: cube is one D move away from cross. Only meaningful when prev
  // wasn't already at this state or further along.
  if (curr.stage === 'pscross' && prev.stage !== 'pscross' && prev.stage !== 'cross'
      && prev.stage !== 'xcross' && prev.stage !== 'xxcross' && prev.stage !== 'xxxcross'
      && prev.stage !== 'f2l' && prev.stage !== 'oll' && prev.stage !== 'pll'
      && prev.stage !== 'solved') {
    return { kind: 'pscross' };
  }

  // Need at least cross solved for any further transition.
  const nowCrossOk = curr.stage !== 'none' && curr.stage !== 'pscross';
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
    const ordinalIndex = totalSolveCountBeforeLine + 1;
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
  /** Move text on the current line (used to detect pure-rotation inspection). */
  lineMovesText: string;
  /** Move count to display in `(N)` suffix. */
  moveCount: number;
}

export async function buildCommentSuggestions(args: SuggestArgs): Promise<string[]> {
  const { prevPattern, currPattern, lineMovesText, moveCount } = args;
  const prev = await detectStage(prevPattern);
  const curr = await detectStage(currPattern);
  const t = classifyTransition(prev, curr, lineMovesText);
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

  // Cross-stage labels: only `<COLOR> <stage>` form, where COLOR is the single
  // letter (W/Y/R/O/B/G). 既不输出无色前缀的 `// cross`, 也不输出 `// Green cross`。
  const colorLetter = curr.crossColor?.letter;
  if (t.kind === 'pscross') {
    if (colorLetter) pushPair(`${colorLetter} pscross`);
    else pushPair('pscross');
    return out;
  }
  if (t.kind === 'cross') {
    if (colorLetter) pushPair(`${colorLetter} cross`);
    else pushPair('cross');
    return out;
  }
  // xcross / xxcross / xxxcross: append the included F2L pair colors as a
  // suffix, e.g. `Y xxcross (RB+BO)`. xxxxcross is just F2L done so we don't
  // bother (always 4 pairs).
  if (t.kind === 'xcross' || t.kind === 'xxcross' || t.kind === 'xxxcross') {
    const pairs = curr.solvedSlots.map(s => slotColors(curr.canonicalPattern, s).pair);
    const suffix = pairs.length > 0 ? ` (${pairs.join('+')})` : '';
    const stageName = t.kind;
    if (colorLetter) pushPair(`${colorLetter} ${stageName}${suffix}`);
    else pushPair(`${stageName}${suffix}`);
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
    // Two label variants only: F2L<N> ordinal and 2-letter color-pair.
    // (Full-name, "1st pair", and "Pair" suffix variants were dropped.)
    if (t.slots.length === 1) {
      const colors = slotColors(curr.canonicalPattern, t.slots[0]);
      pushPair(colors.pair);
      pushPair(`F2L${t.ordinalIndex}`);
      return out;
    }
    if (t.slots.length === 2) {
      const i1 = t.ordinalIndex;
      const i2 = t.ordinalIndex + 1;
      const c1 = slotColors(curr.canonicalPattern, t.slots[0]);
      const c2 = slotColors(curr.canonicalPattern, t.slots[1]);
      pushPair(`${c1.pair} & ${c2.pair}`);
      pushPair(`F2L${i1} & F2L${i2}`);
      return out;
    }
  }
  return out;
}

// Re-export commonly used types
export type { F2lSlotId, StageInfo };
export { F2L_SLOT_DEFS };
