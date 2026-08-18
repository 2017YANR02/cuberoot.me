#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { toMoveString } from '../../../../core/packages/shared/src/alg_notation.ts';

const cubingAlgUrl = new URL(
  '../../../../core/packages/client/node_modules/cubing/dist/lib/cubing/alg/index.js',
  import.meta.url,
);
const { Alg } = await import(cubingAlgUrl.href);

type ExtractedEntry = { alg: string; setup?: string };
type ExtractedCase = { no: number; algs: ExtractedEntry[] };
type ExtractedPayload = { cases: ExtractedCase[] };

function usage(): never {
  throw new Error('usage: add_formula_setups.mts <input.json> --puzzle <slug> --output <output.json>');
}

const args = process.argv.slice(2);
const inputArg = args[0];
const puzzleIndex = args.indexOf('--puzzle');
const outputIndex = args.indexOf('--output');
if (!inputArg || puzzleIndex < 0 || outputIndex < 0 || !args[puzzleIndex + 1] || !args[outputIndex + 1]) usage();

const input = resolve(inputArg);
const output = resolve(args[outputIndex + 1]);
const puzzle = args[puzzleIndex + 1];
if (!['2x2', '3x3', '4x4', '5x5'].includes(puzzle)) {
  throw new Error(`unsupported cube puzzle: ${puzzle}`);
}
const payload = JSON.parse(await readFile(input, 'utf8')) as ExtractedPayload;
let formulaCount = 0;

for (const item of payload.cases) {
  for (const entry of item.algs) {
    let setup = '';
    try {
      setup = new Alg(toMoveString(entry.alg)).invert().toString();
    } catch {
      setup = '';
    }
    if (!setup) throw new Error(`case ${item.no}: cannot invert formula ${entry.alg}`);
    entry.setup = setup;
    formulaCount += 1;
  }
}

await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
process.stdout.write(`wrote ${payload.cases.length} cases and ${formulaCount} formula setups to ${output}\n`);
