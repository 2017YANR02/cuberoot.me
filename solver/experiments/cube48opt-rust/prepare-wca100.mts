/** Freeze the first 100 complete records from the statistics pipeline corpus. No solver is run. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { wcaDir } from '../../333opt/data_paths.mjs';

const source = resolve(process.argv[2] ?? resolve(wcaDir, 'wca_scrambles_no_wide_move.txt'));
const count = Number(process.argv[3] ?? 100);
assert([100, 1000].includes(count));
const output = resolve(`solver/testdata/benchmarks/wca-first${count}.json`);
const sourceHash = createHash('sha256');
for await (const chunk of createReadStream(source)) sourceHash.update(chunk);
const cases: { id: string; scramble: string; group: string; sourceLine: number }[] = [];
const stream = createReadStream(source, 'utf8');
const lines = createInterface({ input: stream, crlfDelay: Infinity });
try {
  for await (const line of lines) {
    const comma = line.indexOf(',');
    assert(comma > 0, 'Invalid pipeline row; do not skip or replace it');
    const id = line.slice(0, comma), scramble = line.slice(comma + 1);
    assert(/^\d+$/.test(id) && /^(?:[URFDLB](?:2|')?)(?:\s+[URFDLB](?:2|')?)*$/.test(scramble));
    cases.push({ id, scramble, group: `wca${count}`, sourceLine: cases.length + 1 });
    if (cases.length === count) break;
  }
} finally { lines.close(); stream.destroy(); }
assert.equal(cases.length, count);
assert.equal(new Set(cases.map(row => row.id)).size, count);
const canonical = cases.map(row => `${row.id},${row.scramble}\n`).join('');
const result = {
  schema: `cuberoot.solver.wca-first${count}.v1`,
  source: 'wca_scramble/wca_scrambles_no_wide_move.txt',
  sourceSha256: sourceHash.digest('hex'),
  corpusSha256: createHash('sha256').update(canonical).digest('hex'),
  selection: `First ${count} physical records in source-file order; full scrambles, no filtering, truncation, reordering or replacement.`,
  cases,
};
const serialized = JSON.stringify(result, null, 2) + '\n';
if (existsSync(output)) assert.equal(readFileSync(output, 'utf8'), serialized, 'Frozen corpus differs; preserve it and investigate source drift');
else writeFileSync(output, serialized, { flag: 'wx' });
console.log(JSON.stringify({ output, count: cases.length, first: cases[0].id, last: cases.at(-1)!.id, corpusSha256: result.corpusSha256 }));
