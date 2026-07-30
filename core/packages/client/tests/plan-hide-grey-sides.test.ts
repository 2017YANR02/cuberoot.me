// 俯视图「隐去侧面灰格」(ImageSpec.hideGreySides / URL `ngs` / visualcube hideGreySides)。
//
// 语义:plan 视图侧面那一圈(renderOLLStickers 单独一个 pass 画的 12 格)里,填充色 == 遮罩色
// 的直接不画;**顶面 9 格一格不动**。所以本文件的核心判据不是"看着少了几块",而是
// 「SVG 里侧环那一组之前的字节完全相同」—— 外框 + U 面全在这一段里,逐字节相同 = 顶面零改动。
//
// 三条渲染路各锁一遍(它们的"灰"来源不同,最容易在这里走散):
//   /alg 缩略图      → renderFromSimpleQuery(view=oll)  灰 = OLL 预设的 #404040
//   /visualcube 工作室 → specToCubeOptions(spec)          灰 = spec.maskColor(可被 mkc 改)
//   /sim 伴图         → exportSimPlanSvg(引擎实时态)      灰 = 引擎自己的 #444
import { describe, it, expect } from 'vitest';
import { renderFromSimpleQuery, renderCubeSVG } from '@cuberoot/visualcube';
import { specToCubeOptions } from '@/lib/puzzle-image/render';
import { readSpecFromParams, specToParams } from '@/lib/puzzle-image/codec';
import { DEFAULTS } from '@/lib/puzzle-image/defaults';
import type { ImageSpec } from '@/lib/puzzle-image/types';
import { exportSimPlanSvg } from '@/app/[lang]/sim/sim_plan_export';
import { NET_FACE_ORDER } from '@/lib/cube-net-svg';

/** OLL 1(点组),侧面 8 黄 4 灰 —— 灰格删得掉又不会删光,正好当判据。 */
const OLL_DOT = "f U R U' R' f' F U R U' R' F'";

/** 侧环那一组的起点(wrapOllLayerGroup 的 stroke-width="0.02")。它之前的字节 = 外框 + U 面。 */
const RIM_GROUP = 'stroke-width="0.02"';

function beforeRim(svg: string): string {
  const i = svg.indexOf(RIM_GROUP);
  expect(i).toBeGreaterThan(0);
  return svg.slice(0, i);
}

const polygons = (svg: string): string[] => svg.match(/<polygon[^>]*>/g) ?? [];
const withFill = (svg: string, hex: string): string[] =>
  polygons(svg).filter((p) => p.includes(`fill="${hex}"`));

const spec = (p: Partial<ImageSpec>): ImageSpec => ({ ...DEFAULTS, ...p });

