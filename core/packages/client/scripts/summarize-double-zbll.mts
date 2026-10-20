/** Small, read-only corpus aggregation: no solver, pruning tables or result journals. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeDoubleZbll, validDoubleZbllManifest } from '@cuberoot/shared/double-zbll';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(client, 'public/data/double-zbll');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = read(resolve(root, 'manifest.json'));
assert(validDoubleZbllManifest(manifest));
const data = readFileSync(resolve(root, manifest.dataFile));
const caseBytes = readFileSync(resolve(root, manifest.casesFile));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(data), manifest.dataSha256);
assert.equal(hash(caseBytes), manifest.casesSha256);
const cases = JSON.parse(caseBytes.toString()).cases as { name: string; subgroup: string }[];
assert.equal(cases.length, manifest.caseCount);
const progress = read(process.argv[2] ? resolve(process.argv[2]) : resolve(client, '../../../.tmp/double-zbll-symmetry-v2/progress.json'));
assert.equal(progress.status, 'complete');
assert.equal(progress.verified, manifest.sourceStates);
assert.equal(progress.pairs.finishedPairs, manifest.pairCount);

type Example = { top: string; bottom: string; scramble: string; htm: number; qtm: number; generators: number };
const group = () => ({ count: 0, totalHtm: 0, totalQtm: 0, histogram: Array<number>(21).fill(0), qtmHistogram: Array<number>(41).fill(0), generators: Array<number>(7).fill(0), shortest: [] as Example[], longest: [] as Example[] });
const groups = { pure: group(), all: group() };
for (let top = 0; top < cases.length; top++) for (let bottom = 0; bottom < cases.length; bottom++) {
  const scramble = decodeDoubleZbll(data, cases.length, top, bottom);
  const moves = scramble.split(' ');
  const example = { top: cases[top].name, bottom: cases[bottom].name, scramble, htm: moves.length, qtm: moves.reduce((sum, move) => sum + (move.endsWith('2') ? 2 : 1), 0), generators: new Set(moves.map(move => move[0])).size };
  const targets = [groups.all];
  if (!cases[top].subgroup.startsWith('PLL/') && !cases[bottom].subgroup.startsWith('PLL/')) targets.push(groups.pure);
  for (const target of targets) {
    target.count++;
    target.totalHtm += example.htm;
    target.totalQtm += example.qtm;
    target.histogram[example.htm]++;
    target.qtmHistogram[example.qtm]++;
    target.generators[example.generators]++;
    if (!target.shortest.length || example.htm < target.shortest[0].htm) target.shortest = [];
    if (!target.shortest.length || example.htm === target.shortest[0].htm) target.shortest.push(example);
    if (!target.longest.length || example.htm > target.longest[0].htm) target.longest = [];
    if (!target.longest.length || example.htm === target.longest[0].htm) target.longest.push(example);
  }
}
assert.deepEqual(groups.all.histogram, manifest.histogram);
assert.deepEqual(groups.pure.histogram, progress.website.histogram);
assert.equal(groups.pure.totalHtm / groups.pure.count, progress.website.bestMean);
const snapshot = {
  version: manifest.version, dataSha256: manifest.dataSha256, generatedAt: manifest.generatedAt,
  sourceStates: manifest.sourceStates, caseCount: manifest.caseCount,
  compute: { seconds: progress.computeSeconds, finalEngine: progress.solverEngine },
  baseline: { version: progress.website.baselineVersion, count: progress.website.pairCount, meanHtm: progress.website.baselineMean, improvedPairs: progress.website.improvedPairs, maxSaved: progress.website.maxSaved },
  groups,
};
writeFileSync(resolve(client, 'app/[lang]/alg/double-zbll-about/statistics.json'), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Summarized ${groups.all.count} records; retained every shortest/longest pair; no solver started.`);
