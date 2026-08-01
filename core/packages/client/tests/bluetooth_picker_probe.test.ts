/**
 * 选择器不肯弹时的二分探针。
 * =========================================================================
 *
 * 背景:iOS Bluefy 上 `requestDevice()` 以一个裸 `2` 失败,选择器根本不出现。
 * 之前三轮都是「改一个变量 → 用户实测 → 还是 2」,每轮一次部署一次往返,只验证
 * 一个猜测。探针把这些猜测一次问完。
 *
 * 关键约定:**选择器弹出来又被取消,算成功**。浏览器把选择器弹出来再被取消,抛的
 * 是 `NotFoundError`;而根本不肯弹的,抛的是别的东西。所以用户每一级都点「取消」
 * 就行 —— 不用选设备,也不会连上任何东西。
 *
 * 钉住的是探针本身的判据(它是诊断工具,判错方向比不诊断更糟):
 *
 * 1. 取消 = 弹出了,不能报成失败;
 * 2. 第一个被拒的那级就是答案,后面全是它的超集,继续问只会白让用户多点几次;
 * 3. 每一级只比上一级多一样东西,否则「第一个被拒的那级」指不准。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { probePicker } from '@/app/[lang]/timer/_lib/bluetooth/picker_probe';

type Opts = {
  acceptAllDevices?: boolean;
  optionalServices?: string[];
  optionalManufacturerData?: number[];
  filters?: unknown[];
};

/** 装一个假的 navigator.bluetooth,requestDevice 由 impl 决定。 */
function stubBluetooth(impl: (o: Opts) => Promise<unknown>): Opts[] {
  const seen: Opts[] = [];
  const requestDevice = (o: Opts) => { seen.push(o); return impl(o); };
  vi.stubGlobal('navigator', { bluetooth: { requestDevice } });
  return seen;
}

const cancelled = () => Promise.reject(new DOMException('cancelled', 'NotFoundError'));
const nativeRefusal = () => Promise.reject(2);

afterEach(() => { vi.unstubAllGlobals(); });

describe('probePicker', () => {
  it('取消算「弹出了」—— 全程取消要走完整条梯子', async () => {
    const seen = stubBluetooth(cancelled);
    const steps = await probePicker();
    expect(steps).toHaveLength(4);
    expect(steps.every(s => s.outcome === 'opened')).toBe(true);
    expect(seen).toHaveLength(4);
  });

  it('停在第一个被拒的那级,不再往下问', async () => {
    const seen = stubBluetooth(o => (o.optionalServices ? nativeRefusal() : cancelled()));
    const steps = await probePicker();
    expect(steps).toHaveLength(2);
    expect(steps[0].outcome).toBe('opened');
    expect(steps[1].outcome).toBe('refused');
    expect(steps[1].detail).toBe('2 (number)');
    // 第 3、4 级是第 2 级的超集,问了也是同样答案,只会多让用户点两次。
    expect(seen).toHaveLength(2);
  });

  it('最小调用就被拒时,一级就收工', async () => {
    const seen = stubBluetooth(nativeRefusal);
    const steps = await probePicker();
    expect(steps).toHaveLength(1);
    expect(steps[0].outcome).toBe('refused');
    expect(seen).toHaveLength(1);
  });

  it('过滤条件才是元凶时,指到最后一级', async () => {
    stubBluetooth(o => (o.filters ? nativeRefusal() : cancelled()));
    const steps = await probePicker();
    expect(steps).toHaveLength(4);
    expect(steps.slice(0, 3).every(s => s.outcome === 'opened')).toBe(true);
    expect(steps[3].outcome).toBe('refused');
  });

  it('梯子每级只加一样东西 —— 否则「第一个被拒的那级」指不准', async () => {
    const seen = stubBluetooth(cancelled);
    await probePicker();
    const [bare, withServs, withCics, filtered] = seen;

    expect(bare.acceptAllDevices).toBe(true);
    expect(bare.optionalServices).toBeUndefined();
    expect(bare.optionalManufacturerData).toBeUndefined();
    expect(bare.filters).toBeUndefined();

    expect(withServs.optionalServices?.length).toBeGreaterThan(0);
    expect(withServs.optionalManufacturerData).toBeUndefined();

    expect(withCics.optionalServices).toEqual(withServs.optionalServices);
    expect(withCics.optionalManufacturerData?.length).toBeGreaterThan(0);

    // 最后一级把 acceptAllDevices 换成 filters,其余与上一级相同。
    expect(filtered.acceptAllDevices).toBeUndefined();
    expect(filtered.filters?.length).toBeGreaterThan(0);
    expect(filtered.optionalServices).toEqual(withCics.optionalServices);
    expect(filtered.optionalManufacturerData).toEqual(withCics.optionalManufacturerData);
  });

  it('选中了设备也算弹出了,并记下名字', async () => {
    stubBluetooth(() => Promise.resolve({ name: 'GAN16ui_C296' }));
    const steps = await probePicker();
    expect(steps[0].outcome).toBe('opened');
    expect(steps[0].detail).toBe('GAN16ui_C296');
  });

  it('没有 Web Bluetooth 时返回空,不抛', async () => {
    vi.stubGlobal('navigator', {});
    await expect(probePicker()).resolves.toEqual([]);
  });
});
