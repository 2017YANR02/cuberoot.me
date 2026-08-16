import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import defaultsJson from '@/data/sq1-pbl/finder-defaults.json';
import goldenJson from '@/data/sq1-pbl/finder-golden.json';
import {
  findSq1PblSolutions,
  isSq1PblSolved,
  legacyOptimizeSq1PblSequence,
  normalizeSq1PblAuxiliary,
  parseSq1PblAuxiliaryInput,
  sq1PblMetrics,
  validateSq1PblAuxiliary,
  type Sq1PblFinderDefaults,
} from '@/lib/sq1-pbl';

const defaults = defaultsJson as Sq1PblFinderDefaults;
const golden = goldenJson.fixture;
const workspaceSource = readFileSync(new URL('../components/Sq1PblWorkspace.tsx', import.meta.url), 'utf8');

describe('Square-1 PBL Finder clean-room port', () => {
  test('locks the reflected desktop data invariants', () => {
    expect(defaults.plls.standard).toHaveLength(21);
    expect(defaults.plls.parity).toHaveLength(22);
    expect(defaults.plls.standard.map(pll => pll.name)).toEqual([
      'Ua', 'Ub', 'Z', 'H', 'Aa', 'Ab', 'E', 'F', 'Ja', 'Jb', 'Ra', 'Rb', 'T', 'Y', 'Na', 'Nb', 'Ga', 'Gb', 'Gc', 'Gd', 'V',
    ]);
    expect(defaults.plls.parity.map(pll => pll.name)).toEqual([
      'Adj', 'Opp', 'Oa', 'Ob', 'W', 'M', 'pN', 'pJ', 'X', 'Q', 'Ka', 'Kb', 'Sa', 'Sb', 'Ba', 'Bb', 'Ca', 'Cb', 'Da', 'Db', 'Pa', 'Pb',
    ]);
    expect(defaults.auxiliaryAlgorithms).toHaveLength(814);
    expect(validateSq1PblAuxiliary(defaults.auxiliaryAlgorithms)).toEqual([]);
  });

  test('validates name@sequence at the input boundary', () => {
    expect(parseSq1PblAuxiliaryInput('my alg@(1, 0) / (-1, 0)')).toEqual({
      ok: true,
      value: { name: 'my alg', sequence: '1,0/-1,0' },
    });
    expect(parseSq1PblAuxiliaryInput('bounded@/ (1, 0) /')).toEqual({
      ok: true,
      value: { name: 'bounded', sequence: '/1,0/' },
    });
    expect(parseSq1PblAuxiliaryInput('missing separator')).toEqual({ ok: false, reason: 'missing-separator' });
    expect(parseSq1PblAuxiliaryInput('@(1, 0)')).toEqual({ ok: false, reason: 'empty-name' });
    expect(parseSq1PblAuxiliaryInput('name@not-an-alg')).toEqual({ ok: false, reason: 'invalid-notation' });
  });

  test('normalizes imported fields to compact Finder notation without losing boundary slashes', () => {
    expect(normalizeSq1PblAuxiliary(' imported ', '(1, 0) / (-1, 0)')).toEqual({
      ok: true,
      value: { name: 'imported', sequence: '1,0/-1,0' },
    });
    expect(normalizeSq1PblAuxiliary('bounded', '/ (1, 0) /')).toEqual({
      ok: true,
      value: { name: 'bounded', sequence: '/1,0/' },
    });
  });

  test('keeps worker startup and stale-message recovery guards in the Finder boundary', () => {
    expect(workspaceSource).toMatch(/try \{\s*worker = new Worker/u);
    expect(workspaceSource).toContain('message.id !== id || requestRef.current !== id');
    expect(workspaceSource).toContain('worker.onerror = () => {\n      if (requestRef.current !== id) return;');
    expect(workspaceSource).toMatch(/try \{\s*worker\.postMessage\(\{ id, input \}\);/u);
    expect(workspaceSource).toContain('useEffect(() => () => {\n    requestRef.current += 1;');
    expect(workspaceSource).toContain('const clearResult = () => {\n    requestRef.current += 1;');
    expect(workspaceSource).toContain('const cancelFinder = () => {\n    requestRef.current += 1;');
  });

  test('uses the desktop STM and FTM display metrics', () => {
    expect(sq1PblMetrics('4,-3/5,-1/-3,0/1,1/-3,0/-1,0')).toEqual({ stm: 5, ftm: 14 });
  });

  test.each([
    ['', ''],
    ['/', '//'],
    ['//', '//'],
    ['///', '//'],
    ['0,0', ''],
    ['/0,0', ''],
    ['0,0/', ''],
    ['/0,0/', '//'],
    ['/0,0/0,0', ''],
    ['/0,0/0,0/', ''],
    ['1,0', '1,0'],
    ['/1,0', '/1,0'],
    ['1,0/', '1,0/'],
    ['/1,0/', '/1,0/'],
    ['1,2//3,4', '1,2/3,4'],
    ['1,0///2,0', '1,0/2,0'],
    ['1,0/0,0//2,0', '3,0'],
    ['1,0/0,0/2,0', '3,0'],
    ['1,0/0,0/-1,0', ''],
    ['1,0/-1,0', '1,0/-1,0'],
    ['6,0/0,0/6,0', ''],
    ['7,0/0,0/6,0', '1,0'],
    ['5,0/0,0/6,0', '-1,0'],
    ['10,0/0,0/9,0', '7,0'],
    ['-5,0/0,0/-2,0', '19,0'],
    ['-6,0/0,0/-6,0', '24,0'],
    ['-7,0/0,0/-6,0', '25,0'],
    ['-10,0/0,0/-9,0', '31,0'],
    ['0,5/0,0/0,6', '0,-1'],
    ['0,-5/0,0/0,-2', '0,19'],
    ['20,0/0,0/20,0', '28,0'],
    ['-20,0/0,0/-20,0', '52,0'],
    ['19,0/0,0/0,0', '7,0/'],
    ['-19,0/0,0/0,0', '31,0/'],
    ['0,0/0,0/19,0', '19,0'],
    ['0,0/0,0/-19,0', '-19,0'],
    ['1,2/0,0/3,4/0,0/5,6', '-3,0'],
    ['1,2/0,0/3,4/0,0/-4,-6', ''],
    ['/0,0/0,0/0,0/1,0', '1,0'],
    ['/0,0/1,0/0,0/0,0', '1,0/'],
    [
      '/0,0/0,0/0,0/4,-3/5,-1/-3,0/1,1/-3,0/-1,0',
      '4,-3/5,-1/-3,0/1,1/-3,0/-1,0',
    ],
    [
      '/0,0/4,-3/5,-1/-3,0/1,1/-3,0/-1,0/0,0/0,0',
      '4,-3/5,-1/-3,0/1,1/-3,0/-1,0/',
    ],
  ] as const)('matches legacy optimizer black-box fixture %s', (input, expected) => {
    expect(legacyOptimizeSq1PblSequence(input)).toBe(expected);
  });

  test('strict mode rejects a flipped middle that legacy mode accepts', () => {
    const solvedPieces = [
      0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
      8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
    ];
    const flippedMiddle = { pieces: solvedPieces, sliceSolved: false };
    expect(isSq1PblSolved(flippedMiddle)).toBe(true);
    expect(isSq1PblSolved(flippedMiddle, 'legacy')).toBe(true);
    expect(isSq1PblSolved(flippedMiddle, 'strict')).toBe(false);
  });

  test('rejects invalid auxiliary algorithms before searching', () => {
    const ua = defaults.plls.standard.find((pll) => pll.name === 'Ua')!;
    expect(() => findSq1PblSolutions({
      top: ua,
      bottom: ua,
      auxiliary: [{ name: 'broken', sequence: 'not-an-alg' }],
      mode: 'legacy',
    })).toThrow('Invalid auxiliary algorithms');
  });

  test('returns no results when the only auxiliary pair cannot solve the target', () => {
    const ua = defaults.plls.standard.find((pll) => pll.name === 'Ua')!;
    const result = findSq1PblSolutions({
      top: ua,
      bottom: ua,
      auxiliary: [{ name: 'nothing', sequence: '/0,0/0,0' }],
      mode: 'legacy',
    });
    expect(result.candidateCount).toBe(1);
    expect(result.solutions).toEqual([]);
  });

  test('keeps the desktop no-op behavior for an unsliceable legacy slash', () => {
    const ua = defaults.plls.standard.find((pll) => pll.name === 'Ua')!;
    const auxiliary = ['U+/U-7', 'Rb/L5'].map((name) =>
      defaults.auxiliaryAlgorithms.find((algorithm) => algorithm.name === name)!,
    );
    const result = findSq1PblSolutions({ top: ua, bottom: ua, auxiliary, mode: 'legacy' });

    expect(result.solutions.some((solution) =>
      solution.auxiliary[0] === 'U+/U-7' && solution.auxiliary[1] === 'Rb/L5',
    )).toBe(true);
  });

  test('matches the Ua/Ua black-box golden result order', { timeout: 60_000 }, () => {
    const ua = defaults.plls.standard.find((pll) => pll.name === 'Ua');
    expect(ua).toBeDefined();
    const result = findSq1PblSolutions({
      top: ua!,
      bottom: ua!,
      auxiliary: defaults.auxiliaryAlgorithms,
      mode: 'legacy',
    });

    expect(result.candidateCount).toBe(golden.orderedCandidateCount);
    expect(result.solutions).toHaveLength(golden.expectedSolutionCount);
    expect(result.solutions.map((solution) => ({
      sequence: solution.compactAlgorithm,
      auxiliaryAlgorithms: solution.auxiliary,
      stm: solution.stm,
      ftm: solution.ftm,
    }))).toEqual(golden.expectedResults.map((entry) => ({
      sequence: entry.sequence,
      auxiliaryAlgorithms: entry.auxiliaryAlgorithms,
      stm: entry.stm,
      ftm: entry.ftm,
    })));
    expect(result.solutions.slice(0, 3).map((solution) => solution.stm)).toEqual([5, 5, 6]);
    expect(result.solutions[0].auxiliary).toEqual(['nothing', 'U+/U-7']);
    expect(result.solutions[2].auxiliary).toEqual(['U+/U-7', 'nothing']);
    expect(result.solutions[0].compactAlgorithm.endsWith('/')).toBe(false);
    expect(result.solutions[2].compactAlgorithm.endsWith('/')).toBe(true);
  });
});
