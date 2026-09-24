import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { assertFiles, git, gitPrint, parseOptions, repoRoot, restoreStash, stash, upstreamDir } from './scripts/upstream/lib.js';
import { syncCstimer } from './scripts/upstream/sync-cstimer.js';
import { syncCstimerScramble } from './scripts/upstream/sync-cstimer-scramble.js';
import { syncSolver } from './scripts/upstream/sync-rubiks-solver-demo.js';
import { syncAlgTrainers } from './scripts/upstream/sync-alg-trainers.js';
import { syncBlddb } from './scripts/upstream/sync-blddb.js';
import { syncRecordRanks } from './scripts/upstream/sync-recordranks.js';

const root = repoRoot(parseOptions());
const options = parseOptions();
const available = ['cstimer', 'solver', 'algtrainers', 'blddb', 'recordranks'];
const requested = options.only as string[] | undefined;
if (requested?.some(key => !available.includes(key))) throw new Error(`--only accepts ${available.join(', ')}`);
assertFiles(root, [
  'sync_upstream.ts', 'scripts/upstream/lib.ts', 'scripts/upstream/sync-cstimer.ts',
  'scripts/upstream/sync-cstimer-scramble.ts', 'scripts/upstream/sync-rubiks-solver-demo.ts',
  'scripts/upstream/sync-alg-trainers.ts', 'scripts/upstream/sync-blddb.ts',
  'scripts/upstream/sync-recordranks.ts', '.sync/page_config.json', '.sync/menu_template.html',
  '.sync/alg_trainers_config.json', '.sync/blddb_postprocess.mjs', 'docs/generated-artifacts.json',
]);
if (options.validateOnly) {
  console.log(`Upstream sync graph and internal dependencies validated: ${root}`);
  process.exit(0);
}
const targets = requested?.length ? requested : available;
const summary: Record<string, string> = {};
const clones = targets.filter(key => key !== 'recordranks').map(key => ({ key, dir: upstreamDir(root, key, options) }));
console.log('Step 1 / 2: refresh upstream clones');
for (const { key, dir } of clones) {
  if (!existsSync(join(dir, '.git'))) { console.warn(`[MISS] ${key}: clone missing at ${dir}`); summary[key] = 'clone missing'; continue; }
  if (key === 'blddb') { console.log('[DEFER] blddb: canonical sync locks origin/v2'); continue; }
  if (options.skipPull || options.dryRun) { console.log(`[SKIP] ${key}: ${options.dryRun ? 'dry run' : 'skip pull'}`); continue; }
  const before = git(dir, 'rev-parse', '--short', 'HEAD');
  const created = stash(dir, 'sync-all: local patches');
  try {
    const branch = key === 'solver' ? 'main' : 'master';
    const url = { cstimer: 'https://github.com/cs0x7f/cstimer.git', solver: 'https://github.com/or18/RubiksSolverDemo.git', algtrainers: 'https://github.com/mihlefeld/Alg-Trainers.git' }[key];
    gitPrint(dir, 'pull', '--ff-only', url!, branch);
  } finally { if (created) restoreStash(dir, created); }
  const after = git(dir, 'rev-parse', '--short', 'HEAD');
  summary[key] = before === after ? `current ${after}` : `${before} -> ${after}`;
}
console.log('Step 2 / 2: sync into repository');
for (const key of targets) {
  if (summary[key] === 'clone missing') continue;
  if (key === 'cstimer') {
    if (options.dryRun) { console.log('[DRY RUN] skipping csTimer build and scramble merge'); continue; }
    const dir = upstreamDir(root, key, options);
    syncCstimer({ root, upstream: dir, skipPull: true });
    syncCstimerScramble({ root, upstream: dir, skipPull: true });
  } else if (key === 'solver') syncSolver({ root, upstream: upstreamDir(root, key, options), dryRun: Boolean(options.dryRun) });
  else if (key === 'algtrainers') syncAlgTrainers({ root, upstream: upstreamDir(root, key, options), dryRun: Boolean(options.dryRun) });
  else if (key === 'blddb') {
    if (options.dryRun) console.log('[DRY RUN] skipping BLDDB build');
    else syncBlddb({ root, upstream: upstreamDir(root, key, options), skipPull: Boolean(options.skipPull) });
  } else {
    syncRecordRanks({ root, upstream: upstreamDir(root, key, options), skipPull: Boolean(options.skipPull), dryRun: Boolean(options.dryRun) });
    summary[key] = options.dryRun ? 'previewed' : 'fork pushed and deployment SHA updated';
  }
}
console.log('Completed. CubeRoot changes remain uncommitted.');
for (const [key, result] of Object.entries(summary)) console.log(`${key}: ${result}`);
