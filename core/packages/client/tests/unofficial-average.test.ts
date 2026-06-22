import { describe, it, expect } from 'vitest';
import { unofficialAoN } from '@/lib/unofficial-average';

// 单位为 centiseconds;DNF=-1, DNS=-2, 占位=0
describe('unofficialAoN', () => {
  it('N=5 等价于 WCA Ao5(去一快一慢,取中间三个均值)', () => {
    expect(unofficialAoN([500, 600, 700, 800, 900])).toEqual({ value: 700, n: 5, trim: 1 });
  });

  it('有效次数 < min(默认 5)→ null', () => {
    expect(unofficialAoN([500, 600, 700])).toBeNull();
    expect(unofficialAoN([500, 600, 700, 800])).toBeNull();
    expect(unofficialAoN([])).toBeNull();
  });

  it('占位 0 被剔除,不计入 N', () => {
    expect(unofficialAoN([500, 600, 700, 800, 900, 0, 0])).toEqual({ value: 700, n: 5, trim: 1 });
    // 去掉 0 后只剩 4 个 → null
    expect(unofficialAoN([500, 600, 700, 800, 0])).toBeNull();
  });

  it('单个 DNF / DNS 在 N=5 时被去尾吃掉,仍有有效平均', () => {
    expect(unofficialAoN([500, 600, 700, 800, -1])).toEqual({ value: 700, n: 5, trim: 1 });
    expect(unofficialAoN([500, 600, 700, 800, -2])).toEqual({ value: 700, n: 5, trim: 1 });
  });

  it('失败次数 > trim → 整体 DNF(value=-1)', () => {
    expect(unofficialAoN([500, 600, 700, -1, -1])).toEqual({ value: -1, n: 5, trim: 1 });
  });

  it('trim = ceil(N×5%)', () => {
    expect(unofficialAoN(Array(12).fill(600))?.trim).toBe(1); // ceil(0.6)=1
    expect(unofficialAoN(Array(20).fill(600))?.trim).toBe(1); // ceil(1.0)=1
    expect(unofficialAoN(Array(21).fill(600))?.trim).toBe(2); // ceil(1.05)=2
    expect(unofficialAoN(Array(25).fill(600))?.trim).toBe(2); // ceil(1.25)=2
    expect(unofficialAoN(Array(100).fill(600))?.trim).toBe(5); // ceil(5)=5
  });

  it('Ao26(对阵决赛实例):去最快/最慢各 2,中间 22 取均', () => {
    const solves = [
      575, 657, 622, 483, 542, 601, 623, 602, 503, 583, 576, 678, 809, 524, 577,
      873, 523, 715, 565, 518, 861, 662, 628, 664, 648, 589,
    ];
    const r = unofficialAoN(solves);
    expect(r).not.toBeNull();
    expect(r!.n).toBe(26);
    expect(r!.trim).toBe(2);
    // 去掉最快 483,503 与最慢 873,861 后,余 22 个之和 = 13478 → /22 = 612.6 → round 613
    expect(r!.value).toBe(613);
  });

  it('四舍五入到 centisecond', () => {
    // [501,502,503,504,505] 去 501、505 → (502+503+504)/3 = 503
    expect(unofficialAoN([501, 502, 503, 504, 505])?.value).toBe(503);
    // [500,501,502,503,510] 去 500、510 → (501+502+503)/3 = 502
    expect(unofficialAoN([500, 501, 502, 503, 510])?.value).toBe(502);
  });
});
