/**
 * /scramble/symmetry 的记号解析(_alg.ts)与图鉴代表状态(_examples.ts)。
 */

import { describe, it, expect } from 'vitest';
import { applyAlgExtended } from '@/app/[lang]/scramble/symmetry/_alg';
import { SYM_EXAMPLES, SUPERFLIP } from '@/app/[lang]/scramble/symmetry/_examples';
import { SYM_TYPES, classifyCube } from '@/app/[lang]/scramble/symmetry/_sym_core';
import { solvedCubie, parseMoves, applySequence } from '@/app/[lang]/scramble/solver/_kociemba/cube';
import { cubieToFacelet } from '@/app/[lang]/scramble/solver/facelet';

const basic = (alg: string) => applySequence(solvedCubie(), parseMoves(alg));
const ext = (alg: string) => applyAlgExtended(alg).cube;

describe('_alg 扩展记号', () => {
  it('基本面转与 kociemba 的解析一致', () => {
    for (const alg of ["R U R' U'", 'F2 B2 L2', "D' L2 U", 'U R2 F B R B2 R U2 L B2 R']) {
      expect(ext(alg)).toEqual(basic(alg));
    }
  });

  it('整体旋转不改变状态本身(结果 = 转回标准朝向后的状态)', () => {
    expect(ext('x')).toEqual(solvedCubie());
    expect(ext("x y z x' y' z'")).toEqual(solvedCubie());
    expect(ext('x R x2 y')).toEqual(basic('R'));
  });

  it('旋转的朝向跟踪正确 —— 旋转后的面转落到对的那个面上', () => {
    // y 之后的 "R" 实际是原来的 B 面
    expect(ext('y R')).toEqual(basic('B'));
    expect(ext("y' R")).toEqual(basic('F'));
    expect(ext('x U')).toEqual(basic('F'));
    expect(ext('z U')).toEqual(basic('L'));
    expect(ext('y2 F')).toEqual(basic('B'));
  });

  it('宽层 / 中层展开成众所周知的等价形', () => {
    expect(ext('Rw')).toEqual(basic('L'));
    expect(ext('r')).toEqual(basic('L'));
    expect(ext('Lw')).toEqual(basic('R'));
    expect(ext('Uw')).toEqual(basic('D'));
    expect(ext('Dw')).toEqual(basic('U'));
    expect(ext('Fw')).toEqual(basic('B'));
    expect(ext('Bw')).toEqual(basic('F'));
    expect(ext('M')).toEqual(basic("L' R"));
    expect(ext('E')).toEqual(basic("D' U"));
    expect(ext('S')).toEqual(basic("F' B"));
  });

  it('后缀 2 与 撇 正确', () => {
    expect(ext('R2')).toEqual(basic('R R'));
    expect(ext("R'")).toEqual(basic("R'"));
    expect(ext('M2')).toEqual(ext('M M'));
    expect(ext("M M'")).toEqual(solvedCubie());
    expect(ext("Rw Rw'")).toEqual(solvedCubie());
    expect(ext('x x x x')).toEqual(solvedCubie());
    expect(ext('R3')).toEqual(basic("R'")); // Cube Explorer 用 3 表示逆时针
  });

  it('用到旋转 / 宽层 / 中层时打上 reoriented 标记', () => {
    expect(applyAlgExtended("R U R'").reoriented).toBe(false);
    expect(applyAlgExtended('R M').reoriented).toBe(true);
    expect(applyAlgExtended('Rw').reoriented).toBe(true);
    expect(applyAlgExtended('y').reoriented).toBe(true);
  });

  it('非法记号抛错', () => {
    expect(() => applyAlgExtended('Q')).toThrow();
    expect(() => applyAlgExtended("R U'' R")).toThrow();
    expect(() => applyAlgExtended('R4')).toThrow();
    expect(() => applyAlgExtended('Rww')).toThrow();
  });

  it('空串 = 复原态', () => {
    expect(ext('')).toEqual(solvedCubie());
    expect(ext('   ')).toEqual(solvedCubie());
  });
});

describe('图鉴代表状态', () => {
  it('33 种类型一一对应,顺序与 SYM_TYPES 相同', () => {
    expect(SYM_EXAMPLES).toHaveLength(33);
    SYM_EXAMPLES.forEach((e, i) => expect(e.name).toBe(SYM_TYPES[i].name));
  });

  it('每条公式拧出来的状态,对称型正是它标称的那个', () => {
    for (const e of SYM_EXAMPLES) {
      if (e.alg === null) continue;
      const cube = applyAlgExtended(e.alg).cube;
      expect(`${e.name}: ${SYM_TYPES[classifyCube(cube)].name}`).toBe(`${e.name}: ${e.name}`);
      expect(cubieToFacelet(cube)).toHaveLength(54);
    }
  });

  it('只有 O 与 Td 没有代表 —— 正好是 exact = 0 的两类', () => {
    const missing = SYM_EXAMPLES.filter((e) => e.alg === null).map((e) => e.name);
    expect(missing).toEqual(['O', 'Td']);
    const zero = SYM_TYPES.filter((t) => t.exact === 0n).map((t) => t.name);
    expect(zero).toEqual(['O', 'Td']);
  });

  it('superflip 是 Oh,而且自逆', () => {
    const cube = applyAlgExtended(SUPERFLIP).cube;
    expect(SYM_TYPES[classifyCube(cube)].name).toBe('Oh');
    expect(cube.eo.every((v) => v === 1)).toBe(true);
    expect(cube.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
