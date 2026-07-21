/**
 * visualcube 阶段遮罩 → 引擎 stickering 桥的正确性锁(退役对照表 §2b)。
 *
 * 桥 netIndexOf 把引擎 (initial, face) 换成 visualcube 展开图 index。这里用与渲染
 * 无关的几何 oracle 钉死朝向:FL=底(D)层、LL=顶(U)层验行(y)+ 面归属;2x2x2 的
 * DFR 块验列(x/z 解码 + B 镜像的同类朝向)。桥写错 → 测试炸,而非遮罩悄悄错位。
 */
import { describe, expect, it } from 'vitest';
import { makeMasking, Masking } from '@cuberoot/visualcube';
import { FM_REGULAR, FM_IGNORED } from '@/app/[lang]/sim/engine/nxn/stickering';
import {
  netIndexOf, visualcubeStageMaskFn, resolveStageMaskFn,
  visualcubeStageGroups, VC_MASK_LABEL,
} from '@/app/[lang]/sim/engine/nxn/vcStageMask';

// 引擎 FACE:L0 R1 D2 U3 B4 F5
const F = { L: 0, R: 1, D: 2, U: 3, B: 4, F: 5 } as const;

/** 枚举某面上 N² 个贴纸的 (x,y,z);face 值 = 引擎 FACE。 */
function faceSlots(face: number, N: number): Array<[number, number, number]> {
  const max = N - 1;
  const out: Array<[number, number, number]> = [];
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    if (face === F.U) out.push([a, max, b]);       // y=max, vary x,z
    else if (face === F.D) out.push([a, 0, b]);
    else if (face === F.F) out.push([a, b, max]);  // z=max, vary x,y
    else if (face === F.B) out.push([a, b, 0]);
    else if (face === F.R) out.push([max, a, b]);  // x=max, vary y,z
    else out.push([0, a, b]);                       // L: x=0
  }
  return out;
}

/** 全部贴纸槽 (initial, face)。 */
function allSlots(N: number): Array<{ initial: number; face: number }> {
  const out: Array<{ initial: number; face: number }> = [];
  for (const face of [F.L, F.R, F.D, F.U, F.B, F.F]) {
    for (const [x, y, z] of faceSlots(face, N)) out.push({ initial: x + y * N + z * N * N, face });
  }
  return out;
}

describe('vcStageMask bridge — 每面双射', () => {
  for (const N of [2, 3, 4, 5]) {
    it(`order ${N}: 每面 N² 槽 → 展开图 index 是 0..N²-1 的置换`, () => {
      const max = N - 1;
      for (const face of [F.L, F.R, F.D, F.U, F.B, F.F]) {
        const idx = faceSlots(face, N).map(([x, y, z]) => netIndexOf(x, y, z, face, max, N));
        expect(idx.slice().sort((a, b) => a - b)).toEqual([...Array(N * N).keys()]);
      }
    });
  }
});

