import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AlgCase, AlgEntry, AlgSticker } from '@cuberoot/shared';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import {
  CASE_VIEW_ANGLES,
  caseViewAlg,
  caseViewSetup,
  displayAlg,
} from '@/lib/alg_display';
import { ohAlgsForCase } from '@/lib/alg_oh_hand';
import { getCube3 } from '@/lib/cube3';
import { normalizeAlg } from '@/lib/alg_normalize';
import { checkSetupPrecondition } from '@/lib/alg_precondition';
import { validateAlgCase } from '@/lib/alg_validation';
import ollDbSetups from './fixtures/oll_db_setups.json';

type MetricRow = {
  etm: number;
  optimalEtm: number;
  optimalHtm: number;
  optimalStm: number;
  optimalAtm: number;
};

type ImportedCase = {
  no: number;
  name: string;
  category: string;
  position: number;
  mirror: number;
  scrambleFrom?: number | null;
  metrics: MetricRow;
  algs: AlgEntry[];
};

const SQL = readFileSync(
  new URL('../../server/migrations/0153_oll_docx_import.sql', import.meta.url),
  'utf8',
);
const payloadMatch = SQL.match(/\$payload\$([\s\S]*?)\$payload\$/);
if (!payloadMatch) throw new Error('missing OLL DOCX migration payload');
const imported = JSON.parse(payloadMatch[1]) as ImportedCase[];

const CASE_ORDER = [
  27, 26, 24, 25, 23, 22, 21,
  28, 57,
  45, 33,
  5, 6,
  37, 35,
  46, 34,
  40, 39,
  10, 9,
  38, 36,
  44, 43, 32, 31,
  7, 8, 11, 12,
  42, 41, 29, 30,
  15, 16, 13, 14,
  51, 52, 56, 55,
  49, 50, 48, 47,
  54, 53,
  3, 4, 18, 2, 19, 17, 1, 20,
];

const CATEGORY_COUNTS = new Map([
  ['OCLL [6,7]', 7], ['OELL [2]', 2], ['T [2]', 2], ['O [1,2]', 2],
  ['K [2]', 2], ['C [2]', 2], ['Z [1,2]', 2], ['Y [1,2]', 2],
  ['W [1,2]', 2], ['P [2,4]', 4], ['N [2,4]', 4], ['G [2,4]', 4],
  ['J [2,4]', 4], ['I [4]', 4], ['V [3,6]', 4], ['F', 2], ['D [7,8]', 8],
]);

const ARROW_LINKS = new Map([
  [3, 4], [4, 3], [17, 19], [19, 17], [24, 25], [25, 24],
  [26, 27], [27, 26], [28, 57], [57, 28], [49, 50], [50, 49],
]);

// These are verbatim owner-curated DOCX formulas. Keep the exceptions exact so
// a future import cannot silently add, remove, or "fix" source text.
const DOCX_STATE_EXCEPTIONS = new Set([
  "OLL 24\0U x (l B' l' U) (l B l' U') x'",
  "OLL 25\0U x (l B l' U) (l B' l' U') x'",
  "OLL 30\0x' U2 (R U R' D) (R U2 R U) R2' D' x",
  "OLL 55\0r U2' (r' l') U2 r U2' r' U2 (r l) U2' r'",
  "OLL 2\0U2 (F R U R' U' F') U2 (F U R U' R' f')",
]);

const DOCX_PRECONDITION_EXCEPTIONS = new Set([
  "OLL 30\0x' U2 (R U R' D) (R U2 R U) R2' D' x",
  "OLL 55\0r U2' (r' l') U2 r U2' r' U2 (r l) U2' r'",
  "OLL 2\0U2 (F R U R' U' F') U2 (F U R U' R' f')",
]);

const RIGHT_OH_STATE_EXCEPTIONS = new Set([
  "OLL 24\0U' x r' B r U' r' B' r U x'",
  "OLL 25\0U' x r' B' r U' r' B r U x'",
]);

