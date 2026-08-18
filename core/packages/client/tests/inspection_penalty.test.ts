/**
 * 观察超时判罚(WCA A4b/A4d)的边界。
 *
 * 这里全是边界:15.000 不罚、15.001 罚 +2、17.000 还是 +2、17.001 才 DNF。
 * 判罚看的是**起表那一刻**的观察用时,不是倒计时后来跑到了哪 —— 智能魔方那条路
 * 起表由第一下转动触发,所以这个量必须由魔方的时间戳决定。
 *
 * 与 csTimer 对齐:`timer/giiker.js:173` 是
 * `insTime > 17000 ? -1 : (insTime > 15000 ? 2000 : 0)`,严格大于,15 秒限制硬编码。
 * 我们把 15 换成设置里的值,规则同构。
 */
import { describe, it, expect } from 'vitest';
import { formatInspectionDisplay, inspectionPenalty } from '@/app/[lang]/timer/_shared/inspection';

const WCA = 15;

describe('inspectionPenalty', () => {
  it('does not penalise inside the limit', () => {
    expect(inspectionPenalty(0, WCA)).toBe('ok');
    expect(inspectionPenalty(1, WCA)).toBe('ok');
    expect(inspectionPenalty(8_000, WCA)).toBe('ok');
    expect(inspectionPenalty(14_999, WCA)).toBe('ok');
  });

  it('treats the limit itself as inside it', () => {
    // 恰好 15.000 秒起表不罚 —— csTimer 用的也是严格大于。
    expect(inspectionPenalty(15_000, WCA)).toBe('ok');
    expect(inspectionPenalty(15_001, WCA)).toBe('+2');
  });

  it('gives +2 up to and including limit + 2s', () => {
    expect(inspectionPenalty(16_000, WCA)).toBe('+2');
    expect(inspectionPenalty(17_000, WCA)).toBe('+2');
    expect(inspectionPenalty(17_001, WCA)).toBe('DNF');
  });

  it('DNFs a long overrun', () => {
    expect(inspectionPenalty(20_000, WCA)).toBe('DNF');
    expect(inspectionPenalty(120_000, WCA)).toBe('DNF');
  });

  it('never penalises when inspection is off', () => {
    // limit 0 = 不用观察。这条很重要:我们的默认设置就是 0,而智能魔方那条路
    // 现在会把「上一把结束到这一把起表」之间的时间当观察用时传进来。
    expect(inspectionPenalty(0, 0)).toBe('ok');
    expect(inspectionPenalty(60_000, 0)).toBe('ok');
    expect(inspectionPenalty(60_000, -1)).toBe('ok');
  });

  it('scales with a shorter configured inspection', () => {
    expect(inspectionPenalty(8_000, 8)).toBe('ok');
    expect(inspectionPenalty(8_001, 8)).toBe('+2');
    expect(inspectionPenalty(10_000, 8)).toBe('+2');
    expect(inspectionPenalty(10_001, 8)).toBe('DNF');
  });

  it('refuses to read a penalty out of a nonsense number', () => {
    // 负数 / NaN 只可能来自算错的差值。宁可不罚,也不能凭垃圾数据判 DNF。
    expect(inspectionPenalty(-1, WCA)).toBe('ok');
    expect(inspectionPenalty(Number.NaN, WCA)).toBe('ok');
    expect(inspectionPenalty(Number.POSITIVE_INFINITY, WCA)).toBe('ok');
  });
});

describe('formatInspectionDisplay', () => {
  it('counts up from zero in whole elapsed seconds', () => {
    expect(formatInspectionDisplay(0, WCA)).toBe('0');
    expect(formatInspectionDisplay(999, WCA)).toBe('0');
    expect(formatInspectionDisplay(1_000, WCA)).toBe('1');
    expect(formatInspectionDisplay(14_999, WCA)).toBe('14');
    expect(formatInspectionDisplay(15_000, WCA)).toBe('15');
  });

  it('uses the canonical strict penalty boundaries', () => {
    expect(formatInspectionDisplay(15_001, WCA)).toBe('+2');
    expect(formatInspectionDisplay(17_000, WCA)).toBe('+2');
    expect(formatInspectionDisplay(17_001, WCA)).toBe('DNF');
  });

  it('normalizes invalid and disabled inspection input', () => {
    expect(formatInspectionDisplay(-1, WCA)).toBe('0');
    expect(formatInspectionDisplay(Number.NaN, WCA)).toBe('0');
    expect(formatInspectionDisplay(Number.POSITIVE_INFINITY, WCA)).toBe('0');
    expect(formatInspectionDisplay(60_000, 0)).toBe('0');
    expect(formatInspectionDisplay(60_000, Number.NaN)).toBe('0');
  });
});
