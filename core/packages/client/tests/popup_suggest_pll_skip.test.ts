import { describe, it, expect, vi } from 'vitest';
import { patternFromAlg, countMoves } from '@/lib/cube3';
import { movesOnly } from '@/lib/recon_autofill_core';
import { buildCommentSuggestions } from '@/lib/popup_suggest';

// 用户真实复盘:OLL 37 (K2) 之后 PLL 被跳过(同一行整解)。
const SCRAMBLE = "D' B2 D' L' F D R U D' R2 D2 L2 B2 U' D2 B R B2 Rw'";

// xcross → OG → RG 三把后,F2L 完成、顶层未朝向(待 OLL)。
const PREV =
  "x' R' F' R F y2 R U R' L U L' U L F' L' U' R U R' U R' F R F' U L' U' L U2 L' U L";
const OLL_LINE = "U F R' F' R U R U' R' U'";

// OLL/PLL case 识别走 oll_lookup → loadAlg('3x3','oll') 拉 alg DB。CI/单测里没有 alg API
// 服务(`/api/alg/sets/...` 是网络 fetch),识别会回退泛标签 // OLL/PLL Skip。这里只 mock
// 出本例需要的那一条 OLL 37:用 OLL_LINE 本身当解法 —— 它把 prevPattern(OLL 态)整解到
// solved,故是该 case 的合法解,指纹表据此即能把 prevPattern 认成 OLL 37 → 注释名 K2。
const { OLL_37_ALG } = vi.hoisted(() => ({ OLL_37_ALG: "U F R' F' R U R U' R' U'" }));
vi.mock('@cuberoot/shared/alg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cuberoot/shared/alg')>();
  return {
    ...actual,
    loadAlg: async (_puzzle: string, set: string) =>
      set === 'oll'
        ? { cases: [{ name: 'OLL 37', algs: [[{ alg: OLL_37_ALG }]] }] }
        : { cases: [] },
  };
});

describe('OLL 之后 PLL skip(同一行整解)', () => {
  it('注释合并成 // OLL-K2/PLL Skip', async () => {
    const prevPattern = await patternFromAlg(`${SCRAMBLE} ${PREV}`);
    const currPattern = await patternFromAlg(`${SCRAMBLE} ${PREV} ${OLL_LINE}`);
    const sug = await buildCommentSuggestions({
      prevPattern,
      currPattern,
      lineMovesText: movesOnly(OLL_LINE),
      moveCount: countMoves(movesOnly(OLL_LINE)),
      explicit: true,
    });
    // PLL skip 时只给合并标签,不再给单独的 // OLL-K2 或 // PLL。
    expect(sug).toContain('// OLL-K2/PLL Skip');
    expect(sug.some(s => /\/\/ PLL/.test(s))).toBe(false);
  });
});
