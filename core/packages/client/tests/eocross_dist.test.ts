/**
 * EOCross 精确分布的护栏。
 *
 * 这份分布不是从表格抄的:`computeEoCrossDist()` 用站内棱层模型现场 BFS 全部 24,330,240 个态
 * (约 7 秒),逐档与常量对上;表格 `3x3.xlsx / dist / fixed eocross` 只是外部锚点。
 * 第二件事更硬:`10f eocross 140` 那 140 条打乱,落到的状态必须**恰好**是 BFS 里 d=10 的那 140 个
 * —— 双向覆盖,不多不少。
 */
import { describe, expect, it } from 'vitest';
import {
  EO_CROSS_EO, EO_CROSS_HIST, EO_CROSS_MAX, EO_CROSS_MEAN, EO_CROSS_POS, EO_CROSS_TOTAL,
  computeEoCrossDist, eoCrossAltAxisIndex, eoCrossIndex,
} from '@/lib/eocross-dist';
import AXIS_GOLDEN from './fixtures/eo_cross_axis_golden.json';
import {
  EOCROSS_10F, EOCROSS_10F_BOTH_AXES, EOCROSS_10F_TOTAL,
} from '@/app/[lang]/scramble/hardest/_data/eocross_10f';
import { EXACT_DIST } from '@/app/[lang]/scramble/stats/_data/exact_dist';
import type { ExactFull } from '@/app/[lang]/scramble/stats/_data/exact_dist';

const { dist, hist } = computeEoCrossDist();

describe('EOCross:全空间', () => {
  it('两种数法给同一个 24,330,240', () => {
    expect(EO_CROSS_POS).toBe(12 * 11 * 10 * 9);
    expect(EO_CROSS_EO).toBe(2 ** 11);
    expect(EO_CROSS_POS * EO_CROSS_EO).toBe(EO_CROSS_TOTAL);
    // 十字那 190,080 个态 × 余下 8 条棱的朝向 2⁷ —— 同一个数
    expect(190_080 * 2 ** 7).toBe(EO_CROSS_TOTAL);
  });

  it('BFS 逐档与常量相同,且全空间可达', () => {
    expect(hist).toEqual([...EO_CROSS_HIST]);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(EO_CROSS_TOTAL);
    expect(hist.length - 1).toBe(EO_CROSS_MAX);
    expect(hist[0]).toBe(1);                       // 目标态只有一个
  });

  it('平均步数 7.530829494(表格给到 9 位小数,逐位相同)', () => {
    const sum = hist.reduce((a, n, d) => a + n * d, 0);
    expect(sum / EO_CROSS_TOTAL).toBeCloseTo(EO_CROSS_MEAN, 9);
  });

  it('分布单调增到峰值再单调减', () => {
    const peak = hist.indexOf(Math.max(...hist));
    for (let d = 1; d <= peak; d++) expect(hist[d]).toBeGreaterThan(hist[d - 1]);
    for (let d = peak + 1; d < hist.length; d++) expect(hist[d]).toBeLessThan(hist[d - 1]);
  });

  it('EOCross 至少和十字一样难:每一档的累积占比都不超过十字', () => {
    const cross = (EXACT_DIST.cross.unfixed!.W as ExactFull).counts.map(Number);
    const crossTotal = Number((EXACT_DIST.cross.unfixed!.W as ExactFull).total);
    let a = 0;
    let b = 0;
    for (let d = 0; d < cross.length; d++) {
      a += hist[d] ?? 0;
      b += cross[d];
      expect(a / EO_CROSS_TOTAL).toBeLessThanOrEqual(b / crossTotal);
    }
  });
});

