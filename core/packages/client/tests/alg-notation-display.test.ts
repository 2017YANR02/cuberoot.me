import { describe, expect, it } from 'vitest';
import { formatAlgNotation, formatCubeMoveDescription } from '@/lib/alg-notation-display';

describe('formatAlgNotation', () => {
  it('keeps standard notation byte-for-byte', () => {
    const alg = "(R U R' U')2  M'";
    expect(formatAlgNotation(alg, 'standard')).toBe(alg);
  });

  it('renders all six faces with foolproof Chinese directions', () => {
    expect(formatAlgNotation("F' L2 R U' D B2", 'dumb')).toBe(
      '前面逆时针转90度，左面转180度，右面顺时针转90度，上面逆时针转90度，下面顺时针转90度，后面转180度',
    );
  });

  it('renders lowercase and w-suffixed turns as double-layer turns', () => {
    expect(formatAlgNotation("f' r2 Uw Lw' 2Fw", 'dumb')).toBe(
      '前面双层逆时针转90度，右面双层转180度，上面双层顺时针转90度，左面双层逆时针转90度，前面双层顺时针转90度',
    );
  });

  it('renders rotations and slice moves as full foolproof instructions', () => {
    expect(formatAlgNotation("x y2 z' E M' S2", 'dumb')).toBe(
      '整体沿右层顺时针转90度，整体沿上层转180度，整体沿前层逆时针转90度，下面第二层顺时针转90度，左面第二层逆时针转90度，前面第二层转180度',
    );
    expect(formatAlgNotation("e m' s2", 'dumb')).toBe(
      '下面方向所有内层顺时针转90度，左面方向所有内层逆时针转90度，前面方向所有内层转180度',
    );
    expect(formatCubeMoveDescription('x', 'zh')).toBe('整体沿右层顺时针转90度');
    expect(formatCubeMoveDescription('E', 'zh')).toBe('下面第二层顺时针转90度');
  });

  it('renders compact Chinese notation without standard move tokens', () => {
    expect(formatAlgNotation("R U2' U' r R2 f' Uw x M'", 'zh-compact')).toBe(
      "右 上2' 上' 佑 右2 剪' 让 天 中'",
    );
    expect(formatAlgNotation("R U2 R2 F R F'", 'zh-compact')).toBe("右 上2 右2 前 右 前'");
  });

  it('uses the requested mnemonic characters for all compact double-layer turns', () => {
    expect(formatAlgNotation("u d2 l' r f2' b", 'zh-compact')).toBe("让 吓2 佐' 佑 剪2' 垢");
    expect(formatAlgNotation("Uw Dw2 Lw' Rw Fw2' Bw", 'zh-compact')).toBe("让 吓2 佐' 佑 剪2' 垢");
  });

  it('preserves grouping, commutator punctuation, and unknown text', () => {
    expect(formatAlgNotation("(R U R')2 [F, B']", 'dumb')).toBe(
      '(右面顺时针转90度，上面顺时针转90度，右面逆时针转90度)2 [前面顺时针转90度, 后面逆时针转90度]',
    );
    expect(formatAlgNotation('R note U', 'dumb')).toBe('右面顺时针转90度 note 上面顺时针转90度');
  });

  it('supports explicit repeat counts and numeric layers while preserving invalid input', () => {
    expect(formatAlgNotation('', 'dumb')).toBe('');
    expect(formatAlgNotation("U2' R3 R3'", 'dumb')).toBe(
      '上面转180度，右面顺时针转270度，右面逆时针转270度',
    );
    expect(formatAlgNotation('3Rw R0 2R', 'dumb')).toBe(
      '右面外侧3层顺时针转90度，R0，右面第2层顺时针转90度',
    );
  });
});
