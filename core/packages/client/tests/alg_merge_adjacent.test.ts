import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { mergeAdjacentMoves, flattenAlg, stm } from '@cuberoot/shared/alg-notation';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();
/** 两条公式是不是同一个变换(合并只准改写法,不准改变换)。 */
const sameTransform = (a: string, b: string) =>
  solved.applyAlg(new Alg(a)).isIdentical(solved.applyAlg(new Alg(b)));

describe('mergeAdjacentMoves', () => {
  it('issue #54 那一条:U2 U → U\'', () => {
    expect(mergeAdjacentMoves("R U R' U2 U")).toBe("R U R' U'");
  });

  it('整对抵消就一起丢', () => {
    expect(mergeAdjacentMoves("R U' U R'")).toBe('');       // 中间那对没了 ⟹ R 与 R' 挨上,接着也消
    expect(mergeAdjacentMoves('R U2 U2')).toBe('R');
    expect(mergeAdjacentMoves("U' U")).toBe('');
  });

  it('抵消后继续往回合(U U U\' → U)', () => {
    expect(mergeAdjacentMoves("U U U'")).toBe('U');
    expect(mergeAdjacentMoves("R U U' R'")).toBe('');       // R 与 R' 挨上了,再合就全空
    expect(mergeAdjacentMoves("F R U U' R' F'")).toBe('');
  });

  it('转体一样合', () => {
    expect(mergeAdjacentMoves("y' y2")).toBe('y');
    expect(mergeAdjacentMoves("y' y")).toBe('');
  });

  it('M 与 m 是两个不同的转动,不合(5x5 上一片 vs 三片)', () => {
    expect(mergeAdjacentMoves("M m")).toBe('M m');
    expect(mergeAdjacentMoves('M M')).toBe('M2');
  });

  it('层前缀不同不合', () => {
    expect(mergeAdjacentMoves('2R R')).toBe('2R R');
    expect(mergeAdjacentMoves('2R 2R')).toBe('2R2');
  });

  it('宽转与面转是两个 family', () => {
    expect(mergeAdjacentMoves('Rw R')).toBe('Rw R');
    expect(mergeAdjacentMoves('Rw Rw2')).toBe("Rw'");
  });

  it('没有相邻同面时逐字不动(只重排空格)', () => {
    const a = "R U R' U' R' F R2 U' R' U' R U R' F'";
    expect(mergeAdjacentMoves(a)).toBe(a);
  });

  it('认不出的记号抛错,绝不静默丢', () => {
    expect(() => mergeAdjacentMoves('R U ??? R')).toThrow();
  });

  it('合并前后是同一个变换', () => {
    for (const a of [
      "R U R' U2 U",
      "U' R U2 R D R' U2 R D' R' U2 R' U' R U' R' U U",
      "U2 R2 D r' U2 r D' R' U2 R' U2 U2",
      "R' U2 R U R2 F' R U R U' R' F R U' U2",
      "U' L' U R' U' U' z U R' U' R2 U D z' U'",
    ]) {
      expect(sameTransform(a, mergeAdjacentMoves(a)), a).toBe(true);
    }
  });

  it('废动作真的从步数里掉出去', () => {
    const bad = "U2 R2 D r' U2 r D' R' U2 R' U2 U2";
    const good = mergeAdjacentMoves(bad);
    expect(stm(bad) - stm(good)).toBe(2);   // U2 U2 = 两步废动作
  });

  it('先 flattenAlg 展开括号,跨括号的那对才合得掉', () => {
    const a = "(r U R' U') (U R' D' R U2 R' D R U) (r' F R F')";
    const merged = mergeAdjacentMoves(flattenAlg(a));
    expect(merged).not.toMatch(/U' U(?![2'])/);
    expect(sameTransform(a, merged)).toBe(true);
  });
});
