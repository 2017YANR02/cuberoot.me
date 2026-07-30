/**
 * 序号宽度:GAN 的移动帧和历史回放不是同一个位宽。
 * =========================================================================
 *
 * 移动事件里的 `moveCnt` 是 **16 位**(`gan_v4.ts:295`、`gan_v3.ts` 同),历史回放
 * 里的 `startMoveCnt` 只有 **8 位**(`gan_v4.ts:330`)。`GanMoveSync` 内部所有的
 * 比较都带 `& 0xff`,所以「差多少」一直是对的 —— 但存进 `prevMoveCnt` 的是原值。
 * 一旦补帧结束在一条历史移动上,`prevMoveCnt` 就变成了 8 位数,而下一条实况移动
 * 还是 16 位。此时 `push()` 里唯一那道去重
 *
 *     if (moveCnt === this.prevMoveCnt) return [];
 *
 * 比的是原值,`302 === 46` 不成立 —— 重复的那条通知被放进缓冲,`evict()` 算出
 * `diff = (302 - 46) & 0xff = 0`,不满足 `diff > 1`,于是**同一步被应用第二次**。
 *
 * 症状:一次 90 度被记成 180 度,之后跟踪状态永久偏一步,打乱校验、自动停表、
 * 实况魔方图全部跟着错 —— 而且是「从那一下起每一步都不对」。
 *
 * 修法是把序号空间统一成 8 位(入口就 `& 0xff`),两边宽度一致后原有的去重自然
 * 成立;`evict()` 里再补一道 `diff === 0` 的防线,因为在 8 位空间里它只可能是
 * 「和上一条同号」。
 */
import { describe, it, expect } from 'vitest';

import { GanMoveSync } from '@/app/[lang]/timer/_lib/bluetooth/gan_move_sync';

describe('GanMoveSync 的序号宽度', () => {
  it('补帧之后重复的实况通知不能被当成新的一步', () => {
    const requested: Array<[number, number]> = [];
    const sync = new GanMoveSync({
      requestHistory: (start, num) => { requested.push([start, num]); },
    });

    // 魔方连上时计数器已经跑到 300(16 位)。
    sync.seed(300);

    // 301 正常到达。
    expect(sync.push(301, 'R', 1000).map(m => m.mv)).toEqual(['R']);

    // 302 的通知丢了,303 先到 —— FIFO 认出缺口,去要历史。
    expect(sync.push(303, 'F', 1200)).toEqual([]);
    expect(requested.length).toBe(1);

    // 历史回复带的是 8 位序号:303 & 0xff = 47,302 & 0xff = 46。
    // 最新在前,和魔方发的顺序一致。
    const out = sync.injectHistory([
      { cnt: 47, mv: 'F' },
      { cnt: 46, mv: 'U' },
    ]);
    expect(out.map(m => m.mv)).toEqual(['U', 'F']);

    // 现在 BLE 把 302 这条又送了一遍(重传浮到应用层)。它早就补过了,
    // 必须原样丢掉 —— 放行就等于凭空多转了一个 90 度。
    expect(sync.push(302, 'U', 1150)).toEqual([]);
  });

  it('同一条移动重复到达,不管补没补过帧都只算一次', () => {
    const sync = new GanMoveSync();
    sync.seed(0x1ff);
    expect(sync.push(0x200, 'R').map(m => m.mv)).toEqual(['R']);
    expect(sync.push(0x200, 'R')).toEqual([]);          // 同号原值
    expect(sync.push(0x100, 'R')).toEqual([]);          // 同号、不同位宽
  });

  it('正常的连续移动不受影响', () => {
    const sync = new GanMoveSync();
    sync.seed(0xfe);
    expect(sync.push(0xff, 'R').map(m => m.mv)).toEqual(['R']);
    // 8 位空间自然回绕,下一条是 0x100 ≡ 0。
    expect(sync.push(0x100, 'U').map(m => m.mv)).toEqual(['U']);
    expect(sync.push(0x101, 'F').map(m => m.mv)).toEqual(['F']);
    expect(sync.counter).toBe(0x101 & 0xff);
  });
});
