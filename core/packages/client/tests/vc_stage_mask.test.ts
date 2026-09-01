/**
 * visualcube 阶段遮罩 → 引擎 stickering 桥的正确性锁(退役对照表 §2b)。
 *
 * 桥 netIndexOf 把引擎 (initial, face) 换成 visualcube 展开图 index。这里用与渲染
 * 无关的几何 oracle 钉死朝向:FL=底(D)层、LL=顶(U)层验行(y)+ 面归属;2x2x2 的
 * DFR 块验列(x/z 解码 + B 镜像的同类朝向)。桥写错 → 测试炸,而非遮罩悄悄错位。
 */
import { describe, expect, it } from 'vitest';
import { makeMasking, Masking } from '@cuberoot/visualcube';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { FM_REGULAR, FM_IGNORED, stickeringMaskFn } from '@/app/[lang]/sim/engine/nxn/stickering';
import {
  netIndexOf, visualcubeStageMaskFn, resolveStageMaskFn, visualcubeMaskForStickering,
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
    for (const name of [Masking.FL, Masking.DR, Masking.XCROSS, Masking.MEHTA_BELT2, Masking.EO_ORBIT]) {
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

describe('十字系遮罩:同形状只留一个,换槽靠转体', () => {
  // 遮罩清单里 XCross 只有一条(PHP 的 xcross_fr),另外三个槽由拿方朝向的 y / y2 / y'
  // 转出来。这里钉死这条等价:转 4 次回到原样、四档互不相同、且四档的并集正好是
  // 「十字 + 四个槽」= XXXCross 再加上第四个槽(= 满 F2L 的贴纸集合)。
  const N = 3;
  const colored = (name: string, rot: string): Set<string> => {
    const fn = visualcubeStageMaskFn(N, name, rot)!;
    return new Set(allSlots(N).filter((s) => fn(s.initial, s.face) === FM_REGULAR)
      .map((s) => `${s.initial}:${s.face}`));
  };
  const Y = ['', 'y', 'y2', "y'"];

  it('XCross 四档 y 互不相同,y⁴ 回到原样', () => {
    const sets = Y.map((r) => colored('xcross', r));
    expect(new Set(sets.map((s) => [...s].sort().join('|'))).size).toBe(4);
    for (const s of sets) expect(s.size).toBe(18); // 十字 13 + 一个槽 5
    expect([...colored('xcross', "y y y y")].sort()).toEqual([...sets[0]].sort());
  });

  it('XCross 四档的并 = F2L(十字 + 四个槽);XXXCross 只差一个槽', () => {
    const union = new Set(Y.flatMap((r) => [...colored('xcross', r)]));
    expect(union.size).toBe(13 + 4 * 5);
    const xxx = colored('xxxcross', '');
    expect(xxx.size).toBe(13 + 3 * 5);
    for (const k of xxx) expect(union.has(k), k).toBe(true);
  });

  it('XXCross:邻角 = 两个相邻槽,对角 = 隔开的两个槽', () => {
    const adj = colored('xxcross', ''), diag = colored('xxcross_diag', '');
    expect(adj.size).toBe(23);
    expect(diag.size).toBe(23);
    // 邻角转 y2 得到另一对相邻槽(≠ 自己);对角转 y2 是自身(对角对 y2 不变)
    expect([...colored('xxcross', 'y2')].sort()).not.toEqual([...adj].sort());
    expect([...colored('xxcross_diag', 'y2')].sort()).toEqual([...diag].sort());
  });

  it('旧 cross_full 输入由标准 cross 完全替代', () => {
    expect(makeMasking('cross_full' as Masking, 3)).toEqual(makeMasking(Masking.CROSS, 3));
  });

  it('清单里只留这几条十字系遮罩', () => {
    const items = new Set(visualcubeStageGroups(3).flatMap((g) => g.items));
    for (const keep of ['cross_half', 'cross_half_opp', 'cross_partial', 'xcross', 'xxcross', 'xxcross_diag', 'xxxcross']) {
      expect(items.has(keep), `should keep ${keep}`).toBe(true);
    }
    for (const drop of ['cross_full', 'cross_fr', 'cross_br', 'cross_fb', 'cross_lr', 'xcross_fr', 'xcross_bl', 'dec', 'tec_fr', 'tec_bl']) {
      expect(items.has(drop), `should drop ${drop}`).toBe(false);
    }
  });

  it('PHP 的 f2l_1/2/3/sm 与 222_fl/bl/br 已删(前者与十字系逐枚同形,后者是 222 的转体)', () => {
    const items = new Set(visualcubeStageGroups(3).flatMap((g) => g.items));
    for (const drop of ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_sm', '222_fl', '222_bl', '222_br']) {
      expect(items.has(drop), `should drop ${drop}`).toBe(false);
      expect(() => makeMasking(drop as Masking, 3)).toThrow();
    }
  });

  it('引擎自带 2x2x2(去重后留下的那条)与 visualcube 位串同形 —— 块都在 DFR', () => {
    const N = 3;
    const vc = visualcubeStageMaskFn(N, Masking.TWO_BY_TWO_BY_TWO)!;
    const eng = stickeringMaskFn(N, '2x2x2')!;
    for (const { initial, face } of allSlots(N)) {
      expect(eng(initial, face) === FM_REGULAR, `initial=${initial} face=${face}`)
        .toBe(vc(initial, face) === FM_REGULAR);
    }
  });
});

describe('vcStageMask — 拿方朝向重定向', () => {
  it("FL + z2(翻个个儿)→ 顶(U)层着色", () => {
    const N = 3, max = N - 1;
    const fn = visualcubeStageMaskFn(N, Masking.FL, 'z2')!;
    for (const { initial, face } of allSlots(N)) {
      const y = ((initial / N) | 0) % N;
      const want = (face === F.U || (face !== F.D && y === max)) ? FM_REGULAR : FM_IGNORED;
      expect(fn(initial, face)).toBe(want);
    }
  });

  it('24 档朝向两两不同(拿无对称的 XCross 试:底面选完还剩绕底 4 档)', () => {
    const N = 3;
    const seen = new Set(CUBE_ORIENTATIONS.map((o) => {
      const fn = visualcubeStageMaskFn(N, Masking.XCROSS, o.value)!;
      return allSlots(N).map((s) => fn(s.initial, s.face)).join('');
    }));
    expect(seen.size).toBe(24);
  });

  it("y 是 R→F:XCross 的 FR 槽转一次落到 FL(等价于 y' 的镜像轨道)", () => {
    const N = 3, max = N - 1;
    // 独立 oracle:y 把物理坐标 (x,y,z) 上的贴纸搬到 (max-z, y, x),面按 R→F→L→B→R。
    const fnBase = visualcubeStageMaskFn(N, 'xcross', '')!;
    const fnY = visualcubeStageMaskFn(N, 'xcross', 'y')!;
    const FACE_AFTER_Y: Record<number, number> = { [F.R]: F.F, [F.F]: F.L, [F.L]: F.B, [F.B]: F.R, [F.U]: F.U, [F.D]: F.D };
    for (const { initial, face } of allSlots(N)) {
      const x = initial % N, y = ((initial / N) | 0) % N, z = (initial / (N * N)) | 0;
      const moved = (max - z) + y * N + x * N * N;
      expect(fnY(moved, FACE_AFTER_Y[face]), `initial=${initial} face=${face}`).toBe(fnBase(initial, face));
    }
  });
});

describe('vcStageMask — 下拉清单去重 + 标签', () => {
  it('把 /sim 同义阶段转成 cold fallback 可直接消费的 visualcube mask', () => {
    expect(visualcubeMaskForStickering(3, 'F2L')).toBe('f2l');
    expect(visualcubeMaskForStickering(3, 'Cross')).toBe('cross');
    expect(visualcubeMaskForStickering(3, 'dr')).toBe('dr');
    expect(visualcubeMaskForStickering(3, 'PLL')).toBe('');
    expect(visualcubeMaskForStickering(3, 'full')).toBe('');
  });

  it('order 3:含 visualcube 独有(fl/dr/xcross),去掉与引擎重名(oll/ll/cross/f2l/2x2x2)', () => {
    const groups = visualcubeStageGroups(3);
    expect(groups.map((g) => g.group)).toEqual(['VCMasks']);
    const items = new Set(groups.flatMap((g) => g.items));
    for (const keep of ['fl', 'wv', 'vh', 'dr', 'xcross', 'mehta_belt2', 'roux_co', 'line', 'oell']) {
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
