// /sim 按阶段展示色块(issue #27)— engine/nxn/stickering.ts 的 mask 翻译回归。
// 期望值按 cubing.js cube-like-stickerings.ts 的定义手工推导(piece 级语义 ×
// 主/次贴纸展开),锁数值防阶段定义漂移。
import { describe, it, expect } from 'vitest';
import {
  stickeringMaskFn, stickeringGroupsFor,
  FM_REGULAR, FM_DIM, FM_IGNORED, FM_ORIENTED, FM_ORIENTED2,
} from '@/app/[lang]/sim/engine/nxn/stickering';
import { FACE } from '@/app/[lang]/sim/engine/define';

/** initial = x + y·N + z·N²(y=N-1 为 U,z=N-1 为 F,x=N-1 为 R) */
const idx = (N: number, x: number, y: number, z: number) => x + y * N + z * N * N;

// 3 阶常用块(名字按 Reid 记法)
const N3 = 3;
const P3 = {
  UF: idx(N3, 1, 2, 2), UR: idx(N3, 2, 2, 1), UB: idx(N3, 1, 2, 0), UL: idx(N3, 0, 2, 1),
  DF: idx(N3, 1, 0, 2), DR: idx(N3, 2, 0, 1),
  FR: idx(N3, 2, 1, 2), FL: idx(N3, 0, 1, 2), BR: idx(N3, 2, 1, 0),
  UFR: idx(N3, 2, 2, 2), UBL: idx(N3, 0, 2, 0), DFR: idx(N3, 2, 0, 2), DBL: idx(N3, 0, 0, 0),
  Uc: idx(N3, 1, 2, 1), Dc: idx(N3, 1, 0, 1), Fc: idx(N3, 1, 1, 2),
  Bc: idx(N3, 1, 1, 0), Lc: idx(N3, 0, 1, 1), Rc: idx(N3, 2, 1, 1),
};

