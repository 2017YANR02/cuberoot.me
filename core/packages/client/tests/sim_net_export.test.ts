// exportSimNetSvg:引擎驱动展开图(net / wca)导出器。与 tnoodle 参照
// renderUnfoldedSvg 共享同一 SVG emitter(cube_unfolded_svg)—— 复原态喂 tnoodle
// 配色必须逐字节同款;另锁 54 格逐格归属(cstimer 面序换算不许错位)与遮罩。
// 交互式 _SimCubeNet 同一布局源(退役对照表 §2b「视图 net / wca」)。
import { describe, it, expect } from 'vitest';
import {
  exportSimNetSvg, netFaceOffsets, NET_GAP, NET_FACE_ORDER, type NetFaceLetter,
} from '@/app/[lang]/sim/sim_net_export';
import { renderUnfoldedSvg } from '@/app/[lang]/scramble/gen/_svg/cube_unfolded_svg';

const COLORS = {
  U: '#fff', R: '#f00', F: '#0f0', D: '#ff0', L: '#f90', B: '#00f',
} as const;

/** tnoodle CubePuzzle defaultColorScheme(renderUnfoldedSvg 的 WCA_COLORS)。 */
const TNOODLE_COLORS: Record<NetFaceLetter, string> = {
  U: '#FFFFFF', R: '#FF0000', F: '#00FF00', D: '#FFFF00', L: '#FF8000', B: '#0000FF',
};

/** 复原态 serialize:每块 N² 全该面字母(URFDLB 顺序)。 */
function solvedSerialized(N: number): string {
  return NET_FACE_ORDER.map((f) => f.repeat(N * N)).join('');
}

describe('exportSimNetSvg', () => {
  it('byte-identical to renderUnfoldedSvg for the solved state (N=2/3/4, tnoodle palette)', () => {
    // 共享 emitter 的总闸:布局 / 描边 / 属性顺序 / 数字格式没有任何自绘余地。
    for (const N of [2, 3, 4]) {
      const svg = exportSimNetSvg({
        serialized: solvedSerialized(N), order: N, faceColors: TNOODLE_COLORS,
      });
      expect(svg).toBe(renderUnfoldedSvg(N, ''));
    }
  });

  it('lays out 6·N² sticker rects in the URFDLB cross with viewBox 4N+5GAP × 3N+4GAP', () => {
    const N = 3;
    const svg = exportSimNetSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
    const rects = svg.match(/<rect /g) ?? [];
    expect(rects.length).toBe(6 * N * N); // 54,无背景 rect(默认透明)
    const w = 4 * N + 5 * NET_GAP, h = 3 * N + 4 * NET_GAP;
    expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
  });

  it('paints each facelet with its engine face colour (solved = 9 of each)', () => {
    const svg = exportSimNetSvg({ serialized: solvedSerialized(3), order: 3, faceColors: COLORS });
    for (const [, hex] of Object.entries(COLORS)) {
      const n = (svg.match(new RegExp(`fill="${hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) ?? []).length;
      expect(n).toBe(9);
    }
  });

  it('54 格逐格归属:serialize 任一格改字母 → 恰该格的 rect 换色,落在自己面的偏移处', () => {
    // 锁 URFDLB 块序 → cstimer 面序(D L B U R F)换算 + 行列直映(serialize 已是
    // net 朝向,不许再套 cstimer 的 L/B/D 镜像)。
    const N = 3;
    const solved = solvedSerialized(N);
    const base = exportSimNetSvg({ serialized: solved, order: N, faceColors: COLORS });
    const baseRects = base.match(/<rect [^>]*>/g)!;
    const offs = netFaceOffsets(N);
    for (let g = 0; g < 6 * N * N; g++) {
      const face = NET_FACE_ORDER[Math.floor(g / (N * N))];
      const probeLetter = face === 'U' ? 'B' : 'U'; // 换成必不同色的字母
      const mutated = solved.slice(0, g) + probeLetter + solved.slice(g + 1);
      const svg = exportSimNetSvg({ serialized: mutated, order: N, faceColors: COLORS });
      const rects = svg.match(/<rect [^>]*>/g)!;
      const changed = rects.map((r, i) => (r === baseRects[i] ? -1 : i)).filter((i) => i >= 0);
      expect(changed.length).toBe(1);
      const m = rects[changed[0]].match(/x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*fill="([^"]+)"/)!;
      const local = g % (N * N);
      const [ox, oy] = offs[face];
      expect(Number(m[1])).toBeCloseTo(ox + (local % N), 6);
      expect(Number(m[2])).toBeCloseTo(oy + Math.floor(local / N), 6);
      expect(m[3]).toBe(COLORS[probeLetter as NetFaceLetter]);
    }
  });

  it('U-face NW corner sits right of L and above F (unfolded cross geometry)', () => {
    const offs = netFaceOffsets(3);
    expect(offs.U[0]).toBeGreaterThan(offs.L[0]); // U 在 L 右侧
    expect(offs.U[1]).toBeLessThan(offs.F[1]);    // U 在 F 上方
    expect(offs.D[1]).toBeGreaterThan(offs.F[1]); // D 在 F 下方
  });

  it('greys masked net cells (key = `${face}:${row*N+col}`)', () => {
    const svg = exportSimNetSvg({
      serialized: solvedSerialized(3), order: 3, faceColors: COLORS,
      mask: { keys: new Set(['U:0', 'U:8']), color: '#888' },
    });
    expect((svg.match(/fill="#888"/g) ?? []).length).toBe(2);
  });
});
