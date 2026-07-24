/**
 * /scramble/pattern/search 核心算法回归 — 对照 Cube Explorer PatternSearch.pas 语义。
 *
 * 数值 baseline 用 toBe 锁定:改算法若数值变动,必须人工确认再改 baseline。
 */
import { describe, it, expect } from 'vitest';
import {
  GRAY,
  expandPattern,
  isEmptyPattern,
  twistOk,
  flipOk,
  parityOk,
  canonicalKey,
  faceletString,
  searchPatterns,
  SYM_PERMS,
  type PatternFace,
  type SearchOptions,
} from '@/app/[lang]/scramble/pattern/search/_pattern_core';
import { faceletToCubie, SOLVED_FACELET } from '@/app/[lang]/scramble/solver/facelet';
import { applySequence, parseMoves, solvedCubie } from '@/app/[lang]/scramble/solver/_kociemba/cube';
import { cubieToFacelet } from '@/app/[lang]/scramble/solver/facelet';

const ALL_FACES = [true, true, true, true, true, true];
const NO_FACES = [false, false, false, false, false, false];

function run(patterns: PatternFace[], assign: boolean[][], opts?: Partial<SearchOptions>) {
  const results: string[] = [];
  const stats = searchPatterns(
    {
      patterns,
      faceAssign: assign,
      continuous: false,
      maxResults: 100000,
      ...opts,
    },
    { onResult: (f) => results.push(f) },
  );
  return { results, stats };
}

const grayPattern = (): PatternFace => new Array(9).fill(GRAY);
/** 5 槽 pattern 集:第 0 槽给定,其余空。 */
function onePattern(p: PatternFace) {
  return [p, grayPattern(), grayPattern(), grayPattern(), grayPattern()];
}
function oneAssign(faces: boolean[]) {
  return [faces, NO_FACES, NO_FACES, NO_FACES, NO_FACES];
}

describe('对称置换', () => {
  it('48 个互异且中心映中心', () => {
    expect(SYM_PERMS.length).toBe(48);
    const keys = new Set(SYM_PERMS.map((p) => p.join(',')));
    expect(keys.size).toBe(48);
    const centers = new Set([4, 13, 22, 31, 40, 49]);
    for (const p of SYM_PERMS) {
      for (const c of centers) expect(centers.has(p[c])).toBe(true);
    }
  });

  it('solved 的 canonicalKey 是 solved 自身', () => {
    const solved = new Uint8Array(54);
    for (let i = 0; i < 54; i++) solved[i] = Math.floor(i / 9);
    expect(faceletString(solved)).toBe(SOLVED_FACELET);
    expect(canonicalKey(solved)).toBe(SOLVED_FACELET);
  });
});

describe('pattern 展开', () => {
  it('非对称 pattern 有 8 个形式,全灰只有 1 个', () => {
    // 1 在右上角、2 在右下角:D4 作用下 8 个摆放互异
    expect(expandPattern([0, 0, 1, 0, 0, 0, 0, 0, 2]).length).toBe(8);
    expect(expandPattern(grayPattern()).length).toBe(1);
    expect(isEmptyPattern(grayPattern())).toBe(true);
    expect(isEmptyPattern([0, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY])).toBe(false);
  });
});

describe('合法性检查', () => {
  it('solved 状态 twist/flip/parity 全过', () => {
    const solved = new Uint8Array(54);
    for (let i = 0; i < 54; i++) solved[i] = Math.floor(i / 9);
    expect(twistOk(solved)).toBe(true);
    expect(flipOk(solved)).toBe(true);
    expect(parityOk(solved)).toBe(true);
  });
});

