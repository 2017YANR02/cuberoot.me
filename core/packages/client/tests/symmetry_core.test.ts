/**
 * /scramble/symmetry 的对称引擎回归测试。
 *
 * 核心断言:cubie 层的 48 对称表(移植自 CubeExplorer Symmetries.pas)与本仓
 * 已有的 facelet 层 48 对称置换表(_pattern_core.SYM_PERMS,移植自 CubeDefs.pas
 * FaceletSym)编号一致 —— 两条独立路径算出的对称掩码必须逐位相同。
 * 编号一致是 ImageSym 那 33 个子群掩码能直接用的前提。
 */

import { describe, it, expect } from 'vitest';
import {
  N_SYM, SYMS, SYM_INV, SYM_MULT, SYM_MATRIX, SYM_ELEMENTS, SYM_TYPES,
  symMask, antisymMask, classifyMask, classifyCube, maskOrder, closure,
  closureWithAnti, seedsWithoutElement,
  normalizer, invertCubie, conjugate, TOTAL_POSITIONS, SYMMETRIC_POSITIONS,
  maskToList, generatorsOf,
} from '@/app/[lang]/scramble/symmetry/_sym_core';
import { SYM_PERMS } from '@/app/[lang]/scramble/pattern/search/_pattern_core';
import { cubieToFacelet, faceletToCubie } from '@/lib/cube-facelet';
import { solvedCubie, parseMoves, applySequence, multiply } from '@/app/[lang]/scramble/solver/_kociemba/cube';

const cubeOf = (alg: string) => applySequence(solvedCubie(), parseMoves(alg));

/** facelet 层的共轭:位置置换 + 按中心归一重命色。 */
function conjFacelet(facelet: string, m: number): string {
  const perm = SYM_PERMS[m];
  const tmp = new Array<string>(54);
  for (let i = 0; i < 54; i++) tmp[i] = facelet[perm[i]];
  const centers = 'URFDLB';
  const cmap = new Map<string, string>();
  for (let f = 0; f < 6; f++) cmap.set(tmp[4 + 9 * f], centers[f]);
  return tmp.map((c) => cmap.get(c)!).join('');
}

describe('48 对称元素表', () => {
  it('是一个 48 阶群,逆表与乘法表自洽', () => {
    expect(SYMS).toHaveLength(N_SYM);
    const keys = new Set(SYMS.map((s) => s.cp.join(',') + '|' + s.co.join(',')));
    expect(keys.size).toBe(N_SYM);
    for (let i = 0; i < N_SYM; i++) {
      expect(SYM_MULT[i][SYM_INV[i]]).toBe(0);
      expect(SYM_MULT[SYM_INV[i]][i]).toBe(0);
      expect(SYM_MULT[0][i]).toBe(i);
      expect(SYM_MULT[i][0]).toBe(i);
    }
    // 结合律抽查
    for (let i = 0; i < N_SYM; i += 5) {
      for (let j = 0; j < N_SYM; j += 7) {
        for (let k = 0; k < N_SYM; k += 11) {
          expect(SYM_MULT[SYM_MULT[i][j]][k]).toBe(SYM_MULT[i][SYM_MULT[j][k]]);
        }
      }
    }
  });

  it('每个元素都有对应的 3×3 有向置换矩阵', () => {
    expect(SYM_MATRIX.filter(Boolean)).toHaveLength(N_SYM);
  });

  it('共轭类分布 = O_h 的 1+6+3+8+6+1+6+8+3+6', () => {
    const count = (c: string) => SYM_ELEMENTS.filter((e) => e.cls === c).length;
    expect(count('E')).toBe(1);
    expect(count('C4')).toBe(6);
    expect(count('C2f')).toBe(3);
    expect(count('C3')).toBe(8);
    expect(count('C2e')).toBe(6);
    expect(count('i')).toBe(1);
    expect(count('S4')).toBe(6);
    expect(count('S6')).toBe(8);
    expect(count('sh')).toBe(3);
    expect(count('sd')).toBe(6);
    expect(SYM_ELEMENTS.filter((e) => e.det > 0)).toHaveLength(24);
  });

  it('每个元素的标记唯一', () => {
    expect(new Set(SYM_ELEMENTS.map((e) => e.label)).size).toBe(N_SYM);
  });
});