describe('vcStageMask — 几何 oracle 钉朝向', () => {
  it('FL = 底(D)层:D 全 + 侧面 y=0 行,U 全无', () => {
    for (const N of [3, 4]) {
      const fn = visualcubeStageMaskFn(N, Masking.FL)!;
      for (const { initial, face } of allSlots(N)) {
        const y = ((initial / N) | 0) % N;
        const want = (face === F.D || (face !== F.U && y === 0)) ? FM_REGULAR : FM_IGNORED;
        expect(fn(initial, face), `FL N${N} initial=${initial} face=${face}`).toBe(want);
      }
    }
  });

  it('LL = 顶(U)层:U 全 + 侧面 y=max 行', () => {
    const N = 3, max = N - 1;
    const fn = visualcubeStageMaskFn(N, Masking.LL)!;
    for (const { initial, face } of allSlots(N)) {
      const y = ((initial / N) | 0) % N;
      const want = (face === F.U || (face !== F.D && y === max)) ? FM_REGULAR : FM_IGNORED;
      expect(fn(initial, face)).toBe(want);
    }
  });

  it('2x2x2 = DFR 块:仅 D/F/R 面上 x∈{1,2} y∈{0,1} z∈{1,2} 的外贴纸(验列 + B 镜像同类)', () => {
    const N = 3;
    const fn = visualcubeStageMaskFn(N, Masking.TWO_BY_TWO_BY_TWO)!;
    for (const { initial, face } of allSlots(N)) {
      const x = initial % N, y = ((initial / N) | 0) % N, z = (initial / (N * N)) | 0;
      const inBlock = x >= 1 && y <= 1 && z >= 1;
      const want =
        (inBlock && (
          (face === F.D && x >= 1 && z >= 1) ||
          (face === F.F && x >= 1 && y <= 1) ||
          (face === F.R && y <= 1 && z >= 1)
        )) ? FM_REGULAR : FM_IGNORED;
      expect(fn(initial, face), `2x2x2 initial=${initial} face=${face}`).toBe(want);
    }
  });

  it('灰化数 = makeMasking 的 masked 数(逐面双射的必然推论,兜底核对)', () => {
    for (const name of [Masking.FL, Masking.DR, Masking.XCROSS_FR, Masking.MEHTA_BELT2, Masking.EO_ORBIT]) {
      const N = 3;
      const fn = visualcubeStageMaskFn(N, name)!;
      const grayEngine = allSlots(N).filter((s) => fn(s.initial, s.face) === FM_IGNORED).length;
      const fv = makeMasking(name, N);
      let masked = 0;
      for (const face of [0, 1, 2, 3, 4, 5]) for (const v of fv[face]) if (!v) masked++;
      expect(grayEngine, name).toBe(masked);
    }
  });
});

describe('vcStageMask — crossColor 重定向', () => {
  it('FL + white(U 当底)→ 顶(U)层着色', () => {
    const N = 3, max = N - 1;
    const fn = visualcubeStageMaskFn(N, Masking.FL, 'white')!;
    for (const { initial, face } of allSlots(N)) {
      const y = ((initial / N) | 0) % N;
      const want = (face === F.U || (face !== F.D && y === max)) ? FM_REGULAR : FM_IGNORED;
      expect(fn(initial, face)).toBe(want);
    }
  });
});

describe('vcStageMask — 下拉清单去重 + 标签', () => {
  it('order 3:含 visualcube 独有(fl/dr/xcross_fr),去掉与引擎重名(oll/ll/cross/f2l/2x2x2)', () => {
    const items = new Set(visualcubeStageGroups(3).flatMap((g) => g.items));
    for (const keep of ['fl', 'wv', 'vh', 'dr', 'xcross_fr', 'mehta_belt2', 'roux_co', 'line', 'oell']) {
      expect(items.has(keep), `should keep ${keep}`).toBe(true);
    }
    for (const drop of ['oll', 'll', 'cll', 'coll', 'ell', 'ocll', 'cross', 'f2l', '2x2x2', '2x2x3', 'cmll', '']) {
      expect(items.has(drop), `should drop ${drop}`).toBe(false);
    }
  });

  it('order 4:含 4 阶专属(yau/hoya/l2c)+ 通用 core(fl),不含 3 阶专属位串(dr)', () => {
    const items = new Set(visualcubeStageGroups(4).flatMap((g) => g.items));
    expect(items.has('yau')).toBe(true);
    expect(items.has('hoya')).toBe(true);
    expect(items.has('fl')).toBe(true);
    expect(items.has('dr')).toBe(false); // makeMasking(dr,4) 会抛 → 本就不该列
    expect(items.has('oll')).toBe(false); // 引擎 4 阶已有 OLL
  });

  it('每个下拉项都有人读标签', () => {
    for (const g of visualcubeStageGroups(3)) for (const name of g.items) {
      expect(VC_MASK_LABEL[name], name).toBeTruthy();
    }
  });

  it('resolveStageMaskFn:full/空 → null;vc 名 → 函数', () => {
    expect(resolveStageMaskFn(3, 'full')).toBeNull();
    expect(resolveStageMaskFn(3, '')).toBeNull();
    expect(typeof resolveStageMaskFn(3, 'dr')).toBe('function');
  });
});
