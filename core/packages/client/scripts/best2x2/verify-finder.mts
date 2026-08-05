/** 用最终导入清单跑一次完整 two-tools 搜索，并逐条验返回的解。 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { TwoToolsCaseInput } from '../../lib/two-tools-solver.ts';
const { findTwoToolsSolutions } = await import('../../lib/two-tools-solver.ts');
const { TWO_TOOLS_TIMINGS } = await import('../../lib/two-tools-timings.ts');
const { applyPocketAlg, pocketStateToFacelet, solvedPocketState, POCKET_FACES } =
  await import('../../lib/pocket-facelet.ts');

const ROOT = resolve(import.meta.dirname, '../../../../..');
const input = resolve(ROOT, process.argv[2] ?? '.tmp/best2x2/import.json');
const scramble = process.argv.slice(3).join(' ') || "R U R' F2 U' R2 F R2 U2";
const METHOD: Record<string, string> = {
  cll: 'CLL', eg1: 'EG-1', eg2: 'EG-2', leg1: 'LEG-1',
  'tcll-plus': 'TCLL+', 'tcll-minus': 'TCLL-',
  ls1: 'LS-1', ls2: 'LS-2', ls3: 'LS-3', ls4: 'LS-4', ls5: 'LS-5',
  ls6: 'LS-6', ls7: 'LS-7', ls8: 'LS-8', ls9: 'LS-9',
};

interface ImportFile {
  sets: { slug: string; cases: { name: string; subgroup: string; setup: string; algs: { alg: string }[][] }[] }[];
}
const data = JSON.parse(await readFile(input, 'utf8')) as ImportFile;
const cases: TwoToolsCaseInput[] = data.sets.flatMap((set) => METHOD[set.slug]
  ? set.cases.map((c) => ({
    set: set.slug, method: METHOD[set.slug], name: c.name, subgroup: c.subgroup,
    setup: c.setup, algs: c.algs.flat().map((a) => a.alg),
  }))
  : []);

const start = performance.now();
const solutions = findTwoToolsSolutions({
  scramble,
  cases,
  depths: { EG: 5, TCLL: 4, LS: 3 },
  algsPerCase: 1,
}, TWO_TOOLS_TIMINGS);
const elapsedMs = Math.round(performance.now() - start);
if (!solutions.length) throw new Error(`完整公式库没有找到解:${scramble}`);

for (const solution of solutions) {
  const full = [scramble, solution.inspection, solution.solution].filter(Boolean).join(' ');
  const facelet = pocketStateToFacelet(applyPocketAlg(solvedPocketState(), full));
  if (!POCKET_FACES.every((_, i) => new Set(facelet.slice(i * 4, i * 4 + 4)).size === 1)) {
    throw new Error(`返回了不能还原的解:${full}`);
  }
}

console.log(JSON.stringify({ cases: cases.length, scramble, solutions: solutions.length, elapsedMs, first: solutions[0] }));