describe('搜索', () => {
  it('纯色 pattern 全六面 → 唯一结果 solved', () => {
    const solid: PatternFace = new Array(9).fill(0); // 9 格同一类(非灰,但类值无语义)
    const { results, stats } = run(onePattern(solid), oneAssign(ALL_FACES));
    expect(results).toEqual([SOLVED_FACELET]);
    expect(stats.truncated).toBe(false);
  });

  it('某面未分配任何 pattern → 0 结果', () => {
    const solid: PatternFace = new Array(9).fill(0);
    const partial = [true, true, true, true, true, false]; // B 面无 pattern
    const { results } = run(onePattern(solid), oneAssign(partial));
    expect(results.length).toBe(0);
  });

  it('空 pattern 即使勾了面也不参与(自动摘除)', () => {
    // 槽 0 纯色勾 5 面,槽 1 全灰勾 B 面 → B 面等效无 pattern → 0 结果
    const solid: PatternFace = new Array(9).fill(0);
    const assign = [
      [true, true, true, true, true, false],
      [false, false, false, false, false, true],
      NO_FACES, NO_FACES, NO_FACES,
    ];
    const { results } = run(onePattern(solid), assign);
    expect(results.length).toBe(0);
  });

  it('棋盘 pattern(角类≠棱类)六面 → 数量与合法性 baseline', () => {
    // A=角+中心类,B=棱类;双射语义強制每面严格两色棋盘
    const checker: PatternFace = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    const { results, stats } = run(onePattern(checker), oneAssign(ALL_FACES));
    // baseline:跑通后锁定(isomorphic 去重后的状态数)
    expect(results.length).toBe(BASELINE_CHECKER);
    expect(stats.truncated).toBe(false);
    // 全部结果必须是合法可解块排列(faceletToCubie 不抛)且互不 isomorphic
    const keys = new Set<string>();
    for (const f of results) {
      expect(() => faceletToCubie(f)).not.toThrow();
      const st = new Uint8Array(54);
      for (let i = 0; i < 54; i++) st[i] = 'URFDLB'.indexOf(f[i]);
      keys.add(canonicalKey(st));
    }
    expect(keys.size).toBe(results.length);
    // pons asinorum(M2 E2 S2 等价写法)必在结果中(mod isomorphism)
    const pons = cubieToFacelet(applySequence(
      solvedCubie(),
      parseMoves('U2 D2 F2 B2 L2 R2'),
    ));
    const ponsState = new Uint8Array(54);
    for (let i = 0; i < 54; i++) ponsState[i] = 'URFDLB'.indexOf(pons[i]);
    expect(keys.has(canonicalKey(ponsState))).toBe(true);
  });

  it('棋盘 + Continuous → 收缩且是子集', () => {
    const checker: PatternFace = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    const all = run(onePattern(checker), oneAssign(ALL_FACES));
    const cont = run(onePattern(checker), oneAssign(ALL_FACES), { continuous: true });
    expect(cont.results.length).toBe(BASELINE_CHECKER_CONTINUOUS);
    expect(cont.results.length).toBeLessThanOrEqual(all.results.length);
    const allSet = new Set(all.results);
    for (const f of cont.results) expect(allSet.has(f)).toBe(true);
  });

  it('生成公式往返:two-phase 解 → 逆序列从复原态重放 = 原状态', async () => {
    const { buildMoveTables } = await import('@/app/[lang]/scramble/solver/_kociemba/movetables');
    const { buildPruneTables } = await import('@/app/[lang]/scramble/solver/_kociemba/prune');
    const { solveCube } = await import('@/app/[lang]/scramble/solver/_kociemba/search');
    const { formatMoves, invertSequence } = await import('@/app/[lang]/scramble/solver/_kociemba/cube');
    const mt = buildMoveTables();
    const pt = buildPruneTables(mt);
    const checker: PatternFace = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    const { results } = run(onePattern(checker), oneAssign(ALL_FACES));
    for (const facelet of results) {
      const sol = solveCube(faceletToCubie(facelet), mt, pt, { timeoutMs: 2000 });
      const generator = formatMoves(invertSequence(sol));
      expect(generator.length).toBeGreaterThan(0);
      const replayed = cubieToFacelet(applySequence(solvedCubie(), parseMoves(generator)));
      expect(replayed).toBe(facelet);
    }
  }, 30000);

  it('maxResults 截断生效', () => {
    const checker: PatternFace = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    const { results, stats } = run(onePattern(checker), oneAssign(ALL_FACES), { maxResults: 2 });
    expect(results.length).toBe(2);
    expect(stats.truncated).toBe(true);
  });
});

// ── baseline(首跑锁定;改动算法需人工确认)──
const BASELINE_CHECKER = 3;
const BASELINE_CHECKER_CONTINUOUS = 3;
