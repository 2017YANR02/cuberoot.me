// 训练器学习标记的本地/云端合并(单条 last-write-wins)。
// mergeMarks 是纯函数:每个 key 取 t 大的一边;本地较新的差异回传;
// 本地墓碑(s/f 全空)在云端无对应行时不回传。
import { describe, it, expect } from 'vitest';
import { mergeMarks, type CaseMarks } from '@/lib/trainer-marks';

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
    const cloud: CaseMarks = { 'T|T1': { s: 'paused', f: 1, t: 200 } };
    const { merged, toUpload } = mergeMarks(local, cloud);
    expect(merged['T|T1']).toEqual({ s: 'paused', f: 1, t: 200 });
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
    const cloud: CaseMarks = { 'T|T9': { s: 'paused', t: 50 } };
    const { merged, toUpload } = mergeMarks({}, cloud);
    expect(merged['T|T9']).toEqual({ s: 'paused', t: 50 });
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
