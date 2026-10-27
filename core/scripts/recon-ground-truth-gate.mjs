import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startResult, finishResult } from './recon-ground-truth-results.mts';
import { runSnapshotGroundTruth, verifyStagedSnapshot } from './recon-staged-snapshot.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(SCRIPT_DIR, '..');
const CLIENT_ROOT = resolve(CORE_ROOT, 'packages', 'client');
const REPO_ROOT = resolve(CORE_ROOT, '..');
const STAMP_PATH = resolve(REPO_ROOT, '.tmp', 'recon-ground-truth-pass.json');
const STAMP_VERSION = 3;
export const GROUND_TRUTH_TESTS = [
  'tests/recon-intake.test.ts',
  'tests/recon-intake-ui.test.ts',
  'tests/recon_ground_truth.test.ts',
  'tests/recon-ground-truth-display.test.ts',
  'tests/recon-playback-track.test.ts',
  'tests/recon-ground-truth-input.test.ts',
  'tests/recon-ground-truth-gate.test.ts',
  'tests/recon-ground-truth-results.test.ts',
  'tests/recon-test-history-route.test.ts',
  'tests/session-fetch.test.ts',
  'tests/recon_f2l_rotation_policy.test.ts',
  'tests/recon_f2l_rotations.test.ts',
  'tests/recon-library-correction.test.ts',
  'tests/recon-comment-links.test.ts',
  'tests/alg_case_display.test.ts',
  'tests/solution_view_caret.test.ts',
];

const EXACT_GUARDED_PATHS = new Set([
  'core/packages/client/lib/recon-intake-check.mts',
  'core/packages/client/lib/recon-intake-api.ts',
  'core/packages/client/lib/use-web-reconstruct-host.ts',
  'core/apps/api/src/routes/recon_intake.ts',
  'core/apps/api/migrations/0286_recon_intake.sql',
  'core/packages/shared/src/recon_intake.ts',
  'core/scripts/recon-intake.mts',
  '.node-version',
  'core/package.json',
  'core/pnpm-lock.yaml',
  'core/pnpm-workspace.yaml',
  '.codex/hooks/recon-ground-truth-gate.mts',
  '.codex/hooks.json',
  '.githooks/pre-commit',
  'core/packages/client/scripts/recon-ground-truth-gate.mjs',
  'core/packages/client/scripts/sync-recon-ground-truth.mjs',
  'core/packages/client/scripts/import-recon-ground-truth.mjs',
  ...GROUND_TRUTH_TESTS.map(test => 'core/packages/client/' + test),
  'core/packages/client/package.json',
  'core/packages/client/vitest.config.ts',
  'core/packages/shared/package.json',
  'core/packages/shared/tsconfig.json',
  'core/tsconfig.base.json',
  'core/packages/timer-ui/package.json',
  'core/packages/shared/src/alg.ts',
  'core/packages/shared/src/alg_notation.ts',
  'core/packages/client/components/SolutionView.tsx',
  'core/packages/client/components/solution_view.css',
  'core/packages/client/components/ReconLineDiagrams.tsx',
  'core/packages/client/components/ReconCaseLink.tsx',
  'core/packages/client/components/recon-case-link.css',
  'core/packages/client/lib/recon-alg-utils.ts',
  'core/packages/client/lib/recon-f2l-links.ts',
  'core/packages/client/lib/recon-ground-truth-api.ts',
  'core/packages/client/lib/recon-test-results.ts',
  'core/packages/client/lib/session-fetch.ts',
  'core/packages/client/lib/recon-test-history.server.ts',
  'core/packages/client/lib/recon-intake-regression.ts',
  'core/scripts/recon-ground-truth-results.mts',
  'core/packages/client/app/api/admin/recon-tests/route.ts',
  'core/apps/api/migrations/0278_recon_test_runs.sql',
  'core/packages/client/app/[lang]/timer/_components/useWebReconstructHost.ts',
  'core/packages/timer-ui/src/CubeColorChip.tsx',
  'core/packages/timer-ui/src/cube-color-chip.css',
  'core/packages/timer-ui/src/TimerSolveDetailModal.tsx',
  'core/packages/client/tests/fixtures/cross-unreset-orientation-recording.json',
  'core/packages/client/tests/fixtures/f2l-front-triggers-recording.json',
  'core/packages/client/tests/fixtures/f2l-overlapping-y-recording.json',
  'core/packages/client/tests/fixtures/f2l-rotation-cascade-recording.json',
  'core/packages/client/tests/fixtures/f2l-tilted-start-recording.json',
  'core/packages/shared/src/recon_ground_truth.ts',
  'core/packages/shared/src/recon_slice.ts',
  'core/packages/shared/src/cube_facelet.ts',
  'core/packages/shared/src/smart_cube/gyro_track.ts',
  'core/packages/shared/src/smart_cube/orientation.ts',
  'core/packages/shared/src/timer/sim_log.ts',
  'core/packages/shared/src/timer/replay-input.ts',
  'core/packages/shared/src/timer/replay-decode.ts',
  'core/packages/shared/src/timer/replay_encode.ts',
  'core/packages/shared/src/timer/replay-client.ts',
  'core/scripts/recon-ground-truth-gate.mjs',
  'core/scripts/recon-staged-snapshot.mjs',
  'core/apps/api/src/routes/recon_ground_truth.ts',
  'core/apps/api/migrations/0105_recon_ground_truth.sql',
  'core/apps/api/migrations/0106_recon_ground_truth_candidates.sql',
  'core/packages/client/app/[lang]/timer/_lib/bluetooth/gyro_track.ts',
  'core/packages/client/app/[lang]/timer/_lib/bluetooth/orientation.ts',
  'core/packages/client/app/[lang]/timer/_lib/share/decode.ts',
  'core/packages/client/app/[lang]/timer/_lib/share/verified_reconstruction.ts',
]);

