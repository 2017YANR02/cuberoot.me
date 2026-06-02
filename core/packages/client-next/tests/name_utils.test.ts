import { describe, it, expect } from 'vitest';
import { extractChineseName, stripChineseParens, displayCuberName } from '@/lib/cuber-name-display';

describe('extractChineseName', () => {
  it('extracts trailing Chinese paren', () => {
    expect(extractChineseName('Yiheng Wang (王艺衡)')).toBe('王艺衡');
    expect(extractChineseName('Xuanyi Geng (耿暄一)')).toBe('耿暄一');
  });
  it('returns null when no Chinese in parens', () => {
    expect(extractChineseName('Feliks Zemdegs')).toBeNull();
    expect(extractChineseName('Park Sang-Won (박상원)')).toBeNull(); // Korean, no CJK Unified
  });
  it('returns null when paren is not at the end', () => {
    expect(extractChineseName('(王艺衡) Yiheng Wang')).toBeNull();
  });
});

describe('stripChineseParens', () => {
  it('strips paren block at end', () => {
    expect(stripChineseParens('Yiheng Wang (王艺衡)')).toBe('Yiheng Wang');
  });
  it('strips Korean parens too (any non-empty paren)', () => {
    expect(stripChineseParens('Park Sang-Won (박상원)')).toBe('Park Sang-Won');
  });
  it('passes through plain Latin', () => {
    expect(stripChineseParens('Feliks Zemdegs')).toBe('Feliks Zemdegs');
  });
  it('strips multiple paren blocks', () => {
    expect(stripChineseParens('Foo (bar) Baz (qux)')).toBe('Foo  Baz'.replace(/\s+/g, ' ').trim());
  });
});

describe('displayCuberName', () => {
  it('zh mode → Chinese inside paren', () => {
    expect(displayCuberName('Yiheng Wang (王艺衡)', true)).toBe('王艺衡');
  });
  it('zh mode without Chinese paren → falls back to stripped Latin', () => {
    expect(displayCuberName('Feliks Zemdegs', true)).toBe('Feliks Zemdegs');
    expect(displayCuberName('Park Sang-Won (박상원)', true)).toBe('Park Sang-Won');
  });
  it('en mode → strip parens', () => {
    expect(displayCuberName('Yiheng Wang (王艺衡)', false)).toBe('Yiheng Wang');
    expect(displayCuberName('Park Sang-Won (박상원)', false)).toBe('Park Sang-Won');
  });
});
