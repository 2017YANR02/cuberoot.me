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

import { CUBE_DRIVERS, pickerOptions } from '@/app/[lang]/timer/_lib/bluetooth';

type Filtered = { filters: BluetoothLEScanFilter[] } & Record<string, unknown>;
type AcceptAll = { acceptAllDevices: boolean } & Record<string, unknown>;

const filtered = (): Filtered => pickerOptions(false) as Filtered;
/** The Bluefy shape: same call, minus the service filters. */
const nameOnly = (): Filtered => pickerOptions(false, true) as Filtered;
const acceptAll = (): AcceptAll => pickerOptions(true) as AcceptAll;

const asDevice = (name: string): BluetoothDevice => ({ name }) as BluetoothDevice;

/** Does this name get past the chooser's filters? */
function reachesPicker(opts: Filtered, name: string): boolean {
  return opts.filters.some(f => typeof f.namePrefix === 'string' && name.startsWith(f.namePrefix));
}

const driverFor = (name: string): string | null =>
  CUBE_DRIVERS.find(d => d.matches(asDevice(name)))?.brand ?? null;

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

  it('名字前缀排在 service 前面', () => {
    // 只认前几条过滤的浏览器,该被留下的是认得出魔方的那半边。iOS Bluefy 就是
    // 一条 service 过滤下去整个列表就空了(见 pickerOptions 的注释)。
    const fs = filtered().filters;
    const lastName = fs.findLastIndex(f => typeof f.namePrefix === 'string');
    const firstServ = fs.findIndex(f => Array.isArray(f.services));
    expect(lastName).toBeGreaterThanOrEqual(0);
    expect(firstServ).toBeGreaterThan(lastName);
  });

  it('每个驱动声明的名字前缀都进了选择器', () => {
    const prefixes = new Set(filtered().filters
      .map(f => f.namePrefix)
      .filter((p): p is string => typeof p === 'string'));
    for (const d of CUBE_DRIVERS) {
      for (const p of d.namePrefixes) {
        expect(prefixes, `${d.brand} 的前缀 ${p} 没进选择器`).toContain(p);
      }
    }
  });
});

/**
 * 真机名字表。**这一条才是用户报的 bug**:2026-08-01 之前选择器的名字前缀是手写
 * 的五条(GAN / MG / AiCube / Gi / WCU),而 UI 上写着支持、`matches()` 里也认得的
 * GoCube、Rubik's Connected、奇艺、魔域 MHC 全不在里面 —— 它们只能靠 service 过滤
 * 进选择器,而 iOS Bluefy 上那条根本不管用。名字得从驱动来,不能再手写。
 *
 * 每个名字要过两关:进得了选择器,且进来之后有驱动认。少哪一关都是坏的 ——
 * 前者是「明明在旁边却不显示」,后者是「点了报『无法识别的智能魔方』」。
 */
describe('pickerOptions — 各家真机名字都能进选择器并配到驱动', () => {
  const NAMES: Array<[name: string, brand: string]> = [
    ['GAN16ui_C296', 'gan-v4'],         // 用户手上那颗,截图里的原名
    ['GAN356i_1234', 'gan-v3'],
    ['MG-1234', 'gan-v4'],
    ['AiCube_1234', 'gan-v4'],
    ['GoCube_1234', 'gocube'],
    ["Rubik's Connected", 'gocube'],
    ['QY-QYSC-1234', 'qiyi'],
    ['XMD-TornadoV4-i-1234', 'qiyi'],
    ['WCU_MY32_1A2B', 'moyu32'],
    ['MHC-1234', 'moyu'],
    ['Gi123456', 'giiker'],
    ['Mi Smart Magic Cube', 'giiker'],
    ['Hi-Cube1234', 'giiker'],
  ];

  for (const [name, brand] of NAMES) {
    it(`${name} → ${brand}`, () => {
      expect(reachesPicker(filtered(), name), '进不了选择器').toBe(true);
      expect(reachesPicker(nameOnly(), name), 'Bluefy 版进不了选择器').toBe(true);
      expect(driverFor(name)).toBe(brand);
    });
  }

  it('不相干的设备照样挡在外面 —— 过滤还是过滤', () => {
    // 用户截图里「显示全部蓝牙设备」那一版列出来的邻居,没名字的用标识符占位。
    for (const n of ['A280CF60-52A4-26AF-1DD6-B05BD643', 'iPhone', 'MacBook Pro']) {
      expect(reachesPicker(filtered(), n), `${n} 不该进选择器`).toBe(false);
    }
  });
});

/**
 * iOS Bluefy 版:名字前缀,别的什么都不带。
 *
 * 起因(2026-08-01,用户在 Bluefy 实测):带过滤那版每次都弹出选择器却一台都不列,
 * 连两寸外那颗名字明明匹配 `{namePrefix:'GAN'}` 的 GAN16ui 都不列;换 acceptAll
 * 同一台手机立刻列出四台,那颗就在里面。同机的 cstimer 能列、而且只列那一颗。
 * cstimer 的魔方选择器只发名字前缀(`servFilters` 只有 GAN 计时器声明,而计时器
 * 是另一个选择器),所以两边唯一的结构差别就是 service 过滤。
 */
describe('pickerOptions — Bluefy 版', () => {
  it('一条 service 过滤都不带', () => {
    for (const f of nameOnly().filters) {
      expect(f.services, '给 Bluefy 的过滤里出现了 service').toBeUndefined();
      expect(typeof f.namePrefix).toBe('string');
    }
  });

  it('名字前缀一条不少 —— 只去掉 service,不缩窄名字', () => {
    const names = (o: Filtered): (string | undefined)[] =>
      o.filters.map(f => f.namePrefix).filter(p => typeof p === 'string');
    expect(names(nameOnly())).toEqual(names(filtered()));
  });

  it('授权部分照旧 —— 少了就是选得中读不了', () => {
    expect(nameOnly().optionalServices).toEqual(filtered().optionalServices);
    expect(nameOnly().optionalManufacturerData).toEqual(filtered().optionalManufacturerData);
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
