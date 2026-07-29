// 俯视识别简化(MeiCubeTool「view=plan simplify Config」的移植)。
//
// 最要紧的一条是**下标空间**:规则和 URL 里的 side=/up= 序号必须和渲染器真画出来的位置对得上。
// 所以这里不抄映射表 —— 直接给每张贴纸涂一个唯一色渲染一遍,按多边形质心把侧环排成
// 「左上角起顺时针」,再反查它是哪张贴纸,和 ringStickerIndex 对答案。投影哪天改了,这条先红。
import { describe, it, expect } from 'vitest';
import {
  renderCubeSVG, renderFromSimpleQuery, ringStickerIndex, parseIndexList,
} from '@cuberoot/visualcube';
import { readSpecFromParams, specToParams } from '@/lib/puzzle-image/codec';
import { DEFAULTS } from '@/lib/puzzle-image/defaults';
import type { ImageSpec } from '@/lib/puzzle-image/types';

const spec = (p: Partial<ImageSpec>): ImageSpec => ({ ...DEFAULTS, ...p });
const RIM_GROUP = 'stroke-width="0.02"';
const rimCount = (svg: string) => (svg.slice(svg.indexOf(RIM_GROUP)).match(/<polygon/g) ?? []).length;
/** 顶面格数 = 侧环组之前的多边形数 - 1(那 1 个是外框)。 */
const upCount = (svg: string) => (svg.slice(0, svg.indexOf(RIM_GROUP)).match(/<polygon/g) ?? []).length - 1;

/** 每张贴纸一个唯一色,便于从 fill 反查它是第几张。 */
function probeColors(N: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 6 * N * N; i++) out.push('#' + (0x100000 + i).toString(16));
  return out;
}
const colorToIndex = (fill: string) => parseInt(fill.slice(1), 16) - 0x100000;

function polys(part: string) {
  return [...part.matchAll(/<polygon points="([^"]+)"[^>]*fill="([^"]+)"/g)].map((m) => {
    const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number));
    return {
      cx: pts.reduce((a, p) => a + p[0], 0) / pts.length,
      cy: pts.reduce((a, p) => a + p[1], 0) / pts.length,
      idx: colorToIndex(m[2]),
    };
  });
}

