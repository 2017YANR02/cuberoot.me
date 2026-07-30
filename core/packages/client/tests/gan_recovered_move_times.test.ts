/**
 * 从历史补齐回来的动作，时间戳怎么给。
 * =========================================================================
 *
 * GAN 的历史帧（0xD1）只说「丢的是哪一下」，不说「什么时候」。这里原先留空，
 * 理由写的是「不编造」—— 但留空在下游**不是没有数字**：`MoveClock` 会退回
 * 到达时间，也就是历史回复送到的那一刻。那一刻在这一下真正发生之后，甚至在
 * 触发补齐的那个**更晚**的动作之后。于是一次丢包会凭空造出一个停顿，再把紧
 * 跟着的真实间隔压成 0 —— 恰好是 TPS / 停顿 / 分阶段全都建立在上面的那个量。
 *
 * 补齐回来的这一下，确实发生在「上一个有时间的动作」和「下一个有时间的动作」
 * 之间。把这一段按个数均分：顺序对、总量对、误差被这段区间自己的长度框住。
 * 猜的只是**间隔分布**。上游做同一件事（`tsLinearFit`，用线性回归而不是均分；
 * 一次真实丢包只涉及两三下，两者答案一样）。
 *
 * 两端缺一个就仍然留空 —— 那种情况下连区间都没有，均分是无源之水。
 */
import { describe, it, expect } from 'vitest';
import { GanMoveSync, type GanMoveSyncHooks } from '@/app/[lang]/timer/_lib/bluetooth/gan_move_sync';
import { MoveClock } from '@/app/[lang]/timer/_lib/bluetooth/move_clock';

/** The sync object as a driver builds it, seeded from a facelets snapshot. */
function seeded(hooks: GanMoveSyncHooks = {}) {
  const sync = new GanMoveSync(hooks);
  sync.seed(0);
  return sync;
}

describe('history-recovered move timestamps', () => {
  it('interpolates a single recovered move to the midpoint of its interval', () => {
    const requested: Array<[number, number]> = [];
    const sync = seeded({ requestHistory: (s, n) => { requested.push([s, n]); } });

    expect(sync.push(1, 'U', 500_000)).toEqual([{ mv: 'U', ts: 500_000 }]);
    // Counter 2 never arrived: 3 is held and history is requested.
    expect(sync.push(3, 'F', 500_120)).toEqual([]);
    expect(requested.length).toBe(1);

    // The cube replies newest-first; only counter 2 fills the hole.
    const out = sync.injectHistory([{ cnt: 3, mv: 'F' }, { cnt: 2, mv: 'R' }]);
    expect(out.map((m) => m.mv)).toEqual(['R', 'F']);
    // 500_000 → 500_120 with one unknown in between: 500_060.
    expect(out[0].ts).toBe(500_060);
    // The move that was merely HELD keeps the timestamp its own frame carried.
    expect(out[1].ts).toBe(500_120);
  });

  it('spreads a run of recovered moves evenly', () => {
    const sync = seeded({ requestHistory: () => {} });
    sync.push(1, 'U', 1_000);
    expect(sync.push(5, 'B', 1_400)).toEqual([]);   // 2, 3, 4 all missing
    const out = sync.injectHistory([
      { cnt: 5, mv: 'B' }, { cnt: 4, mv: 'L' }, { cnt: 3, mv: 'D' }, { cnt: 2, mv: 'R' },
    ]);
    expect(out.map((m) => m.mv)).toEqual(['R', 'D', 'L', 'B']);
    // 400 ms of interval, four gaps: 100 ms each.
    expect(out.map((m) => m.ts)).toEqual([1_100, 1_200, 1_300, 1_400]);
  });

  it('keeps timestamps strictly increasing, which is what the fallback broke', () => {
    const sync = seeded({ requestHistory: () => {} });
    sync.push(1, 'U', 9_000);
    sync.push(4, 'F', 9_090);
    const out = sync.injectHistory([
      { cnt: 4, mv: 'F' }, { cnt: 3, mv: 'D' }, { cnt: 2, mv: 'R' },
    ]);
    const stamps = out.map((m) => m.ts!);
    expect(stamps).toHaveLength(3);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]).toBeGreaterThan(stamps[i - 1]);
    // …and inside the interval that actually contains them.
    expect(Math.min(...stamps)).toBeGreaterThan(9_000);
    expect(Math.max(...stamps)).toBeLessThanOrEqual(9_090);
  });

  it('leaves a recovered move blank when there is no interval to place it in', () => {
    // Nothing timed has been emitted yet, so there is no left-hand end. Making
    // one up would be inventing an interval out of nothing, which is the thing
    // interpolation is NOT allowed to do.
    const sync = seeded({ requestHistory: () => {} });
    sync.observe(2);
    const out = sync.injectHistory([{ cnt: 1, mv: 'R' }]);
    expect(out.map((m) => m.mv)).toEqual(['R']);
    expect(out[0].ts).toBeUndefined();
  });

  it('refuses to interpolate across a device counter that went backwards', () => {
    const sync = seeded({ requestHistory: () => {} });
    sync.push(1, 'U', 8_000);
    // A restarted / wrapped counter: the "next" reading is BEFORE the previous
    // one, so the two are not the ends of an interval at all.
    sync.push(4, 'F', 20);
    const out = sync.injectHistory([
      { cnt: 4, mv: 'F' }, { cnt: 3, mv: 'D' }, { cnt: 2, mv: 'R' },
    ]);
    expect(out.map((m) => m.mv)).toEqual(['R', 'D', 'F']);
    expect(out[0].ts).toBeUndefined();
    expect(out[1].ts).toBeUndefined();
    expect(out[2].ts).toBe(20);
  });

  it('carries the interval across batches, not just within one', () => {
    // The left-hand end came from an EARLIER notification. Forgetting it would
    // send every recovery that lands in its own batch down the blank path.
    const sync = seeded({ requestHistory: () => {} });
    sync.push(1, 'U', 200);
    sync.push(2, 'R', 300);       // separate batch, so `out` above is empty here
    expect(sync.push(4, 'F', 500)).toEqual([]);
    const out = sync.injectHistory([{ cnt: 4, mv: 'F' }, { cnt: 3, mv: 'D' }]);
    expect(out.map((m) => m.ts)).toEqual([400, 500]);
  });

  it('what this buys downstream: real intervals instead of a fabricated pause', () => {
    // The end-to-end shape. `MoveClock` maps device readings onto the local
    // clock, and a batch is delivered in one BLE notification, so every move in
    // it arrives at the same local instant.
    const clock = new MoveClock();
    const sync = seeded({ requestHistory: () => {} });

    const local0 = 10_000;
    const u = sync.push(1, 'U', 1_000);
    expect(clock.stamp(u[0].ts, local0)).toBe(local0);

    // Three turns at ~60 ms; the middle notification is lost, and the reply
    // lands 200 ms later — long after all three actually happened.
    sync.push(3, 'F', 1_120);
    const out = sync.injectHistory([{ cnt: 3, mv: 'F' }, { cnt: 2, mv: 'R' }]);
    const arrival = local0 + 320;
    const stamped = out.map((m) => clock.stamp(m.ts, arrival));

    // R at +60 ms, F at +120 ms — the real turn rate, recovered.
    expect(stamped).toEqual([local0 + 60, local0 + 120]);
    // The point of the exercise: neither move is placed at the arrival instant,
    // and the gap between them is a turn, not zero.
    expect(stamped[1] - stamped[0]).toBe(60);
    expect(stamped.every((t) => t < arrival)).toBe(true);
  });
});
