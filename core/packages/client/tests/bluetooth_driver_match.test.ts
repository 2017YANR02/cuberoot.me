/**
 * 名字兜底认型号 —— `CubeDriver.matches()` 的边界。
 * =========================================================================
 *
 * 正常路径不走名字:连上之后读 GATT service UUID 选驱动(`_lib/bluetooth/index.ts`
 * 的 connect)。名字这条只在 `getPrimaryServices()` 失败时用得上,可它恰恰是那种
 * 「平时看不出坏没坏、真要用的时候才发现认不出」的代码,所以边界钉在这里。
 *
 * 钉的是两件事:
 *
 * 1. **v3 / v4 的分界**。两家都以 `GAN` 开头,靠 356/i 前缀与两位数 ui 型号分开;v4 那条
 *    的 `(?!356)` 前瞻一旦写反,GAN 356 会被 v4 抢走,而 v4 是另一套加密和另一套
 *    事件号 —— 抢走之后不是不解码,是解出垃圾。
 *
 * 2. **新型号不该逐个补**。GAN 16 ui 出来的时候没人改代码,而它跟 12/14 是同一代
 *    协议,service UUID 一样 —— 正常路径本来就认得。所以兜底写成 `1[2-9]`,让它
 *    跟正常路径同一个口径,而不是慢半年。
 */

import { describe, it, expect } from 'vitest';

import { ganV3Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v3';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';

/** `matches()` 只读 `device.name`,所以喂一个只有名字的壳就够。 */
const named = (name: string) => ({ name } as BluetoothDevice);

describe('GAN 名字兜底', () => {
  it('356 家族归 v3,不被 v4 抢走', () => {
    for (const n of ['GAN-356i', 'GAN356 i3', 'GANi Carry']) {
      expect(ganV3Driver.matches(named(n)), n).toBe(true);
      expect(ganV4Driver.matches(named(n)), n).toBe(false);
    }
    expect(ganV3Driver.matches(named('GAN-357'))).toBe(false);
    expect(ganV4Driver.matches(named('GAN-357'))).toBe(false);
  });

  it('两位数编号归 v4 —— 含发布时代码里还没写过的型号', () => {
    for (const n of ['GAN12ui', 'GAN-14 ui FreePlay', 'GAN16 ui', 'GAN-19', 'GANMini Pro', 'MG-abc', 'AiCube-1']) {
      expect(ganV4Driver.matches(named(n)), n).toBe(true);
      expect(ganV3Driver.matches(named(n)), n).toBe(false);
    }
  });

  it('无名设备两边都不认(交给 service UUID 那条路)', () => {
    expect(ganV3Driver.matches({} as BluetoothDevice)).toBe(false);
    expect(ganV4Driver.matches({} as BluetoothDevice)).toBe(false);
  });
});
