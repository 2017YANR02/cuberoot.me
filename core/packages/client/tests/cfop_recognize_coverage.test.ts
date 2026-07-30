/**
 * OLL / PLL 精确识别的**空间覆盖**测试。
 * =========================================================================
 *
 * 为什么单独写一个:原有自检是**循环的** —— 它拿建表用的那 21 / 57 个 setup 再
 * 回喂给识别器,当然全过。真实局面不止那些:一把 solve 结束 F2L 时,顶层可以是
 * 288 种合法排列中的任意一种(公式前后各能 AUF 一次,同一个 case 有 16 种摆法)。
 * 按旧表(每个 case 只登记公式自带的那一种摆法)实测只认 **85 / 288**,其余 203
 * 种返回 null —— 复盘里 70% 的 PLL 标签是空的,连「PLL skip 但还差一个 AUF」这种
 * 最常见的局面都不认。
 *
 * 所以这里**穷举整个空间**:
 *   PLL — 21 case + 已还原,各 4×4 种 AUF 组合 → 去重后正好 288 种;
 *   OLL — 57 case + skip,同样穷举 → 216 种(顶层朝向的全部)。
 * 每一种都必须被识别,且识别出的 case 必须等于构造它时用的那个 case。
 */
import { describe, it, expect } from 'vitest';

import { solved, applyMoves } from '@/app/[lang]/timer/_lib/cube/state';
import type { CubeFaces } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
import {
  recognizeOllExact, recognizePllExact, __cfopRecognizeSelfTest,
} from '@/app/[lang]/timer/_lib/components/cfop_recognize';
import { isF2l, isOll } from '@/app/[lang]/timer/_lib/cube/cfop_detect';
import { shortestLibraryAlg } from '@/app/[lang]/timer/_lib/reconstruct/reference';
import ollData from '@cuberoot/shared/data/oll.json';
import pllData from '@cuberoot/shared/data/pll.json';

const AUF = ['', 'U', 'U2', "U'"] as const;

function invert(alg: string): string {
  return alg.trim().split(/\s+/).reverse().map(t => {
    if (t.endsWith("2'")) return t.slice(0, -1);
    if (t.endsWith('2')) return t;
    if (t.endsWith("'")) return t.slice(0, -1);
    return t + "'";
  }).join(' ');
}
function ap(s: CubeFaces, alg: string): CubeFaces {
  return alg.trim() ? applyMoves(s, 3, parseScramble(alg)) : s;
}
/** Permutation key: the 12 last-layer side stickers (the U face is uniform in
 *  every PLL position, so the sides say everything). */
function positionKey(s: CubeFaces): string {
  return (['F', 'R', 'B', 'L'] as const).map(f => s[f].slice(0, 3).join('')).join('|');
}

/** Orientation key: which stickers show the U colour. This is all OLL is about
 *  — an OLL setup also permutes the last layer, and counting those variations
 *  would inflate a 216-state space into 904 positions the recognizer cannot
 *  and need not distinguish. */
function orientationKey(s: CubeFaces): string {
  const cU = s.U[4];
  const mark = (c: string) => (c === cU ? '1' : '0');
  return s.U.map(mark).join('') + (['F', 'R', 'B', 'L'] as const)
    .map(f => s[f].slice(0, 3).map(mark).join('')).join('');
}

/** Every distinct position reachable by AUF-ing before and after each setup. */
function enumerate(
  cases: Array<[string, string]>,
  keep: (s: CubeFaces) => boolean,
  key: (s: CubeFaces) => string = positionKey,
) {
  const out: Array<{ key: string; built: string; state: CubeFaces }> = [];
  const seen = new Set<string>();
  for (const [name, alg] of cases) {
    for (const pre of AUF) {
      for (const post of AUF) {
        const state = ap(ap(ap(solved(3), pre), alg ? invert(alg) : ''), post);
        if (!keep(state)) continue;
        const k = key(state);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ key: k, built: name, state });
      }
    }
  }
  return out;
}

describe('the recognizer self-test still passes', () => {
  it('reports no build errors or round-trip failures', () => {
    expect(__cfopRecognizeSelfTest()).toBeNull();
  });
});

describe('PLL: every legal last-layer permutation', () => {
  const cases: Array<[string, string]> = [['skip', '']];
  for (const [k, v] of Object.entries(pllData as Record<string, { noAuf: string }>)) {
    cases.push([k, v.noAuf]);
  }

  const positions = enumerate(cases, () => true);

  it('spans exactly the 288 permutations of an oriented last layer', () => {
    // 4! corner × 4! edge permutations, halved by parity = 288.
    expect(positions.length).toBe(288);
    for (const p of positions) expect(isOll(p.state), p.key).toBe(true);
  });

  it('recognizes all 288 — none null, none attributed to the wrong case', () => {
    const nulls: string[] = [];
    const wrong: string[] = [];
    for (const p of positions) {
      const r = recognizePllExact(p.state);
      if (!r) { nulls.push(`${p.built} ${p.key}`); continue; }
      if (r.case !== p.built) wrong.push(`${p.built} recognized as ${r.case} (${p.key})`);
    }
    expect(nulls).toEqual([]);
    expect(wrong).toEqual([]);
  });

  it('recognizes a skip that still needs an AUF', () => {
    // The regression that made this file exist: solved-but-turned is a PLL
    // skip, and it used to come back null.
    for (const post of AUF) {
      const st = ap(solved(3), post);
      expect(recognizePllExact(st)?.case, `post=${post}`).toBe('skip');
    }
  });
});

describe('PLL: every position also gets a verified reference alg', () => {
  // Recognition is only half of it — the reference (reconstruct/reference.ts)
  // has to find an alg in our tables that VERIFIABLY solves the position, over
  // both AUFs. Sweeping the space here is what caught the missing closing-AUF
  // sweep: most positions are not solved by any table alg on its own.
  const cases: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(pllData as Record<string, { noAuf: string }>)) {
    cases.push([k, v.noAuf]);
  }
  const positions = enumerate(cases, () => true);

  it('finds a verified line for all 284 unsolved positions', () => {
    expect(positions.length).toBe(284);   // 288 minus the 4 rotations of solved
    const misses: string[] = [];
    for (const p of positions) {
      const best = shortestLibraryAlg(p.state, 'pll');
      if (!best || best.case !== p.built || best.turns <= 0) {
        misses.push(`${p.built} ${p.key} → ${best ? best.case + '/' + best.turns : 'null'}`);
      }
    }
    expect(misses).toEqual([]);
  });
});

describe('OLL: every orientation of the last layer', () => {
  const cases: Array<[string, string]> = [['skip', '']];
  for (let i = 1; i <= 57; i++) {
    cases.push([`OLL ${i}`, (ollData as Record<string, { alg: string }>)[`OLL ${i}`].alg]);
  }

  // A net x/z rotation in a table alg leaves the fixture in another frame;
  // that is not a last-layer position in the D-anchored sense.
  const positions = enumerate(cases, isF2l, orientationKey);

  it('spans exactly the 216 orientations', () => {
    // 3^3 corner twists × 2^3 edge flips = 27 × 8 = 216.
    expect(positions.length).toBe(216);
  });

  it('recognizes all 216 — none null, none attributed to the wrong case', () => {
    const nulls: string[] = [];
    const wrong: string[] = [];
    for (const p of positions) {
      const r = recognizeOllExact(p.state);
      if (!r) { nulls.push(`${p.built} ${p.key}`); continue; }
      if (r.case !== p.built) wrong.push(`${p.built} recognized as ${r.case}`);
    }
    expect(nulls).toEqual([]);
    expect(wrong).toEqual([]);
  });
});