describe('stickeringMaskFn 3x3', () => {
  it('full / 未知阶段 → null(全原色)', () => {
    expect(stickeringMaskFn(3, 'full')).toBeNull();
    expect(stickeringMaskFn(3, 'nope')).toBeNull();
    expect(stickeringMaskFn(1, 'OLL')).toBeNull();
  });

  it('OLL:F2L 全暗,顶层主贴纸原色 / 侧贴纸忽略,U 中心原色', () => {
    const m = stickeringMaskFn(3, 'OLL')!;
    expect(m(P3.UF, FACE.U)).toBe(FM_REGULAR);   // 顶层棱 U 面 = 主贴纸
    expect(m(P3.UF, FACE.F)).toBe(FM_IGNORED);   // 侧贴纸忽略
    expect(m(P3.UFR, FACE.U)).toBe(FM_REGULAR);
    expect(m(P3.UFR, FACE.R)).toBe(FM_IGNORED);
    expect(m(P3.Uc, FACE.U)).toBe(FM_REGULAR);
    expect(m(P3.FR, FACE.F)).toBe(FM_DIM);       // F2L 块整体变暗
    expect(m(P3.DFR, FACE.D)).toBe(FM_DIM);
    expect(m(P3.Fc, FACE.F)).toBe(FM_DIM);
  });

  it('PLL:顶层主贴纸暗 / 侧贴纸原色(看排列),U 中心暗,F2L 暗', () => {
    const m = stickeringMaskFn(3, 'PLL')!;
    expect(m(P3.UF, FACE.U)).toBe(FM_DIM);
    expect(m(P3.UF, FACE.F)).toBe(FM_REGULAR);
    expect(m(P3.UFR, FACE.R)).toBe(FM_REGULAR);
    expect(m(P3.Uc, FACE.U)).toBe(FM_DIM);
    expect(m(P3.FL, FACE.F)).toBe(FM_DIM);
  });

  it('Cross:D 棱 + D 中心原色,其余中心暗,其它全忽略', () => {
    const m = stickeringMaskFn(3, 'Cross')!;
    expect(m(P3.DF, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.DF, FACE.F)).toBe(FM_REGULAR);   // 十字棱整块原色(侧色也要对齐)
    expect(m(P3.Dc, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.Fc, FACE.F)).toBe(FM_DIM);
    expect(m(P3.Uc, FACE.U)).toBe(FM_DIM);
    expect(m(P3.DFR, FACE.D)).toBe(FM_IGNORED);  // 底角忽略
    expect(m(P3.UF, FACE.U)).toBe(FM_IGNORED);
    expect(m(P3.FR, FACE.F)).toBe(FM_IGNORED);
  });

  it('EO:角全忽略,棱主贴纸青标 / 次贴纸忽略,中心原色', () => {
    const m = stickeringMaskFn(3, 'EO')!;
    expect(m(P3.UF, FACE.U)).toBe(FM_ORIENTED);  // U/D 层棱主贴纸 = U/D 面
    expect(m(P3.UF, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.DF, FACE.D)).toBe(FM_ORIENTED);
    expect(m(P3.DF, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.FR, FACE.F)).toBe(FM_ORIENTED);  // E 层棱主贴纸 = F/B 面
    expect(m(P3.FR, FACE.R)).toBe(FM_IGNORED);
    expect(m(P3.BR, FACE.B)).toBe(FM_ORIENTED);
    expect(m(P3.BR, FACE.R)).toBe(FM_IGNORED);
    expect(m(P3.UFR, FACE.U)).toBe(FM_IGNORED);
    expect(m(P3.UFR, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.Fc, FACE.F)).toBe(FM_REGULAR);   // EO 不动中心
    expect(m(P3.Uc, FACE.U)).toBe(FM_REGULAR);
  });

  it('EOline:EO 基础上 DF/DB 棱 + D 中心原色', () => {
    const m = stickeringMaskFn(3, 'EOline')!;
    expect(m(P3.DF, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.DF, FACE.F)).toBe(FM_REGULAR);
    expect(m(P3.Dc, FACE.D)).toBe(FM_REGULAR);   // D∩M 含 D 中心
    expect(m(P3.DR, FACE.D)).toBe(FM_ORIENTED);  // DR 不在 M 层,仍是 EO 标注
    expect(m(P3.UFR, FACE.U)).toBe(FM_IGNORED);
  });

  it('CMLL:顶层角原色,L6E(M 层棱 + 顶层棱 + M 层中心)忽略,其余 F2L 暗', () => {
    const m = stickeringMaskFn(3, 'CMLL')!;
    expect(m(P3.UFR, FACE.U)).toBe(FM_REGULAR);
    expect(m(P3.UFR, FACE.F)).toBe(FM_REGULAR);
    expect(m(P3.UF, FACE.U)).toBe(FM_IGNORED);   // LL 棱 ∈ L6E
    expect(m(P3.DF, FACE.D)).toBe(FM_IGNORED);   // M 层棱 ∈ L6E
    expect(m(P3.Uc, FACE.U)).toBe(FM_IGNORED);   // M 层中心(U/F/D/B)∈ L6E
    expect(m(P3.Fc, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.Lc, FACE.L)).toBe(FM_DIM);       // L/R 中心 ∉ L6E → F2L 暗
    expect(m(P3.FL, FACE.F)).toBe(FM_DIM);       // 块块 ∈ F2L
    expect(m(P3.DFR, FACE.D)).toBe(FM_DIM);
  });

  it('FirstBlock:L 层非顶两排原色,R 中心暗,其余忽略', () => {
    const m = stickeringMaskFn(3, 'FirstBlock')!;
    expect(m(P3.FL, FACE.F)).toBe(FM_REGULAR);   // FB 块成员
    expect(m(P3.Lc, FACE.L)).toBe(FM_REGULAR);
    expect(m(P3.DBL, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.Rc, FACE.R)).toBe(FM_DIM);
    expect(m(P3.UBL, FACE.U)).toBe(FM_IGNORED);  // 顶层(即使在 L 层)忽略
    expect(m(P3.Fc, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.DF, FACE.D)).toBe(FM_IGNORED);
  });

  it('G1:全场黄标,E 层青标,L/R 中心忽略', () => {
    const m = stickeringMaskFn(3, 'G1')!;
    expect(m(P3.UF, FACE.U)).toBe(FM_ORIENTED2);
    expect(m(P3.UF, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.FR, FACE.F)).toBe(FM_ORIENTED);  // E 层棱
    expect(m(P3.Fc, FACE.F)).toBe(FM_ORIENTED);  // E 层中心(F/R/B/L)
    expect(m(P3.Lc, FACE.L)).toBe(FM_IGNORED);   // E∩S = L/R 中心
    expect(m(P3.Rc, FACE.R)).toBe(FM_IGNORED);
    expect(m(P3.UFR, FACE.U)).toBe(FM_ORIENTED2);
  });

  it('LS:FR 槽原色,顶层忽略(U 中心暗),其余 F2L 暗', () => {
    const m = stickeringMaskFn(3, 'LS')!;
    expect(m(P3.FR, FACE.F)).toBe(FM_REGULAR);
    expect(m(P3.FR, FACE.R)).toBe(FM_REGULAR);
    expect(m(P3.DFR, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.UF, FACE.U)).toBe(FM_IGNORED);
    expect(m(P3.Uc, FACE.U)).toBe(FM_DIM);
    expect(m(P3.FL, FACE.F)).toBe(FM_DIM);
  });

  it('2x2x2(Petrus):DBL 2x2x2 块原色,U/F/R 三层忽略(其中中心暗)', () => {
    const m = stickeringMaskFn(3, '2x2x2')!;
    expect(m(P3.DBL, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.Lc, FACE.L)).toBe(FM_REGULAR);   // L 中心不在 U/F/R 层
    expect(m(P3.Fc, FACE.F)).toBe(FM_DIM);       // F 中心在 F 层 → 中心改暗
    expect(m(P3.UF, FACE.U)).toBe(FM_IGNORED);
    expect(m(P3.FR, FACE.F)).toBe(FM_IGNORED);
  });
});

