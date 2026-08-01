/**
 * 递给 `requestDevice` 的那个选项字典。
 * =========================================================================
 *
 * 它是整条连接链上唯一一处「浏览器还没给你看任何东西就能把你拒掉」的地方 ——
 * iOS Bluefy 把 Web Bluetooth 桥到原生代码,过滤那一版直接以一个不透明的 `2`
 * 失败,选择器根本没弹出来。所以有了不带过滤的第二版。
 *
 * 这里钉三件事:
 *
 * 1. **两版的差别只在过滤**。`optionalServices` / `optionalManufacturerData`
 *    不参与填充选择器,它们授权的是选完之后能读什么;掉了的话,不管从哪一版选出
 *    来的设备都是废的(读不了 GATT service,也拿不到厂商数据里的 MAC)。
 * 2. **`acceptAllDevices` 那版不许带 `filters`**。规范里两者互斥,同时给会被抛
 *    TypeError —— 那样逃生通道自己就先坏了,而且坏在最需要它的浏览器上。
 * 3. **过滤那版两条路都在**:service UUID 一条,名字前缀一条。有的固件的广播包里
 *    压根没有数据 service,只能靠名字认。
 */

import { describe, it, expect } from 'vitest';

import { pickerOptions } from '@/app/[lang]/timer/_lib/bluetooth';

type Filtered = { filters: BluetoothLEScanFilter[] } & Record<string, unknown>;
type AcceptAll = { acceptAllDevices: boolean } & Record<string, unknown>;

const filtered = (): Filtered => pickerOptions(false) as Filtered;
const acceptAll = (): AcceptAll => pickerOptions(true) as AcceptAll;

describe('pickerOptions — 两版共有的授权部分', () => {
  it('两版都带 optionalServices,且非空', () => {
    for (const o of [filtered(), acceptAll()]) {
      const servs = o.optionalServices as string[] | undefined;
      expect(Array.isArray(servs)).toBe(true);
      expect(servs?.length).toBeGreaterThan(0);
    }
  });

  it('两版都带 optionalManufacturerData,且非空', () => {
    // GAN / 魔域 32 / 奇艺都要从广播里的厂商数据取 MAC 才能推出密钥。
    // 只在过滤那版给,会让逃生通道选出来的 GAN 永远解不开。
    for (const o of [filtered(), acceptAll()]) {
      const cics = o.optionalManufacturerData as number[] | undefined;
      expect(Array.isArray(cics)).toBe(true);
      expect(cics?.length).toBeGreaterThan(0);
      // CIC 是 16 位公司编号。
      for (const c of cics ?? []) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0xffff);
      }
    }
  });

  it('两版给的 optionalServices 完全一致 —— 差别只在过滤', () => {
    expect(acceptAll().optionalServices).toEqual(filtered().optionalServices);
    expect(acceptAll().optionalManufacturerData).toEqual(filtered().optionalManufacturerData);
  });

  it('optionalServices 里没有重复项', () => {
    const servs = filtered().optionalServices as string[];
    expect(new Set(servs).size).toBe(servs.length);
  });
});

describe('pickerOptions — 过滤版', () => {
  it('不带 acceptAllDevices', () => {
    expect('acceptAllDevices' in filtered()).toBe(false);
  });

  it('service 和 namePrefix 两条路都在', () => {
    const fs = filtered().filters;
    expect(fs.some(f => Array.isArray(f.services) && f.services.length > 0)).toBe(true);
    expect(fs.some(f => typeof f.namePrefix === 'string')).toBe(true);
  });

  it('每条过滤条件都至少有一个判据 —— 空条件规范里是非法的', () => {
    for (const f of filtered().filters) {
      const keys = Object.keys(f).filter(k => (f as Record<string, unknown>)[k] !== undefined);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it('过滤里出现的 service 全都在 optionalServices 里', () => {
    // 过滤只管「谁能进选择器」,optionalServices 才管「选完能不能读」。一个
    // service 只在前者出现,那个牌子就是选得中、连上之后读不了。
    const o = filtered();
    const servs = new Set(o.filters.flatMap(f => (f.services ?? []) as string[]));
    expect(servs.size).toBeGreaterThan(0);
    for (const s of servs) expect(o.optionalServices as string[]).toContain(s);
  });

  it('GAN 家族的名字前缀在', () => {
    const prefixes = filtered().filters
      .map(f => f.namePrefix)
      .filter((p): p is string => typeof p === 'string');
    expect(prefixes).toContain('GAN');
    // 魔域 32(威龙 V10 Ai 起)播成 `WCU_MY32_XXYY`。
    expect(prefixes).toContain('WCU');
  });
});

describe('pickerOptions — 逃生版', () => {
  it('acceptAllDevices 为 true', () => {
    expect(acceptAll().acceptAllDevices).toBe(true);
  });

  it('绝不同时带 filters —— 规范里互斥,同时给会抛 TypeError', () => {
    expect('filters' in acceptAll()).toBe(false);
  });
});
