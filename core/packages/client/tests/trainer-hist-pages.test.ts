import { describe, it, expect } from 'vitest';
import { histPageWindow } from '@/app/[lang]/alg/_trainer/trainer-components';

/**
 * 历史面板的页码窗口。要害只有一条:页数再多,渲染出来的格子数也得有上界 ——
 * 否则页码自己就成了第二片刷屏(正是加分页要躲的那件事)。
 */
describe('histPageWindow', () => {
  it('7 页以内全列,不折叠', () => {
    expect(histPageWindow(0, 1)).toEqual([0]);
    expect(histPageWindow(2, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(histPageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('页数再大,格子数也不超过 7', () => {
    for (const count of [8, 12, 50, 400]) {
      for (let cur = 0; cur < count; cur++) {
        expect(histPageWindow(cur, count).length).toBeLessThanOrEqual(7);
      }
    }
  });

  it('首页、末页、当前页永远在窗口里', () => {
    for (const count of [8, 12, 50, 400]) {
      for (let cur = 0; cur < count; cur++) {
        const w = histPageWindow(cur, count);
        expect(w).toContain(0);
        expect(w).toContain(count - 1);
        expect(w).toContain(cur);
      }
    }
  });

  it('页码严格递增,省略号只出现在真断开处', () => {
    for (const count of [8, 12, 50]) {
      for (let cur = 0; cur < count; cur++) {
        const w = histPageWindow(cur, count);
        for (let i = 1; i < w.length; i++) {
          const a = w[i - 1], b = w[i];
          if (typeof a === 'number' && typeof b === 'number') {
            // 相邻两个数字必须是连号,中间有跳号就该摆省略号
            expect(b).toBe(a + 1);
          }
        }
        // 省略号不挨着省略号,也不在首尾
        expect(w[0]).toBe(0);
        expect(w[w.length - 1]).toBe(count - 1);
        expect(w.some((x, i) => x === '…' && w[i + 1] === '…')).toBe(false);
      }
    }
  });

  it('贴边时窗口往里撑,不缩成三两个格子', () => {
    expect(histPageWindow(0, 12)).toEqual([0, 1, 2, 3, '…', 11]);
    expect(histPageWindow(11, 12)).toEqual([0, '…', 8, 9, 10, 11]);
    expect(histPageWindow(5, 12)).toEqual([0, '…', 4, 5, 6, '…', 11]);
  });
});
