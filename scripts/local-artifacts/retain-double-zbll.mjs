/** Explicit, one-job retention cleanup; no solver, table generation or recursive deletion. */
import { readFileSync, writeFileSync, readdirSync, lstatSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyRetainedDoubleZbll } from '../../core/jobs/alg-build/src/double-zbll-retained.mts';

const root = resolve(import.meta.dirname, '../..');
const work = resolve(root, '.local-data/double-zbll-symmetry-v2');
const apply = process.argv.slice(2).join(' ') === '--apply';
if (process.argv.length > 2 && !apply) throw Error('Use no arguments to plan, or --apply');
const json = name => JSON.parse(readFileSync(resolve(work, name), 'utf8'));
const progress = json('progress.json');
if (progress.status !== 'complete' || progress.verified !== 7555446 || progress.total !== 7555446) throw Error('Task is not complete');
for (const name of ['owner.pid', 'compute.lock']) {
  if (existsSync(resolve(work, name))) throw Error(`Owner marker present; leave untouched: ${name}`);
}
const processes = execFileSync('ps', ['-axo', 'pid=,args='], { encoding: 'utf8' });
if (processes.split('\n').some(line => /(?:double-zbll-symmetry\.(?:mts|mjs)|double-zbll-auf-run\.(?:mts|mjs)|double-zbll-select\.(?:mts|mjs))\s/.test(line))) throw Error('Double ZBLL process may be active; leave untouched');
const manifestBytes = readFileSync(resolve(work, 'export/manifest.json'));
const manifest = JSON.parse(manifestBytes.toString());
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.pairCount !== 243049 || manifest.caseCount !== 493 || manifest.sourceStates !== progress.verified) throw Error('Incomplete final export');
for (const [name, hash] of [[manifest.dataFile, manifest.dataSha256], [manifest.casesFile, manifest.casesSha256]]) {
  if (!/^[\w.-]+$/.test(name) || sha(readFileSync(resolve(work, 'export', name))) !== hash) throw Error('Final export hash mismatch');
}
const targets = ['solutions.csv', 'representatives.csv', 'finished-pairs.csv', 'selected-pairs.json', 'selected-pairs-snapshot.json', 'run.log'];
for (const entry of readdirSync(resolve(work, 'batches'), { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^\d{6}$/.test(entry.name)) throw Error('Unexpected batch entry');
  for (const name of ['input.json', 'batch.json', 'corpus.csv', 'solutions.csv', 'solutions.csv.rust.jsonl']) targets.push(`batches/${entry.name}/${name}`);
}
const files = targets.filter(name => existsSync(resolve(work, name))).map(name => {
  const s = lstatSync(resolve(work, name));
  if (!s.isFile()) throw Error(`Not a regular file: ${name}`);
  return { name, bytes: s.size, mtimeMs: s.mtimeMs, ino: s.ino };
});
const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(JSON.stringify({ apply, files: files.length, bytes, retainedPairs: manifest.pairCount, computeSeconds: progress.computeSeconds }));
if (!apply) process.exit(0);
if (existsSync(resolve(work, 'retention.json'))) {
  verifyRetainedDoubleZbll(work);
} else {
  // Marker is durable before the first deletion, so interrupted cleanup never resumes computation.
  writeFileSync(resolve(work, 'retention.json'), JSON.stringify({
    schema: 1, mode: 'final-results-and-statistics', createdAt: new Date().toISOString(),
    manifestSha256: sha(manifestBytes), removedRawDetails: true,
    retained: ['export/', 'progress.json', 'batches/*/report.json', 'batches/*/progress.json', 'resource reviews and integrity metadata'],
    note: 'Raw inputs, per-state outputs and duplicate selections intentionally removed by owner request; export is authoritative. Historical hashes record provenance, not files still present.',
  }, null, 2) + '\n', { flag: 'wx' });
}
verifyRetainedDoubleZbll(work);
const receipt = resolve(work, 'retention-deletions.json');
const previous = existsSync(receipt) ? JSON.parse(readFileSync(receipt, 'utf8')) : [];
writeFileSync(receipt, JSON.stringify([...previous, { at: new Date().toISOString(), files, bytes }], null, 2) + '\n');
for (const file of files) {
  const path = resolve(work, file.name), s = lstatSync(path);
  if (s.ino !== file.ino || s.size !== file.bytes || s.mtimeMs !== file.mtimeMs) throw Error(`Changed since plan; stop: ${file.name}`);
  unlinkSync(path);
}
console.log('Retained final export, original timing/speed and per-batch statistics; removed only enumerated raw details.');
