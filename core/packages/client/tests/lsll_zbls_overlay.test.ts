/**
 * LSLL ↔ ZBLS 交叉引用回归(zbls_algs.json 由 scripts/gen-lsll-zbls-overlay.mts 生成)。
 *  1. 覆盖数 = 305(zbls 非全解案例全集),键互异。
 *  2. 每个键是**合法且已 canonical** 的 LSLL key —— 用真实 model 往返验证,
 *     捕获生成脚本与 model 编码的任何漂移。
 *  3. 每条 ref 结构完整(name / subgroup / slug / algCount)。
 */
import { describe, expect, it } from 'vitest';
import overlay from '@/lib/lsll/zbls_algs.json';
import { keyFromString, keyToString, decodeKey, canonicalKey } from '@/lib/lsll/model';

const entries = Object.entries(overlay as Record<string, { name: string; subgroup: string; slug: string; algCount: number }[]>);

describe('lsll zbls overlay', () => {
  it('covers 305 distinct LSLL cases', () => {
    expect(entries.length).toBe(305);
    expect(new Set(entries.map(([k]) => k)).size).toBe(305);
  });

  it('every key is a canonical LSLL key (round-trips through the real model)', () => {
    for (const [k] of entries) {
      const num = keyFromString(k);
      expect(num, k).not.toBeNull();
      const st = decodeKey(num!);
      expect(st, k).not.toBeNull();
      // 生成脚本存的就是 canonicalKey 的 base36 —— 再 canonical 一次必回到自身。
      expect(keyToString(canonicalKey(st!)), k).toBe(k);
    }
  });

  it('every ref is well-formed', () => {
    for (const [, refs] of entries) {
      expect(refs.length).toBeGreaterThanOrEqual(1);
      for (const r of refs) {
        expect(typeof r.name).toBe('string');
        expect(r.name.length).toBeGreaterThan(0);
        expect(r.slug, `${r.subgroup} ${r.name}`).toMatch(/^[a-z0-9+-]+$/);
        expect(r.algCount).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
