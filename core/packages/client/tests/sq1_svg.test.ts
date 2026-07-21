import { describe, it, expect } from 'vitest';
import {
  applySq1Scramble,
  canonicalSq1Alg,
  compactSq1Alg,
  invertSq1Alg,
  simplifySq1Alg,
} from '@cuberoot/shared/sq1-notation';

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
  it('compact emits `tb` for pair, `t` for (t,0)+slash, round-trips', () => {
    expect(compactSq1Alg('(1, 0) / (-3, -2)')).toBe('1/-3-2');
    expect(canonicalSq1Alg('1/-3-2')).toBe('(1, 0) / (-3, -2)');
    // (-3, -2) bot ≠ 0 → 留 -3-2;最后一个 turn (3, 0) 后无 token → 简成 3
    expect(compactSq1Alg('(1, 0) / (-3, -2) / (3, 0)')).toBe('1/-3-2/3');
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
  it('compact emits `t` for (t, 0) at end / before slash', () => {
    expect(compactSq1Alg('3')).toBe('3');
    expect(canonicalSq1Alg(compactSq1Alg('-4'))).toBe('(-4, 0)');
    // Two adjacent (t, 0) turns with no slice between — keep `t0` to avoid
    // greedy regex mis-parse of `33` as (3, 3).
    expect(compactSq1Alg('(3, 0) (3, 0)')).toBe('3030');
  });
  it('invert single negates top, keeps 0 bottom', () => {
    expect(invertSq1Alg('3')).toBe('(-3,0)');
    expect(invertSq1Alg('(1, 0) / 3')).toBe('(-3,0)/(-1,0)');
  });
});

describe('SQ1 消步 — cancel redundant moves', () => {
  it('net-zero turns collapse, trailing `//` comment vanishes', () => {
    // The reported case: two opposing bottom turns cancel; `//` is a comment.
    expect(simplifySq1Alg('(0,-6) (0,6)//')).toBe('');
    expect(simplifySq1Alg('(0,-6) (0,6)')).toBe('');
  });
  it('lone `//` comment → empty', () => {
    expect(simplifySq1Alg('//')).toBe('');
    expect(simplifySq1Alg('(3,3) // some note')).toBe('33');
  });
  it('two adjacent slices annihilate', () => {
    expect(simplifySq1Alg('/ /')).toBe('');
    expect(simplifySq1Alg('(1,0) / / (-1,0)')).toBe('');
  });
  it('consecutive turns (no slice between) merge per layer', () => {
    expect(simplifySq1Alg('(1,0) (2,0)')).toBe('3');
    expect(simplifySq1Alg('(1,2) (2,1)')).toBe('33');
    // 12 units = full turn → identity.
    expect(simplifySq1Alg('(0,6) (0,6)')).toBe('');
  });
  it('turns straddling a slice do NOT merge', () => {
    expect(simplifySq1Alg('(1,0) / (2,0)')).toBe('1/2');
  });
  it('slice + cancelling turns + slice all collapse', () => {
    expect(simplifySq1Alg('/ (0,3) (0,-3) /')).toBe('');
  });
  it('amounts normalize to (-6, 6]', () => {
    expect(simplifySq1Alg('(7,0)')).toBe('-5'); // 7 → -5
    expect(simplifySq1Alg('(-7,0)')).toBe('5'); // -7 → 5
    expect(canonicalSq1Alg(simplifySq1Alg('(8,8)'))).toBe('(-4, -4)');
  });
  it('respects requested output format', () => {
    expect(simplifySq1Alg('(1,0) (2,0)', 'wca')).toBe('(3, 0)');
    expect(simplifySq1Alg('(1,0) (2,0)', 'compact')).toBe('3');
  });
  it('already-minimal alg is unchanged (sans comment)', () => {
    expect(simplifySq1Alg('1/3/-2-2', 'wca')).toBe(canonicalSq1Alg('1/3/-2-2'));
  });
});
