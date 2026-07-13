/**
 * AlgPlayer 喂给 cubing.js 的文本 —— 库里的公式是**人写的**,不是机器串。
 *
 * 1LLL 表(3915 case / 10123 条公式)带进来三样 cubing.js 直接吃会出事的东西:
 *   · 无空格连写 `MR` `U'D'` `R'M'` —— cubing.js **不报错**,它把 `MR` 当成一个叫 MR 的
 *     family 收下,直到 applyAlg 才炸。AlgPlayer 的 catch 只 warn 一行 → 用户看到空播放器。
 *   · 换握记号 `↑↓·` —— 解析直接抛。
 *   · 分组重复 `(R U R' U')2`。
 */
import { describe, it, expect } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { normalizeAlgForTwisty } from '@/components/AlgPlayer/AlgPlayer';

const kpuzzle = await cube3x3x3.kpuzzle();
const playable = (s: string) => {
  kpuzzle.defaultPattern().applyAlg(new Alg(s));   // 抛 = 播放器会空白
  return s;
};

describe('normalizeAlgForTwisty', () => {
  it('拆开无空格连写(cubing.js 会把 MR 当成一个 family)', () => {
    expect(normalizeAlgForTwisty('3x3', "(MR U R' U) (r U2' r' U) M'")).toBe("M R U R' U r U2' r' U M'");
    expect(normalizeAlgForTwisty('3x3', "(R U' r' U') (R U R'M') F' U F")).toBe("R U' r' U' R U R' M' F' U F");
    expect(normalizeAlgForTwisty('3x3', "(R D' R2' U') (R2 UD R' U')")).toBe("R D' R2' U' R2 U D R' U'");
  });

  it('剥换握记号,不把两步黏成一个 family', () => {
    // ↑ 剥成空串会得到 `U2r'` —— new Alg 收下一个叫 `U2r` 的东西,静默错一步
    expect(normalizeAlgForTwisty('3x3', "U2↑r' U' r (U2' R' U2 R U2') r' U r U'"))
      .toBe("U2 r' U' r U2' R' U2 R U2' r' U r U'");
    expect(normalizeAlgForTwisty('3x3', "(↑ L U L F' L' F U') (F' L' U' L U F2' U' F' L')"))
      .toBe("L U L F' L' F U' F' L' U' L U F2' U' F' L'");
  });

  it('展开分组重复', () => {
    expect(normalizeAlgForTwisty('3x3', "(R U R' U')2 F")).toBe("R U R' U' R U R' U' F");
  });

  it('R4 / R3 是真实动作,不折 mod 4', () => {
    expect(normalizeAlgForTwisty('3x3', "R4 U R3")).toBe("R4 U R3");
  });

  it('产出的串 cubing.js 全都能 apply', () => {
    for (const raw of [
      "U2 (MR U R' U) (R U' R' U) (r U2' r' U') M'",
      "F' U' (R' F R2 U R') E'U' (R' F R D') U2",
      "U2 (R' F R F) U2' (R' F' R U2')↓F2 R U2 R'",
      "(↑R' U' R' F R F' U) (F R U R' U' F2 U F R)",
    ]) expect(() => playable(normalizeAlgForTwisty('3x3', raw))).not.toThrow();
  });

  it('别的记号体系原样透传', () => {
    expect(normalizeAlgForTwisty('megaminx', "R++ D-- R++ D--")).toBe("R++ D-- R++ D--");
    expect(normalizeAlgForTwisty('sq1', '(1,0)/(3,0)')).toContain('/');
  });

  it('认不出来的东西不静默改写 —— 原样退回,别硬塞半截给播放器', () => {
    expect(normalizeAlgForTwisty('3x3', 'R U @@@ F')).toBe('R U @@@ F');
  });
});
