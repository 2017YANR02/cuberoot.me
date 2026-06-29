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
import { detectStage, F2L_SLOT_DEFS, topEdgesOriented, crossOnDRotation } from './stage_detect';
import { EDGE_STICKERS } from './sticker_tables';
import { lookupOllAlgs } from './oll_lookup';
import { lookupPllAlgs } from './pll_lookup';
import { lookupZbllAlgsRobust } from './zbll_lookup';
import { ollCommentName, pllCommentLabel, isEpll, zbllCommentLabel } from './alg_case_display';

/**
 * 识别一个 OLL 待解状态(F2L 完、顶层未朝向)的 DB case 名,如 "OLL 27"。
 * 走 oll_lookup 的指纹表(指纹相对 U 中心,任意十字颜色都识别得出)。
 */
async function recognizeOllCase(pattern: KPattern): Promise<string | null> {
  try {
    const rot = await crossOnDRotation(pattern);
    const canonical = rot ? pattern.applyAlg(rot) : pattern;
    return (await lookupOllAlgs(canonical))[0]?.caseName ?? null;
  } catch { return null; }
}

/** 识别一个 PLL 待解状态(OLL 完、顶层已朝向)的 DB case 名,如 "Gd"。 */
async function recognizePllCase(pattern: KPattern): Promise<string | null> {
  try {
    const rot = await crossOnDRotation(pattern);
    const canonical = rot ? pattern.applyAlg(rot) : pattern;
    return (await lookupPllAlgs(canonical))[0]?.caseName ?? null;
  } catch { return null; }
}

/**
 * 识别一个 ZBLL 待解状态(F2L 完 + 顶层棱已朝向 = 顶面十字已成,角可能拧错)的 DB case 名,
 * 如 "ZBLL AS 13"。仅当一条公式整解时用来给精确 ZBLL 标签。
 */
async function recognizeZbllCase(pattern: KPattern): Promise<string | null> {
  try {
    // Frame-invariant robust lookup: works for every cross colour (the old
    // per-cross-colour fingerprint table missed non-yellow / tilted crosses and
    // cost ~9.5s to build). crossFaceHome is only a hint — it can be wrong for
    // ambiguous LL states, so the search falls back to the colour that solves.
    const info = await detectStage(pattern);
    return (await lookupZbllAlgsRobust(pattern, info.crossFaceHome))[0]?.caseName ?? null;
  } catch { return null; }
}

/**
 * F2L slots in `curr` whose CUBIE PAIR wasn't already solved in `prev`.
 *
 * Slot IDs (FR/FL/BR/BL) are frame-relative — a `y2` between two recon lines
 * shifts the canonical frame and the same physical cubie ends up at a
 * different slot id. So we compare cubie identities (corner+edge piece IDs,
 * which are home-slot-based and therefore frame-invariant) instead of slot IDs.
 */
