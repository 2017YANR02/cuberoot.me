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
import { cube3x3x3, puzzles } from 'cubing/puzzles';
import { normalizeAlgForTwisty } from '@/components/AlgPlayer/AlgPlayer';
import {
  DEFAULT_ALG_MOVE_DURATION_MS,
  DEFAULT_PREVIEW_TIMING,
  resolvePlayerSetup,
  resolvePreviewTiming,
  resolveSimMoveDurationScale,
  resolveSimPreviewMoves,
  resolveTwistyTempoScale,
} from '@/components/AlgPlayer/player-setup';

const kpuzzle = await cube3x3x3.kpuzzle();
const megaminxKpuzzle = await puzzles.megaminx.kpuzzle();
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
    expect(normalizeAlgForTwisty('fto', "Uo' U Rw2 R' S H'")).toBe("Uo' U Rw2 R' S H'");
  });

  it('把 LowCubes Full PLL 记号转换成 cubing.js 可执行的 Megaminx 记号', () => {
    const normalized = normalizeAlgForTwisty(
      'megaminx',
      "L- (R' DR' R U R' DR R U)x3 x'",
    );
    expect(normalized).toBe("L' (R' DR' R U R' DR R U)3 x2");
    expect(() => megaminxKpuzzle.defaultPattern().applyAlg(new Alg(normalized))).not.toThrow();
  });

  it('认不出来的东西不静默改写 —— 原样退回,别硬塞半截给播放器', () => {
    expect(normalizeAlgForTwisty('3x3', 'R U @@@ F')).toBe('R U @@@ F');
  });
});

describe('resolvePlayerSetup', () => {
  it('记号教学从复原态开始', () => {
    expect(resolvePlayerSetup('3x3', 'R', undefined, true)).toBe('');
  });

  it('普通公式预览仍优先使用显式 setup,否则从公式逆态开始', () => {
    expect(resolvePlayerSetup('3x3', 'R U', 'F R', false)).toBe('F R');
    expect(resolvePlayerSetup('3x3', 'R U', undefined, false)).toBe("(R U)'");
    expect(resolvePlayerSetup('fto', "U Rw S'", undefined, false)).toBe("S Rw' U'");
    expect(resolvePlayerSetup('sq1', '(1,0)/(3,-3)', undefined, false)).toBe('(-3,3)/(-1,0)');
  });

  it('SQ1 的成对转层和切层按真实 token 切步,不按括号内空格误拆', () => {
    expect(resolveSimPreviewMoves('sq1', '(1,0) / (3, -3) /')).toEqual([
      '(1, 0)', '/', '(3, -3)', '/',
    ]);
    expect(resolveSimPreviewMoves('3x3', "R U R'")).toEqual(['R', 'U', "R'"]);
  });
});

describe('notation demo timing', () => {
  it('公式预览和记号教学默认共用每 STM 一秒', () => {
    expect(DEFAULT_ALG_MOVE_DURATION_MS).toBe(1000);
    expect(DEFAULT_PREVIEW_TIMING).toEqual({ frames: 60, stepMs: 1000 });
    expect(resolvePreviewTiming()).toBe(DEFAULT_PREVIEW_TIMING);
    expect(resolveTwistyTempoScale()).toBeUndefined();
  });

  it('把一秒单步换算为 sim 帧数和 TwistyPlayer 速度', () => {
    expect(resolvePreviewTiming(1000)).toEqual({ frames: 60, stepMs: 1000 });
    const halfTurnScale = resolveSimMoveDurationScale('3x3', 'R2');
    const pyraTurnScale = resolveSimMoveDurationScale('pyraminx', 'R');
    expect(resolvePreviewTiming(1000, halfTurnScale)).toEqual({ frames: 45, stepMs: 1000 });
    expect(resolvePreviewTiming(1000, pyraTurnScale).frames * pyraTurnScale).toBeCloseTo(60);
    expect(resolveTwistyTempoScale(1000, 'R')).toBe(1);
    expect(resolveTwistyTempoScale(1000, 'R2')).toBe(1.5);
    expect(resolveTwistyTempoScale(1000, 'R++')).toBe(1.5);
  });

  it('拒绝非法时长,极短时长至少保留一帧', () => {
    expect(resolvePreviewTiming(0)).toBe(DEFAULT_PREVIEW_TIMING);
    expect(resolvePreviewTiming(Number.NaN)).toBe(DEFAULT_PREVIEW_TIMING);
    expect(resolvePreviewTiming(1)).toEqual({ frames: 1, stepMs: 1 });
    expect(resolveTwistyTempoScale(-1)).toBeUndefined();
  });
});
