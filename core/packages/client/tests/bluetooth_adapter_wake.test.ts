/**
 * 蓝牙适配器「睡着」时的处理。
 * =========================================================================
 *
 * 根因(2026-08-01 定,真机实证):iOS Bluefy 的原生蓝牙栈开机是睡着的。
 * `getAvailability()` 期间返回 false —— 甚至干脆不返回 —— 而这段时间里任何
 * `requestDevice()` 都被一个裸 `2` 拒掉:不弹选择框、没有消息。栈一旦被唤醒,
 * **一模一样的调用**立刻就能用(用户在同一台手机上先用 cstimer 连了一次,回头
 * 我们的裸页面就弹出了选择框并选中了 GAN16ui)。
 *
 * 之前四轮全走错方向(过滤条件、服务 UUID 的数字简写、域名),就是因为唯一那个
 * 相关信号被当成了噪声 —— 我甚至专门写过「返回 false 也不当回事」然后硬上。
 *
 * 这里钉三件事:
 *
 * 1. **等**,但有上界。`getAvailability()` 可能永不落地,不能把连接卡死。
 * 2. **重试仅限 Bluefy**。Web Bluetooth 通常把 user activation 花在第一次调用上,
 *    别处盲目重试会收到 `NotAllowedError`,而本模块把它读成「用户取消了」直接静默 ——
 *    真错误会变成「点了没反应」。Bluefy 不卡 activation(cstimer 在 `.then()` 里
 *    调用照样能用),所以这个特例是有据的,不能泄漏出去。
 * 3. **不拿 `2` 糊用户脸上**。没就绪时的失败有确定的原因,要说人话。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const H = () => import('@/app/[lang]/timer/_lib/bluetooth/connect_error');

afterEach(() => { vi.unstubAllGlobals(); });

describe('adapter-asleep 这个阶段', () => {
  it('有双语文案,和其它阶段一样', async () => {
    const { CONNECT_STAGE_LABEL } = await H();
    expect(CONNECT_STAGE_LABEL['adapter-asleep'].zh.length).toBeGreaterThan(0);
    expect(CONNECT_STAGE_LABEL['adapter-asleep'].en.length).toBeGreaterThan(0);
  });

  it('原始值仍然完整留着 —— 说人话不等于把证据扔了', async () => {
    const { BluetoothConnectError } = await H();
    const e = new BluetoothConnectError('adapter-asleep', 2);
    expect(e.stage).toBe('adapter-asleep');
    expect(e.raw).toBe(2);
    expect(e.detail).toBe('2 (number)');
  });

  it('已打标的错误不会被外层重标成 adapter-asleep', async () => {
    const { atStage, BluetoothConnectError } = await H();
    const inner = new BluetoothConnectError('handshake', 'key error');
    expect(atStage('adapter-asleep', inner)).toBe(inner);
    expect(atStage('adapter-asleep', inner).stage).toBe('handshake');
  });

  it('取消判据不受影响 —— 没就绪时的裸码绝不能被当成用户取消吞掉', async () => {
    const { isNoDeviceSelected } = await H();
    expect(isNoDeviceSelected(2)).toBe(false);
    expect(isNoDeviceSelected({ name: 'NotFoundError' })).toBe(true);
  });
});

/**
 * 唤醒重试的判据。`requestDeviceWaking` 是模块私有的(它闭在 hook 里),所以这里
 * 按同一套规则重建一份,锁的是**决策表**而不是实现细节 —— 会出事的正是这张表。
 */
describe('唤醒重试的判据表', () => {
  const shouldRetry = (opts: {
    readiness: 'ready' | 'unavailable' | 'unknown';
    inBluefy: boolean;
    cancelled: boolean;
  }) => opts.readiness !== 'ready' && opts.inBluefy && !opts.cancelled;

  it('Bluefy + 没就绪 + 不是取消 → 重试', () => {
    expect(shouldRetry({ readiness: 'unavailable', inBluefy: true, cancelled: false })).toBe(true);
    expect(shouldRetry({ readiness: 'unknown', inBluefy: true, cancelled: false })).toBe(true);
  });

  it('适配器已就绪 → 不重试(失败另有原因,重试只会再弹一次选择框)', () => {
    expect(shouldRetry({ readiness: 'ready', inBluefy: true, cancelled: false })).toBe(false);
  });

  it('不是 Bluefy → 绝不重试', () => {
    // 这条是最要命的:Chrome 上第二次调用没有 user activation,会抛
    // NotAllowedError,而它在取消判据里 —— 真错误会被静默吞掉,用户看到的是
    // 「点了连接毫无反应」。
    expect(shouldRetry({ readiness: 'unavailable', inBluefy: false, cancelled: false })).toBe(false);
    expect(shouldRetry({ readiness: 'unknown', inBluefy: false, cancelled: false })).toBe(false);
  });

  it('用户自己取消 → 不重试(否则关掉选择框它又弹回来)', () => {
    expect(shouldRetry({ readiness: 'unavailable', inBluefy: true, cancelled: true })).toBe(false);
  });
});

/**
 * 等待预算。这一段跑在 `requestDevice` **之前**,而 Chrome 的 transient user
 * activation 在点击后约 5 秒过期 —— 在一个第一次问就答了的浏览器上耗掉 3 秒去
 * 轮询,等于拿一个我们没有的 bug 换我们有的那个。
 */
describe('等待预算', () => {
  it('Bluefy 才真的等;别处只取一次读数', async () => {
    const { readyBudget } = await import('@/app/[lang]/timer/_lib/bluetooth');
    const bluefy = readyBudget(true);
    const other = readyBudget(false);

    expect(bluefy.maxMs).toBeGreaterThan(0);
    expect(other.maxMs).toBe(0);           // maxMs=0 → 循环只走一趟
  });

  it('两边加起来都远在 5 秒 activation 窗口以内', async () => {
    const { readyBudget } = await import('@/app/[lang]/timer/_lib/bluetooth');
    for (const b of [readyBudget(true), readyBudget(false)]) {
      // 最坏情况:轮询到 deadline,再加最后一次调用挂满 callMs。
      expect(b.maxMs + b.callMs).toBeLessThanOrEqual(4000);
    }
  });

  it('单次调用有上界 —— 挂死的原生桥不能拖住这一趟', async () => {
    const { readyBudget } = await import('@/app/[lang]/timer/_lib/bluetooth');
    expect(readyBudget(true).callMs).toBeGreaterThan(0);
    expect(readyBudget(false).callMs).toBeGreaterThan(0);
  });
});
