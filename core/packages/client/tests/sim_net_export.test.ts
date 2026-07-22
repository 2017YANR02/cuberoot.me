// exportSimNetSvg:引擎驱动展开图(net)导出器。锁住十字布局 + 逐格上色 + 遮罩,
// 与交互式 _SimCubeNet 同一布局源(退役对照表 §2b「视图 net」)。
import { describe, it, expect } from 'vitest';
import {
  exportSimNetSvg, netFaceOffsets, NET_GAP, NET_FACE_ORDER,
} from '@/app/[lang]/sim/sim_net_export';

const COLORS = {
  U: '#fff', R: '#f00', F: '#0f0', D: '#ff0', L: '#f90', B: '#00f',
} as const;

/** 复原态 serialize:每块 N² 全该面字母(URFDLB 顺序)。 */
function solvedSerialized(N: number): string {
  return NET_FACE_ORDER.map((f) => f.repeat(N * N)).join('');
}

describe('exportSimNetSvg', () => {
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

  it('reflects a scrambled serialize (different output than solved)', () => {
    const solved = solvedSerialized(3);
    // 交换 U 面第 0 格与 F 面第 0 格的颜色字母 → net 必须跟着变。
    const scrambled = 'F' + solved.slice(1, 18) + 'U' + solved.slice(19);
    const a = exportSimNetSvg({ serialized: solved, order: 3, faceColors: COLORS });
    const b = exportSimNetSvg({ serialized: scrambled, order: 3, faceColors: COLORS });
    expect(b).not.toBe(a);
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
