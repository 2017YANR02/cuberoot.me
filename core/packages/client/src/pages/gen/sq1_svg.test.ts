import { describe, it, expect } from 'vitest';
import {
  applySq1Scramble,
  canonicalSq1Alg,
  compactSq1Alg,
  invertSq1Alg,
} from './sq1_svg';

describe('SQ1 tokenizer — existing forms still parse', () => {
  // Lock down `30` → `(3,0)` via greedy backtrack (NOT a single 30 turn).
  // If anyone "fixes" the regex to prefer single-num greedily, this breaks.
  it('`30` parses as (3, 0)', () => {
    expect(canonicalSq1Alg('30')).toBe('(3, 0)');
  });
  it('mixed `(1,0)/(-3,0)/(3,-3)` canonicalizes', () => {
    expect(canonicalSq1Alg('(1,0)/(-3,0)/(3,-3)')).toBe('(1, 0) / (-3, 0) / (3, -3)');
  });
  it('space-separated `1 0` = (1, 0)', () => {
    expect(canonicalSq1Alg('1 0')).toBe('(1, 0)');
  });
  it('compact emits `tb` for pair, round-trips', () => {
    expect(compactSq1Alg('(1, 0) / (-3, -2)')).toBe('10/-3-2');
    expect(canonicalSq1Alg('10/-3-2')).toBe('(1, 0) / (-3, -2)');
  });
  it('invert (1,0) / (3,-3) = (3, -3) / (-1, 0) reversed-negated', () => {
    expect(invertSq1Alg('(1, 0) / (3, -3)')).toBe('(-3,3)/(-1,0)');
  });
});

describe('SQ1 tokenizer — single-num shorthand `t` = (t, 0)', () => {
  it('`/3/` = `/ (3, 0) /`', () => {
    expect(canonicalSq1Alg('/3/')).toBe('/ (3, 0) /');
  });
  it('`(3)` paren shorthand = (3, 0)', () => {
    expect(canonicalSq1Alg('(3)')).toBe('(3, 0)');
  });
  it('negative single `-3` = (-3, 0)', () => {
    expect(canonicalSq1Alg('-3')).toBe('(-3, 0)');
  });
  it('apply `/3/` rotates top by -3 then slices twice (net = top rotation only)', () => {
    const a = applySq1Scramble('/3/');
    const b = applySq1Scramble('/ (3, 0) /');
    expect(a.pieces).toEqual(b.pieces);
    expect(a.sliceSolved).toBe(b.sliceSolved);
  });
  it('mixed `(1,0) / 3 / (-2, -2)` parses with implicit bottom=0 on middle turn', () => {
    expect(canonicalSq1Alg('(1,0) / 3 / (-2, -2)'))
      .toBe('(1, 0) / (3, 0) / (-2, -2)');
  });
  it('leading `3/` (single then slash, no opening slash) parses', () => {
    expect(canonicalSq1Alg('3/')).toBe('(3, 0) /');
    expect(canonicalSq1Alg('3/-2,1/0,3/')).toBe('(3, 0) / (-2, 1) / (0, 3) /');
    expect(canonicalSq1Alg('-3/3,-3/')).toBe('(-3, 0) / (3, -3) /');
  });
  it('compact emits `t0` for single (round-trip safe via greedy backtrack)', () => {
    expect(compactSq1Alg('3')).toBe('30');
    expect(canonicalSq1Alg(compactSq1Alg('-4'))).toBe('(-4, 0)');
  });
  it('invert single negates top, keeps 0 bottom', () => {
    expect(invertSq1Alg('3')).toBe('(-3,0)');
    expect(invertSq1Alg('(1, 0) / 3')).toBe('(-3,0)/(-1,0)');
  });
});
