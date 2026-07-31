// BLDDB 三循环查表的编码契约 —— 查错键 = 给用户一条**解错 case 的公式**,
// 是这页最坏的失效方式,所以判据要硬。
//
// 库(nbwzx/blddb)只给每个三循环存**一个**代表元键,等价写法要自己算出来:
// 整体换贴纸 × 循环移位(见 _lib/blddb.ts 头注)。这里锁三层:
//   ① 纯逻辑:贴纸格分类、编码方案互译、等价类封闭性 —— 不依赖数据,CI 必跑;
//   ② 真实 fixture:UF-UB-RU(Speffz CAM)在库里就是键 GBF,拿上游页面实测过;
//   ③ 全量数据:**任意两个键都不能互为等价写法**。这条一旦破,同一个 case 有两个
//      代表元,查到哪个全看候选顺序 —— 无声给错公式。角那套(2.4MB)进了 CI
//      sparse-checkout,棱那套(3.5MB)只在本地跑。
//
// 没拿上游 codeConverter.ts 当 oracle:那是仓库外的 clone(D:\cube\blddb),CI 上不存在,
// 而 ③ 对全部 1008 + 1760 个真实键成立本身就比逐个比对更强。

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lookupCase,
  sameSticker,
  schemeLetters,
  toChichu,
  variantKeys,
  type BlddbPiece,
  type BlddbSet,
} from '@/app/[lang]/alg/3bld/_lib/blddb';
import { CHICHU_SCHEME, SPEFFZ_SCHEME } from '@/app/[lang]/alg/3bld/_lib/scheme-presets';
import { DEFAULT_CORNER_CH, DEFAULT_EDGE_CH } from '@/app/[lang]/alg/3bld/_lib/lettering';

const PIECES: BlddbPiece[] = ['corner', 'edge'];
const CH_LETTERS: Record<BlddbPiece, string> = {
  corner: DEFAULT_CORNER_CH.slice(1),
  edge: DEFAULT_EDGE_CH.slice(1),
};

function dataFile(name: string): string | null {
  const candidates = [
    path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'tools', 'blddb', 'data', name),
    path.resolve(process.cwd(), '..', '..', 'tools', 'blddb', 'data', name),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'blddb', 'data', name),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function loadSet(piece: BlddbPiece): BlddbSet | null {
  const f = dataFile(`${piece}Manmade.json`);
  return f ? (JSON.parse(fs.readFileSync(f, 'utf8')) as BlddbSet) : null;
}

const sorted = (s: string) => [...s].sort().join('');

describe('blddb 贴纸格分类', () => {
  // schemeLetters 走的是「每面 8 格里角在 0/2/5/7、棱在 1/3/4/6」。错一个下标,
  // 取出来的 24 个字母就不再是那套字母表的排列 —— 这条断言就是那个下标表的证明。
  it.each(PIECES)('%s 的 24 个格子恰好铺满该类字母表', (piece) => {
    expect(schemeLetters(piece, 'chichu').join('')).toBe(sorted(CH_LETTERS[piece]));
    expect(schemeLetters(piece, 'speffz')).toHaveLength(24);
  });

  it('两套方案的字母表互不串用(角 / 棱各自 24 个)', () => {
    expect(CHICHU_SCHEME).toHaveLength(48);
    expect(SPEFFZ_SCHEME).toHaveLength(48);
  });
});

describe('编码方案互译', () => {
  it.each(PIECES)('%s:Speffz → 彳亍 是双射', (piece) => {
    const from = schemeLetters(piece, 'speffz');
    const to = from.map((c) => toChichu(c, piece, 'speffz'));
    expect(new Set(to).size).toBe(24);
    expect(sorted(to.join(''))).toBe(sorted(CH_LETTERS[piece]));
  });

  it('彳亍原样返回(库本来就用它)', () => {
    expect(toChichu('AEH', 'edge', 'chichu')).toBe('AEH');
  });

  // 上游页面实测:?position=UF-UB-RU 的表头字母对是 Speffz 的 CAM。
  it('UF-UB-RU:Speffz CAM → 彳亍 AEH', () => {
    expect(toChichu('CAM', 'edge', 'speffz')).toBe('AEH');
  });
});

