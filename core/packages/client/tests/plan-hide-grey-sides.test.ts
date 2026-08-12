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
import type { AlgSticker } from '@cuberoot/shared';
import { renderFromSimpleQuery, renderCubeSVG } from '@cuberoot/visualcube';
import { cubeThumbParams, LEVEL2_PICKER_MASK } from '@/lib/alg_thumb_plan';
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

function rim(svg: string): string {
  const i = svg.indexOf(RIM_GROUP);
  expect(i).toBeGreaterThan(0);
  return svg.slice(i);
}

const polygons = (svg: string): string[] => svg.match(/<polygon[^>]*>/g) ?? [];
const withFill = (svg: string, hex: string): string[] =>
  polygons(svg).filter((p) => p.includes(`fill="${hex}"`));

const spec = (p: Partial<ImageSpec>): ImageSpec => ({ ...DEFAULTS, ...p });

describe('二阶公式缩略图', () => {
  const RAW: AlgSticker = { kind: 'raw', tag: '', attrs: {} };

  it('所有公式集都走完整平面图，不套 LL 灰色遮罩', () => {
    for (const set of ['cll', 'eg1', 'tcll-plus', 'ls1', 'ls9', 'teg2-plus']) {
      expect(cubeThumbParams('2x2', set, RAW)).toEqual({ view: 'plan', puzzleSize: 2 });
      expect(cubeThumbParams('2x2', set, RAW, 'coll')).toEqual({ view: 'plan', puzzleSize: 2 });
    }
  });

  it('LS case 的可见贴纸没有遮罩灰', () => {
    const p = cubeThumbParams('2x2', 'ls1', RAW);
    const svg = renderFromSimpleQuery({
      view: p.view,
      pzl: p.puzzleSize,
      size: 88,
      setup: "R U R' F2' R F' R U R2' F2'",
    });
    expect(withFill(svg, '#404040')).toHaveLength(0);
  });

  it('LS 分类说明用两张 plan 图分别只露出目标白角和占槽黄角', () => {
    const setup = "R U' R2' F R F' R U R2' F R F' U'"; // LS2:白格朝 U，黄格朝 F
    const white = renderFromSimpleQuery({
      view: 'plan',
      pzl: 2,
      size: 88,
      setup,
      sch: '404040,404040,404040,FFFFFF,404040,404040',
      psy: '0',
    });
    const yellow = renderFromSimpleQuery({
      view: 'plan',
      pzl: 2,
      size: 88,
      setup: `${setup} x2`, // DFR 槽转到 UBR，D/F/R 三种黄格方向都进入 plan 可见区
      sch: 'FFFF00,404040,404040,404040,404040,404040',
      psy: '0',
    });
    expect(withFill(white, '#FFFFFF')).toHaveLength(1);
    expect(withFill(white, '#FFFF00')).toHaveLength(0);
    expect(withFill(yellow, '#FFFF00')).toHaveLength(1);
    expect(withFill(yellow, '#FFFFFF')).toHaveLength(0);
    expect(withFill(white, '#404040')).toHaveLength(3); // 顶面灰保留，侧环灰删除
    expect(withFill(yellow, '#404040')).toHaveLength(4);
    for (const color of ['#00FF00', '#FF0000', '#FF8000', '#0000FF']) {
      expect(withFill(white, color)).toHaveLength(0);
      expect(withFill(yellow, color)).toHaveLength(0);
    }
  });
});

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

  // 顶层公式集的图统一「侧面无灰」:OLL 的灰是「这里不是黄」,COLL / CMLL 的灰是「这条棱
  // 不用看」,都是占位而非题面 —— 删了侧环只剩真要认的色块。顶面照旧一格不动(CMLL 顶面
  // 那圈灰是「M 层没解开」,是题面)。
  describe('顶层公式集(coll / cmll / ollcp)', () => {
    const RAW: AlgSticker = { kind: 'raw', tag: '', attrs: {} };
    const params = (set: string, mask?: string) => cubeThumbParams('3x3', set, RAW, mask);

    it('coll / cmll / ollcp 走 pll 视角 + 自家遮罩,并删侧环灰格', () => {
      expect(params('coll')).toEqual({ view: 'pll', mask: 'coll', hideGreySides: true, puzzleSize: 3 });
      expect(params('cmll')).toEqual({ view: 'pll', mask: 'cmll', hideGreySides: true, puzzleSize: 3 });
      expect(params('2-look-cmll')).toEqual({ view: 'pll', mask: 'cmll', hideGreySides: true, puzzleSize: 3 });
      expect(params('oh-cmll')).toEqual({ view: 'pll', mask: 'cmll', hideGreySides: true, puzzleSize: 3 });
      expect(params('ollcp')).toEqual({ view: 'pll', mask: 'ollcp', hideGreySides: true, puzzleSize: 3 });
    });

    it('ZBLL / 1LLL / OLLCP 二级选择卡(mask=coll)同样删', () => {
      for (const set of ['zbll', '1lll', 'ollcp']) {
        expect(LEVEL2_PICKER_MASK[set]).toBe('coll');
        expect(params(set, LEVEL2_PICKER_MASK[set]).hideGreySides).toBe(true);
      }
      // 只认角块遮罩:别的遮罩覆盖(zbls 的 vh 等)不顺手打开这个开关。
      expect(params('zbls', 'vh').hideGreySides).toBeUndefined();
      expect(params('pll').hideGreySides).toBe(false); // 侧环是真配色,没有灰可删
    });

    it('COLL:侧环 4 格灰全删,顶面逐字节不变', () => {
      const q = { view: 'pll' as const, mask: 'coll', size: 88, case: "R U R' U R U2 R'" };
      const off = renderFromSimpleQuery(q);
      const on = renderFromSimpleQuery({ ...q, ngs: '1' });
      expect(beforeRim(on)).toBe(beforeRim(off));
      expect(withFill(off, '#404040')).toHaveLength(4); // COLL 遮罩:顶面全彩,灰只在侧环
      expect(polygons(off)).toHaveLength(22);
      expect(polygons(on)).toHaveLength(18);
      expect(withFill(on, '#404040')).toHaveLength(0);
    });

    it('CMLL:侧环 4 格灰删掉,顶面那 5 格灰留着', () => {
      const q = { view: 'pll' as const, mask: 'cmll', size: 88, case: "R U R' F' R U R' U' R' F R2 U' R'" };
      const off = renderFromSimpleQuery(q);
      const on = renderFromSimpleQuery({ ...q, ngs: '1' });
      expect(beforeRim(on)).toBe(beforeRim(off));
      expect(withFill(off, '#404040')).toHaveLength(9); // 顶面 4 棱 + 中心 + 侧环 4
      expect(polygons(on)).toHaveLength(18);
      expect(withFill(on, '#404040')).toHaveLength(5); // 顶面那 5 格
    });

    it('OLLCP:完整图和简化图都不绘制侧环灰格', () => {
      const q = {
        view: 'pll' as const,
        mask: 'ollcp',
        size: 88,
        setup: "F R' F' R U2' F R' F' R2' U2' R'",
        ngs: '1',
      };
      const full = renderFromSimpleQuery(q);
      const simplified = renderFromSimpleQuery({
        ...q,
        psr: 'oppbar',
        pur: 'all',
        psy: '1',
        pfh: 'side=1,2,3,4,5,6,7,8,9,10,11,12',
      });
      expect(withFill(rim(full), '#404040')).toHaveLength(0);
      expect(withFill(rim(simplified), '#404040')).toHaveLength(0);
      for (const color of ['#00D800', '#EE0000', '#FFA100', '#0000F2']) {
        expect(withFill(rim(simplified), color)).toHaveLength(0);
      }
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
