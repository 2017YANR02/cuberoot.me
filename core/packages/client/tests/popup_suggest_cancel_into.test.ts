import { describe, it, expect } from 'vitest';
import { patternFromAlg, countMoves } from '@/lib/cube3';
import { movesOnly, resolveEffectivePrev, resolveCommentPopupState } from '@/lib/recon_autofill_core';
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

// GH issue #15:cross 家族(cross/xcross/xxcross/xxxcross/xxxxcross)自身也要有 cancel-into——
// 之前只有 F2L pair 有。用户复盘(issue #15 附图)打乱如下,解法第一行 `z2`(纯转体,插入阶段),
// 第二行差一步 R' 就能拼出 W(此处实测出的颜色是 G,cubie 恒等,颜色只取决于打乱+朝向)xcross。
const ISSUE15_SCRAMBLE = "L' F2 B' R' D2 F2 R2 F D' U2 L2 F L F2 U' R B' R'";

describe('cross 家族自身的 cancel-into(GH issue #15)', () => {
  it('caret 停在补完 xcross 的最后一步之前(行内后面还有更多已输入的字符),仍正确识别 —— 且不因 caret 之后的内容跑偏(issue #17 caret-bound 之上)', async () => {
    // 第二行真实内容(如用户附图):一堆面转,中间某一步 R' 一补,cross+第一把 pair(xcross)即成;
    // caret 停在那个 R' 之前,R' 后面还跟着别的已输入内容(`D R2`),验证 popup 只看 caret 之前。
    const line2Full = "D R F' L2 D U2 B U B' U2 B R' B R B R B' R' D R2";
    const value = `z2\n${line2Full}\n`;
    const caretUpTo = "D R F' L2 D U2 B U B' U2 B R' B R B R B'"; // 差最后一个 R'
    const caret = value.indexOf(line2Full) + caretUpTo.length;

    const state = await resolveCommentPopupState(ISSUE15_SCRAMBLE, value, caret);
    const auto = await buildCommentSuggestions({
      prevPattern: state.prevPattern,
      currPattern: state.currPattern,
      lineMovesText: state.lineMovesText,
      prevMovesText: state.prevMovesText,
      moveCount: state.moveCount,
      explicit: false,
    });
    const tab = await buildCommentSuggestions({
      prevPattern: state.prevPattern,
      currPattern: state.currPattern,
      lineMovesText: state.lineMovesText,
      prevMovesText: state.prevMovesText,
      moveCount: state.moveCount,
      explicit: true,
    });
    expect(auto).toEqual([]);
    expect(tab).toEqual(['// G xcross (YB) cancel into']);
  });

  it('cross 本身(0 pair,不只是 xcross/xxcross)也能 cancel-into —— 验证不局限于 xcross', async () => {
    const line2Full = "D R F' L2 D R2 U"; // 差最后一步 D 就是纯 cross(还没碰到任何 F2L pair)
    const value = `z2\n${line2Full}\n`;
    const caretUpTo = "D R F' L2";
    const caret = value.indexOf(line2Full) + caretUpTo.length;

    const state = await resolveCommentPopupState(ISSUE15_SCRAMBLE, value, caret);
    const auto = await buildCommentSuggestions({
      prevPattern: state.prevPattern,
      currPattern: state.currPattern,
      lineMovesText: state.lineMovesText,
      prevMovesText: state.prevMovesText,
      moveCount: state.moveCount,
      explicit: false,
    });
    const tab = await buildCommentSuggestions({
      prevPattern: state.prevPattern,
      currPattern: state.currPattern,
      lineMovesText: state.lineMovesText,
      prevMovesText: state.prevMovesText,
      moveCount: state.moveCount,
      explicit: true,
    });
    expect(auto).toEqual([]);
    expect(tab).toEqual(['// G cross cancel into']);
  });

  it('cross 家族 cancel-into 的下一行只记真正新解的 pair,不因上一行还没建过 cross 就跳过折算', async () => {
    // 上一行(第 2 行)恰好停在 cancel 点(不含补完的 R'),再上一行(第 1 行)只是 `z2` 插入、
    // 还没建过 cross —— 这正是 F2L 版 resolveEffectivePrev 原本会直接放弃折算的场景;新逻辑用
    // crossFamilyCancelInto 识别出「上一行本身就是 cross 家族的 cancel-into」,照样折算。
    const linesBefore = "z2 // insp\nD R F' L2 D U2 B U B' U2 B R' B R B R B' // G xcross (YB) cancel into\n";
    const prevMoves = movesOnly(linesBefore);
    const lineMoves = "R' L' B L"; // 首步 R' 正是被 cancel 的那步,补完 xcross 后再解出第 2 把
    const effPrevPattern = await resolveEffectivePrev(ISSUE15_SCRAMBLE, prevMoves, lineMoves, linesBefore);
    const currPattern = await patternFromAlg(`${ISSUE15_SCRAMBLE} ${prevMoves} ${lineMoves}`);
    const sug = await buildCommentSuggestions({
      prevPattern: effPrevPattern, currPattern, lineMovesText: lineMoves, moveCount: countMoves(lineMoves), explicit: false,
    });
    expect(sug.some(s => /xxcross/.test(s))).toBe(false);  // 不再把 xcross 那把重复计进来
    expect(sug.some(s => /F2L2/.test(s))).toBe(true);      // 这是第 2 把

    // 不折算的话(旧逻辑直接放弃,用未折算的 prev)会把 xcross 那把也算进这一行,
    // 误判成「一步到位建好 xxcross」——正是这条 fix 要防止的回归。
    const rawPrevPattern = await patternFromAlg([ISSUE15_SCRAMBLE, prevMoves].filter(Boolean).join(' '));
    const sugWithoutFix = await buildCommentSuggestions({
      prevPattern: rawPrevPattern, currPattern, lineMovesText: lineMoves, moveCount: countMoves(lineMoves), explicit: false,
    });
    expect(sugWithoutFix.some(s => /xxcross/.test(s))).toBe(true);
  });
});
