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
  totalSolveCountBeforeLine: number,
): Transition {
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

/** Slot color pair (e.g. FR slot in default WCA = "GR" / "Green Red"). */
function slotColors(p: KPattern, slotId: F2lSlotId): { pair: string; full: string } {
  const COLOR_BY_PIECE: Record<number, string> = {
    0: 'White', 1: 'Red', 2: 'Green', 3: 'Orange', 4: 'Blue', 5: 'Yellow',
  };
  const COLOR_LETTER: Record<number, string> = {
    0: 'W', 1: 'R', 2: 'G', 3: 'O', 4: 'B', 5: 'Y',
  };
  // Each slot adjacency to side faces (side center slots in canonical orientation)
  const sideSlotsOf: Record<F2lSlotId, [number, number]> = {
    FR: [2, 1], // F + R
    FL: [2, 3], // F + L
    BL: [4, 3], // B + L
    BR: [4, 1], // B + R
  };
  const c = p.patternData.CENTERS.pieces;
  const [a, b] = sideSlotsOf[slotId];
  return {
    pair: `${COLOR_LETTER[c[a]] ?? '?'}${COLOR_LETTER[c[b]] ?? '?'}`,
    full: `${COLOR_BY_PIECE[c[a]] ?? '?'} ${COLOR_BY_PIECE[c[b]] ?? '?'}`,
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
  /** Number of F2L pairs already solved before this line (for ordinal naming). */
  pairsBeforeLine: number;
}

export async function buildCommentSuggestions(args: SuggestArgs): Promise<string[]> {
  const { prevPattern, currPattern, lineHasMoves, moveCount, pairsBeforeLine } = args;
  const prev = await detectStage(prevPattern);
  const curr = await detectStage(currPattern);
  const t = classifyTransition(prev, curr, lineHasMoves, pairsBeforeLine);
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
    // For each newly-solved slot generate the pair label set.
    // Combined-pair case: 2 slots solved at once → "1st & 2nd pairs" etc.
    if (t.slots.length === 1) {
      const slot = t.slots[0];
      const colors = slotColors(currPattern, slot);
      const ordinal = ORDINALS[t.ordinalIndex] ?? String(t.ordinalIndex);
      pushPair(`${ordinal} pair`);
      pushPair(`${colors.pair} Pair`);
      pushPair(`${colors.full} Pair`);
      return out;
    }
    if (t.slots.length === 2) {
      // Combined: ordinals span 2 indices.
      const i1 = t.ordinalIndex;
      const i2 = t.ordinalIndex + 1;
      const o1 = ORDINALS[i1] ?? String(i1);
      const o2 = ORDINALS[i2] ?? String(i2);
      pushPair(`${o1} & ${o2} pairs`);
      // Color combined: take both slots' first names
      const c1 = slotColors(currPattern, t.slots[0]);
      const c2 = slotColors(currPattern, t.slots[1]);
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
