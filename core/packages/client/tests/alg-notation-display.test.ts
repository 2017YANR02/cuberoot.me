import { describe, expect, it } from 'vitest';
import { formatAlgNotation } from '@/lib/alg-notation-display';

describe('formatAlgNotation', () => {
  it('keeps standard notation byte-for-byte', () => {
    const alg = "(R U R' U')2  M'";
    expect(formatAlgNotation(alg, 'standard')).toBe(alg);
  });

  it('renders all six faces with csTimer-style Chinese directions', () => {
    expect(formatAlgNotation("F' L2 R U' D B2", 'zh-cstimer')).toBe(
      '前面逆时针转90度，左面转180度，右面顺时针转90度，上面逆时针转90度，下面顺时针转90度，后面转180度',
    );
  });

  it('renders lowercase and w-suffixed turns as double-layer turns', () => {
    expect(formatAlgNotation("f' r2 Uw Lw' 2Fw", 'zh-cstimer')).toBe(
      '前面双层逆时针转90度，右面双层转180度，上面双层顺时针转90度，左面双层逆时针转90度，前面双层顺时针转90度',
    );
  });

  it('keeps rotations and slice moves in their original notation', () => {
    expect(formatAlgNotation("x y2 z' E M' S2", 'zh-cstimer')).toBe("x，y2，z'，E，M'，S2");
  });

  it('renders compact Chinese notation without standard move tokens', () => {
    expect(formatAlgNotation("R U2' U' r R2 f' Uw x M'", 'zh-compact')).toBe(
      "右顺 上180 上逆 右双顺 右180 前双逆 上双顺 x M'",
    );
  });

  it('preserves grouping, commutator punctuation, and unknown text', () => {
    expect(formatAlgNotation("(R U R')2 [F, B']", 'zh-cstimer')).toBe(
      '(右面顺时针转90度，上面顺时针转90度，右面逆时针转90度)2 [前面顺时针转90度, 后面逆时针转90度]',
    );
    expect(formatAlgNotation('R note U', 'zh-cstimer')).toBe('右面顺时针转90度 note 上面顺时针转90度');
  });

  it('returns empty and unsupported layer notation safely', () => {
    expect(formatAlgNotation('', 'zh-cstimer')).toBe('');
    expect(formatAlgNotation('3Rw R0 2R', 'zh-cstimer')).toBe('3Rw，R0，2R');
  });
});