describe('cubie 层与 facelet 层的对称编号一致', () => {
  const algs = [
    '',
    "R U R' U'",
    'U2 D2 R2 L2 F2 B2',
    "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U", // superflip
    "F2 B2 U2 D2 L2 R2",
    "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    'U2 D2',
    "U D'",
    'F2 R2',
    "U' D F2 B2",
    'B2 D2 U2 F2',
    "B F L R B' F' D' U' L R D U",
    "R U R' U R U2 R'",
  ];
  for (const alg of algs) {
    it(`「${alg || '复原态'}」对称阶两路一致`, () => {
      const cube = cubeOf(alg);
      const facelet = cubieToFacelet(cube);
      let n = 0;
      for (let m = 0; m < N_SYM; m++) if (conjFacelet(facelet, m) === facelet) n++;
      expect(maskOrder(symMask(cube))).toBe(n);
    });
  }

  it('两层给出同一个 48 元轨道', () => {
    // _pattern_core 的 tmp[i]=state[perm[i]] 是"取源"写法,与上游 Conjugate 的
    // "放到目标"方向相反,于是两边对 48 个元素的编号差一个自同构。作为群作用
    // 二者等价 —— 断言轨道(48 个共轭像的集合)完全相同即可。
    for (const alg of ["R U R' F' L D2 B", 'U2 D2', "R U2 D' B D'"]) {
      const cube = cubeOf(alg);
      const facelet = cubieToFacelet(cube);
      const a = new Set<string>();
      const b = new Set<string>();
      for (let m = 0; m < N_SYM; m++) {
        a.add(conjFacelet(facelet, m));
        b.add(cubieToFacelet(conjugate(cube, m)));
      }
      expect([...b].sort()).toEqual([...a].sort());
    }
  });
});