describe('stickeringMaskFn 2x2 / 4x4', () => {
  it('2x2 PBL:全块主贴纸暗 / 侧贴纸原色', () => {
    const m = stickeringMaskFn(2, 'PBL')!;
    const UFR2 = idx(2, 1, 1, 1);
    const DBL2 = idx(2, 0, 0, 0);
    expect(m(UFR2, FACE.U)).toBe(FM_DIM);
    expect(m(UFR2, FACE.F)).toBe(FM_REGULAR);
    expect(m(DBL2, FACE.D)).toBe(FM_DIM);
    expect(m(DBL2, FACE.L)).toBe(FM_REGULAR);
  });

  it('2x2 OBL:主贴纸原色 / 侧贴纸忽略', () => {
    const m = stickeringMaskFn(2, 'OBL')!;
    const UFR2 = idx(2, 1, 1, 1);
    expect(m(UFR2, FACE.U)).toBe(FM_REGULAR);
    expect(m(UFR2, FACE.F)).toBe(FM_IGNORED);
  });

  it('4x4 L2C:U/F 中心原色,L/R/B/D 中心暗,棱角忽略', () => {
    const m = stickeringMaskFn(4, 'L2C')!;
    const Uc4 = idx(4, 1, 3, 2);   // U 面内 2x2 中心块之一
    const Fc4 = idx(4, 2, 1, 3);
    const Rc4 = idx(4, 3, 1, 1);
    const Dc4 = idx(4, 2, 0, 1);
    const cornerUFR4 = idx(4, 3, 3, 3);
    const edgeUF4 = idx(4, 1, 3, 3);   // U 面前排棱(wing)
    expect(m(Uc4, FACE.U)).toBe(FM_REGULAR);
    expect(m(Fc4, FACE.F)).toBe(FM_REGULAR);
    expect(m(Rc4, FACE.R)).toBe(FM_DIM);
    expect(m(Dc4, FACE.D)).toBe(FM_DIM);
    expect(m(cornerUFR4, FACE.U)).toBe(FM_IGNORED);
    expect(m(edgeUF4, FACE.U)).toBe(FM_IGNORED);
  });

  it('4x4 Cross(推广):D 面棱层原色', () => {
    const m = stickeringMaskFn(4, 'Cross')!;
    const dEdge = idx(4, 1, 0, 3);   // D 层 F 侧棱
    const dCenter = idx(4, 1, 0, 2);
    expect(m(dEdge, FACE.D)).toBe(FM_REGULAR);
    expect(m(dCenter, FACE.D)).toBe(FM_REGULAR);
    expect(m(idx(4, 0, 0, 0), FACE.D)).toBe(FM_IGNORED); // 底角
    expect(m(idx(4, 1, 3, 2), FACE.U)).toBe(FM_DIM);     // U 中心暗
  });
});

