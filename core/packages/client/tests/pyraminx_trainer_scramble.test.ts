import { describe, it, expect } from 'vitest';
import { generateScramble } from '@/lib/trainer-scramble';
import { equivalentPyraScramble, pyraFaceletFromMoves } from '@/lib/pyraminx-solver';
import type { AlgCase } from '@cuberoot/shared';

/**
 * 金字塔训练打乱(issue #64)。库里的 setup 是最少步(L4E 多为 4-7 步),照着念一遍就等于
 * 把答案倒背了一遍 —— `rand` 换一条到达同一状态的随机长路径,并随机转一下顶层(金字塔真解
 * 里本来就要先补的那个 U / U')。
 *
 * 这里锁两件事,一件都不能松:
 *  · 状态必须**一模一样**(顶层朝向那一下除外)—— 打乱错了就是在练别的 case;
 *  · 必须真的更长、且每次都不一样 —— 否则这个功能等于没做。
 */

/** /v1/alg/sets/pyraminx/l4e 里的真 setup(Sune / AntiSune / Sledge / Hedge / Clockwise)。 */
const SETUPS = [
  "L' U' L U' L' U' L",
  "R U R' U R U R'",
  "R' L' U' L U R",
  "L R' L' R",
  "R' L R L'",
  "L' U L U R U R'",
];

const mkCase = (setup: string): AlgCase => ({
  subgroup: 'L4E', name: 'x', setup, standard: '', algs: [], sticker: { kind: 'face' },
} as unknown as AlgCase);

/** 顶层转 0/1/2 次后的三个状态 —— 收尾 AUF 只允许落在这三个里。 */
const aufStates = (setup: string): string[] =>
  ['', 'U', "U'"].map(auf => pyraFaceletFromMoves(`${setup} ${auf}`.trim()));

describe('pyraminx trainer scramble', () => {
  it('equivalentPyraScramble 到达同一状态,且明显更长', () => {
    for (const setup of SETUPS) {
      const target = pyraFaceletFromMoves(setup);
      for (let i = 0; i < 30; i++) {
        const s = equivalentPyraScramble(setup);
        expect(pyraFaceletFromMoves(s), `${setup} → ${s}`).toBe(target);
        expect(s.split(/\s+/).length).toBeGreaterThanOrEqual(setup.split(/\s+/).length + 3);
      }
    }
  });

  it('同一个 case 连出两条打乱不会一样(不是换汤不换药的定式)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(equivalentPyraScramble(SETUPS[0]));
    expect(seen.size).toBeGreaterThan(10);
  });

  it('空 / 认不出的记号原样退回,不编假打乱', () => {
    expect(equivalentPyraScramble('')).toBe('');
    expect(equivalentPyraScramble('   ')).toBe('');
    expect(equivalentPyraScramble('这不是公式')).toBe('这不是公式');
  });

  it('detour 越长打乱越长,但状态不变', () => {
    const target = pyraFaceletFromMoves(SETUPS[3]);
    const long = equivalentPyraScramble(SETUPS[3], { detour: 12 });
    expect(pyraFaceletFromMoves(long)).toBe(target);
    expect(long.split(/\s+/).length).toBeGreaterThanOrEqual(12);
  });

  it("kind='rand':状态 = case 或 case 顶层转过一次(收尾 AUF),绝不越界", () => {
    for (const setup of SETUPS) {
      const allowed = new Set(aufStates(setup));
      const hits = new Set<string>();
      for (let i = 0; i < 40; i++) {
        const s = generateScramble(mkCase(setup), 'pyraminx', 'rand');
        const st = pyraFaceletFromMoves(s);
        expect(allowed.has(st), `${setup} → ${s}`).toBe(true);
        hits.add(st);
      }
      expect(hits.size, `${setup} 顶层三种朝向都出得来`).toBe(3);
    }
  });

  it("kind='rand' + postAuf:false(记忆模式):状态与 case 逐字一致", () => {
    for (const setup of SETUPS) {
      const target = pyraFaceletFromMoves(setup);
      for (let i = 0; i < 10; i++) {
        const s = generateScramble(mkCase(setup), 'pyraminx', 'rand', { postAuf: false });
        expect(pyraFaceletFromMoves(s)).toBe(target);
      }
    }
  });

  it("kind='inv':仍是库里的 setup 原文(短打乱这条路没被动过)", () => {
    for (const setup of SETUPS) {
      expect(generateScramble(mkCase(setup), 'pyraminx', 'inv')).toBe(setup);
    }
  });
});