describe('EOCross:10 步的那 140 个态', () => {
  it('140 条打乱都是 10 步、都落在 d=10、彼此不同', () => {
    expect(EOCROSS_10F_TOTAL).toBe(140);
    const seen = new Set<number>();
    for (const scramble of EOCROSS_10F) {
      expect(scramble.trim().split(/\s+/).length).toBe(10);
      const idx = eoCrossIndex(scramble);
      expect(idx, scramble).not.toBeNull();
      expect(dist[idx!], scramble).toBe(10);
      seen.add(idx!);
    }
    expect(seen.size).toBe(140);
  });

  it('覆盖 d=10 那一档的全部状态 —— 是穷尽,不是精选', () => {
    const deep = new Set<number>();
    for (let i = 0; i < EO_CROSS_TOTAL; i++) if (dist[i] === 10) deep.add(i);
    expect(deep.size).toBe(hist[10]);
    expect(deep.size).toBe(140);
    const seen = new Set(EOCROSS_10F.map((s) => eoCrossIndex(s)!));
    for (const idx of deep) expect(seen.has(idx)).toBe(true);
  });
});

describe('EOCross:固定轴 ≠ 站内真题那列', () => {
  // 底面定死后 EO 的轴还剩两条(F/B 与 L/R,差一个 y 旋转)。本站精确集固定一条;
  // 而 WCA 真题那列出自 Rust eo_cross_analyzer,`fold_cross_sym_to_rot` 两两取 min。
  // fixture = solver/testdata 的 100 条打乱 + golden CSV 的 eo_cross_z0(黄)/ z2(白)。
  const distWhite = computeEoCrossDist('White').dist;
  const tableOf = { Yellow: dist, White: distWhite } as const;

  it('白底与黄底同一条分布 —— 精确集把这格挂在 W 下才成立', () => {
    expect(computeEoCrossDist('White').hist).toEqual([...EO_CROSS_HIST]);
  });

  it('两条轴取 min:100 条 × 2 底色逐格对上管道 golden', () => {
    for (const row of AXIS_GOLDEN) {
      for (const face of ['Yellow', 'White'] as const) {
        const a = tableOf[face][eoCrossIndex(row.scramble, face)!];
        const b = tableOf[face][eoCrossAltAxisIndex(row.scramble, face)!];
        expect(Math.min(a, b), `${row.id} ${face}`).toBe(row[face]);
      }
    }
  });

  it('那 140 条换一条轴读:139 条掉到 6–9 步,只剩 1 条两条轴都 10 步', () => {
    const hist: Record<number, number> = {};
    for (const scramble of EOCROSS_10F) {
      const d = dist[eoCrossAltAxisIndex(scramble)!];
      hist[d] = (hist[d] ?? 0) + 1;
    }
    expect(hist).toEqual({ 6: 1, 7: 10, 8: 74, 9: 54, 10: 1 });
    // 那唯一一条要与页面引用的常量是同一条 —— 页面不许自己抄一份。
    expect(dist[eoCrossAltAxisIndex(EOCROSS_10F_BOTH_AXES)!]).toBe(10);
    expect(EOCROSS_10F).toContain(EOCROSS_10F_BOTH_AXES);
  });

  it('固定轴对不上:黄底 66/100、白底 84/100,且从不更短', () => {
    let hitY = 0;
    let hitW = 0;
    for (const row of AXIS_GOLDEN) {
      for (const face of ['Yellow', 'White'] as const) {
        const fixed = tableOf[face][eoCrossIndex(row.scramble, face)!];
        expect(fixed, `${row.id} ${face}`).toBeGreaterThanOrEqual(row[face]);
        if (fixed === row[face]) { if (face === 'Yellow') hitY++; else hitW++; }
      }
    }
    expect(hitY).toBe(66);
    expect(hitW).toBe(84);
  });
});

describe('EOCross:进了精确集', () => {
  it('exact_dist 的 eo_cross 格与本文件同源', () => {
    const cell = EXACT_DIST.eo_cross.unfixed!.W as ExactFull;
    expect(cell.kind).toBe('full');
    expect(cell.total).toBe(String(EO_CROSS_TOTAL));
    expect(cell.counts.map(Number)).toEqual([...EO_CROSS_HIST]);
  });
});
