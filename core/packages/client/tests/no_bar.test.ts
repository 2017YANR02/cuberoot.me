/**
 * 「没有棒」三档口径的护栏。
 *
 * 上游语料(`3x3.xlsx` 三页,存成 fixture)逐条过一遍口径:每一档的语料必须整份满足自己那档,
 * 且更严的那档必然也满足更松的。稀有度那两个数由固定种子的采样器现场重跑。
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyAlgExtended } from '@/app/[lang]/scramble/symmetry/_alg';
import { canonicalKey, cubieKey } from '@/app/[lang]/scramble/symmetry/_sym_core';
import { cubieToFacelet } from '@/lib/cube-facelet';
import {
  FACE_DIAG_PAIRS, FACE_ORTHO_PAIRS, faceContacts, makeRng, randomCubie, sampleNoBar,
} from '@/lib/no-bar';
import { NO_BAR_CORPORA, NO_BAR_SAMPLE } from '@/app/[lang]/scramble/hardest/_data/no_bar';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ROWS = gunzipSync(readFileSync(path.join(FIXTURES, 'no_bar_corpora.txt.gz')))
  .toString('utf8').trim().split('\n')
  .map((line) => { const [key, s] = line.split('\t'); return { key, s }; });

const rowsOf = (key: string) => ROWS.filter((r) => r.key === key).map((r) => r.s);
const faceletOf = (s: string) => cubieToFacelet(applyAlgExtended(s).cube);

/** 每一面上「同行 / 同列 / 同对角线出现两块同色」的对数(不要求相邻)。 */
function lineContacts(facelet: string): number {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  let n = 0;
  for (let f = 0; f < 6; f++) {
    const b = f * 9;
    for (const l of lines) {
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) if (facelet[b + l[i]] === facelet[b + l[j]]) n++;
      }
    }
  }
  return n;
}

describe('没有棒:口径本身', () => {
  it('面内相邻对数:正交 12、对角 8', () => {
    expect(FACE_ORTHO_PAIRS.length).toBe(12);
    expect(FACE_DIAG_PAIRS.length).toBe(8);
  });

  it('还原态:每面 12 对正交、8 对对角全同色 —— 满贯', () => {
    const c = faceContacts('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    expect(c.ortho).toBe(72);
    expect(c.diag).toBe(48);
  });
});

describe('没有棒:三份语料逐条验', () => {
  it('条数与 fixture 一致', () => {
    for (const c of NO_BAR_CORPORA) expect(rowsOf(c.key).length, c.key).toBe(c.total);
  });

  it('无棒那份:整份正交 0,但对角一个不缺(所以不是更严的那档)', () => {
    const rows = rowsOf('bar');
    let minDiag = Infinity;
    for (const s of rows) {
      const c = faceContacts(faceletOf(s));
      expect(c.ortho, s).toBe(0);
      minDiag = Math.min(minDiag, c.diag);
    }
    expect(minDiag).toBe(2);
  });

  it('无接触那份:正交与对角都是 0', () => {
    for (const s of rowsOf('contact')) {
      const c = faceContacts(faceletOf(s));
      expect(c.ortho, s).toBe(0);
      expect(c.diag, s).toBe(0);
    }
  });

  it('无同线那份:连不相邻的同行同列同对角也不同色(最严的一档)', () => {
    for (const s of rowsOf('line')) {
      const fl = faceletOf(s);
      expect(faceContacts(fl).ortho, s).toBe(0);
      expect(faceContacts(fl).diag, s).toBe(0);
      expect(lineContacts(fl), s).toBe(0);
    }
  });

  it('三份两两不重,且每份内部对称去重后不减(都是对称类代表)', () => {
    const all48 = Array.from({ length: 48 }, (_, i) => i);
    const seen = new Map<string, string>();
    for (const c of NO_BAR_CORPORA) {
      const canon = new Set<string>();
      for (const s of rowsOf(c.key)) {
        const cube = applyAlgExtended(s).cube;
        const raw = cubieKey(cube);
        expect(seen.has(raw), s).toBe(false);
        seen.set(raw, c.key);
        canon.add(canonicalKey(cube, all48, false));
      }
      expect(canon.size, c.key).toBe(c.total);
    }
  });

  it('页面上摆的那三条例子确实出自对应语料', () => {
    for (const c of NO_BAR_CORPORA) expect(rowsOf(c.key)).toContain(c.example);
  });
});

describe('没有棒:稀有度自己采样', () => {
  it('固定种子的采样结果逐位复现', () => {
    const r = sampleNoBar(NO_BAR_SAMPLE.n / 10, NO_BAR_SAMPLE.seed);
    // 十分之一的样本量:这里锁的是「采样器 + 口径」这条链,页面那个数是全量跑出来的
    expect(r.n).toBe(1_000_000);
    expect(r.noOrtho).toBe(8);
    expect(r.noContact).toBe(0);
  }, 120_000);

  it('采样器是均匀的:三项已知概率都对得上(种子固定,不是掷骰子)', () => {
    const n = 500_000;
    const rnd = makeRng(NO_BAR_SAMPLE.seed);
    let co = 0;
    let eo = 0;
    let cp = 0;
    for (let i = 0; i < n; i++) {
      const c = randomCubie(rnd);
      if (c.co.every((v) => v === 0)) co++;
      if (c.eo.every((v) => v === 0)) eo++;
      if (c.cp.every((v, k) => v === k)) cp++;
    }
    // 角朝向全正 1/3⁷、棱朝向全正 1/2¹¹、角排列复原 1/8!;各自 4σ 以内
    for (const [got, p] of [[co, 3 ** -7], [eo, 2 ** -11], [cp, 1 / 40_320]] as [number, number][]) {
      const mu = n * p;
      expect(Math.abs(got - mu)).toBeLessThan(4 * Math.sqrt(mu));
    }
  }, 120_000);
});
