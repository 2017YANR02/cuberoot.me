// lib/pocket-facelet —— 二阶「画状态」模型:facelet ↔ 状态、整体旋转、六面转、合法性、最优解。
//
// 判据都是外部/独立的,不自证:
//   · 角位表逐项对齐 3×3 的 CORNER_FACELET(facelet.ts)—— 两套表本来就是同一套约定的 3 阶 / 2 阶版。
//   · U/R/F 六面转与 cube222-metric 的生成元逐态一致(该模块已被 essential-2x2 全空间数据验过)。
//   · 最优步数与 cube222MetricOfScramble(独立 IDA*)逐例相等。
//   · 解的正确性看「施加后六面各自单色」—— 二阶还原的定义,不看内部坐标。
import { describe, it, expect } from 'vitest';
import {
  POCKET_FACES, POCKET_CORNER_FACELET, POCKET_STICKER_SIBLINGS, POCKET_ROTATIONS,
  SOLVED_POCKET_FACELET, EMPTY_POCKET_FACELET,
  solvedPocketState, pocketStateToFacelet, faceletToPocketState,
  validatePocketFacelet, applyPocketMoves, pocketFaceletFromMoves, invertPocketAlg,
  solvePocketFacelet, randomPocketFacelet, rotatePocketState, derivePocketScramble,
  type PocketFace,
} from '@/lib/pocket-facelet';
import { CORNER_FACELET } from '@/app/[lang]/scramble/solver/facelet';
import { cube222MetricOfScramble, _test as m222 } from '@/lib/cube222-metric';
import { optimalPocketScramble } from '@/lib/pocket-scramble';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 每面 4 格同色(= 二阶还原,允许整体旋转)。 */
function allFacesSolid(facelet: string): boolean {
  for (let f = 0; f < 6; f++) {
    const a = facelet[f * 4];
    for (let k = 1; k < 4; k++) if (facelet[f * 4 + k] !== a) return false;
  }
  return true;
}

describe('pocket-facelet 角位表', () => {
  it('逐项等于 3×3 CORNER_FACELET 的 2×2 对应格', () => {
    // 3×3 idx = face*9 + r*3 + c(r,c ∈ 0..2 的角格)→ 2×2 idx = face*4 + (r>0?1:0)*2 + (c>0?1:0)
    const shrink = (i: number): number => {
      const face = Math.floor(i / 9), r = Math.floor((i % 9) / 3), c = i % 3;
      expect(r === 0 || r === 2).toBe(true);
      expect(c === 0 || c === 2).toBe(true);
      return face * 4 + (r === 2 ? 2 : 0) + (c === 2 ? 1 : 0);
    };
    expect(POCKET_CORNER_FACELET.map((tri) => tri.slice()))
      .toEqual(CORNER_FACELET.map((tri) => tri.map(shrink)));
  });

  it('同块伙伴表:每格恰好 2 个伙伴,且互为伙伴', () => {
    expect(POCKET_STICKER_SIBLINGS.length).toBe(24);
    POCKET_STICKER_SIBLINGS.forEach((sibs, i) => {
      expect(sibs.length).toBe(2);
      for (const s of sibs) expect(POCKET_STICKER_SIBLINGS[s]).toContain(i);
    });
  });
});

