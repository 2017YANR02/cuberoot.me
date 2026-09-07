/** 复核最终导入清单：每条合并公式都必须从对应 setup 实测还原。 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { puzzles } from 'cubing/puzzles';

const ROOT = resolve(import.meta.dirname, '../../../../..');
const input = resolve(ROOT, process.argv[2] ?? '.tmp/best2x2/import.json');

interface ImportFile {
  stats: Record<string, number>;
  sets: {
    slug: string;
    cases: { name: string; setup: string; algs: { alg: string; setup?: string }[][] }[];
  }[];
  quarantine: unknown[];
}

const data = JSON.parse(await readFile(input, 'utf8')) as ImportFile;
const puzzle = await puzzles['2x2x2'].kpuzzle();
const solved = (alg: string): boolean => {
  // Source notation includes parentheses and R3; parse it without rewriting stored moves.
  return puzzle.defaultPattern().applyAlg(alg).experimentalIsSolved({
    ignorePuzzleOrientation: true, ignoreCenterOrientation: true,
  });
};

let cases = 0;
let algs = 0;
const failures: string[] = [];
for (const set of data.sets) for (const c of set.cases) {
  cases++;
  for (const entry of c.algs.flat()) {
    algs++;
    try {
      if (!solved([entry.setup ?? c.setup, entry.alg].filter(Boolean).join(' '))) {
        failures.push(`${set.slug}/${c.name}: ${entry.alg}`);
      }
    } catch (error) {
      failures.push(`${set.slug}/${c.name}: ${entry.alg} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
}

if (failures.length) {
  console.error(failures.slice(0, 50).join('\n'));
  throw new Error(`${failures.length}/${algs} 条合并公式不能还原自己的 setup`);
}
console.log(JSON.stringify({ sets: data.sets.length, cases, algs, quarantine: data.quarantine.length }));