const GUARDED_PREFIXES = [
  'core/packages/timer-ui/src/reconstruct/',
  'core/packages/timer-ui/src/recon/',
  'core/packages/client/components/CubeColorChip/',
  'core/packages/client/components/recon/',
  'core/packages/client/app/[lang]/recon/ground-truth/',
  'core/packages/shared/src/recon/',
  'core/packages/shared/src/timer/reconstruct/',
  'core/packages/client/app/[lang]/timer/_lib/reconstruct/',
  'core/packages/client/tests/fixtures/recon',
];

function normalizeRepoPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isGuardedRepoPath(path) {
  const normalized = normalizeRepoPath(path);
  return EXACT_GUARDED_PATHS.has(normalized)
    || GUARDED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function walkFiles(path, out) {
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) walkFiles(child, out);
    else if (entry.isFile()) out.push(child);
  }
}

export function collectGuardedFiles() {
  const files = [];
  for (const path of EXACT_GUARDED_PATHS) {
    const absolute = resolve(REPO_ROOT, path);
    if (existsSync(absolute)) files.push(absolute);
  }

  for (const prefix of GUARDED_PREFIXES) {
    const candidates = [];
    walkFiles(resolve(REPO_ROOT, prefix.endsWith('/') ? prefix : dirname(prefix)), candidates);
    files.push(...candidates.filter(path => normalizeRepoPath(relative(REPO_ROOT, path)).startsWith(prefix)));
  }

  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

export function computeFingerprint() {
  const hash = createHash('sha256');
  hash.update(`${process.versions.node}\0${process.platform}\0`);
  for (const absolute of collectGuardedFiles()) {
    const repoPath = normalizeRepoPath(relative(REPO_ROOT, absolute));
    hash.update(repoPath);
    hash.update('\0');
    hash.update(readFileSync(absolute));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function gitLines(args) {
  const result = spawnSync('git', ['-C', REPO_ROOT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map(normalizeRepoPath).filter(Boolean);
}

function readStamp() {
  try {
    return JSON.parse(readFileSync(STAMP_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function checkStaged({ preflight = false, allowRun = true } = {}) {
  const staged = gitLines([
    'diff', '--cached', '--name-status', '--find-renames=100%', '--diff-filter=ACMRD',
  ]);
  if (staged === null) return 0; // Git unavailable or not a worktree: fail open; CI is the fallback.

  const guardedStaged = staged.flatMap(line => line.split('\t').slice(1).filter(isGuardedRepoPath));
  if (guardedStaged.length === 0) return 0;

  const unstaged = gitLines(['diff', '--name-only']);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard']);
  if (unstaged === null || untracked === null) return 0;

  const worktreeOnly = [...unstaged, ...untracked].filter(isGuardedRepoPath);
  const partiallyStaged = worktreeOnly.filter(path => guardedStaged.includes(path));
  if (partiallyStaged.length > 0) {
    process.stderr.write(
      `Ground-truth verification blocked: guarded staged and working-tree content differ:\n${partiallyStaged.join('\n')}\n`,
    );
    return 3;
  }

  // The Codex preflight must not run a potentially long test inside a tool-hook
  // timeout. Git owns the automatic run, for human and AI commits alike.
  if (preflight) {
    const hookPaths = gitLines(['config', '--get', 'core.hooksPath']);
    if (!hookPaths || resolve(REPO_ROOT, hookPaths[0] ?? '') !== resolve(REPO_ROOT, '.githooks')) {
      process.stderr.write('Ground-truth Git hook is not installed. Run pnpm run prepare in core.\n');
      return 3;
    }
    return 0;
  }

  if (worktreeOnly.length > 0) {
    process.stdout.write('Other reconstruction work is in progress; verifying the staged snapshot with independent dependencies.\n');
    return verifyStagedSnapshot({ repoRoot: REPO_ROOT, verify: runSnapshotGroundTruth });
  }

  const stamp = readStamp();
  const fingerprint = computeFingerprint();
  if (stamp?.version !== STAMP_VERSION || stamp?.fingerprint !== fingerprint) {
    if (!allowRun) {
      process.stderr.write('Ground-truth verification changed before the commit could continue.\n');
      return 3;
    }
    process.stdout.write('Reconstruction changes detected: automatically checking all ground-truth cases.\n');
    // Never fetch/rewrite a staged fixture or stage files as a side effect of a
    // commit. Explicit `run` still supports syncing newly confirmed cases.
    const status = runGroundTruth({ sync: false, trigger: 'commit' });
    if (status !== 0) return status;
    return checkStaged({ allowRun: false });
  }
  return 0;
}

function installHook() {
  if (process.env.CI) return 0;
  const root = gitLines(['rev-parse', '--show-toplevel']);
  if (!root || resolve(root[0]) !== REPO_ROOT) return 0; // source archives / sparse CI
  const existing = gitLines(['config', '--get', 'core.hooksPath']);
  if (existing?.[0] && resolve(REPO_ROOT, existing[0]) !== resolve(REPO_ROOT, '.githooks')) {
    process.stderr.write(`Existing Git hooksPath ${existing[0]} was preserved. Integrate the ground-truth pre-commit hook before committing reconstruction changes.\n`);
    return 3;
  }
  const hook = resolve(REPO_ROOT, '.githooks/pre-commit');
  if (!existsSync(hook)) return 2;
  if (process.platform !== 'win32') chmodSync(hook, 0o755);
  const result = spawnSync('git', ['-C', REPO_ROOT, 'config', '--local', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  if (result.status !== 0) return result.status ?? 2;
  process.stdout.write('Automatic reconstruction pre-commit checks installed.\n');
  return 0;
}

function clearStamp() {
  try {
    unlinkSync(STAMP_PATH);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function runGroundTruth({ sync = true, trigger = process.env.CI ? 'ci' : 'manual' } = {}) {
  clearStamp();
  const context = startResult(REPO_ROOT, computeFingerprint(), trigger);
  const finish = (status, message = '') => {
    const result = finishResult(REPO_ROOT, context, status, message);
    if (!process.env.RECON_TEST_DISABLE_SYNC) {
      const upload = spawnSync(process.execPath, [resolve(SCRIPT_DIR, 'recon-ground-truth-results.mts'), 'publish', REPO_ROOT], {
        stdio: 'inherit', env: process.env, timeout: 15000,
      });
      if (upload.error || upload.status !== 0) process.stderr.write('Reports saved locally; cloud synchronization pending.\n');
    }
    return result;
  };
  const syncScript = resolve(CLIENT_ROOT, 'scripts', 'sync-recon-ground-truth.mjs');
  const syncResult = spawnSync(process.execPath, [syncScript, sync ? 'sync' : 'check'], {
    cwd: CLIENT_ROOT,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (syncResult.error) {
    process.stderr.write(`${syncResult.error.message}\n`);
    return finish(2, syncResult.error.message);
  }
  if (syncResult.status !== 0) return finish(syncResult.status ?? 2, 'Ground-truth snapshot validation/sync failed.');

  // Node consumers resolve shared exports through dist. Never verify stale output
  // against a fingerprint of newer source (including newly added exports).
  const sharedRoot = resolve(CORE_ROOT, 'packages/shared');
  const compiler = resolve(sharedRoot, 'node_modules/typescript/bin/tsc');
  if (!existsSync(compiler)) return finish(2, 'Shared compiler is not installed. Run pnpm install in core.');
  const build = spawnSync(process.execPath, [compiler, '-b'], { cwd: sharedRoot, env: process.env, stdio: 'inherit', windowsHide: true });
  if (build.error || build.status !== 0) return finish(build.status ?? 2, 'Shared build failed; reconstruction tests did not run.');

  const vitestBin = resolve(CLIENT_ROOT, 'node_modules/vitest/vitest.mjs');
  if (!existsSync(vitestBin)) {
    process.stderr.write('Vitest is not installed. Run pnpm install in core first.\n');
    return finish(2, 'Vitest is not installed.');
  }

  const fingerprint = computeFingerprint();
  context.run.fingerprint = fingerprint;
  // Optional local resource bound; it changes scheduling, never test coverage.
  const workers = process.env.RECON_TEST_MAX_WORKERS;
  if (workers && !/^[1-9]\d?$/.test(workers)) return finish(2, 'RECON_TEST_MAX_WORKERS must be an integer from 1 to 99.');
  const result = spawnSync(process.execPath, [vitestBin, 'run', ...GROUND_TRUTH_TESTS,
    ...(workers ? ['--maxWorkers', workers] : []),
    '--reporter=default', '--reporter=json', `--outputFile.json=${context.reportFile}`], {
    cwd: CLIENT_ROOT,
    env: { ...process.env, RECON_GROUND_TRUTH_CAPTURE_DIR: context.captureDirectory },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return finish(2, result.error.message);
  }
  if (result.status !== 0) return finish(result.status ?? 2, result.signal ? `Test process interrupted: ${result.signal}` : 'Regression checks failed.');

  if (computeFingerprint() !== fingerprint) {
    process.stderr.write('Ground-truth inputs changed during verification. Run the check again before committing.\n');
    return finish(3, 'Inputs changed during verification; results do not verify the current code.');
  }
  const resultStatus = finish(0);
  if (resultStatus !== 0) return resultStatus;
  mkdirSync(dirname(STAMP_PATH), { recursive: true });
  writeFileSync(STAMP_PATH, `${JSON.stringify({
    version: STAMP_VERSION,
    fingerprint,
    testedAt: new Date().toISOString(),
    tests: GROUND_TRUTH_TESTS,
  }, null, 2)}\n`, 'utf8');
  process.stdout.write(`Ground-truth credential refreshed: ${fingerprint.slice(0, 12)}\n`);
  return 0;
}

export function runGroundTruthGate() {
  const [mode = 'run', argument] = process.argv.slice(2);
  if (mode === 'run') return runGroundTruth({ sync: argument !== '--offline' });
  if (mode === 'install') return installHook();
  if (mode === 'check-staged') return checkStaged({ preflight: argument === '--preflight' });
  if (mode === 'list-guarded') {
    process.stdout.write(`${JSON.stringify(collectGuardedFiles().map(path => normalizeRepoPath(relative(REPO_ROOT, path))))}\n`);
    return 0;
  }
  if (mode === 'fingerprint') {
    process.stdout.write(`${computeFingerprint()}\n`);
    return 0;
  }
  if (mode === 'is-guarded') {
    const guarded = typeof argument === 'string' && isGuardedRepoPath(argument);
    process.stdout.write(`${guarded}\n`);
    return guarded ? 0 : 1;
  }
  process.stderr.write(`Unknown mode: ${mode}\n`);
  return 2;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  process.exitCode = runGroundTruthGate();
}
