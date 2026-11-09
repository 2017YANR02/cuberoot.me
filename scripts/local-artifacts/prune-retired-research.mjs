/** Owner-authorized 2026-11-09 cleanup. Plan on the source Mac, apply the same list on both. */
import { existsSync, readdirSync, lstatSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, realpathSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const root = realpathSync(resolve(import.meta.dirname, '../..'));
const recordDir = resolve(root, '.local-data/migrations/retention-2026-11-09');
const planPath = resolve(recordDir, 'plan.json');
const mode = process.argv[2] ?? '--plan';
if (process.argv.length > 3 || !['--plan', '--apply'].includes(mode)) throw Error('Use --plan or --apply');
const cacheGroups = new Set([
  'opt8-native-batch-source-20261015', 'opt8-native-quarter-cpu-source-20261015',
  'opt8-native-quarter-source-20261015', 'opt8-native-search-source-20261015', 'opt8-native-specialized-source-20261015',
  'rust-wasm-bpmx-candidate', 'rust-wasm-bpmx-jump-candidate', 'rust-wasm-const-contexts-candidate',
  'rust-wasm-fetch-reuse-candidate', 'rust-wasm-opt9-specialized-candidate', 'rust-wasm-padded-candidate',
  'rust-wasm-query-mask-candidate', 'rust-wasm-shared-builds', 'rust-wasm-simd-candidate',
  'rust-wasm-v3-candidate', 'rust-wasm-v4-candidate',
]);
function category(name) {
  if (name.startsWith('.local-data/table-gen-opt/') && name.endsWith('.bin')) return 'duplicate-generated-tables';
  if (/^\.local-data\/table-gen-opt\/table_generator-(adaptive|baseline|read-cas)$/.test(name)) return 'retired-generators';
  if (name === '.local-data/cubeopt-reverse/opt9-generated/h48prun31h9.dat') return 'retired-opt9-table';
  if (name === '.local-data/cubeopt-reverse/nxopt22-20261015/nxopth22b.dat') return 'retired-nxopt-table';
  if (name.startsWith('.local-data/cubeopt-reverse/corner96/') && /\.(dat|chk|checkpoint)$/.test(name)) return 'retired-corner-tables';
  const parts = name.split('/');
  if (parts[0] === '.local-data' && parts[1] === 'cubeopt-reverse' && cacheGroups.has(parts[2]) && parts.slice(3).includes('target')) return 'old-build-cache';
  return undefined;
}
function checkedPath(name) {
  if (typeof name !== 'string' || name.split('/').some(x => !x || x === '.' || x === '..')) throw Error('Invalid cleanup path');
  const path = resolve(root, name);
  if (!category(name) || relative(root, path) !== name) throw Error(`Out of cleanup scope: ${name}`);
  let parent = root;
  for (const part of name.split('/').slice(0, -1)) {
    parent = resolve(parent, part);
    if (lstatSync(parent).isSymbolicLink()) throw Error(`Symlink parent: ${name}`);
  }
  return path;
}
function requiredArtifacts() {
  const base = resolve(root, '.local-data/cubeopt-reverse');
  if (lstatSync(resolve(base, 'opt10-generated-v2/cuberoot-opt10.dat')).size !== 31_130_911_744) throw Error('Opt10 main table missing');
  const small = readFileSync(resolve(base, 'opt9-generated/small-memory.bin'));
  if (createHash('sha256').update(small).digest('hex') !== '0db5898f544781d7088be836e9759c61d45ffcc7bf3ceb18010f5cba5932377d') throw Error('Opt10 auxiliary table differs');
}
function walk(dir, output) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name), name = relative(root, path);
    if (entry.isDirectory()) walk(path, output);
    else if (entry.isFile() && category(name)) {
      const stat = lstatSync(path);
      if (category(name) === 'duplicate-generated-tables') {
        const canonical = resolve(root, 'solver/tables', basename(name));
        if (!existsSync(canonical) || lstatSync(canonical).size !== stat.size) throw Error(`Canonical table absent/different: ${name}`);
      }
      output.push({ name, category: category(name), bytes: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
}
requiredArtifacts();
mkdirSync(recordDir, { recursive: true });
if (mode === '--plan') {
  const files = [];
  for (const dir of ['table-gen-opt', 'cubeopt-reverse']) walk(resolve(root, '.local-data', dir), files);
  const groups = {};
  for (const f of files) groups[f.category] = (groups[f.category] ?? 0) + f.bytes;
  const plan = { schema: 1, createdAt: new Date().toISOString(), files, groups, bytes: files.reduce((n, f) => n + f.bytes, 0) };
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ planPath, files: files.length, bytes: plan.bytes, groups }));
} else {
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  if (plan.schema !== 1 || !Array.isArray(plan.files)) throw Error('Invalid plan');
  const processNames = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' });
  if (processNames.split('\n').some(name => /(?:cube48opt-research|table_generator|nxopt22|solve_h48)[^/]*$/.test(name))) throw Error('Native research process is active; no deletion');
  const opened = spawnSync('lsof', ['-nP', '-F', 'n'], { encoding: 'utf8', maxBuffer: 64 * 1024 ** 2 });
  if (opened.error || ![0, 1].includes(opened.status)) throw Error('Could not check open files');
  const openPaths = new Set(opened.stdout.split('\n').filter(x => x.startsWith('n')).map(x => x.slice(1)));
  const candidates = [], skipped = [];
  for (const file of plan.files) {
    const path = checkedPath(file.name);
    if (!existsSync(path)) { skipped.push({ name: file.name, reason: 'already absent' }); continue; }
    const stat = lstatSync(path);
    // rsync preserves timestamps to whole seconds on the second Mac.
    if (!stat.isFile() || stat.size !== file.bytes || Math.abs(stat.mtimeMs - file.mtimeMs) >= 1000) {
      skipped.push({ name: file.name, reason: 'changed on this Mac; preserved' }); continue;
    }
    if (openPaths.has(path)) throw Error(`Candidate is open; no deletion: ${file.name}`);
    if (file.category === 'duplicate-generated-tables') {
      const canonical = resolve(root, 'solver/tables', basename(file.name));
      if (!existsSync(canonical) || lstatSync(canonical).size !== file.bytes) throw Error('Canonical table missing on this Mac');
    }
    candidates.push({ ...file, ino: stat.ino, observedMtimeMs: stat.mtimeMs });
  }
  const receipt = { schema: 1, at: new Date().toISOString(), root, planSha256: createHash('sha256').update(readFileSync(planPath)).digest('hex'), candidates, skipped, removed: 0, bytes: 0, complete: false };
  const receiptPath = resolve(recordDir, `receipt-${Date.now()}.json`);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  for (const dir of ['table-gen-opt', 'cubeopt-reverse']) {
    writeFileSync(resolve(root, '.local-data', dir, 'RETENTION.md'),
      '# Retention decision — 2026-11-09\n\n' +
      'The owner authorized removal of duplicate generated tables, the Opt9 main table, nxopt22/corner96 research tables and old target caches.\n' +
      'Opt10, its opt9-generated/small-memory.bin dependency, current Opt8 artifacts, canonical solver/tables, source snapshots, reports and resource stop history remain.\n' +
      'Missing files listed in ../migrations/retention-2026-11-09/plan.json are intentional retirement, not failed migration. Do not regenerate or restore them automatically.\n' +
      'Historical report hashes describe the original experiment, not availability of every original payload. See docs/local-artifact-lifecycle.md and the cleanup receipts.\n');
  }
  try {
    for (const file of candidates) {
      const path = checkedPath(file.name), stat = lstatSync(path);
      if (!stat.isFile() || stat.ino !== file.ino || stat.size !== file.bytes || stat.mtimeMs !== file.observedMtimeMs) throw Error(`Changed during cleanup: ${file.name}`);
      unlinkSync(path); receipt.removed++; receipt.bytes += file.bytes;
    }
    requiredArtifacts(); receipt.complete = true;
  } finally { writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n'); }
  console.log(JSON.stringify({ receiptPath, removed: receipt.removed, bytes: receipt.bytes, skipped: skipped.length, complete: receipt.complete }));
}
