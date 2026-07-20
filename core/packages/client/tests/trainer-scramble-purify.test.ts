import { describe, it, expect } from 'vitest';
import { purifyScramble } from '@/lib/trainer-scramble';

// 「纯打乱」开关:显示/复制那一份只留转动。原打乱不动(store / 缩略图仍吃原文)。
describe('purifyScramble', () => {
  it('剥换握记号 ↑↓·', () => {
    expect(purifyScramble('3x3', "R U ↑ R' U' ↓ R' F · R2")).toBe("R U R' U' R' F R2");
  });

  it('展开分组括号,不留孤立的重复指数', () => {
    expect(purifyScramble('3x3', "F' (L' U2 L U')2 F")).toBe("F' L' U2 L U' L' U2 L U' F");
  });

  it('括号没有指数时只是丢括号', () => {
    expect(purifyScramble('3x3', "(R U R') (U' R' F R F')")).toBe("R U R' U' R' F R F'");
  });

  it('剥上游标注 =/*', () => {
    expect(purifyScramble('3x3', "R U R' U' = R' F R F'")).toBe("R U R' U' R' F R F'");
  });

  it("半圈的撇归一:R2' → R2(宽层同理),但 U3' 不动(它 = U',不是 U3)", () => {
    expect(purifyScramble('3x3', "R2' U2' F2")).toBe('R2 U2 F2');
    expect(purifyScramble('4x4', "3Rw2' u2'")).toBe('3Rw2 u2');
    expect(purifyScramble('3x3', "U3' R")).toBe("U3' R");
  });

  it('五魔方另一套文法,只剥标注不做 2 归一', () => {
    expect(purifyScramble('megaminx', "R++ D-- ↑ R2' U'")).toBe("R++ D-- R2' U'");
  });

  it('sq1 的括号是招式本体,原样返回', () => {
    expect(purifyScramble('sq1', '(1,0)/ (3,0)/ (-1,-1)')).toBe('(1,0)/ (3,0)/ (-1,-1)');
  });

  it('空串 / 已经干净的打乱是恒等', () => {
    expect(purifyScramble('3x3', '')).toBe('');
    expect(purifyScramble('3x3', "R U R' U'")).toBe("R U R' U'");
  });
});