const FACE: AlgSticker = { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' };

function visualStateAfter(alg: string): Record<number, string[]> {
  const initial: Record<number, string[]> = {};
  for (const face of AllFaces) initial[face] = Array(9).fill(String(face));
  const cube = new CubeData(3, initial);
  for (const turn of parseAlgorithm(normalizeAlg('3x3', alg))) cube.turn(turn);
  return cube.faces;
}

const OLL_RIM: Array<[number, number]> = (() => {
  const solved = visualStateAfter('');
  const turned = visualStateAfter('U');
  const rim: Array<[number, number]> = [];
  for (const face of AllFaces) {
    if (face === Face.U || face === Face.D) continue;
    for (let index = 0; index < 9; index++) {
      if (solved[face][index] !== turned[face][index]) rim.push([face, index]);
    }
  }
  return rim;
})();

function ollMask(alg: string): string {
  const after = visualStateAfter(alg);
  const up = String(Face.U);
  return [
    ...after[Face.U].map(value => value === up),
    ...OLL_RIM.map(([face, index]) => after[face][index] === up),
  ].map(value => value ? '1' : '0').join('');
}

function sameOllCase(a: string, b: string): boolean {
  const left = ollMask(a);
  return ['', 'y', 'y2', "y'"].some(rotation => left === ollMask(`${b} ${rotation}`));
}

function runtimeCases(): AlgCase[] {
  return imported.map(item => ({
    name: item.name,
    subgroup: item.category,
    setup: ollDbSetups[item.name as keyof typeof ollDbSetups],
    sticker: FACE,
    algs: [item.algs],
    meta: { no: item.no, mirror: item.mirror },
  }));
}

describe('OLL DOCX import', () => {
  it('locks all 57 cases in the owner-curated category and case order', () => {
    expect(imported).toHaveLength(57);
    expect(imported.map(item => item.no)).toEqual(CASE_ORDER);
    expect(imported.map(item => item.position)).toEqual(Array.from({ length: 57 }, (_, index) => index));
    expect(new Set(imported.map(item => item.no)).size).toBe(57);

    const actualCounts = new Map<string, number>();
    for (const item of imported) actualCounts.set(item.category, (actualCounts.get(item.category) ?? 0) + 1);
    expect(actualCounts).toEqual(CATEGORY_COUNTS);
  });

  it('preserves 269 curated formulas, exact 180-degree primes, and five formula tags', () => {
    const algs = imported.flatMap(item => item.algs);
    expect(algs).toHaveLength(269);
    expect(imported.find(item => item.no === 1)?.algs[0].alg)
      .toBe("(R U2' R2' F R F') U2' (R' F R F')");
    expect(algs.every(entry => entry.source === 'cuberoot')).toBe(true);
    expect(algs.some(entry => entry.alg.includes("2'"))).toBe(true);

    const tagCounts = new Map<string, number>();
    for (const entry of algs) {
      for (const tag of entry.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    expect(tagCounts).toEqual(new Map([
      ['big', 30], ['fmc', 14], ['ft', 18], ['key', 28], ['oh', 65],
    ]));
  });

  it('stores ETM plus four optimal metrics and keeps arrows separate from mirror links', () => {
    for (const item of imported) {
      expect(Object.keys(item.metrics).sort(), item.name).toEqual([
        'etm', 'optimalAtm', 'optimalEtm', 'optimalHtm', 'optimalStm',
      ]);
      expect(Object.values(item.metrics).every(Number.isInteger), item.name).toBe(true);
      expect(item.scrambleFrom ?? undefined).toBe(ARROW_LINKS.get(item.no));
    }

    const byNo = new Map(imported.map(item => [item.no, item]));
    for (const item of imported) {
      expect(byNo.get(item.mirror)?.mirror, item.name).toBe(item.no);
    }
    expect(imported.some(item => item.scrambleFrom != null && item.scrambleFrom !== item.mirror)).toBe(true);
  });

  it('keeps the SQL merge scoped, guarded, idempotent, and DOCX-first', () => {
    expect(SQL).toContain("puzzle = '3x3' AND set_slug = 'oll'");
    expect(SQL).toContain('Expected 57 existing 3x3/oll cases');
    expect(SQL).toContain('curated_algs || preserved_algs');
    expect(SQL).toContain("'2'''",);
    expect(SQL).toContain("merged_meta := merged_meta - 'scramble'");
  });

  it('locks every case to the existing state and validates every formula-specific setup', async () => {
    const kpuzzle = await getCube3();
    const solved = kpuzzle.defaultPattern();
    const failures: string[] = [];
    const stateExceptions = new Set<string>();
    const preconditionExceptions = new Set<string>();
    for (const item of runtimeCases()) {
      const firstSetup = item.algs[0][0]?.setup;
      if (!firstSetup || !sameOllCase(firstSetup, item.setup)) {
        failures.push(`${item.name}: first formula does not match the existing case state`);
      }
      for (const entry of item.algs[0]) {
        const key = `${item.name}\0${entry.alg}`;
        if (!entry.setup) {
          failures.push(`${item.name}: missing setup for ${entry.alg}`);
          continue;
        }
        if (displayAlg(entry.alg) !== entry.alg) {
          failures.push(`${item.name}: formula has a trailing display-only AUF: ${entry.alg}`);
        }
        if (!sameOllCase(entry.setup, item.setup)) {
          stateExceptions.add(key);
        }
        const precondition = await checkSetupPrecondition(entry.setup, '3x3', 'oll', kpuzzle);
        if (!precondition.ok) preconditionExceptions.add(key);
        for (const angle of CASE_VIEW_ANGLES) {
          const playerAlg = displayAlg(caseViewAlg(entry.alg, angle));
          const result = solved.applyAlg(normalizeAlg(
            '3x3',
            `${caseViewSetup(entry.setup, angle)} ${playerAlg}`,
          ));
          if (!result.isIdentical(solved)) {
            failures.push(`${item.name}: ${entry.alg}: player angle ${angle} did not solve`);
          }
        }
        const result = await validateAlgCase(entry.setup, entry.alg, item.sticker, '3x3', 'oll');
        if (!result.ok) failures.push(`${item.name}: ${entry.alg}: ${result.reason}`);
      }
    }
    expect([...stateExceptions].sort()).toEqual([...DOCX_STATE_EXCEPTIONS].sort());
    expect([...preconditionExceptions].sort()).toEqual([...DOCX_PRECONDITION_EXCEPTIONS].sort());
    expect(failures).toEqual([]);
  });

  it('derives every right-OH formula from the mirror partner in source priority order', async () => {
    const cases = runtimeCases();
    const kpuzzle = await getCube3();
    const solved = kpuzzle.defaultPattern();
    const failures: string[] = [];
    const stateExceptions = new Set<string>();
    for (const item of cases) {
      const partner = cases.find(candidate => candidate.meta?.no === item.meta?.mirror)!;
      const partnerOh = partner.algs[0].filter(entry => entry.tags?.includes('oh'));
      const rightOh = ohAlgsForCase(item, cases, 0, 'right');
      expect(rightOh, item.name).toHaveLength(partnerOh.length);
      for (const entry of rightOh) {
        expect(entry).not.toHaveProperty('algHtml');
        expect(entry).not.toHaveProperty('altId');
        expect(entry).not.toHaveProperty('ytId');
        expect(entry).not.toHaveProperty('gen');
        expect(entry).not.toHaveProperty('src');
        if (!entry.setup) {
          failures.push(`${item.name}: missing setup for ${entry.alg}`);
          continue;
        }
        const precondition = await checkSetupPrecondition(entry.setup, '3x3', 'oll', kpuzzle);
        if (!precondition.ok) failures.push(`${item.name}: ${entry.alg}: ${precondition.reason}`);
        if (!sameOllCase(entry.setup, item.setup)) {
          stateExceptions.add(`${item.name}\0${entry.alg}`);
        }
        const final = solved.applyAlg(normalizeAlg('3x3', `${entry.setup} ${entry.alg}`));
        if (!final.isIdentical(solved)) failures.push(`${item.name}: ${entry.alg}: did not solve`);
        const result = await validateAlgCase(entry.setup, entry.alg, item.sticker, '3x3', 'oll');
        if (!result.ok) failures.push(`${item.name}: ${entry.alg}: ${result.reason}`);
      }
    }
    expect([...stateExceptions].sort()).toEqual([...RIGHT_OH_STATE_EXCEPTIONS].sort());
    expect(failures).toEqual([]);
  });
});