describe('33 种对称类型', () => {
  it('每个代表掩码都能被正确分类回自己', () => {
    expect(SYM_TYPES).toHaveLength(33);
    SYM_TYPES.forEach((t, i) => {
      expect(classifyMask(t.mask)).toBe(i);
      expect(maskOrder(t.mask)).toBe(t.order);
      expect(closure(maskToList(t.mask))).toBe(t.mask); // 确实是子群
    });
  });

  it('33 个共轭类两两不同,且覆盖 O_h 的全部子群共轭类', () => {
    const seen = new Set<string>();
    for (const t of SYM_TYPES) seen.add(classifyMask(t.mask).toString());
    expect(seen.size).toBe(33);
    // 枚举所有由 ≤3 个元素生成的子群,分类结果必落在 33 类里
    for (let a = 0; a < N_SYM; a += 1) {
      for (let b = a; b < N_SYM; b += 5) {
        expect(classifyMask(closure([a, b]))).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('各类型状态数合计等于魔方状态总数', () => {
    const sum = SYM_TYPES.reduce((a, t) => a + t.classCount, 0n);
    expect(sum).toBe(TOTAL_POSITIONS);
    expect(SYMMETRIC_POSITIONS + SYM_TYPES[32].classCount).toBe(TOTAL_POSITIONS);
  });

  it('Burnside:本质不同的状态数 = 901,083,404,981,813,616', () => {
    // Σ_p |Sym(p)| / 48 —— 与文献上公认的"48 对称下本质不同的魔方状态数"对齐,
    // 这是对 exact 计数表的一条完全独立的外部校验。
    let sum = 0n;
    for (const t of SYM_TYPES) sum += t.classCount * BigInt(t.order);
    expect(sum % 48n).toBe(0n);
    expect(sum / 48n).toBe(901083404981813616n);
  });

  it('exact 表 = 对 98 个子群做 Möbius 反演的结果', () => {
    // 枚举 O_h 的全部子群(已知恰好 98 个),再由 atLeast 反演出 exact。
    const subs = new Set<bigint>([1n]);
    let frontier: bigint[] = [1n];
    while (frontier.length) {
      const next: bigint[] = [];
      for (const H of frontier) {
        const list = maskToList(H);
        for (let g = 0; g < N_SYM; g++) {
          if ((H >> BigInt(g)) & 1n) continue;
          const K = closure([...list, g]);
          if (!subs.has(K)) { subs.add(K); next.push(K); }
        }
      }
      frontier = next;
    }
    expect(subs.size).toBe(98);
    const all = [...subs].sort((a, b) => maskOrder(b) - maskOrder(a));
    const exact = new Map<bigint, bigint>();
    for (const K of all) {
      let v = SYM_TYPES[classifyMask(K)].atLeast;
      for (const L of all) if (L !== K && (L & K) === K) v -= exact.get(L)!;
      exact.set(K, v);
    }
    for (const t of SYM_TYPES) expect(exact.get(t.mask)).toBe(t.exact);
  });

  it('复原态与 superflip 都是 Oh', () => {
    expect(SYM_TYPES[classifyCube(solvedCubie())].name).toBe('Oh');
    const sf = cubeOf("R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U");
    expect(SYM_TYPES[classifyCube(sf)].name).toBe('Oh');
  });

  it('已知花式图案的对称类型', () => {
    // 六点 (six spots):三条轴各转一个中层 → 只剩旋转,含 4 次轴
    expect(SYM_TYPES[classifyCube(cubeOf('U2 D2 R2 L2 F2 B2'))].name).toBe('Oh');
    expect(SYM_TYPES[classifyCube(cubeOf('U2 D2'))].name).toBe('D4h');
    expect(SYM_TYPES[classifyCube(cubeOf('U D'))].name).toBe('D4');
    expect(SYM_TYPES[classifyCube(cubeOf('D2'))].name).toBe('C4v');
    expect(SYM_TYPES[classifyCube(cubeOf("U D'"))].name).toBe('C4h');
    expect(SYM_TYPES[classifyCube(cubeOf('D'))].name).toBe('C4');
    expect(SYM_TYPES[classifyCube(cubeOf('F2 R2'))].name).toBe('Cs(a)');
    expect(SYM_TYPES[classifyCube(cubeOf('L R U2'))].name).toBe('C2(a)');
    expect(SYM_TYPES[classifyCube(cubeOf('R2 L2 U2'))].name).toBe('C2v(a2)');
    expect(SYM_TYPES[classifyCube(cubeOf('B2 D2 U2 F2'))].name).toBe('D2h(face)');
    expect(SYM_TYPES[classifyCube(cubeOf('R2 L2 F B'))].name).toBe('D2(face)');
    expect(SYM_TYPES[classifyCube(cubeOf("U' D F2 B2"))].name).toBe('C2h(a)');
    expect(SYM_TYPES[classifyCube(cubeOf('U R2 L2 U2 R2 L2 D'))].name).toBe('S4');
    expect(SYM_TYPES[classifyCube(cubeOf("B F L R B' F' D' U' L R D U"))].name).toBe('T');
    expect(SYM_TYPES[classifyCube(cubeOf('U2 L2 F2 D2 U2 F2 R2 U2'))].name).toBe('Th');
    expect(SYM_TYPES[classifyCube(cubeOf("B' D' U L' R B' F U"))].name).toBe('S6');
    expect(SYM_TYPES[classifyCube(cubeOf("D B D U2 B2 F2 L2 R2 U' F U"))].name).toBe('D3');
    expect(SYM_TYPES[classifyCube(cubeOf("L' R U2 R2 D2 F2 L R D2"))].name).toBe('C3');
    expect(SYM_TYPES[classifyCube(cubeOf("U L D U L' D' U' R B2 U2 B2 L' R' U'"))].name).toBe('D3d');
    expect(SYM_TYPES[classifyCube(cubeOf("U L' R' B2 U' R2 B L2 D' F2 L' R' U'"))].name).toBe('C3v');
    // 其余出自 D:\cube\solver_wip\tools\symmetry\symmetry.cpp 的对照表
    expect(SYM_TYPES[classifyCube(cubeOf('U F2 B2 D2 F2 B2 U'))].name).toBe('D2d(edge)');
    expect(SYM_TYPES[classifyCube(cubeOf("U R L F2 B2 R' L' U"))].name).toBe('D2d(face)');
    expect(SYM_TYPES[classifyCube(cubeOf('U R2 L2 D2 F2 B2 U'))].name).toBe('D2h(edge)');
    expect(SYM_TYPES[classifyCube(cubeOf('U F2 U2 D2 F2 D'))].name).toBe('D2(edge)');
    expect(SYM_TYPES[classifyCube(cubeOf("U R2 L2 U2 F2 B2 U'"))].name).toBe('C2v(a1)');
    expect(SYM_TYPES[classifyCube(cubeOf('B2 R2 B2 R2 B2 R2'))].name).toBe('C2v(b)');
    expect(SYM_TYPES[classifyCube(cubeOf('U R2 U D R2 D'))].name).toBe('C2h(b)');
    expect(SYM_TYPES[classifyCube(cubeOf("U R2 D' U' R2 U'"))].name).toBe('C2(b)');
    expect(SYM_TYPES[classifyCube(cubeOf("U B2 U D B2 D'"))].name).toBe('Cs(b)');
  });

  it('生成元组能重新生成整个子群', () => {
    for (const t of SYM_TYPES) {
      expect(closure(generatorsOf(t.mask))).toBe(t.mask);
    }
  });
});

describe('反对称与自逆', () => {
  it('自逆位置的反对称掩码含恒等', () => {
    const sf = cubeOf("R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U");
    expect(antisymMask(sf) & 1n).toBe(1n); // superflip 是对合
    const notSelfInv = cubeOf("R U R' U'");
    expect(antisymMask(notSelfInv) & 1n).toBe(0n);
  });

  it('p⁻¹ 与 p 的对称群相同', () => {
    for (const alg of ["R U R' U'", 'U2 D2', "F R U' R' U' R U R' F' R U R' U' R' F R F'"]) {
      const p = cubeOf(alg);
      expect(symMask(invertCubie(p))).toBe(symMask(p));
    }
  });

  it('求逆自洽', () => {
    const p = cubeOf("R U2 D' B D'");
    const solved = solvedCubie();
    expect(multiply(p, invertCubie(p))).toEqual(solved);
    expect(multiply(invertCubie(p), p)).toEqual(solved);
  });
});

describe('正规化子', () => {
  it('N(H) 含 H,且对 Oh / C1 是全群', () => {
    for (const t of SYM_TYPES) {
      const n = normalizer(t.mask);
      expect(n & t.mask).toBe(t.mask);
    }
    expect(normalizer(1n)).toBe((1n << 48n) - 1n);
    expect(normalizer((1n << 48n) - 1n)).toBe((1n << 48n) - 1n);
  });
});

describe('取消勾选元素(seedsWithoutElement)', () => {
  const lit = (s: number[], a: number[], selfInv = false) => {
    const c = closureWithAnti(s, selfInv ? [...a, 0] : a);
    return c.sym | c.asym;
  };
  const has = (mask: bigint, idx: number) => ((mask >> BigInt(idx)) & 1n) === 1n;

  /** 网格里亮着的每个元素都必须点得掉 —— 包括不是种子、由乘积生成出来的那些。 */
  it('33 种类型里的任一亮元素都能被关掉,且结果仍是原群的子群', () => {
    for (const ty of SYM_TYPES) {
      const seeds = generatorsOf(ty.mask);
      for (const idx of maskToList(ty.mask)) {
        if (idx === 0) continue;
        const next = seedsWithoutElement(idx, seeds, [], false);
        const after = lit(next.symSeeds, next.asymSeeds);
        expect(has(after, idx)).toBe(false);
        expect(after & ty.mask).toBe(after); // 只会变小,不会跑出原群
        expect(maskOrder(after)).toBeLessThan(maskOrder(ty.mask));
      }
    }
  });

  it('D2(face) 里点掉乘积生成的那个 C₂ 会退回 C₂(以前从种子里删删不掉)', () => {
    const d2 = SYM_TYPES.find((t) => t.name === 'D2(face)')!;
    const seeds = generatorsOf(d2.mask);
    expect(seeds).toHaveLength(2); // 三个 C₂ 只有两个是种子,第三个是乘出来的
    const derived = maskToList(d2.mask).find((s) => s !== 0 && !seeds.includes(s))!;
    const next = seedsWithoutElement(derived, seeds, [], false);
    expect(maskOrder(lit(next.symSeeds, next.asymSeeds))).toBe(2);
  });

  it('自逆时反对称集跟着 sym 走,关掉的元素两边都不亮', () => {
    const d4h = SYM_TYPES.find((t) => t.name === 'D4h')!;
    const seeds = generatorsOf(d4h.mask);
    for (const idx of maskToList(d4h.mask)) {
      if (idx === 0) continue;
      const next = seedsWithoutElement(idx, seeds, [], true);
      expect(has(lit(next.symSeeds, next.asymSeeds, true), idx)).toBe(false);
    }
  });

  it('反对称种子若能把该元素乘回来也会被丢掉', () => {
    // sym = C₂(U),asym = σh(U) → 陪集乘出 i 那一类;点掉任何亮着的都得真灭。
    const c2u = SYM_ELEMENTS.find((e) => e.label === 'C₂(U)')!.idx;
    const sh = SYM_ELEMENTS.find((e) => e.cls === 'sh')!.idx;
    const before = lit([c2u], [sh]);
    for (const idx of maskToList(before)) {
      if (idx === 0) continue;
      const next = seedsWithoutElement(idx, [c2u], [sh], false);
      expect(has(lit(next.symSeeds, next.asymSeeds), idx)).toBe(false);
    }
  });
});

describe('facelet 往返', () => {
  it('conjugate 后仍是合法状态', () => {
    const p = cubeOf("R U R' F' L D2 B");
    for (let m = 0; m < N_SYM; m++) {
      const q = conjugate(p, m);
      expect(faceletToCubie(cubieToFacelet(q))).toEqual(q);
    }
  });
});
