/**
 * `forEachYielding` —— 长构建循环的让路。
 * =========================================================================
 *
 * 起因(2026-08-01,CDP profile 实测):点「查看复盘」后面板画出来了却拖不动
 * 进度条。栈根指向 `oll_lookup` / `pll_lookup` 的 `buildTable()` —— 打开那一刻
 * 才现拉公式库,再把每条公式 × 每个变体 × 每个 AUF 过一遍 cubing.js,约四千次
 * alg 解析**全在一个不中断的同步循环里**。实测最长单次主线程占用 402ms,总阻塞
 * 506ms,持续到 1285ms。手机上 CPU 慢几倍,就是用户说的「卡几秒」。
 *
 * 这里钉两件容易写错的事:
 *
 * 1. **真的让出事件循环**。`await Promise.resolve()` 是微任务,不出当前宏任务,
 *    循环该多长还多长 —— 看着像修了,其实一点没变。必须是 `setTimeout`。
 * 2. **遍历结果不能变**。让路是性能改动,不是行为改动;顺序、次数、下标都得和
 *    原来的 for 循环一模一样,否则查找表会悄悄少条目。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { forEachYielding } from '@/lib/build-yield';

afterEach(() => { vi.useRealTimers(); });

describe('forEachYielding', () => {
  it('每一项都跑到,顺序和下标与 for 循环一致', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const seen: Array<[string, number]> = [];
    await forEachYielding(items, (x, i) => { seen.push([x, i]); });
    expect(seen).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4]]);
  });

  it('空数组直接返回,不抛', async () => {
    await expect(forEachYielding([], () => { throw new Error('不该被调用'); })).resolves.toBeUndefined();
  });

  it('回调抛错会传出来 —— 让路不等于吞异常', async () => {
    await expect(
      forEachYielding([1, 2, 3], (n) => { if (n === 2) throw new Error('boom'); }),
    ).rejects.toThrow('boom');
  });

  it('确实让出了宏任务:让路期间排队的 setTimeout 能插进来', async () => {
    // 这一条是全文件的重点。让路如果写成 await Promise.resolve(),下面这个
    // timer 只会在整个循环跑完之后才触发 —— 主线程照样被占满。
    const order: string[] = [];
    setTimeout(() => order.push('timer'), 0);

    await forEachYielding(Array.from({ length: 400 }, (_, i) => i), () => {
      // 烧掉足够时间越过 SLICE_MS,逼出至少一次让路。
      const until = Date.now() + 1;
      while (Date.now() < until) { /* burn */ }
      order.push('work');
    });

    expect(order).toContain('timer');
    expect(order.indexOf('timer')).toBeLessThan(order.length - 1);
  });

  it('活儿很短就不必让路(短表不该白付调度开销)', async () => {
    let after = false;
    setTimeout(() => { after = true; }, 0);
    await forEachYielding([1, 2, 3], () => { /* 瞬间完成 */ });
    // 三次瞬时回调凑不满一个时间片,整段应当在同一个宏任务里跑完。
    expect(after).toBe(false);
  });
});
