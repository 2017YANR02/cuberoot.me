import { describe, it, expect } from 'vitest';
import { findIllegalNotationChars } from '@/lib/recon-alg-utils';

describe('findIllegalNotationChars', () => {
  it('passes pure ASCII notation', () => {
    expect(findIllegalNotationChars("R U R' U' R' F R2 U' R' U' F' R U")).toEqual([]);
  });

  it('passes SQ1-style parenthesized notation', () => {
    expect(findIllegalNotationChars('(1,0) / (3,3) / (-2,1)')).toEqual([]);
  });

  it('allows any language AFTER the // comment marker', () => {
    expect(findIllegalNotationChars("R D R' U' // memo(黄顶红前 Yellow Top)")).toEqual([]);
    expect(findIllegalNotationChars('// 角块(Corner):')).toEqual([]);
    expect(findIllegalNotationChars("R' E R U' // CT(UF-UL-LF)")).toEqual([]);
  });

  it('flags non-ASCII BEFORE the moves (the recon 2406 playback bug)', () => {
    const v = findIllegalNotationChars("消接R' E R U' R' E' R U2 // CT(UF-UL-LF)");
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(1);
    expect(v[0].chars).toContain('消');
    expect(v[0].chars).toContain('接');
  });

  it('reports the correct 1-based line number in multi-line input', () => {
    const text = [
      "R U R' U'",            // line 1 ok
      "// pure comment 中文",  // line 2 ok (comment)
      "测试 R U R'",           // line 3 bad
    ].join('\n');
    const v = findIllegalNotationChars(text);
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(3);
  });

  it('flags full-width punctuation outside comments', () => {
    expect(findIllegalNotationChars('R U，R U').length).toBe(1);
  });

  it('returns [] for empty input', () => {
    expect(findIllegalNotationChars('')).toEqual([]);
  });
});
