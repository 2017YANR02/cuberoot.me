import { describe, it, expect } from 'vitest';
import { stripFtnBlocks, FTN_TOKEN, parseFtnPin } from '@/app/[lang]/sim/engine/hands/ftn';

// FTN [...] 注解块(FINGERTRICKS.md §7,部分实装):剥离 + @pin 单簇解析。
// 编排目前仅 R[R2:@C](R2 贴块钉 C 随 weld 骑到 Q)。

describe('stripFtnBlocks', () => {
  it('剥净注解块,招式原样保留', () => {
    expect(stripFtnBlocks("R[R2:@C>Q] U R'")).toBe("R U R'");
    expect(stripFtnBlocks("U2[R2:(0-.5)Q>M; R3:(.5-1)Q>M] U'")).toBe("U2 U'");
    expect(stripFtnBlocks("U'p[R2:@B>A .p]")).toBe("U'p"); // p 糖塌形,后续 stripPushMarks 再剥
  });
  it('无块输入零变化', () => {
    expect(stripFtnBlocks("R U R' U'")).toBe("R U R' U'");
  });
});

describe('FTN_TOKEN', () => {
  it('匹配紧贴注解 token 并分离招式/块', () => {
    const m = FTN_TOKEN.exec("R[R2:@C>Q]");
    expect(m?.[1]).toBe('R');
    expect(m?.[2]).toBe('R2:@C>Q');
  });
  it('裸招式 / 未闭合块不匹配', () => {
    expect(FTN_TOKEN.test('R')).toBe(false);
    expect(FTN_TOKEN.test('R[R2:@C')).toBe(false);
  });
});

describe('parseFtnPin', () => {
  it('R[R2:@C>Q] 与终点省略形都产出 pin', () => {
    const pin = { hand: 'R', finger: 'index', sticker: 'C' };
    expect(parseFtnPin('R2:@C>Q', 'R')).toEqual(pin);
    expect(parseFtnPin('R2:@C', 'R')).toEqual(pin);
  });
  it('多簇取首个可识别 pin,垃圾簇静默忽略(§7.4)', () => {
    expect(parseFtnPin('(junk); R2:@C>Q', 'R')).toEqual({ hand: 'R', finger: 'index', sticker: 'C' });
  });
  it('未编排组合一律 undefined:错终点/错招式/错手指/非贴块档', () => {
    expect(parseFtnPin('R2:@C>M', 'R')).toBeUndefined(); // pin 落点被群论钉死为 Q,非 Q 视为规格错误
    expect(parseFtnPin('R2:@C', 'U')).toBeUndefined();
    expect(parseFtnPin('L2:@C', 'R')).toBeUndefined();
    expect(parseFtnPin('R3:@C', 'R')).toBeUndefined();
    expect(parseFtnPin('R2:Q>M', 'R')).toBeUndefined(); // 缺省贴面档不是 @pin
  });
});