describe('plan view — hide grey sides', () => {
  describe('/alg thumbnails (renderFromSimpleQuery view=oll)', () => {
    const off = renderFromSimpleQuery({ view: 'oll', size: 88, setup: OLL_DOT });
    const on = renderFromSimpleQuery({ view: 'oll', size: 88, setup: OLL_DOT, ngs: '1' });

    it('leaves the U face byte-identical', () => {
      // 顶面 9 格 + 外框全在侧环组之前。逐字节相同 = 顶面零改动(不是"肉眼看不出")。
      expect(beforeRim(on)).toBe(beforeRim(off));
      expect(withFill(beforeRim(on), '#404040')).toHaveLength(8); // 点组:U 面 8 灰 1 黄
    });

    it('drops exactly the grey rim stickers', () => {
      expect(polygons(off)).toHaveLength(22); // 外框 1 + U 面 9 + 侧环 12
      expect(withFill(off, '#404040')).toHaveLength(12); // U 面 8 + 侧环 4
      expect(polygons(on)).toHaveLength(18); // 侧环少 4
      expect(withFill(on, '#404040')).toHaveLength(8); // 只剩 U 面那 8 块
    });

    it('is off by default and off for ngs=0 (老链接输出不变)', () => {
      expect(renderFromSimpleQuery({ view: 'oll', size: 88, setup: OLL_DOT, ngs: '0' })).toBe(off);
      expect(renderFromSimpleQuery({ view: 'oll', size: 88, setup: OLL_DOT, ngs: '' })).toBe(off);
    });

    it('no-ops where the rim carries real colours (PLL)', () => {
      const pll = { view: 'pll' as const, size: 88, setup: "R U R' U' R' F R2 U' R' U' R U R' F'" };
      expect(renderFromSimpleQuery({ ...pll, ngs: '1' })).toBe(renderFromSimpleQuery(pll));
    });

    it('no-ops on an iso view (侧环压根没画)', () => {
      const iso = { view: 'iso' as const, size: 88, setup: OLL_DOT };
      expect(renderFromSimpleQuery({ ...iso, ngs: '1' })).toBe(renderFromSimpleQuery(iso));
    });
  });

  describe('studio spec → cube options', () => {
    it('only fires on the plan view', () => {
      expect(specToCubeOptions(spec({ cubeView: 'plan', hideGreySides: true })).hideGreySides).toBe(true);
      expect(specToCubeOptions(spec({ cubeView: 'normal', hideGreySides: true })).hideGreySides).toBeUndefined();
      expect(specToCubeOptions(spec({ cubeView: 'plan' })).hideGreySides).toBeUndefined();
    });

    it("hands the renderer the spec's own grey so a custom mkc still counts as grey", () => {
      const o = specToCubeOptions(spec({ cubeView: 'plan', hideGreySides: true, maskColor: '#123456' }));
      expect(o.maskColor).toBe('#123456');
    });

    it('leaves maskColor alone when off (老 URL 的 stage 遮罩填充不变)', () => {
      expect(specToCubeOptions(spec({ cubeView: 'plan', maskColor: '#123456' })).maskColor).toBeUndefined();
    });
  });

  describe('URL codec', () => {
    it('round-trips ngs', () => {
      const s = spec({ cubeView: 'plan', hideGreySides: true });
      expect(specToParams(s, '').get('ngs')).toBe('1');
      expect(readSpecFromParams('pzl=3&view=plan&ngs=1', '').hideGreySides).toBe(true);
      expect(readSpecFromParams('pzl=3&view=plan&ngs=0', '').hideGreySides).toBe(false);
      expect(readSpecFromParams('pzl=3&view=plan', '').hideGreySides).toBe(false);
    });

    it('never emits ngs where it would render nothing', () => {
      expect(specToParams(spec({ cubeView: 'normal', hideGreySides: true }), '').get('ngs')).toBeNull();
      expect(specToParams(spec({ puzzleType: 'skewb', hideGreySides: true }), '').get('ngs')).toBeNull();
    });
  });

  describe('/sim companion (engine state, engine grey)', () => {
    // 引擎 serialize():面序 U R F D L B,面内 row-major。非面字母 = 该贴纸被 stickering 隐掉。
    const N = 3;
    const rimHidden = (): string => {
      const faces = NET_FACE_ORDER.map((f) => f.repeat(N * N));
      // R / F 两面的第一行(挨着 U 的那一圈)整行隐掉,L / B 保留 → 侧环 6 灰 6 彩。
      for (const fi of [1, 2]) faces[fi] = 'X'.repeat(N) + faces[fi].slice(N);
      return faces.join('');
    };
    const COLORS = { U: '#ffffff', R: '#ff0000', F: '#00ff00', D: '#ffff00', L: '#ff9900', B: '#0000ff' } as const;
    const base = { serialized: rimHidden(), order: N, faceColors: COLORS, size: 256 };

    const off = exportSimPlanSvg({ ...base, spec: spec({ cubeView: 'plan' }) });
    const on = exportSimPlanSvg({ ...base, spec: spec({ cubeView: 'plan', hideGreySides: true }) });

    it('drops the engine-grey rim stickers, U face byte-identical', () => {
      expect(withFill(off, '#444')).toHaveLength(6);
      expect(withFill(on, '#444')).toHaveLength(0);
      expect(polygons(off).length - polygons(on).length).toBe(6);
      expect(beforeRim(on)).toBe(beforeRim(off));
    });

    it('still IS visualcube — same options, same bytes', () => {
      // 侧环那 12 个下标里的引擎灰置 transparent,其余照旧 —— 与导出器同一套下标算法。
      const colors: string[] = [...base.serialized].map((ch) =>
        NET_FACE_ORDER.includes(ch as never) ? COLORS[ch as keyof typeof COLORS] : '#444');
      for (const fi of [1, 2, 4, 5]) {
        for (let i = 0; i < N; i++) {
          const idx = fi * N * N + i;
          if (colors[idx] === '#444') colors[idx] = 'transparent';
        }
      }
      const vc = renderCubeSVG({
        ...specToCubeOptions(spec({ cubeView: 'plan', hideGreySides: true })),
        cubeSize: N, view: 'plan', width: 256, height: 256,
        algorithm: undefined, case: undefined,
        stickerColors: colors,
      });
      expect(on).toBe(vc);
    });

    it('顶面的灰一格不动 —— 连色值都不换', () => {
      // 顶面也隐掉一格(U 面 index 0),它必须原样留在图里、还是引擎那只灰。
      const faces = NET_FACE_ORDER.map((f) => f.repeat(N * N));
      faces[0] = 'X' + faces[0].slice(1);
      for (const fi of [1, 2]) faces[fi] = 'X'.repeat(N) + faces[fi].slice(N);
      const ser = faces.join('');
      const hidden = exportSimPlanSvg({
        ...base, serialized: ser, spec: spec({ cubeView: 'plan', hideGreySides: true }),
      });
      expect(withFill(hidden, '#444')).toHaveLength(1); // 只剩顶面那一格
      expect(withFill(beforeRim(hidden), '#444')).toHaveLength(1); // 且它在 U 面那一段里
    });

    it('spec 自带的 stage 遮罩灰走 maskColor 那条路,同样能删', () => {
      const solved = NET_FACE_ORDER.map((f) => f.repeat(N * N)).join('');
      const staged = (hide: boolean) => exportSimPlanSvg({
        ...base, serialized: solved,
        spec: spec({ cubeView: 'plan', stageMask: 'oll', hideGreySides: hide }),
      });
      // OLL stage:U 面全彩,其余全 #404040 → 侧环 12 格全灰。
      expect(withFill(staged(false), '#404040')).toHaveLength(12);
      expect(withFill(staged(true), '#404040')).toHaveLength(0);
      expect(beforeRim(staged(true))).toBe(beforeRim(staged(false)));
    });
  });
});
