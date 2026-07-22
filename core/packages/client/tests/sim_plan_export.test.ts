// exportSimPlanSvg:/sim 伴图的俯视(plan)图 —— **由 visualcube 本体渲染**,引擎只提供状态。
// 锁三件事:①输出与 visualcube 同参数调用逐字节相同(不是"看着像");②引擎 serialize() 下标
// 与 visualcube stickerColors 下标是恒等映射(逐 facelet 单点着色核验,防颜色错位/转置);
// ③solved 下的面归属与 B/F 上下序。退役对照表 §2b「视图 plan」。
import { describe, it, expect } from 'vitest';
import { renderCubeSVG } from '@cuberoot/visualcube';
import { exportSimPlanSvg } from '@/app/[lang]/sim/sim_plan_export';
import { NET_FACE_ORDER } from '@/app/[lang]/sim/sim_net_export';

const COLORS = {
  U: '#ffffff', R: '#ff0000', F: '#00ff00', D: '#ffff00', L: '#ff9900', B: '#0000ff',
} as const;

function solvedSerialized(N: number): string {
  return NET_FACE_ORDER.map((f) => f.repeat(N * N)).join('');
}

const countFill = (svg: string, hex: string): number =>
  (svg.match(new RegExp(`fill="${hex}"`, 'g')) ?? []).length;

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

/** 该 SVG 里唯一一块白色贴纸的质心;不可见(D 面 / 侧面下排)时为 null。 */
function whiteCentroid(svg: string): [number, number] | null {
  const w = polys(svg).find((p) => p.fill.toLowerCase() === COLORS.U);
  return w ? centroid(w.pts) : null;
}

describe('exportSimPlanSvg', () => {
  it('IS visualcube: byte-identical to renderCubeSVG({view:plan}) with the same colors', () => {
    for (const N of [2, 3, 4]) {
      const ser = solvedSerialized(N);
      const mine = exportSimPlanSvg({ serialized: ser, order: N, faceColors: COLORS, size: 256 });
      const vc = renderCubeSVG({
        cubeSize: N,
        view: 'plan',
        width: 256,
        height: 256,
        stickerColors: ser.split('').map((c) => COLORS[c as keyof typeof COLORS]),
      });
      expect(mine).toBe(vc);
    }
  });

  it('keeps visualcube chrome: viewBox, black cube outline frame, OLL layer group', () => {
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(3), order: 3, faceColors: COLORS });
    expect(svg).toContain('viewBox="-0.9 -0.9 1.8 1.8"');
    // 外框:cubeColor 填充 + 同色描边,由 stroke-width=0.1 的分组向外扩 → U 面外围黑方框。
    expect(svg).toContain('<g opacity="1" stroke-width="0.1" stroke-linejoin="round">');
    expect(svg).toContain('fill="black" stroke="black"');
    // OLL 侧带层(四侧顶排斜切梯形)。
    expect(svg).toContain('stroke-opacity="1" stroke-width="0.02"');
  });

  it('serialize() index space is the identity of visualcube stickerColors (无转置/错位)', () => {
    // 逐 facelet 单点着色:整方块涂 D(黄),只把第 k 个 facelet 涂 U(白),
    // 比对我们与 visualcube 各自那块白贴纸的质心。俯视图看不见的位置两边都应无白块。
    const N = 3;
    const bad: string[] = [];
    for (let k = 0; k < 6 * N * N; k++) {
      const ser = Array.from({ length: 6 * N * N }, (_, i) => (i === k ? 'U' : 'D')).join('');
      const mine = whiteCentroid(exportSimPlanSvg({ serialized: ser, order: N, faceColors: COLORS }));
      const vc = whiteCentroid(renderCubeSVG({
        cubeSize: N, view: 'plan', width: 256, height: 256,
        stickerColors: ser.split('').map((c) => COLORS[c as keyof typeof COLORS]),
      }));
      const tag = `${NET_FACE_ORDER[Math.floor(k / (N * N))]}${k % (N * N)}`;
      if (!mine && !vc) continue;
      if (!mine || !vc) { bad.push(`${tag}: 可见性不一致`); continue; }
      if (Math.hypot(mine[0] - vc[0], mine[1] - vc[1]) > 1e-9) bad.push(`${tag}: 质心不同`);
    }
    expect(bad).toEqual([]);
  });

  it('solved: white U centre (N²) + one solid band per adjacent face (N each), D absent', () => {
    const N = 3;
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    expect(countFill(svg, COLORS.U)).toBe(N * N); // U 中央
    expect(countFill(svg, COLORS.B)).toBe(N);     // B 上带
    expect(countFill(svg, COLORS.F)).toBe(N);     // F 下带
    expect(countFill(svg, COLORS.L)).toBe(N);     // L 左带
    expect(countFill(svg, COLORS.R)).toBe(N);     // R 右带
    expect(countFill(svg, COLORS.D)).toBe(0);     // D 不出现在俯视图
  });

  it('places the B band above and the F band below the U grid', () => {
    const N = 3;
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    const ys: Record<string, number[]> = {};
    for (const p of polys(svg)) for (const [, y] of p.pts) (ys[p.fill] ??= []).push(y);
    expect(Math.min(...ys[COLORS.B])).toBeLessThan(Math.min(...ys[COLORS.U])); // B 在 U 之上
    expect(Math.max(...ys[COLORS.F])).toBeGreaterThan(Math.max(...ys[COLORS.U])); // F 在 U 之下
  });

  it('side bands are perspective trapezoids, not axis-aligned rectangles', () => {
    const N = 3;
    const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    const isAxisRect = (pts: [number, number][]): boolean => {
      const xs = new Set(pts.map((p) => Math.round(p[0] * 1e4)));
      const ys = new Set(pts.map((p) => Math.round(p[1] * 1e4)));
      return xs.size <= 2 && ys.size <= 2;
    };
    const bands = polys(svg).filter((p) => p.fill !== COLORS.U && p.fill !== 'black');
    expect(bands.length).toBe(4 * N);
    expect(bands.every((b) => !isAxisRect(b.pts))).toBe(true);
  });
});
