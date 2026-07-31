// 末位层「角块换位」排序:U(只差 AUF)最前、D(对角换)次之,其余保持库里的顺序。
import { describe, it, expect } from 'vitest';
import { zbllCpLetter, collCpLetter, cpRank, sortByCp } from '@/lib/alg_cp_order';

const zc = (subgroup: string, name = subgroup) => ({ name, subgroup });

describe('zbllCpLetter', () => {
  it('剥掉顶层组前缀,剩下的就是方向字母', () => {
    expect(zbllCpLetter('U/UD')).toBe('D');
    expect(zbllCpLetter('U/UU')).toBe('U');
    expect(zbllCpLetter('Pi/PiU')).toBe('U');   // 多字符前缀
    expect(zbllCpLetter('AS/ASD')).toBe('D');
    expect(zbllCpLetter('H/HB')).toBe('B');
  });
  it('不是两级子组就没有方向', () => {
    expect(zbllCpLetter('U')).toBe('');
    expect(zbllCpLetter('')).toBe('');
    expect(zbllCpLetter('Adj Swap/Something')).toBe('');  // 二级不以顶层开头
  });
});

describe('collCpLetter', () => {
  it('每组 1 号是角块已成型,末位是对角换', () => {
    for (const [first, last] of [['U 1', 'U 6'], ['T 1', 'T 6'], ['Pi 1', 'Pi 6'],
      ['S 1', 'S 6'], ['AS 1', 'AS 6'], ['L 1', 'L 6'], ['H 1', 'H 4']]) {
      expect(collCpLetter(first), first).toBe('U');
      expect(collCpLetter(last), last).toBe('D');
    }
  });
  it('每组六个方向互不相同(H 组高对称只有四个)', () => {
    for (const [g, n] of [['U', 6], ['T', 6], ['L', 6], ['Pi', 6], ['S', 6], ['AS', 6], ['H', 4]] as const) {
      const letters = Array.from({ length: n }, (_, i) => collCpLetter(`${g} ${i + 1}`));
      expect(new Set(letters).size, g).toBe(n);
      expect(letters, g).not.toContain('');
    }
  });
  it('认不出的名字返回空(排序时当同级)', () => {
    expect(collCpLetter('U 9')).toBe('');
    expect(collCpLetter('Aa')).toBe('');
  });
});

describe('cpRank', () => {
  it('U < D < 其余', () => {
    expect(cpRank('U')).toBeLessThan(cpRank('D'));
    expect(cpRank('D')).toBeLessThan(cpRank('R'));
    expect(cpRank('R')).toBe(cpRank('F'));
    expect(cpRank('')).toBe(cpRank('L'));
  });
});

describe('sortByCp', () => {
  it('ZBLL:组内 U、D 提前,其余四个原顺序', () => {
    const order = ['UR', 'UL', 'UB', 'UF', 'UD', 'UU'].map(s => zc(`U/${s}`));
    expect(sortByCp('zbll', order).map(c => c.subgroup))
      .toEqual(['U/UU', 'U/UD', 'U/UR', 'U/UL', 'U/UB', 'U/UF']);
  });

  it('ZBLL:顶层组之间不重排,各排各的', () => {
    const cases = [...['UR', 'UD', 'UU'].map(s => zc(`U/${s}`)), ...['LL', 'LD', 'LU'].map(s => zc(`L/${s}`))];
    expect(sortByCp('zbll', cases).map(c => c.subgroup))
      .toEqual(['U/UU', 'U/UD', 'U/UR', 'L/LU', 'L/LD', 'L/LL']);
  });

  it('ZBLL:同一子组内 case 的先后不动', () => {
    const cases = [zc('U/UR', 'ZBLL U 1'), zc('U/UR', 'ZBLL U 2'), zc('U/UU', 'ZBLL U 61')];
    expect(sortByCp('zbll', cases).map(c => c.name)).toEqual(['ZBLL U 61', 'ZBLL U 1', 'ZBLL U 2']);
  });

  it('COLL:1 号提到最前、末位紧随其后', () => {
    const cases = [1, 2, 3, 4, 5, 6].map(n => ({ name: `U ${n}`, subgroup: 'U' }));
    expect(sortByCp('coll', cases).map(c => c.name)).toEqual(['U 1', 'U 6', 'U 2', 'U 3', 'U 4', 'U 5']);
  });

  it('COLL:H 组只有四个,末位是 4', () => {
    const cases = [1, 2, 3, 4].map(n => ({ name: `H ${n}`, subgroup: 'H' }));
    expect(sortByCp('coll', cases).map(c => c.name)).toEqual(['H 1', 'H 4', 'H 2', 'H 3']);
  });

  it('别的 set 原样返回(同一个数组引用,上游拿它当 memo 依赖)', () => {
    const cases = [zc('Adj Swap', 'Aa'), zc('EPLL', 'H')];
    expect(sortByCp('pll', cases)).toBe(cases);
  });
});