describe('plan-simplify — index spaces (实测反推,不抄表)', () => {
  for (const N of [2, 3, 4, 5]) {
    it(`side ring 1..${4 * N} 顺时针自左上角 (N=${N})`, () => {
      const svg = renderCubeSVG({
        cubeSize: N, view: 'plan', width: 300, height: 300, stickerColors: probeColors(N),
      });
      const rim = polys(svg.slice(svg.indexOf(RIM_GROUP)));
      expect(rim).toHaveLength(4 * N);
      // 按到中心的主方向分四条边,再各自按环行进方向排序。
      const strip = (r: { cx: number; cy: number }) =>
        Math.abs(r.cy) > Math.abs(r.cx) ? (r.cy < 0 ? 0 : 2) : (r.cx > 0 ? 1 : 3);
      const order = [
        (a: typeof rim[0], b: typeof rim[0]) => a.cx - b.cx,  // 上:左→右
        (a: typeof rim[0], b: typeof rim[0]) => a.cy - b.cy,  // 右:上→下
        (a: typeof rim[0], b: typeof rim[0]) => b.cx - a.cx,  // 下:右→左
        (a: typeof rim[0], b: typeof rim[0]) => b.cy - a.cy,  // 左:下→上
      ];
      const measured: number[] = [];
      for (let s = 0; s < 4; s++) measured.push(...rim.filter((r) => strip(r) === s).sort(order[s]).map((r) => r.idx));
      const declared = Array.from({ length: 4 * N }, (_, k) => ringStickerIndex(k + 1, N));
      expect(measured).toEqual(declared);
    });
  }

  it('up 1..9 = U 面 row-major,就是图上从左上到右下的顺序', () => {
    const N = 3;
    const svg = renderCubeSVG({
      cubeSize: N, view: 'plan', width: 300, height: 300, stickerColors: probeColors(N),
    });
    const face = polys(svg.slice(0, svg.indexOf(RIM_GROUP))).filter((p) => p.idx >= 0 && p.idx < 9);
    face.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
    expect(face.map((p) => p.idx)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('parseIndexList 认 side=/up=,乱七八糟的 token 直接丢', () => {
    expect(parseIndexList('side=1,2,3&up=5')).toEqual({ side: [1, 2, 3], up: [5] });
    expect(parseIndexList('side=&up=')).toEqual({ side: [], up: [] });
    expect(parseIndexList('up=1,x,0,-2,4')).toEqual({ side: [], up: [1, 4] });
    expect(parseIndexList(undefined)).toEqual({ side: [], up: [] });
    expect(parseIndexList('nonsense')).toEqual({ side: [], up: [] });
  });
});

describe('plan-simplify — 侧面规则', () => {
  // PLL 视图侧环是真配色,分类才有意义(OLL 视图侧面只有黄和灰)。
  const PLL = {
    T: "R U R' U' R' F R2 U' R' U' R U R' F'",
    Ua: "R U' R U R U R U' R' U' R2",
    H: 'M2 U M2 U2 M2 U M2',
    Aa: "x R' U R' D2 R U' R' D2 R2 x'",
  };
  const rim = (setup: string, extra: Record<string, string>) =>
    rimCount(renderFromSimpleQuery({ view: 'pll', size: 96, setup, ...extra }));

  it('阈值越松留得越多(单调不减)', () => {
    const rules = ['bar', 'oppline', 'cece', 'light', 'oppbar', 'ecec'];
    for (const setup of Object.values(PLL)) {
      const counts = rules.map((psr) => rim(setup, { psr }));
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
      expect(counts[counts.length - 1]).toBeLessThanOrEqual(12);
    }
  });

  it('锁基线 —— 改了分类器要主动改这里当 review 信号', () => {
    expect(rim(PLL.T, { psr: 'bar' })).toBe(4);
    expect(rim(PLL.Ua, { psr: 'bar' })).toBe(3);
    expect(rim(PLL.Aa, { psr: 'bar' })).toBe(4);
    expect(rim(PLL.Aa, { psr: 'oppbar' })).toBe(9);
  });

  it('永不给空图:阈值比全场最强的图案还严就自动放宽一档', () => {
    // H perm 四面全是「X 对色X X」,任何严于它的阈值都会被抬到 minType+4。
    expect(rim(PLL.H, { psr: 'bar' })).toBe(12);
    for (const setup of Object.values(PLL)) expect(rim(setup, { psr: 'bar' })).toBeGreaterThan(0);
  });

  it('psr=all 与不传逐字节相同(老链接不受影响)', () => {
    const base = { view: 'pll' as const, size: 96, setup: PLL.T };
    expect(renderFromSimpleQuery({ ...base, psr: 'all' })).toBe(renderFromSimpleQuery(base));
    expect(renderFromSimpleQuery({ ...base, psr: '乱写的' })).toBe(renderFromSimpleQuery(base));
  });

  it('非三阶不套规则(判据是三格窗口,四阶没有意义)', () => {
    const base = { view: 'plan' as const, size: 96, pzl: 4, setup: "R U R' U'" };
    expect(renderFromSimpleQuery({ ...base, psr: 'bar' })).toBe(renderFromSimpleQuery(base));
  });
});

describe('plan-simplify — 顶面规则 / 保留顶层色 / 强制显隐', () => {
  const setup = "R U R' U' R U R' U' F R U R' U' F'"; // 六面真色,U 面颜色混杂
  const svg = (extra: Record<string, string>) =>
    renderFromSimpleQuery({ view: 'plan', size: 96, setup, ...extra });

  it('顶面规则会隐掉 U 面的格(这条是显式开的,与 ngs 无关)', () => {
    expect(upCount(svg({}))).toBe(9);
    expect(upCount(svg({ pur: 'bar', psy: '0' }))).toBe(4);
    expect(upCount(svg({ pur: 'baroppbar', psy: '0' }))).toBe(4);
  });

  it('保留顶层色:顶层配色的贴纸规则再狠也留着(默认开)', () => {
    expect(upCount(svg({ pur: 'bar' }))).toBeGreaterThan(upCount(svg({ pur: 'bar', psy: '0' })));
  });

  it('强制隐藏在强制显示之后生效,保留顶层色又盖过两者', () => {
    const hidden = svg({ pfh: 'side=1,2,3&up=1,2,3', psy: '0' });
    expect(upCount(hidden)).toBe(6);
    expect(rimCount(hidden)).toBe(9);
    // 同一格同时进两张表 → 隐藏赢。
    const both = svg({ pfs: 'side=1&up=', pfh: 'side=1&up=', psy: '0' });
    expect(rimCount(both)).toBe(11);
  });

  it('强制显示能把规则抹掉的格子加回来', () => {
    const off = upCount(svg({ pur: 'bar', psy: '0' }));
    expect(upCount(svg({ pur: 'bar', psy: '0', pfs: 'side=&up=5' }))).toBe(off + 1);
  });
});

describe('plan-simplify — URL codec', () => {
  it('五个键都能来回跑', () => {
    const s = spec({
      cubeView: 'plan', planSideRule: 'light', planUpRule: 'bar',
      planShowYellow: false, planForceShow: 'side=1&up=', planForceHide: 'side=&up=5',
    });
    const p = specToParams(s, '');
    expect(p.get('psr')).toBe('light');
    expect(p.get('pur')).toBe('bar');
    expect(p.get('psy')).toBe('0');
    expect(p.get('pfs')).toBe('side=1&up=');
    expect(p.get('pfh')).toBe('side=&up=5');
    const back = readSpecFromParams(p, '');
    expect(back.planSideRule).toBe('light');
    expect(back.planUpRule).toBe('bar');
    expect(back.planShowYellow).toBe(false);
    expect(back.planForceShow).toBe('side=1&up=');
    expect(back.planForceHide).toBe('side=&up=5');
  });

  it('非俯视 / 非方块一个都不写;规则名不认识当没写', () => {
    const s = spec({ cubeView: 'normal', planSideRule: 'light', planForceShow: 'side=1&up=' });
    for (const k of ['psr', 'pur', 'psy', 'pfs', 'pfh']) expect(specToParams(s, '').get(k)).toBeNull();
    expect(readSpecFromParams('view=plan&psr=乱写', '').planSideRule).toBe('all');
  });
});