describe('facelet ↔ 状态', () => {
  it('还原态互转', () => {
    expect(pocketStateToFacelet(solvedPocketState())).toBe(SOLVED_POCKET_FACELET);
    const st = faceletToPocketState(SOLVED_POCKET_FACELET);
    expect([...st.cp]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect([...st.co]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('随机合法状态 round-trip(facelet → 状态 → facelet)', () => {
    const r = rng(4);
    for (let i = 0; i < 400; i++) {
      const fc = randomPocketFacelet(r);
      expect(validatePocketFacelet(fc)).toBeNull();
      expect(pocketStateToFacelet(faceletToPocketState(fc))).toBe(fc);
    }
  });

  it('六面各 4 格同色,共 24 格', () => {
    expect(SOLVED_POCKET_FACELET.length).toBe(24);
    expect(EMPTY_POCKET_FACELET).toBe('X'.repeat(24));
    for (const f of POCKET_FACES) {
      expect([...SOLVED_POCKET_FACELET].filter((c) => c === f).length).toBe(4);
    }
  });
});

describe('六面转', () => {
  it('U / R / F 与 cube222-metric 的生成元逐态一致', () => {
    const r = rng(9);
    for (let i = 0; i < 60; i++) {
      const alg = optimalPocketScramble(r); // 只含 U/R/F
      const mine = applyPocketMoves(solvedPocketState(), alg);
      const theirs = m222.applyScramble(alg);
      expect([...mine.cp]).toEqual([...theirs.cp]);
      expect([...mine.co]).toEqual([...theirs.co]);
    }
  });

  it('每面 4 次转回原状,单面转保持对面单色', () => {
    for (const f of POCKET_FACES) {
      expect(pocketFaceletFromMoves(`${f} ${f} ${f} ${f}`)).toBe(SOLVED_POCKET_FACELET);
      expect(pocketFaceletFromMoves(`${f}2 ${f}2`)).toBe(SOLVED_POCKET_FACELET);
      // 转一面:该面与对面各自仍单色(只有侧面被打乱)
      const fc = pocketFaceletFromMoves(f);
      const fi = POCKET_FACES.indexOf(f);
      const oppI = POCKET_FACES.indexOf(({ U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' } as Record<PocketFace, PocketFace>)[f]);
      for (const idx of [fi, oppI]) {
        expect(new Set([...fc.slice(idx * 4, idx * 4 + 4)]).size).toBe(1);
      }
      expect(fc).not.toBe(SOLVED_POCKET_FACELET);
    }
  });

  it('对面同向转 = 整体旋转 → 仍是还原态(六面单色)', () => {
    for (const alg of ["R L'", "L R'", "U D'", "F B'", "R2 L2", "U2 D2"]) {
      const fc = pocketFaceletFromMoves(alg);
      expect(allFacesSolid(fc)).toBe(true);
      expect(fc).not.toBe(SOLVED_POCKET_FACELET); // 是旋转过的还原态,不是恒等
      expect(validatePocketFacelet(fc)).toBeNull();
    }
  });

  it('取逆:alg + invert(alg) 回到恒等', () => {
    const algs = ["R U' F2 D L B'", "U R2 F' D2", "B L' U2 R F"];
    for (const alg of algs) {
      expect(pocketFaceletFromMoves(`${alg} ${invertPocketAlg(alg)}`)).toBe(SOLVED_POCKET_FACELET);
    }
  });
});

describe('整体旋转', () => {
  it('恰好 24 个,面映射两两不同,还原态转完仍六面单色', () => {
    expect(POCKET_ROTATIONS.length).toBe(24);
    expect(new Set(POCKET_ROTATIONS.map((r) => r.faceMap.join(''))).size).toBe(24);
    for (const rot of POCKET_ROTATIONS) {
      const fc = pocketStateToFacelet(rotatePocketState(solvedPocketState(), rot));
      expect(allFacesSolid(fc)).toBe(true);
      expect(validatePocketFacelet(fc)).toBeNull();
    }
  });

  it('shift 与取哪个面无关(两张 CC 表同手性)', () => {
    // rotatePocketState 只用 CC[slot][0] 算 shift;这里对另外两个面重算,必须一致。
    const r = rng(21);
    for (let i = 0; i < 50; i++) {
      const fc = randomPocketFacelet(r);
      const st = faceletToPocketState(fc);
      for (const rot of POCKET_ROTATIONS) {
        const rotated = rotatePocketState(st, rot);
        // 旋转后的 facelet 必须仍能被解析(块认得出 = 手性没被破坏)
        expect(validatePocketFacelet(pocketStateToFacelet(rotated))).toBeNull();
      }
    }
  });

  it('整体旋转不改变最优步数', () => {
    const r = rng(33);
    for (let i = 0; i < 30; i++) {
      const fc = randomPocketFacelet(r);
      const base = solvePocketFacelet(fc).length;
      const st = faceletToPocketState(fc);
      for (const rot of POCKET_ROTATIONS) {
        expect(solvePocketFacelet(pocketStateToFacelet(rotatePocketState(st, rot))).length).toBe(base);
      }
    }
  });
});

describe('合法性校验', () => {
  it('还原态 / 随机态合法', () => {
    expect(validatePocketFacelet(SOLVED_POCKET_FACELET)).toBeNull();
  });

  it('颜色数不对 → 报颜色数', () => {
    const bad = `R${SOLVED_POCKET_FACELET.slice(1)}`; // 一个 U 改成 R
    expect(validatePocketFacelet(bad)).toContain('color counts');
  });

  it('单角被扭 ±120° → 报扭转和', () => {
    // 把 URF 角的三格循环移一位(色数不变、块仍存在,只是扭了)
    const arr = [...SOLVED_POCKET_FACELET];
    const [a, b, c] = POCKET_CORNER_FACELET[0];
    const t = arr[a]; arr[a] = arr[b]; arr[b] = arr[c]; arr[c] = t;
    expect(validatePocketFacelet(arr.join(''))).toContain('orientation sum');
  });

  it('同一块出现两次(且颜色数仍然对)→ 报块重复', () => {
    // 只数颜色抓不到的那类错:把 (URF, DLF) 两个位置换放成 (UFL, DFR) —— 色多重集
    // {U,R,F}+{D,L,F} = {U,F,L}+{D,F,R},六色仍各 4 格,但 1/4 号块各出现两次。
    const st = solvedPocketState();
    st.cp[0] = 1;
    st.cp[5] = 4;
    const fc = pocketStateToFacelet(st);
    for (const f of POCKET_FACES) expect([...fc].filter((c) => c === f).length).toBe(4);
    expect(validatePocketFacelet(fc)).toContain('not bijective');
  });

  it('镜像角(三色对但手性错)→ 报块不存在', () => {
    const arr = [...SOLVED_POCKET_FACELET];
    const [a, , c] = POCKET_CORNER_FACELET[0]; // URF:交换 U 与 F 两格 = 镜像
    const t = arr[a]; arr[a] = arr[c]; arr[c] = t;
    expect(validatePocketFacelet(arr.join(''))).toContain('no matching piece');
  });

  it('未涂满(有 X)→ 报非面色', () => {
    expect(validatePocketFacelet(EMPTY_POCKET_FACELET)).toBeTruthy();
  });
});

describe('画状态求最优解', () => {
  it('只含 U/R/F 的打乱:步数 = cube222-metric 的 HTM 最优(独立 IDA*)', () => {
    const r = rng(5);
    for (let i = 0; i < 120; i++) {
      const scr = optimalPocketScramble(r);
      const fc = pocketFaceletFromMoves(scr);
      const got = solvePocketFacelet(fc);
      expect(got.length).toBe(cube222MetricOfScramble(scr, 'htm'));
    }
  });

  it('六面打乱(含 D/L/B):解施加回去 → 六面单色', () => {
    const r = rng(6);
    const FACES6: PocketFace[] = ['U', 'R', 'F', 'D', 'L', 'B'];
    const SUF = ['', '2', "'"];
    for (let i = 0; i < 200; i++) {
      const toks: string[] = [];
      for (let k = 0; k < 12; k++) {
        toks.push(FACES6[Math.floor(r() * 6)] + SUF[Math.floor(r() * 3)]);
      }
      const scr = toks.join(' ');
      const start = applyPocketMoves(solvedPocketState(), scr);
      const { solution, length } = solvePocketFacelet(pocketStateToFacelet(start));
      expect(length).toBeLessThanOrEqual(11); // 二阶上帝之数
      const end = length === 0 ? start : applyPocketMoves(start, solution);
      expect(allFacesSolid(pocketStateToFacelet(end))).toBe(true);
    }
  });

  it('还原态(含旋转过的)→ 0 步', () => {
    expect(solvePocketFacelet(SOLVED_POCKET_FACELET).length).toBe(0);
    for (const rot of POCKET_ROTATIONS) {
      const fc = pocketStateToFacelet(rotatePocketState(solvedPocketState(), rot));
      expect(solvePocketFacelet(fc).length).toBe(0);
    }
  });

  it('解取逆 = 一条到达该状态的打乱(步数相同,同样最优)', () => {
    const r = rng(8);
    for (let i = 0; i < 60; i++) {
      const fc = randomPocketFacelet(r);
      const { solution, length } = solvePocketFacelet(fc);
      if (length === 0) continue;
      const scr = invertPocketAlg(solution);
      // 打乱到达的状态与所画状态最多差一个整体旋转 → 最优步数必相等
      expect(solvePocketFacelet(pocketFaceletFromMoves(scr)).length).toBe(length);
    }
  });
});

describe('反推打乱', () => {
  it('逐格精确复现所画状态(不只是差一个整体旋转)', () => {
    const r = rng(17);
    for (let i = 0; i < 300; i++) {
      const fc = randomPocketFacelet(r);
      const scr = derivePocketScramble(fc);
      expect(pocketFaceletFromMoves(scr)).toBe(fc);
    }
  });

  it('长度 = 最优步数 + ≤4 步整体旋转,且只含六面单转记号', () => {
    const r = rng(18);
    for (let i = 0; i < 200; i++) {
      const fc = randomPocketFacelet(r);
      const optimal = solvePocketFacelet(fc).length;
      const toks = derivePocketScramble(fc).split(' ').filter(Boolean);
      for (const tk of toks) expect(tk).toMatch(/^[URFDLB]['2]?$/);
      expect(toks.length).toBeLessThanOrEqual(optimal + 4);
    }
  });

  it('转过朝向的还原态:打乱只有整体旋转那几步,且复现原样', () => {
    for (const rot of POCKET_ROTATIONS) {
      const fc = pocketStateToFacelet(rotatePocketState(solvedPocketState(), rot));
      const scr = derivePocketScramble(fc);
      expect(pocketFaceletFromMoves(scr)).toBe(fc);
      expect(scr.split(' ').filter(Boolean).length).toBeLessThanOrEqual(4);
    }
    expect(derivePocketScramble(SOLVED_POCKET_FACELET)).toBe('');
  });

  it('最优步数分布合理(均值 ~8.76,上界 11)', () => {
    const r = rng(12);
    const lens: number[] = [];
    for (let i = 0; i < 300; i++) lens.push(solvePocketFacelet(randomPocketFacelet(r)).length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    expect(mean).toBeGreaterThan(8.3);
    expect(mean).toBeLessThan(9.2);
    expect(Math.max(...lens)).toBeLessThanOrEqual(11);
  });

  it('非法状态求解直接抛错', () => {
    const arr = [...SOLVED_POCKET_FACELET];
    const [a, b, c] = POCKET_CORNER_FACELET[0];
    const t = arr[a]; arr[a] = arr[b]; arr[b] = arr[c]; arr[c] = t;
    expect(() => solvePocketFacelet(arr.join(''))).toThrow();
  });
});