function newlySolvedSlots(prev: StageInfo, curr: StageInfo): F2lSlotId[] {
  // A fully solved cube has every F2L pair done, but detectStage reports its
  // solvedPairs in the DEFAULT (yellow-on-D) frame (corners 4..7). A colored-
  // cross prev identifies its pairs by the cross color's own cubies (e.g. a
  // white cross uses corners 0..3), so the piece-id sets never overlap and the
  // diff below would falsely flag all 4 pairs as "newly solved" — turning a
  // pure last-layer line (OLL/PLL/ZBLL) into a bogus 4-slot pair transition.
  // When curr is solved, the pairs genuinely completed on this line are exactly
  // the ones prev was still missing.
  if (curr.stage === 'solved') {
    const ALL: F2lSlotId[] = ['FR', 'FL', 'BL', 'BR'];
    return ALL.filter(s => !prev.solvedSlots.includes(s));
  }
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
  | { kind: 'pair'; slots: F2lSlotId[]; ordinalIndex: number; eoDone: boolean; ollSkip: boolean }
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
  hasMovesBefore: boolean,
): Transition {
  // Ordinal index = which F2L pair (1..4) the user just solved.
  const totalSolveCountBeforeLine = prev.solvedSlots.length;
  // Inspection = pure rotation(s) BEFORE any other turn. A rotation-only line
  // in the middle of a solve (AUF / regrip adjustment) is not inspection, so
  // require an empty pre-line move history.
  if (!hasMovesBefore && isInspectionMoves(lineMovesText)) return { kind: 'inspection' };

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

  // F2L pairs newly solved on this line (frame-invariant cubie identity).
  const newSlots = newlySolvedSlots(prev, curr);
  const totalSlotsAfter = curr.solvedSlots.length;

  // Pure last-layer transitions ONLY apply when this line solved no new F2L
  // pair. A line that completes a pair AND lands on an oriented LL is an
  // OLL-skip F2L pair (handled by the pair branch with ollSkip), not a pure OLL.
  if (newSlots.length === 0) {
    if (curr.stage === 'oll' && prev.stage !== 'oll' && prev.stage !== 'pll' && prev.stage !== 'solved') {
      // OLL just got solved (along the way to OLL)
      return { kind: 'oll' };
    }
    if (curr.stage === 'oll') {
      // already in OLL; line probably just permuted top. No progress.
      return null;
    }
    if (curr.stage === 'solved' && (prev.stage === 'oll' || prev.stage === 'pll')) {
      return { kind: 'pll' };
    }
    if (curr.stage === 'solved' && prev.stage === 'f2l') {
      // Skipped OLL → went directly to solved (OLL line that also skips PLL).
      return { kind: 'oll' };
    }
  }

  // Cross-only transitions

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
    // If this line completes F2L AND leaves LL EO done, the user effectively
    // did ZBLS (or EOLS) — surface that as an additional label option.
    const eoDone = curr.stage === 'f2l' && topEdgesOriented(curr.canonicalPattern);
    // If the completing pair ALSO leaves LL fully oriented, OLL was skipped —
    // the pair label carries a `/OLL Skip` suffix. (curr.stage === 'oll' implies
    // F2L is complete, so this is always the last pair.)
    const ollSkip = curr.stage === 'oll';
    return { kind: 'pair', slots: newSlots, ordinalIndex, eoDone, ollSkip };
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

/** 18 个面转,用于「cancel into」前瞻 ≤2 步搜索。 */
const MOVES_18 = ['U', "U'", 'U2', 'D', "D'", 'D2', 'F', "F'", 'F2', 'B', "B'", 'B2', 'L', "L'", 'L2', 'R', "R'", 'R2'];

interface CancelCand { slotId: F2lSlotId; pair: string; ordinal: number; }

/**
 * 「cancel into」前瞻:当前行没真正解出新 pair(常见情形是行尾把 cross 边翻上去、靠下一步首动
 * 抵消补回 —— 所以当前 state 的 cross 反而是断的),但在 currPattern 之后追加 ≤2 个面转就能补完
 * 某个新 pair(且 cross 还原、prev 已完成的 pair 不被破坏)。这正是解法里「留一两步 cancel into
 * 下一步」的写法。pair 用 piece-id 比对(免受 canonical 帧旋转影响)。优先更短(差 1 步>差 2 步)。
 */
async function cancelIntoCandidates(prev: StageInfo, currPattern: KPattern): Promise<CancelCand[]> {
  // 仅 cross 已完成、F2L 未完成时前瞻(prev 处于 cross/xcross/xxcross/xxxcross)。
  if (!['cross', 'xcross', 'xxcross', 'xxxcross'].includes(prev.stage)) return [];
  const prevKeys = new Set(prev.solvedPairs.map(([c, e]) => `${c}.${e}`));
  const ordinal = prev.solvedSlots.length + 1;

  const collect = async (depth: number): Promise<CancelCand[]> => {
    const out: CancelCand[] = [];
    const seen = new Set<string>();
    const consider = async (p: KPattern) => {
      const info = await detectStage(p);
      if (info.stage === 'none' || info.stage === 'pscross') return;          // cross 没还原 → 跳
      for (const [c, e] of prev.solvedPairs) {                                 // prev 的 pair 必须仍在
        if (!info.solvedPairs.some(([c2, e2]) => c2 === c && e2 === e)) return;
      }
      for (let i = 0; i < info.solvedSlots.length; i++) {
        const [c, e] = info.solvedPairs[i];
        const key = `${c}.${e}`;
        if (prevKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push({ slotId: info.solvedSlots[i], pair: slotColors(info.canonicalPattern, info.solvedSlots[i]).pair, ordinal });
      }
    };
    if (depth === 1) {
      for (const m of MOVES_18) {
        try { await consider(currPattern.applyAlg(m)); } catch { /* ignore */ }
      }
    } else {
      for (const m1 of MOVES_18) {
        let p1: KPattern;
        try { p1 = currPattern.applyAlg(m1); } catch { continue; }
        for (const m2 of MOVES_18) {
          try { await consider(p1.applyAlg(m2)); } catch { /* ignore */ }
        }
      }
    }
    return out;
  };

  // 差 1 步优先;没有再看差 2 步。
  const d1 = await collect(1);
  if (d1.length > 0) return d1;
  return collect(2);
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
  /** Moves-only text of ALL lines before the current one. Empty ⇒ this is the
   *  first turn, so a pure-rotation line counts as inspection. */
  prevMovesText?: string;
  /** Move count to display in `(N)` suffix. */
  moveCount: number;
  /**
   * 用户主动按 Tab 触发(非边打边自动弹)。仅此时才做「cancel into」前瞻——
   * 当前行没真正解出 pair,但某 pair 差 ≤2 步就能补完时,给出该 pair 标签。
   */
  explicit?: boolean;
}

export async function buildCommentSuggestions(args: SuggestArgs): Promise<string[]> {
  const { prevPattern, currPattern, lineMovesText, prevMovesText, moveCount, explicit } = args;
  const prev = await detectStage(prevPattern);
  const curr = await detectStage(currPattern);
  const hasMovesBefore = (prevMovesText ?? '').trim().length > 0;
  const t = classifyTransition(prev, curr, lineMovesText, hasMovesBefore);
  if (!t) {
    // 没真正解出东西。仅在用户主动按 Tab 时,试「cancel into」前瞻:某 pair 差 ≤2 步补完。
    if (!explicit) return [];
    const cands = await cancelIntoCandidates(prev, currPattern);
    if (cands.length === 0) return [];
    const out: string[] = [];
    for (const c of cands) out.push(`// ${c.pair} cancel into`);
    if (cands.length === 1) out.push(`// F2L${cands[0].ordinal} cancel into`);
    return out;
  }

  const N = moveCount;
  const out: string[] = [];

  const pushPair = (bare: string) => {
    out.push(`// ${bare}`);
    out.push(`// ${bare} (${N})`);
  };

  if (t.kind === 'inspection') {
    out.push('// insp');
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
    // 精确 case 名(识别不出回退泛标签 // OLL),不再给中间那条泛 // OLL。
    const ollRaw = await recognizeOllCase(prevPattern);
    const ollName = ollRaw ? ollCommentName(ollRaw) : null;
    // 这把 OLL 之后魔方已整解 → PLL 被跳过(同一行 OLL + PLL skip),注释合并成
    // `// OLL-K2/PLL Skip`(识别不出 case 名时回退 `// OLL/PLL Skip`)。
    if (curr.stage === 'solved') {
      // 整解之前顶层棱已朝向(F2L 完即出顶面十字)→ 这一条其实是 ZBLL(EO 已做),
      // 多给一个精确 ZBLL 标签并置顶(如 `// ZBLL-S-13`);后面仍保留 OLL/PLL Skip 解读。
      if (topEdgesOriented(prev.canonicalPattern)) {
        const zbllRaw = await recognizeZbllCase(prevPattern);
        const zbllLabel = zbllRaw ? zbllCommentLabel(zbllRaw) : null;
        if (zbllLabel) out.push(`// ${zbllLabel}`);
      }
      out.push(ollName ? `// OLL-${ollName}/PLL Skip` : '// OLL/PLL Skip');
      return out;
    }
    const ollLabel = ollName ? `// OLL-${ollName}` : '// OLL';
    // 仅当这把 OLL 之后只剩 EPLL(角已归位)时,它才是 OLL(CP) → 加该选项并置顶;
    // 否则(后面是普通 PLL)根本不显示 OLL(CP)。
    const pllNext = await recognizePllCase(currPattern);
    if (pllNext != null && isEpll(pllNext)) out.push('// OLL(CP)');
    if (!out.includes(ollLabel)) out.push(ollLabel);
    return out;
  }
  if (t.kind === 'pll') {
    // 只给精确 case(EPLL 加 E 前缀:// EPLL-U+);识别不出才回退泛 // PLL。
    const pllRaw = await recognizePllCase(prevPattern);
    out.push(pllRaw ? `// ${pllCommentLabel(pllRaw)}` : '// PLL');
    return out;
  }
  if (t.kind === 'pair') {
    // Two label variants only: F2L<N> ordinal and 2-letter color-pair.
    // (Full-name, "1st pair", and "Pair" suffix variants were dropped.)
    // Suffix convention (mutually exclusive — curr 是 oll 还是 f2l 二选一):
    //   - OLL skipped on the completing pair → `/OLL Skip`.
    //   - 最后一把同时把 LL 棱朝向(EO 完)= ZBLS/EOLS → 合并成 `/ZBLS`(如 `OB/ZBLS`),
    //     不再单列一条 `// ZBLS`。
    const sfx = t.ollSkip ? '/OLL Skip' : t.eoDone ? '/ZBLS' : '';
    if (t.slots.length === 1) {
      const colors = slotColors(curr.canonicalPattern, t.slots[0]);
      pushPair(`${colors.pair}${sfx}`);
      pushPair(`F2L${t.ordinalIndex}${sfx}`);
      return out;
    }
    if (t.slots.length === 2) {
      const i1 = t.ordinalIndex;
      const i2 = t.ordinalIndex + 1;
      const c1 = slotColors(curr.canonicalPattern, t.slots[0]);
      const c2 = slotColors(curr.canonicalPattern, t.slots[1]);
      pushPair(`${c1.pair}+${c2.pair}${sfx}`);
      pushPair(`F2L${i1}+F2L${i2}${sfx}`);
      return out;
    }
  }
  return out;
}

// Re-export commonly used types
export type { F2lSlotId, StageInfo };
export { F2L_SLOT_DEFS };
