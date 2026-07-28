import { describe, it, expect } from 'vitest';
import {
  FOLD_WATERLINE, emptySweep, foldableKeys, isSwept, markSwept, mergeSweep, setCursor,
  sweepKey, sweptScopes, sweptTimes, type SetSweep,
} from '@/lib/alg-sweep';

describe('sweepKey', () => {
  it('归一空范围', () => {
    expect(sweepKey(null)).toBe('');
    expect(sweepKey(undefined)).toBe('');
    expect(sweepKey('  ')).toBe('');
    expect(sweepKey(' ZBLS-R7 ')).toBe('zbls-r7');
  });
});

describe('markSwept', () => {
  it('第一次过完记 1,再过一遍 +1', () => {
    let sw = emptySweep();
    expect(isSwept(sw, 'zbls-r7')).toBe(false);
    sw = markSwept(sw, 'zbls-r7', 1000);
    expect(sweptTimes(sw, 'zbls-r7')).toBe(1);
    expect(isSwept(sw, 'zbls-r7')).toBe(true);
    sw = markSwept(sw, 'zbls-r7', 2000);
    expect(sweptTimes(sw, 'zbls-r7')).toBe(2);
    expect(sw.t).toBe(2000);
  });

  it('不同范围各记各的', () => {
    let sw = emptySweep();
    for (let r = 1; r <= 66; r++) sw = markSwept(sw, `zbls-r${r}`, r);
    expect(sweptScopes(sw)).toBe(66);
    expect(sweptTimes(sw, 'zbls-r67')).toBe(0);
  });

  it('不改原对象', () => {
    const a = emptySweep();
    const b = markSwept(a, 'x', 1);
    expect(a.counts).toEqual({});
    expect(b).not.toBe(a);
  });
});

describe('setCursor', () => {
  const cur = (scope: string, pos: number, total = 302) => ({ scope, pos, total });

  it('同范围内 pos 只进不退(回看历史不该把进度拨回去)', () => {
    let sw = setCursor(emptySweep(), cur('zbls-r7', 128), 1000);
    sw = setCursor(sw, cur('zbls-r7', 5), 2000);
    expect(sw.cursor).toEqual(cur('zbls-r7', 128));
  });

  it('pos 没变则原样返回(不触发落盘)', () => {
    const sw = setCursor(emptySweep(), cur('zbls-r7', 128), 1000);
    expect(setCursor(sw, cur('zbls-r7', 128), 9999)).toBe(sw);
  });

  it('前进则更新并推时间戳', () => {
    let sw = setCursor(emptySweep(), cur('zbls-r7', 128), 1000);
    sw = setCursor(sw, cur('zbls-r7', 129), 2000);
    expect(sw.cursor).toEqual(cur('zbls-r7', 129));
    expect(sw.t).toBe(2000);
  });

  it('换范围无条件重置(哪怕 pos 更小)', () => {
    let sw = setCursor(emptySweep(), cur('zbls-r7', 300), 1000);
    sw = setCursor(sw, cur('zbls-r8', 1), 2000);
    expect(sw.cursor).toEqual(cur('zbls-r8', 1));
  });

  it('同范围但总数变了(集改过)也认新的', () => {
    let sw = setCursor(emptySweep(), cur('', 300, 494), 1000);
    sw = setCursor(sw, cur('', 300, 496), 2000);
    expect(sw.cursor).toEqual(cur('', 300, 496));
  });
});

describe('mergeSweep', () => {
  const of = (counts: Record<string, number>, t: number, cursor: SetSweep['cursor'] = null): SetSweep =>
    ({ counts, cursor, t });

  it('counts 逐范围取 max', () => {
    const { merged } = mergeSweep(of({ a: 3, b: 1 }, 10), of({ a: 1, c: 2 }, 20));
    expect(merged.counts).toEqual({ a: 3, b: 1, c: 2 });
  });

  it('本地有云端没有的范围 → 要回传', () => {
    expect(mergeSweep(of({ a: 1 }, 10), of({}, 20)).dirty).toBe(true);
  });

  it('本地是云端的子集 → 不回传', () => {
    expect(mergeSweep(of({ a: 1 }, 10), of({ a: 1, b: 1 }, 20)).dirty).toBe(false);
  });

  it('cursor 取 t 新的那边', () => {
    const l = of({}, 30, { scope: 'zbls-r9', pos: 5, total: 302 });
    const c = of({}, 20, { scope: 'zbls-r7', pos: 300, total: 302 });
    expect(mergeSweep(l, c).merged.cursor?.scope).toBe('zbls-r9');
    expect(mergeSweep(c, l).merged.cursor?.scope).toBe('zbls-r9');
  });

  it('本地 cursor 更新 → 要回传;两边一样则不回传', () => {
    const same = { scope: 'zbls-r7', pos: 5, total: 302 };
    expect(mergeSweep(of({}, 30, same), of({}, 20, same)).dirty).toBe(false);
    expect(mergeSweep(of({}, 30, { ...same, pos: 6 }), of({}, 20, same)).dirty).toBe(true);
  });

  it('t 取两边较大', () => {
    expect(mergeSweep(of({}, 30), of({}, 20)).merged.t).toBe(30);
    expect(mergeSweep(of({}, 10), of({}, 20)).merged.t).toBe(20);
  });
});

describe('foldableKeys', () => {
  const keys = Array.from({ length: 302 }, (_, i) => `A+|A+ k${i}`);
  const allHaveRec = () => true;

  it('没过水位:一个都不折(小集行为与今天完全一致)', () => {
    expect(foldableKeys(keys, allHaveRec, new Set(), FOLD_WATERLINE)).toEqual([]);
    expect(foldableKeys(keys, allHaveRec, new Set(), 3915)).toEqual([]);
  });

  it('过了水位:没标记的全折', () => {
    expect(foldableKeys(keys, allHaveRec, new Set(), FOLD_WATERLINE + 1)).toHaveLength(302);
  });

  it('手动标过的永远留着', () => {
    const marked = new Set([keys[0], keys[7], keys[301]]);
    const out = foldableKeys(keys, allHaveRec, marked, 20000);
    expect(out).toHaveLength(299);
    for (const k of marked) expect(out).not.toContain(k);
  });

  it('没有记忆记录的 case 不进折叠名单(没东西可删)', () => {
    const hasRec = (k: string) => k === keys[3];
    expect(foldableKeys(keys, hasRec, new Set(), 20000)).toEqual([keys[3]]);
  });

  it('LSLL 494 轮全折完后剩下的量级', () => {
    // 每轮 302 个,假设用户手动标了 3 个 —— 494 轮下来留 1,482 条,远在 20,000 之下
    let kept = 0;
    for (let r = 0; r < 494; r++) {
      const marked = new Set([keys[0], keys[1], keys[2]]);
      kept += 302 - foldableKeys(keys, allHaveRec, marked, 20000).length;
    }
    expect(kept).toBe(1482);
  });
});