describe('等价键', () => {
  it('棱 6 个、角 9 个,且两两不同', () => {
    const e = variantKeys('AEH', 'edge');
    const c = variantKeys('ADM', 'corner');
    expect(e).toHaveLength(6);
    expect(c).toHaveLength(9);
    expect(new Set(e).size).toBe(6);
    expect(new Set(c).size).toBe(9);
  });

  it('等价类封闭:从任一等价写法出发,算出的集合都一样', () => {
    for (const piece of PIECES) {
      const seed = piece === 'edge' ? 'AEH' : 'ADM';
      const base = [...variantKeys(seed, piece)].sort();
      for (const v of base) {
        expect([...variantKeys(v, piece)].sort()).toEqual(base);
      }
    }
  });

  // ②:库里这个 case 存在键 GBF 下(AEH → 换贴纸 BFG → 移位 GBF)。
  it('UF-UB-RU 的等价写法里有库键 GBF', () => {
    expect(variantKeys('AEH', 'edge')).toContain('GBF');
  });

  it('同块贴纸认得出来(缓冲和目标撞块就不是三循环)', () => {
    expect(sameSticker('A', 'B', 'edge')).toBe(true);   // 同一条棱的两面
    expect(sameSticker('A', 'E', 'edge')).toBe(false);
    expect(sameSticker('J', 'L', 'corner')).toBe(true); // 同一个角的三面
    expect(sameSticker('J', 'G', 'corner')).toBe(false);
  });
});

describe('对着真实库校验', () => {
  for (const piece of PIECES) {
    const set = loadSet(piece);
    const run = set ? describe : describe.skip;

    run(`${piece}Manmade.json`, () => {
      const data = set as BlddbSet;
      const keys = () => Object.keys(data);

      it('键都是 3 个该类字母', () => {
        const alphabet = new Set(CH_LETTERS[piece]);
        for (const k of keys()) {
          expect(k).toHaveLength(3);
          for (const ch of k) expect(alphabet.has(ch)).toBe(true);
        }
      });

      // ③ 代表元唯一 —— 这页正确性的地基。
      it('没有两个键互为等价写法', () => {
        const owner = new Map<string, string>();
        const collisions: string[] = [];
        for (const k of keys()) {
          for (const v of variantKeys(k, piece)) {
            const prev = owner.get(v);
            if (prev && prev !== k) collisions.push(`${prev} ↔ ${k}(共用 ${v})`);
            owner.set(v, k);
          }
        }
        expect(collisions).toEqual([]);
      });

      it('从任一等价写法都查得回同一条记录', () => {
        // 全量 × 6~9 个变体本身不慢,但断言开销大,抽样够用(种子固定,不是随机)。
        const all = keys();
        const step = Math.max(1, Math.floor(all.length / 200));
        for (let i = 0; i < all.length; i += step) {
          const k = all[i];
          for (const v of variantKeys(k, piece)) {
            expect(lookupCase(data, v, piece)?.key).toBe(k);
          }
        }
      });

      // 覆盖完整 = 变体展开没有缺口:1760×6 = 10560 = 24×22×20(棱),
      // 1008×9 = 9072 = 24×21×18(角)。少一个键或少一种变体,这条立刻不成立 ——
      // 也顺带说明页面上那句「没有人工整理的公式」在当前数据下是兜底,不是常态。
      it('每个合法三循环都查得到(库是全覆盖的)', () => {
        const letters = [...CH_LETTERS[piece]];
        let checked = 0;
        const missing: string[] = [];
        for (const a of letters) {
          for (const b of letters) {
            if (sameSticker(a, b, piece)) continue;
            for (const c of letters) {
              if (sameSticker(a, c, piece) || sameSticker(b, c, piece)) continue;
              checked++;
              if (!lookupCase(data, a + b + c, piece)) missing.push(a + b + c);
            }
          }
        }
        expect(missing).toEqual([]);
        expect(checked).toBe(piece === 'edge' ? 24 * 22 * 20 : 24 * 21 * 18);
        expect(Object.keys(data).length * (piece === 'edge' ? 6 : 9)).toBe(checked);
      });

      it('每条记录:公式与换位子一一对应,且有人在用', () => {
        for (const k of keys()) {
          for (const [algs, users, comms] of data[k]) {
            expect(algs.length).toBeGreaterThan(0);
            expect(comms).toHaveLength(algs.length);
            expect(users.length).toBeGreaterThan(0);
          }
        }
      });
    });
  }
});
