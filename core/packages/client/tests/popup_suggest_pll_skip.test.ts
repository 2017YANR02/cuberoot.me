import { describe, it, expect } from 'vitest';
import { patternFromAlg, countMoves } from '@/lib/cube3';
import { movesOnly } from '@/lib/recon_autofill_core';
import { buildCommentSuggestions } from '@/lib/popup_suggest';

// 用户真实复盘:OLL 37 (K2) 之后 PLL 被跳过(同一行整解)。
const SCRAMBLE = "D' B2 D' L' F D R U D' R2 D2 L2 B2 U' D2 B R B2 Rw'";

// xcross → OG → RG 三把后,F2L 完成、顶层未朝向(待 OLL)。
const PREV =
  "x' R' F' R F y2 R U R' L U L' U L F' L' U' R U R' U R' F R F' U L' U' L U2 L' U L";
const OLL_LINE = "U F R' F' R U R U' R' U'";

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
