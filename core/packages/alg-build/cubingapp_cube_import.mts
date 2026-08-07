import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';

export type CubingAppAlgMeta = { note?: string; setup?: string };
export type CubingAppCase = { subset?: string; algs: Record<string, CubingAppAlgMeta> };
export type CubingAppSet = {
  puzzle: string;
  diagramType?: string;
  gray?: Array<number | string>;
  subsets?: string[];
  texts?: string[];
  cases: Record<string, CubingAppCase>;
};

export function invariant(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

/** Read one data-driven CubingApp set without copying its route implementation. */
export function readCubingAppSet(upstreamRoot: string, file: string): CubingAppSet {
  const path = resolve(upstreamRoot, 'tanstack/src/routes/algorithms/algs', `${file}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as CubingAppSet;
}

/** CubingApp uses parentheses only as visual move grouping in these JSON files. */
export function cleanCubeAlg(value: string): string {
  return value.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

/** CubingApp writes 4x4 all-inner-slice moves as `M`; cubing.js correctly calls that grip invalid. */
export function normalizeFourByFourAlg(value: string): string {
  return cleanCubeAlg(value).replace(/(^|\s)M(?=(?:\d+)?'?(?:\s|$))/g, '$1m');
}

export function invertCubeAlg(value: string): string {
  const cleaned = cleanCubeAlg(value);
  invariant(cleaned.length > 0, 'cannot invert an empty algorithm');
  return new Alg(cleaned).invert().toString();
}

const AUF_CANDIDATES = ['', 'U', 'U2', "U'"] as const;

/**
 * Re-anchor an imported formula to an audited setup, preferring an invisible
 * finishing AUF before trying a leading AUF. The UI removes the suffix again
 * via displayAlg(); a necessary prefix remains visible to describe the case.
 */
export async function completeExactAlgAuf(
  puzzleId: keyof typeof puzzles,
  setup: string,
  alg: string,
): Promise<string> {
  const kpuzzle = await puzzles[puzzleId].kpuzzle();
  const solved = JSON.stringify(kpuzzle.defaultPattern().patternData);
  const candidates = [
    ...AUF_CANDIDATES.map(post => ['', post] as const),
    ...AUF_CANDIDATES.slice(1).map(pre => [pre, ''] as const),
    ...AUF_CANDIDATES.slice(1).flatMap(pre => (
      AUF_CANDIDATES.slice(1).map(post => [pre, post] as const)
    )),
  ];
  for (const [pre, post] of candidates) {
    const complete = [pre, cleanCubeAlg(alg), post].filter(Boolean).join(' ');
    const result = kpuzzle.defaultPattern().applyAlg(`${cleanCubeAlg(setup)} ${complete}`);
    if (JSON.stringify(result.patternData) === solved) return complete;
  }
  throw new Error(`${puzzleId}: formula does not solve audited setup: ${setup} + ${alg}`);
}

export function sourceCubeAlgs(
  source: CubingAppCase,
  noteZh: Readonly<Record<string, string>>,
  transform: (value: string) => string = cleanCubeAlg,
) {
  const entries = Object.entries(source.algs);
  invariant(entries.length > 0, 'CubingApp case has no algorithms');
  return [entries.map(([rawAlg, meta]) => {
    const alg = transform(rawAlg);
    // Parsing here makes generation fail before a malformed formula can reach PG.
    new Alg(alg);
    if (!meta.note) return { alg, source: 'cubingapp' as const };
    const zh = noteZh[meta.note];
    invariant(zh, `missing Chinese translation for CubingApp note: ${meta.note}`);
    return { alg, source: 'cubingapp' as const, note: { en: meta.note, zh } };
  })];
}

export function assertSetCounts(
  label: string,
  source: CubingAppSet,
  expectedCases: number,
  expectedAlgs: number,
) {
  const cases = Object.values(source.cases);
  invariant(cases.length === expectedCases, `${label}: expected ${expectedCases} cases, got ${cases.length}`);
  const algs = cases.reduce((sum, item) => sum + Object.keys(item.algs).length, 0);
  invariant(algs === expectedAlgs, `${label}: expected ${expectedAlgs} algorithms, got ${algs}`);
}
