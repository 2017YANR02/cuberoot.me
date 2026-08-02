/**
 * 每一个交给浏览器的 UUID,必须是完整 128 位小写字符串。
 * =========================================================================
 *
 * 回归的是一份跑了很久才定位的报告:iPhone + Bluefy 上,`requestDevice()` 直接以
 * 一个不透明的 `2` 失败,选择器根本不弹。同一台手机、同一颗 GAN16ui,cstimer.net
 * 一次就连上了。
 *
 * 差别只有一处:我们在 `optionalServices` 里传了 `0x180f`(标准电池服务的 16 位
 * 简写,一个 JS **数字**),cstimer 传的全是完整 128 位字符串。规范允许那个简写,
 * Chrome 也会替你展开 —— 但 Bluefy 是把 Web Bluetooth 桥到原生代码的,一个数字
 * 出现在它要 UUID 字符串的位置,整个调用就被拒了。
 *
 * 这个 bug 有两点特别难抓,所以值得钉死:
 *
 * 1. **它在 Chrome 上永远看不出来**,本机、CI、安卓全绿。
 * 2. **它污染的是两版选项**。为此加的 acceptAllDevices 逃生通道同样带
 *    `optionalServices`,所以逃生通道也一起挂 —— 反倒像是「过滤条件没问题」的
 *    伪证据。
 *
 * 所以这里不检查「电池服务写对了没」,而是检查**凡是会流向 requestDevice 的
 * UUID,一个数字都不许有**。
 */

import { describe, it, expect } from 'vitest';

import { pickerOptions } from '@/app/[lang]/timer/_lib/bluetooth';
import { BATTERY_SERVICE } from '@/app/[lang]/timer/_lib/bluetooth/driver';

/** 完整 128 位、小写、连字符分组。 */
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 16 位简写展开成完整形式的标准写法。 */
const canonical16 = (alias: number) =>
  `0000${alias.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;

describe('BATTERY_SERVICE', () => {
  it('是完整 128 位字符串,不是数字', () => {
    expect(typeof BATTERY_SERVICE).toBe('string');
    expect(BATTERY_SERVICE).toMatch(CANONICAL_UUID);
  });

  it('展开的正是 0x180f,没写错', () => {
    expect(BATTERY_SERVICE).toBe(canonical16(0x180f));
  });

  it('不是把数字硬转成字符串 —— String(0x180f) 是十进制 "6159"', () => {
    expect(BATTERY_SERVICE).not.toBe(String(0x180f));
    expect(BATTERY_SERVICE).not.toContain('6159');
  });
});

describe('requestDevice 选项里不许出现数字 UUID', () => {
  for (const [label, opts] of [
    ['过滤版', pickerOptions(false)],
    ['Bluefy 版', pickerOptions(false, true)],
    ['逃生版', pickerOptions(true)],
  ] as const) {
    describe(label, () => {
      it('optionalServices 全是完整 128 位小写字符串', () => {
        const servs = (opts as { optionalServices?: unknown[] }).optionalServices ?? [];
        expect(servs.length).toBeGreaterThan(0);
        for (const s of servs) {
          expect(typeof s, `${String(s)} 必须是字符串`).toBe('string');
          expect(s as string).toMatch(CANONICAL_UUID);
        }
      });

      it('filters 里的 service 同样全是完整 128 位小写字符串', () => {
        const filters = (opts as { filters?: { services?: unknown[] }[] }).filters ?? [];
        for (const f of filters) {
          for (const s of f.services ?? []) {
            expect(typeof s, `${String(s)} 必须是字符串`).toBe('string');
            expect(s as string).toMatch(CANONICAL_UUID);
          }
        }
      });
    });
  }

  it('optionalManufacturerData 相反 —— 那里规范要的就是数字(16 位公司编号)', () => {
    // 这条不是凑数:它划清界限,免得有人看到上面几条就把 CIC 也一起「修」成字符串。
    for (const opts of [pickerOptions(false), pickerOptions(true)]) {
      const cics = (opts as { optionalManufacturerData?: unknown[] }).optionalManufacturerData ?? [];
      expect(cics.length).toBeGreaterThan(0);
      for (const c of cics) {
        expect(typeof c).toBe('number');
        expect(Number.isInteger(c as number)).toBe(true);
        expect(c as number).toBeLessThanOrEqual(0xffff);
      }
    }
  });
});
