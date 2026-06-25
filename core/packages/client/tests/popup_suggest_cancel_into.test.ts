import { describe, it, expect } from 'vitest';
import { patternFromAlg, countMoves } from '@/lib/cube3';
import { movesOnly, resolveEffectivePrev } from '@/lib/recon_autofill_core';
import { buildCommentSuggestions } from '@/lib/popup_suggest';

// 用户真实复盘(image #34):合肥 League 3x3 III 2026, 3x3 决赛
const SCRAMBLE = "L' D' L2 B2 D F2 U B2 U2 F2 L U F2 D' R2 D2 B' F' D R2";

describe('movesOnly 分组重复展开', () => {
  it("(R' F R F')2 → 展开两遍", () => {
    expect(movesOnly("(R' F R F')2")).toBe("R' F R F' R' F R F'");
  });
  it("(R U)2' → 逆序展开两遍", () => {
    expect(movesOnly("(R U)2'")).toBe("U' R' U' R'");
  });
  it('单层无重复括号 → 仅去括号', () => {
    expect(movesOnly('(R U R\' U\')')).toBe("R U R' U'");
  });
});

describe('cancel-into 前瞻(差 ≤2 步补完某 pair)', () => {
  it('仅在用户主动 Tab 时给出 pair 标签;自动弹不给', async () => {
    const prevAlg = `${SCRAMBLE} y' U' R U2' L D' L`;          // Y cross 完成
    const lineMoves = "U' R' U R2";                            // RG pair,差一两步
    const prevPattern = await patternFromAlg(prevAlg);
    const currPattern = await patternFromAlg(`${prevAlg} ${lineMoves}`);
    const base = {
      prevPattern,
      currPattern,
      lineMovesText: movesOnly(lineMoves),
      moveCount: countMoves(movesOnly(lineMoves)),
    };
    const noTab = await buildCommentSuggestions({ ...base, explicit: false });
    const withTab = await buildCommentSuggestions({ ...base, explicit: true });
    expect(noTab).toEqual([]);
    expect(withTab.some(s => /cancel into/.test(s))).toBe(true);
  });

  it('cancel-into 的下一行只记真正新解的 pair(BR),不重复成 xxcross', async () => {
    const linesBefore = "y' // insp\nU' R U2' L D' L // Y cross\nU' R' U R2 // RG cancel into\n";
    const prevMoves = movesOnly(linesBefore);
    const lineMoves = "U R' U L U L'";
    // resolveEffectivePrev 把被 cancel 的 RG 折进 prev(上一行断了 cross、再上一行 cross 已建立)。
    const prevPattern = await resolveEffectivePrev(SCRAMBLE, prevMoves, lineMoves, linesBefore);
    const currPattern = await patternFromAlg(`${SCRAMBLE} ${prevMoves} ${lineMoves}`);
    const sug = await buildCommentSuggestions({
      prevPattern, currPattern, lineMovesText: lineMoves, moveCount: countMoves(lineMoves), explicit: false,
    });
    expect(sug.some(s => /xxcross/.test(s))).toBe(false);   // 不再把 RG 重复计进来
    expect(sug.some(s => /F2L2/.test(s))).toBe(true);       // 这是第 2 把
  });
});
