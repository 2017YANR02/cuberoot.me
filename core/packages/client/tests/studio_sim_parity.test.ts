// /visualcube studio(spec 渲染)↔ /sim 伴图(引擎导出)同视图逐字节 parity。
//
// 用户红线:「vc 和引擎的魔方图不许有任何差别」。几何早已按构造同款(plan 直调
// renderCubeSVG,net/wca 共享 emitter);这里锁的是曾经翻过车的另一半 —— 配色:
//   - studio 默认面色 FACE_DEFAULTS 必须 = 全站单一源 CUBE_FILL(WCA 白顶),
//     而不是 visualcube 包默认(legacy 黄顶,留给公式库 case 缩略图);
//   - 展开图 emitter 的 WCA_COLORS 必须 = CUBE_FILL(ColorCode 色值,
//     不是 tnoodle 纯色系)。
// 三方(studio spec / sim 引擎 / shared emitter)只要有一处换色,这里立刻红。
import { describe, it, expect } from 'vitest';
import { renderSpecSvg } from '@/lib/puzzle-image/render';
import { DEFAULTS, FACE_DEFAULTS } from '@/lib/puzzle-image/defaults';
import { CUBE_FILL } from '@/lib/cube-colors';
import { exportSimPlanSvg } from '@/app/[lang]/sim/sim_plan_export';
import { exportSimNetSvg } from '@/app/[lang]/sim/sim_net_export';
import { WCA_COLORS } from '@cuberoot/shared/cube-unfolded-svg';

/** 复原态 serialize:URFDLB 六块,每块 N² 个该面字母。 */
const solved = (N: number) =>
  (['U', 'R', 'F', 'D', 'L', 'B'] as const).map((f) => f.repeat(N * N)).join('');

describe('studio ↔ sim companion parity', () => {
  it('palette 单一源:FACE_DEFAULTS = CUBE_FILL = emitter WCA_COLORS', () => {
    expect(FACE_DEFAULTS).toEqual(CUBE_FILL);
    // WCA_COLORS 按 cstimer 面序 D L B U R F
    expect(WCA_COLORS).toEqual([
      CUBE_FILL.D, CUBE_FILL.L, CUBE_FILL.B, CUBE_FILL.U, CUBE_FILL.R, CUBE_FILL.F,
    ]);
  });

  it('plan:studio spec ≡ 引擎伴图导出(N=2/3/4 复原态,逐字节)', () => {
    for (const N of [2, 3, 4]) {
      const spec = { ...DEFAULTS, cubeView: 'plan' as const, cubeSize: N };
      const studio = renderSpecSvg(spec)!;
      const sim = exportSimPlanSvg({ serialized: solved(N), order: N, faceColors: CUBE_FILL, spec });
      expect(sim).toBe(studio);
    }
  });

  it('plan:非默认 dist/opacity/背景 也逐字节同(plan 透视投影随 dist 变,曾漏)', () => {
    // 回归:plan companion 曾硬用 renderCubeSVG 默认 dist=5,而 VC 路吃 spec.dist
    // (/sim 透视滑块驱动)→ 面板大小差。现旋钮统一走 specToCubeOptions。
    const variants: Partial<typeof DEFAULTS>[] = [
      { dist: 6 }, { dist: 8.4 }, { dist: 3 },
      { stickerOpacity: 80 }, { cubeOpacity: 50 },
      { backgroundColor: '#123456' }, { dist: 7, stickerOpacity: 60 },
    ];
    for (const patch of variants) {
      const spec = { ...DEFAULTS, cubeView: 'plan' as const, ...patch };
      const studio = renderSpecSvg(spec)!;
      const sim = exportSimPlanSvg({ serialized: solved(3), order: 3, faceColors: CUBE_FILL, spec });
      expect(sim, `plan parity broke for ${JSON.stringify(patch)}`).toBe(studio);
    }
  });

  it('wca:studio 默认 spec ≡ 引擎伴图导出(N=2/3/4 复原态,逐字节)', () => {
    for (const N of [2, 3, 4]) {
      const studio = renderSpecSvg({ ...DEFAULTS, cubeView: 'wca', cubeSize: N })!;
      const sim = exportSimNetSvg({ serialized: solved(N), order: N, faceColors: CUBE_FILL });
      expect(sim).toBe(studio);
    }
  });
});
