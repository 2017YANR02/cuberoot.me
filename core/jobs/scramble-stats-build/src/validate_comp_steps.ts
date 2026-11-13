/** Publication gate: every competition/scramble has every supported stage and bottom. */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMP_STEP_TARGETS } from './comp_step_targets.js';

export async function validateCompSteps(root: string) {
  const reference = (await readdir(join(root, 'comp_steps'))).filter(name => name.endsWith('.json')).sort();
  if (!reference.length) throw new Error('Empty competition statistics');
  for (const target of COMP_STEP_TARGETS) {
    const names = (await readdir(join(root, target.outDir))).filter(name => name.endsWith('.json')).sort();
    if (names.length !== reference.length || names.some((name, i) => name !== reference[i])) {
      throw new Error(`Incomplete competition coverage: ${target.outDir}`);
    }
  }
  let scrambles = 0;
  for (const name of reference) {
    let keys: string[] | undefined;
    for (const target of COMP_STEP_TARGETS) {
      const file = join(root, target.outDir, name);
      const rows = JSON.parse(await readFile(file, 'utf8'));
      if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw new Error(`Invalid statistics: ${file}`);
      keys ??= Object.keys(rows);
      if (!keys.length || Object.keys(rows).length !== keys.length) throw new Error(`Incomplete scramble coverage: ${file}`);
      for (const key of keys) {
        const values = rows[key];
        if (!Array.isArray(values) || values.length !== target.stages * 6
          || values.some(value => !Number.isInteger(value) || value < 0)) {
          throw new Error(`Missing/invalid stage values: ${file}: ${key}`);
        }
      }
    }
    scrambles += keys!.length;
  }
  const result = { competitions: reference.length, scrambles, variants: COMP_STEP_TARGETS.length };
  console.log('[coverage]', JSON.stringify(result));
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateCompSteps(resolve(process.argv[2] ?? 'stats/scramble'));
}
