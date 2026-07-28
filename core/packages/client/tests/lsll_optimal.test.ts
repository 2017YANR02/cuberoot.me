/**
 * `lib/lsll/optimal` 的两个出口 —— 管道口径 2026-07-28 改成「case 的最优」之后,
 * 库里那条解落在 16 个首尾 AUF 像里的**哪一个**不再固定,于是打乱分成两条:
 *
 *  - `optimalSetup`  最短,相位随缘(训练器用,图从实际打乱渲染);
 *  - `setupForPhase` 补 AUF 摆到指定相位(case 页用,图不能飘),长度 +0~2。
 *
 * 这里钉死三件事:两条都必须落在**同一个 case** 上;`setupForPhase` 必须精确落到那个相位;
 * 以及「轨道最短的解首末招都不是 U 系」这条判据 —— 求解管道(solve.mjs / export_cases.mjs)
 * 拿它当唯一的正确性闸门,判据本身写错的话那道闸就白设了。
 */
import { describe, it, expect } from 'vitest';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { optimalSetup, orbitMinimal, setupForPhase } from '@/lib/lsll/optimal';
import { applyAlg, extractLsll, solvedCube } from '@/lib/lsll/cube333';
import { canonicalKey, decodeKey, displayState, locateFromScramble, packState } from '@/lib/lsll/model';

/** 一条把最后一槽也拆了的打乱 —— 对子有块在顶层,比纯顶层 case 更能考验相位处理。 */
const SCRAMBLE = "R U R' U' R U R' U'";
const KEY = (() => {
  const loc = locateFromScramble(SCRAMBLE);
  expect(loc.ok, '测试打乱不是合法 LSLL 局面').toBe(true);
  return loc.ok ? loc.key : 0;
})();
/** 能解开它的一条公式(不必最优 —— 这两个函数只关心「解完是不是这个 case」)。 */
const ALG = invertMoveString(SCRAMBLE).replace(/2'/g, '2');

const moves = (s: string) => s.split(/\s+/).filter(Boolean).length;
const stateOf = (s: string) => {
  const got = extractLsll(applyAlg(solvedCube(), s));
  expect('broken' in got, `${s} 不是 LSLL 局面`).toBe(false);
  return 'broken' in got ? null : got.state;
};

describe('optimalSetup:最短打乱,只认 case 不认相位', () => {
  it('取逆落回同一个 case', () => {
    const setup = optimalSetup(ALG, KEY);
    expect(setup).not.toBeNull();
    expect(canonicalKey(stateOf(setup!)!)).toBe(KEY);
    expect(moves(setup!)).toBe(moves(ALG));   // 纯取逆,一步不多
  });

  it('key 对不上 / 记号认不出 / 空串一律 null —— 调用方好退回现算', () => {
    expect(optimalSetup(ALG, KEY + 1)).toBeNull();
    expect(optimalSetup('R U ZZ', KEY)).toBeNull();
    expect(optimalSetup('', KEY)).toBeNull();
  });

  it('破坏十字 / 前三槽的公式不接受', () => {
    // D 会把已还原的三个槽转走,extractLsll 判 broken
    expect(optimalSetup(`${ALG} D`, KEY)).toBeNull();
  });
});

describe('setupForPhase:补 AUF 摆到展示相位', () => {
  const want = displayState(decodeKey(KEY)!);

  it('精确落在展示相位上,而且仍是同一个 case', () => {
    const setup = setupForPhase(ALG, want);
    expect(setup).not.toBeNull();
    expect(packState(stateOf(setup!)!)).toBe(packState(want));
    expect(canonicalKey(stateOf(setup!)!)).toBe(KEY);
  });

  it('比最短的那条多 0~2 步 —— 补的就是首尾那两个 AUF', () => {
    const delta = moves(setupForPhase(ALG, want)!) - moves(optimalSetup(ALG, KEY)!);
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThanOrEqual(2);
  });

  it('接出来的打乱里没有相邻同面 —— AUF 是合并进去的,不是硬拼成 `U U`', () => {
    // 16 个像逐个走一遍:任一 (pre, post) 组合都不该拼出 `U U` / `U2 U'` 这种写法
    for (const k of [KEY]) {
      const s = setupForPhase(ALG, displayState(decodeKey(k)!))!;
      const t = s.split(' ');
      for (let i = 1; i < t.length; i++) {
        expect(t[i][0], `${s} 第 ${i} 步与前一步同面`).not.toBe(t[i - 1][0]);
      }
    }
  });

  it('记号认不出返 null', () => {
    expect(setupForPhase('R U ZZ', want)).toBeNull();
    expect(setupForPhase('', want)).toBeNull();
  });
});

describe('orbitMinimal:解的首末招都不是 U 系', () => {
  it('首招或末招是 U 系一律判不合格', () => {
    for (const bad of ["U R U' R'", "R U R' U", "U R U' R' U2", 'U', "U' R2 U", '']) {
      expect(orbitMinimal(bad), bad).toBe(false);
    }
  });

  it('中间的 U 不误伤', () => {
    for (const ok of ["R U R' F'", "R U2 R' F R F'", "F R U R' U' F'", 'R2 F2 R2']) {
      expect(orbitMinimal(ok), ok).toBe(true);
    }
  });

  it('旧口径回填的数据过不了这一关 —— 页面靠它认出「这条还是旧的」', () => {
    // 2026-07-27 那批实测样本(展示相位的最优,不是 case 的最优)
    expect(orbitMinimal("B' R' U' R2 U R' B U2")).toBe(false);
    expect(orbitMinimal("U L U L' F' L' U' L B' F U2 B")).toBe(false);
  });

  it('剥掉首尾的 U 之后,得到的是同一个 case 的另一个成员', () => {
    // 判据成立的根据:`U^a S U^b` 这 16 个像是同一个 case,所以从解的首/末剥一个 U
    // 得到的是同轨道更短的成员 —— 「已经最短」与「首末有 U」不可能同时成立。
    const withAuf = `U ${ALG} U'`;
    const stripped = ALG;
    const a = locateFromScramble(invertMoveString(withAuf).replace(/2'/g, '2'));
    const b = locateFromScramble(invertMoveString(stripped).replace(/2'/g, '2'));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.key).toBe(b.key);
  });
});