describe('stickeringMaskFn 十字颜色重定向(crossColor)', () => {
  it('Cross + white:十字落在 U 面(白),D 面变忽略', () => {
    const m = stickeringMaskFn(3, 'Cross', 'white')!;
    expect(m(P3.UF, FACE.U)).toBe(FM_REGULAR);   // U 棱 = 十字棱
    expect(m(P3.UF, FACE.F)).toBe(FM_REGULAR);
    expect(m(P3.Uc, FACE.U)).toBe(FM_REGULAR);
    expect(m(P3.Dc, FACE.D)).toBe(FM_DIM);       // 原十字面退化成普通中心
    expect(m(P3.DF, FACE.D)).toBe(FM_IGNORED);
    expect(m(P3.UFR, FACE.U)).toBe(FM_IGNORED);  // 顶角不属于十字
  });

  it('Cross + green:十字落在 F 面(绿)', () => {
    const m = stickeringMaskFn(3, 'Cross', 'green')!;
    expect(m(P3.UF, FACE.F)).toBe(FM_REGULAR);   // F 面棱 = 十字棱,主贴纸在 F
    expect(m(P3.UF, FACE.U)).toBe(FM_REGULAR);
    expect(m(P3.Fc, FACE.F)).toBe(FM_REGULAR);
    expect(m(P3.Dc, FACE.D)).toBe(FM_DIM);
    expect(m(P3.DF, FACE.D)).toBe(FM_REGULAR);   // DF ∈ F 层 → 十字棱
    expect(m(P3.BR, FACE.B)).toBe(FM_IGNORED);   // B 层棱与绿十字无关
    expect(m(P3.UFR, FACE.F)).toBe(FM_IGNORED);
  });

  it('OLL + white:白十字 → 顶层阶段落在 D 面(黄)', () => {
    const m = stickeringMaskFn(3, 'OLL', 'white')!;
    expect(m(P3.DF, FACE.D)).toBe(FM_REGULAR);   // D 棱 = LL 棱,主贴纸 D
    expect(m(P3.DF, FACE.F)).toBe(FM_IGNORED);
    expect(m(P3.DFR, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.DFR, FACE.R)).toBe(FM_IGNORED);
    expect(m(P3.Dc, FACE.D)).toBe(FM_REGULAR);
    expect(m(P3.UF, FACE.U)).toBe(FM_DIM);       // 原顶层归入 F2L 变暗
    expect(m(P3.Fc, FACE.F)).toBe(FM_DIM);
  });

  it('FirstBlock + red:整套 Roux 随 z 旋转重定向(物理 L→遮罩 U,D→遮罩 L)', () => {
    const m = stickeringMaskFn(3, 'FirstBlock', 'red')!;
    expect(m(P3.Lc, FACE.L)).toBe(FM_IGNORED);   // 物理 L 中心 → 遮罩 LL 中心,忽略
    expect(m(P3.UBL, FACE.U)).toBe(FM_IGNORED);  // 物理 L 层块同理
    expect(m(P3.Uc, FACE.U)).toBe(FM_DIM);       // 物理 U 中心 → 遮罩 R 中心(暗)
    expect(m(P3.DF, FACE.D)).toBe(FM_REGULAR);   // 物理 D 层非 L 列 → 遮罩 L 块成员
    expect(m(P3.Dc, FACE.D)).toBe(FM_REGULAR);
  });

  it('默认 / 未知颜色 = yellow 恒等', () => {
    const base = stickeringMaskFn(3, 'Cross')!;
    const yellow = stickeringMaskFn(3, 'Cross', 'yellow')!;
    const bogus = stickeringMaskFn(3, 'Cross', 'purple')!;
    for (const [piece, face] of [
      [P3.DF, FACE.D], [P3.DF, FACE.F], [P3.Uc, FACE.U], [P3.UFR, FACE.R],
    ] as const) {
      expect(yellow(piece, face)).toBe(base(piece, face));
      expect(bogus(piece, face)).toBe(base(piece, face));
    }
  });
});

describe('stickeringGroupsFor', () => {
  it('阶数清单:1 阶隐藏,2/3/4+ 各有分组', () => {
    expect(stickeringGroupsFor(1)).toEqual([]);
    expect(stickeringGroupsFor(2).flatMap((g) => g.items)).toContain('PBL');
    const g3 = stickeringGroupsFor(3).flatMap((g) => g.items);
    // twizzle 3x3 全清单(去掉 Void Cube / invisible / picture)
    for (const name of ['full', 'OLL', 'PLL', 'ZBLL', 'WVLS', 'Cross', 'EOcross', 'CMLL', 'L6EO', '2x2x3', 'EODF', 'G1', 'centers-only']) {
      expect(g3).toContain(name);
    }
    const g5 = stickeringGroupsFor(5).flatMap((g) => g.items);
    expect(g5).toContain('L2C');
    expect(g5).toContain('Cross');
    // 3 阶清单里每个非 full 阶段都必须有 mask 实现
    for (const name of g3) {
      if (name === 'full') continue;
      expect(stickeringMaskFn(3, name), `mask for ${name}`).not.toBeNull();
    }
    for (const name of stickeringGroupsFor(2).flatMap((g) => g.items)) {
      if (name === 'full') continue;
      expect(stickeringMaskFn(2, name), `mask for 2x2 ${name}`).not.toBeNull();
    }
    for (const name of g5) {
      if (name === 'full') continue;
      expect(stickeringMaskFn(5, name), `mask for 5x5 ${name}`).not.toBeNull();
    }
  });
});
