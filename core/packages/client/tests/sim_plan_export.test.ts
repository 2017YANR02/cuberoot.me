// exportSimPlanSvg:忠实复刻 visualcube plan 的引擎俯视 OLL 图 —— U 面 N×N + F/B/L/R 顶排
// **斜切梯形**侧带(透视投影,非平矩形)。锁结构 + 侧带面归属 + B/F 上下 + 透视斜切(防回退到
// 平矩形版);朝向/左右序经 Playwright 单移动对真机核验(退役对照表 §2b「视图 plan」)。
import { describe, it, expect } from 'vitest';
import { renderCubeSVG } from '@cuberoot/visualcube';
import { exportSimPlanSvg } from '@/app/[lang]/sim/sim_plan_export';
import { NET_FACE_ORDER } from '@/app/[lang]/sim/sim_net_export';

const COLORS = {
  U: '#fff', R: '#f00', F: '#0f0', D: '#ff0', L: '#f90', B: '#00f',
} as const;

function solvedSerialized(N: number): string {
  return NET_FACE_ORDER.map((f) => f.repeat(N * N)).join('');
}

const countFill = (svg: string, hex: string): number =>
  (svg.match(new RegExp(`fill="${hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) ?? []).length;

/** 解析所有 <polygon>,返回 {fill, pts:[x,y][]}。 */
function polys(svg: string): { fill: string; pts: [number, number][] }[] {
  const out: { fill: string; pts: [number, number][] }[] = [];
  for (const m of svg.matchAll(/<polygon points="([^"]+)"[^>]*fill="([^"]+)"/g)) {
    const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
    out.push({ fill: m[2], pts });
  }
  return out;
}

const centroid = (pts: [number, number][]): [number, number] =>
  [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

describe('exportSimPlanSvg', () => {
  it('draws U backing + U (N²) + 4 side bands (N each) = N²+4N+1 polygons, visualcube viewBox', () => {
    for (const N of [2, 3, 4]) {
      const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
      expect(polys(svg).length).toBe(N * N + 4 * N + 1); // +1 = U 黑衬底
      expect(svg).toContain('viewBox="-0.9 -0.9 1.8 1.8"');
      expect(svg).not.toContain('<rect '); // 不再是平矩形版
    }
  });

  it('solved: white U centre (N²) + one solid band per adjacent face (N each), D absent', () => {
    const N = 3;
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    expect(countFill(svg, '#fff')).toBe(N * N); // U 中央
    expect(countFill(svg, '#00f')).toBe(N);     // B 上带
    expect(countFill(svg, '#0f0')).toBe(N);     // F 下带
    expect(countFill(svg, '#f90')).toBe(N);     // L 左带
    expect(countFill(svg, '#f00')).toBe(N);     // R 右带
    expect(countFill(svg, '#ff0')).toBe(0);     // D 不出现在俯视图
  });

  it('places the B band above and the F band below the U grid', () => {
    const N = 3;
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    const ys: Record<string, number[]> = {};
    for (const p of polys(svg)) for (const [, y] of p.pts) (ys[p.fill] ??= []).push(y);
    expect(Math.min(...ys['#00f'])).toBeLessThan(Math.min(...ys['#fff'])); // B 在 U 之上
    expect(Math.max(...ys['#0f0'])).toBeGreaterThan(Math.max(...ys['#fff'])); // F 在 U 之下
  });

  it('geometry is pixel-faithful to visualcube renderCubeSVG(view:plan) (忠于原版)', () => {
    // solved 下颜色两边都是纯色,只比**几何**:每个多边形质心在对方里都有 ε 内匹配。
    // visualcube 自己的 plan 输出即 ground truth(同 dist=5 透视 + OLL 外推 + 内缩)。
    const N = 3;
    const mine = polys(exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS }));
    const vc = polys(renderCubeSVG({ cubeSize: N, view: 'plan', width: 256, height: 256 }));
    // visualcube 会多画一个 U 外框(cubeColor);两边多边形数应一致。
    expect(mine.length).toBe(vc.length);
    const cMine = mine.map((p) => centroid(p.pts));
    const cVc = vc.map((p) => centroid(p.pts));
    const EPS = 0.01;
    for (const c of cVc) {
      const hit = cMine.some((m) => Math.abs(m[0] - c[0]) < EPS && Math.abs(m[1] - c[1]) < EPS);
      expect(hit, `visualcube 多边形质心 (${c[0].toFixed(3)},${c[1].toFixed(3)}) 在引擎版无匹配`).toBe(true);
    }
  });

  it('side bands are perspective trapezoids, not axis-aligned rectangles (忠于原版斜切)', () => {
    const N = 3;
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    // 轴对齐矩形 = 恰 2 个不同 x 且 2 个不同 y。侧带为透视梯形 → 至少一条不满足。
    const isAxisRect = (pts: [number, number][]): boolean => {
      const xs = new Set(pts.map((p) => Math.round(p[0] * 1e4)));
      const ys = new Set(pts.map((p) => Math.round(p[1] * 1e4)));
      return xs.size <= 2 && ys.size <= 2;
    };
    const bands = polys(svg).filter((p) => p.fill !== '#fff' && p.fill !== '#000');
    expect(bands.length).toBe(4 * N);
    expect(bands.every((b) => !isAxisRect(b.pts))).toBe(true); // 全部是斜切梯形
  });
});
