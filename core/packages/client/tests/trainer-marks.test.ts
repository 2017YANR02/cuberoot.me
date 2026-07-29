// 训练器学习标记的本地/云端合并(单条 last-write-wins)。
// mergeMarks 是纯函数:每个 key 取 t 大的一边;本地较新的差异回传;
// 本地墓碑(s/f 全空)在云端无对应行时不回传。
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mergeMarks, summarizeMarks, scanLocalOverview, combineOverviews,
  type CaseMarks, type MarkOverview,
} from '@/lib/trainer-marks';

describe('mergeMarks (LWW)', () => {
  it('local newer wins and is uploaded', () => {
    const local: CaseMarks = { 'T|T1': { s: 'mastered', t: 200 } };
    const cloud: CaseMarks = { 'T|T1': { s: 'learning', t: 100 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(merged['T|T1']).toEqual({ s: 'mastered', t: 200 });
    expect(toUpload).toEqual([{ k: 'T|T1', s: 'mastered', f: false, t: 200 }]);
  });

  it('cloud newer wins and nothing is uploaded', () => {
    const local: CaseMarks = { 'T|T1': { s: 'mastered', t: 100 } };
    const cloud: CaseMarks = { 'T|T1': { s: 'learning', f: 1, t: 200 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(merged['T|T1']).toEqual({ s: 'learning', f: 1, t: 200 });
    expect(toUpload).toEqual([]);
  });

  it('equal timestamps: cloud wins (no useless upload)', () => {
    const local: CaseMarks = { 'T|T1': { s: 'learning', t: 100 } };
    const cloud: CaseMarks = { 'T|T1': { s: 'mastered', t: 100 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(merged['T|T1'].s).toBe('mastered');
    expect(toUpload).toEqual([]);
  });

  it('local-only real mark is uploaded; local-only tombstone is not', () => {
    const local: CaseMarks = {
      'T|T1': { s: 'learning', t: 100 },
      'T|T2': { f: 1, t: 100 },
      'T|T3': { t: 100 }, // 墓碑:云端本来就没有,不用传
    };
    const { merged, toUpload } = mergeMarks(local, {});
    expect(Object.keys(merged).sort()).toEqual(['T|T1', 'T|T2', 'T|T3']);
    expect(toUpload.map(i => i.k).sort()).toEqual(['T|T1', 'T|T2']);
  });

  it('newer local tombstone clears an older cloud mark (upload the clear)', () => {
    const local: CaseMarks = { 'T|T1': { t: 300 } };
    const cloud: CaseMarks = { 'T|T1': { s: 'mastered', t: 100 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(merged['T|T1']).toEqual({ t: 300 });
    expect(toUpload).toEqual([{ k: 'T|T1', s: null, f: false, t: 300 }]);
  });

  it('older local tombstone loses to a newer cloud mark (no resurrection of the delete)', () => {
    const local: CaseMarks = { 'T|T1': { t: 100 } };
    const cloud: CaseMarks = { 'T|T1': { s: 'learning', t: 200 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(merged['T|T1']).toEqual({ s: 'learning', t: 200 });
    expect(toUpload).toEqual([]);
  });

  it('cloud-only marks merge in untouched', () => {
    const cloud: CaseMarks = { 'T|T9': { s: 'mastered', t: 50 } };
    const { merged, toUpload } = mergeMarks({}, cloud);
    expect(merged['T|T9']).toEqual({ s: 'mastered', t: 50 });
    expect(toUpload).toEqual([]);
  });

  it('disjoint sets union cleanly', () => {
    const local: CaseMarks = { 'A|1': { s: 'learning', t: 10 } };
    const cloud: CaseMarks = { 'B|2': { s: 'mastered', t: 20 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(Object.keys(merged).sort()).toEqual(['A|1', 'B|2']);
    expect(toUpload.map(i => i.k)).toEqual(['A|1']);
  });
});

describe('summarizeMarks', () => {
  it('counts each status plus starred; tombstones ignored', () => {
    const marks: CaseMarks = {
      'T|1': { s: 'mastered', t: 1 },
      'T|2': { s: 'mastered', f: 1, t: 1 }, // mastered AND starred → both +1
      'T|3': { s: 'learning', t: 1 },
      'T|5': { f: 1, t: 1 },  // 只星标(未定状态)→ starred +1,状态 0
      'T|6': { t: 1 },        // 墓碑 → 全不计
    };
    // starred = T|2 + T|5 = 2(星标与状态独立计)
    expect(summarizeMarks(marks)).toEqual({ learning: 1, mastered: 2, starred: 2 });
  });

  it('empty marks → all zero', () => {
    expect(summarizeMarks({})).toEqual({ learning: 0, mastered: 0, starred: 0 });
  });
});

describe('combineOverviews', () => {
  it('cloud wins per set; local-only sets are kept', () => {
    const cloud: MarkOverview = { '3x3/pll': { learning: 0, mastered: 5, starred: 1 } };
    const local: MarkOverview = {
      '3x3/pll': { learning: 3, mastered: 1, starred: 0 }, // 被云端覆盖
      '3x3/oll': { learning: 2, mastered: 0, starred: 0 }, // 云端没有 → 保留
    };
    expect(combineOverviews(cloud, local)).toEqual({
      '3x3/pll': { learning: 0, mastered: 5, starred: 1 },
      '3x3/oll': { learning: 2, mastered: 0, starred: 0 },
    });
  });
});

describe('scanLocalOverview', () => {
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  const install = (data: Record<string, string>) => {
    const keys = Object.keys(data);
    g.window = {};
    g.localStorage = {
      get length() { return keys.length; },
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => (k in data ? data[k] : null),
    };
  };
  afterEach(() => { delete g.window; delete g.localStorage; });

  it('aggregates only trainer:marks:* keys, skips other keys and empty/garbage sets', () => {
    install({
      'trainer:marks:3x3/pll': JSON.stringify({
        'T|1': { s: 'mastered', t: 1 }, 'T|2': { s: 'learning', f: 1, t: 1 },
      }),
      'trainer:marks:3x3/oll': JSON.stringify({ 'X|1': { t: 1 } }), // 全墓碑 → 不收
      'trainer:marks:2x2/cll': 'not-json',                         // 坏 JSON → 跳过
      'cuberoot-timer.v3': 'unrelated',                            // 非标记键 → 忽略
    });
    expect(scanLocalOverview()).toEqual({
      '3x3/pll': { learning: 1, mastered: 1, starred: 1 },
    });
  });

  it('no window → empty', () => {
    expect(scanLocalOverview()).toEqual({});
  });
});

// 一次性重置(migration 0097 的本机那半)。跑在模块初始化里,所以每条都得换个新模块实例。
describe('LSLL 进度一次性重置', () => {
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  const install = (data: Record<string, string>) => {
    g.window = { addEventListener: () => {} };   // auth-store 在模块初始化里挂 storage 监听
    g.localStorage = {
      get length() { return Object.keys(data).length; },
      key: (i: number) => Object.keys(data)[i] ?? null,
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => { data[k] = v; },
      removeItem: (k: string) => { delete data[k]; },
    };
    return data;
  };
  afterEach(() => { delete g.window; delete g.localStorage; });

  /** 重新 import 一次 = 重跑一次模块初始化。 */
  const boot = async () => { vi.resetModules(); await import('@/lib/trainer-marks'); };

  it('删掉 3x3/lsll 的标记 / 记忆 / 会话,别的 set 一个不碰', async () => {
    const data = install({
      'trainer:marks:3x3/lsll': '{"A+ 1x2y":{"s":"mastered","t":1}}',
      'srs:recs:3x3/lsll': '{"A+ 1x2y":{"d":1}}',
      'trainer:3x3/lsll': '{"selected":["A+ 1x2y"]}',
      'trainer:marks:3x3/zbll': '{"U|Ua":{"s":"mastered","t":1}}',
      'srs:recs:3x3/zbls': '{"A+|1":{"d":1}}',
      'sweep:3x3/lsll': '{"sweeps":{"zbls":1}}',   // 过遍按 scope 记,路线没变 ⇒ 留着
    });
    await boot();
    expect(Object.keys(data).sort()).toEqual([
      'srs:recs:3x3/zbls', 'sweep:3x3/lsll', 'trainer:marks:3x3/zbll', 'trainer:reset:lsll-midauf',
    ]);
  });

  it('旗标在 = 不再动手,用户重置之后新练的标记不会被第二次抹掉', async () => {
    const data = install({
      'trainer:reset:lsll-midauf': '1',
      'trainer:marks:3x3/lsll': '{"A+ zzz":{"s":"learning","t":9}}',
    });
    await boot();
    expect(data['trainer:marks:3x3/lsll']).toBe('{"A+ zzz":{"s":"learning","t":9}}');
  });

  it('没有 window(SSR)时什么都不做', async () => {
    await expect(boot()).resolves.toBeUndefined();
  });
});
