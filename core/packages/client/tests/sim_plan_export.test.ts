// exportSimPlanSvg:引擎驱动俯视 OLL 图(U 面 N×N + F/B/L/R 顶排侧带)。锁住结构 +
// 侧带面归属;朝向/左右序经 Playwright 单移动(R)对真机核验(退役对照表 §2b「视图 plan」)。
import { describe, it, expect } from 'vitest';
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

describe('exportSimPlanSvg', () => {
  it('draws U (N²) + 4 side bands (N each) = N²+4N rects, square viewBox', () => {
    for (const N of [2, 3, 4]) {
      const svg = exportSimPlanSvg({ serialized: solvedSerialized(N), order: N, faceColors: COLORS });
      expect((svg.match(/<rect /g) ?? []).length).toBe(N * N + 4 * N);
      const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      expect(m).toBeTruthy();
      expect(m![1]).toBe(m![2]); // 方形
    }
  });

  it('solved: white U centre (N²) + one solid band per adjacent face (N each)', () => {
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
    // 逐 rect 解析 y;蓝(B)最小 y(最上)、绿(F)最大 y(最下)。
    const ys: Record<string, number[]> = {};
    for (const m of svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)"[^>]*fill="([^"]+)"/g)) {
      (ys[m[2]] ??= []).push(parseFloat(m[1]));
    }
    const minY = (c: string) => Math.min(...ys[c]);
    const maxY = (c: string) => Math.max(...ys[c]);
    expect(minY('#00f')).toBeLessThan(minY('#fff')); // B 在 U 之上
    expect(maxY('#0f0')).toBeGreaterThan(maxY('#fff')); // F 在 U 之下
  });
});
