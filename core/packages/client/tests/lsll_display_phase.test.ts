/**
 * LSLL 的展示相位(pre-AUF 约定):最后一槽的对子摆在哪一格。
 *
 * 判据不是我们自己的规则,而是站内 zbls 公式库 —— 把它 305 条 setup 里能用纯面转回放的
 * 208 条逐条打出来,42 个子组各自的(槽角位/朝向,槽棱位/朝向)完全一致。下面 `ZBLS_PHASE`
 * 就是那张实测表(探针见 PR 说明),`displayState` 必须逐条落在同一格上。
 *
 * 表里读得出的三条规律,正是 `pairDisplayTurn` 实现的那三条:
 *  - 角块在顶层 → 一律 URF(槽的正上方);
 *  - 只有棱块在顶层 → 朝向 0 落 UR、朝向 1 落 UF(= 棱侧面那枚贴纸对上该侧中心色);
 *  - 对子都在槽里 → 顶层无所谓。
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORIES, canonicalKey, categoryCardFacelets, classify, displayState,
  keyFromString, rotateU, unpackState, packState,
} from '@/lib/lsll/model';
import {
  LSLL_CORNER_POS, LSLL_EDGE_POS, cornerFaceletIdx, edgeFaceletIdx,
  paintCorner, paintEdge, solvedCube, toFacelets,
} from '@/lib/lsll/cube333';
import { ZBLS_COVERED_KEYS } from '@/lib/lsll/zbls_overlay';

/** 字母 → [槽角位, 槽角朝向, 槽棱位, 槽棱朝向];位序 0..3 = UR(F)/UF(L)/UL(B)/UB(R),4 = 槽。 */
const ZBLS_PHASE: Record<string, readonly [number, number, number, number]> = {
  'A+': [0, 2, 0, 0], 'A-': [0, 1, 1, 1], 'B+': [0, 1, 3, 0], 'B-': [0, 2, 2, 1],
  'C+': [4, 1, 4, 1], 'C-': [4, 2, 4, 1], 'D+': [4, 1, 4, 0], 'D-': [4, 2, 4, 0],
  'E+': [4, 0, 0, 0], 'E-': [4, 0, 1, 1], F: [4, 0, 4, 1],
  'G+': [0, 0, 1, 0], 'G-': [0, 0, 0, 1], 'H+': [0, 0, 0, 0], 'H-': [0, 0, 1, 1],
  'I+': [0, 2, 1, 0], 'I-': [0, 1, 0, 1], 'J+': [4, 1, 0, 0], 'J-': [4, 2, 1, 1],
  'K+': [0, 1, 0, 0], 'K-': [0, 2, 1, 1], 'L+': [4, 2, 0, 0], 'L-': [4, 1, 1, 1],
  'M+': [0, 2, 2, 0], 'M-': [0, 1, 3, 1], O: [4, 0, 4, 0],
  'P+': [0, 0, 2, 0], 'P-': [0, 0, 3, 1], 'Q+': [0, 0, 3, 0], 'Q-': [0, 0, 2, 1],
  'R+': [0, 1, 2, 0], 'R-': [0, 2, 3, 1], S: [0, 0, 4, 0], T: [0, 0, 4, 1],
  'U+': [0, 2, 4, 0], 'U-': [0, 1, 4, 0], 'V+': [0, 2, 4, 1], 'V-': [0, 1, 4, 1],
  'W+': [0, 2, 3, 0], 'W-': [0, 1, 2, 1], 'X+': [0, 1, 1, 0], 'X-': [0, 2, 0, 1],
};

/** 状态里对子那两块落在哪、朝向多少。 */
function pairOf(s: { cp: number[]; co: number[]; ep: number[]; eo: number[] }) {
  const cpos = s.cp.indexOf(4), epos = s.ep.indexOf(4);
  return [cpos, s.co[cpos], epos, s.eo[epos]] as const;
}

const COVERED = ZBLS_COVERED_KEYS.map((ks) => {
  const key = keyFromString(ks)!;
  return { ks, key, state: unpackState(key), letter: classify(unpackState(key)).category.letter };
});

describe('displayState 摆出来的对子相位 = zbls 库那一格', () => {
  it('42 个大类都有真实 case 覆盖到(不是只测了几类)', () => {
    expect(new Set(COVERED.map((c) => c.letter)).size).toBe(CATEGORIES.length);
    expect(Object.keys(ZBLS_PHASE)).toHaveLength(CATEGORIES.length);
  });

  it('305 个已收录 case 逐条对上实测表', () => {
    for (const { ks, letter, state } of COVERED) {
      expect(pairOf(displayState(state)), `${letter} #${ks}`).toEqual(ZBLS_PHASE[letter]);
    }
  });

  it('换 case 不算摆正:相位变了,case 还是同一个', () => {
    for (const { ks, key, state } of COVERED) {
      expect(canonicalKey(displayState(state)), `#${ks}`).toBe(key);
    }
  });

  it('拿哪个 AUF 像进去都摆到同一格(幂等 + 与代表元无关)', () => {
    for (const { ks, state } of COVERED.slice(0, 40)) {
      const want = packState(displayState(state));
      for (let a = 0; a < 4; a++) {
        expect(packState(displayState(rotateU(state, a))), `#${ks} U${a}`).toBe(want);
      }
      expect(packState(displayState(displayState(state))), `#${ks} 幂等`).toBe(want);
    }
  });
});

describe('大类卡也按同一相位出图', () => {
  /** 照 categoryCardFacelets 的画法重画一遍,但位置 / 朝向取自实测表。 */
  function expectedCard(cpos: number, cori: number, epos: number, eori: number): string {
    const f = toFacelets(solvedCube()).split('');
    for (const p of LSLL_CORNER_POS) for (const idx of cornerFaceletIdx(p)) f[idx] = 'o';
    for (const p of LSLL_EDGE_POS) for (const idx of edgeFaceletIdx(p)) f[idx] = 'o';
    f[4] = 'o';
    paintCorner(f, LSLL_CORNER_POS[cpos], 4, cori);
    paintEdge(f, LSLL_EDGE_POS[epos], 8, eori);
    return f.join('');
  }

  it('42 张卡逐张与实测表一致', () => {
    for (const cat of CATEGORIES) {
      const [cpos, cori, epos, eori] = ZBLS_PHASE[cat.letter];
      expect(categoryCardFacelets(cat.slug), cat.letter).toBe(expectedCard(cpos, cori, epos, eori));
    }
  });
});
