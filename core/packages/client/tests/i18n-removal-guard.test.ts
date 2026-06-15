// i18n 约定守卫(繁体彻底移除后):全站只服 en + zh-Hans(简体)。
//   1. 源码禁出现繁体文本(短语级 OpenCC tw→cn:简体不变,繁体会被改写)。
//   2. 源码禁残留 `zhHant` 标识符(防 zhHant 字段回潮)。
//   3. en.json ↔ zh.json key 必须一一对应(漏 key = 红)。
// CI 跑 vitest(不跑 eslint),故约定靠本测试守。文案写法 en/zh 二元:
// 行内 `tr({ en, zh })` / `useT()` 或 `isZh ? zh : en` 均可。
//
// 用短语级(非逐字)检测:逐字会误伤简繁同形字(著名 / 显著 的「著」、什么的「么」),
// 短语级 OpenCC 对纯简体文本是恒等变换,只有真繁体才被改写。
import { describe, it, expect } from 'vitest';
import * as OpenCC from 'opencc-js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';
import en from '@/i18n/en.json';
import zh from '@/i18n/zh.json';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SRC_DIRS = ['app', 'components', 'lib', 'hooks', 'i18n'];
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');
// Standard OpenCC t→s. NOT the 'tw'/'twp' variant — those apply Taiwan phrase
// idioms that mutate even pure Simplified text (抬→擡, 覆盖→复盖). DUAL_USE =
// chars valid in Simplified that plain t2s still over-converts (著 名/显著, 覆 盖).
const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
const DUAL_USE = new Set(['著', '覆']);
const hasTrad = (run: string) => [...run].some((ch) => !DUAL_USE.has(ch) && t2s(ch) !== ch);
// Intentional non-Simplified content (vendored multilingual / Japanese / regex).
const EXCLUDE = [
  /scramble[\\/]gen[\\/]_tnoodle-i18n\.ts$/, // vendored tnoodle (zh-TW/ja/ko)
  /code[\\/]language[\\/]ruby[\\/]page\.tsx$/, // 《…スクリプト言語 Ruby》 title
  /[\\/]site[\\/]page\.tsx$/, // /[㐀-鿿豈-﫿]/ CJK-range regex
];
const HAN_RUN = /[㐀-䶿一-鿿豈-﫿]+/g;

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const files = SRC_DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => !EXCLUDE.some((re) => re.test(f)));

describe('i18n: Traditional Chinese fully removed', () => {
  it('no Traditional text in source (phrase-level OpenCC)', () => {
    const offenders: string[] = [];
    for (const fp of files) {
      const bad = new Set<string>();
      for (const run of readFileSync(fp, 'utf8').match(HAN_RUN) ?? []) {
        if (hasTrad(run)) bad.add(run);
      }
      if (bad.size) offenders.push(`${rel(fp)}  ${[...bad].slice(0, 8).join(' / ')}`);
    }
    expect(offenders, `Traditional text found (site is Simplified-only):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no zhHant identifier left in source', () => {
    const offenders: string[] = [];
    for (const fp of files) {
      if (/\bzhHant\b/i.test(readFileSync(fp, 'utf8'))) offenders.push(rel(fp));
    }
    expect(offenders, `Stale zhHant references:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('i18n: en.json and zh.json keys are parallel', () => {
  const keys = (o: unknown, prefix = ''): string[] => {
    if (!o || typeof o !== 'object') return [prefix];
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  };
  it('same key set', () => {
    const ek = new Set(keys(en));
    const zk = new Set(keys(zh));
    expect({
      missingInZh: [...ek].filter((k) => !zk.has(k)),
      missingInEn: [...zk].filter((k) => !ek.has(k)),
    }).toEqual({ missingInZh: [], missingInEn: [] });
  });
});
