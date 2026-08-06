import { createHash } from 'node:crypto';
import {
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

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(CLIENT_ROOT, '..', '..', '..');
const STAMP_PATH = resolve(REPO_ROOT, '.tmp', 'recon-ground-truth-pass.json');
const STAMP_VERSION = 1;
const GROUND_TRUTH_TEST = 'tests/recon_workbook_ground_truth.test.ts';

const EXACT_GUARDED_PATHS = new Set([
  '.claude/hooks/recon-ground-truth-gate.ps1',
  '.codex/hooks.json',
  '.githooks/pre-commit',
  'core/packages/client/scripts/recon-ground-truth-gate.mjs',
  'core/packages/client/scripts/sync-recon-ground-truth.mjs',
  'core/packages/client/tests/recon_workbook_ground_truth.test.ts',
  'core/packages/client/app/[lang]/timer/_lib/bluetooth/gyro_track.ts',
  'core/packages/client/app/[lang]/timer/_lib/bluetooth/orientation.ts',
  'core/packages/client/app/[lang]/timer/_lib/share/decode.ts',
  'core/packages/client/app/[lang]/timer/_lib/share/verified_reconstruction.ts',
]);

const GUARDED_PREFIXES = [
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

  walkFiles(resolve(REPO_ROOT, 'core/packages/client/app/[lang]/timer/_lib/reconstruct'), files);

  const fixtureRoot = resolve(REPO_ROOT, 'core/packages/client/tests/fixtures');
  if (existsSync(fixtureRoot)) {
    for (const entry of readdirSync(fixtureRoot, { withFileTypes: true })) {
      if (!entry.name.startsWith('recon')) continue;
      const child = resolve(fixtureRoot, entry.name);
      if (entry.isDirectory()) walkFiles(child, files);
      else if (entry.isFile()) files.push(child);
    }
  }

  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

export function computeFingerprint() {
  const hash = createHash('sha256');
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

function checkStaged() {
  const staged = gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']);
  if (staged === null) return 0; // Git unavailable or not a worktree: fail open; CI is the fallback.

  const guardedStaged = staged.filter(isGuardedRepoPath);
  if (guardedStaged.length === 0) return 0;

  const unstaged = gitLines(['diff', '--name-only']);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard']);
  if (unstaged === null || untracked === null) return 0;

  const worktreeOnly = [...unstaged, ...untracked].filter(isGuardedRepoPath);
  if (worktreeOnly.length > 0) {
    process.stderr.write(
      `Ground-truth verification blocked: guarded staged and working-tree content differ:\n${worktreeOnly.join('\n')}\n`,
    );
    return 3;
  }

  const stamp = readStamp();
  const fingerprint = computeFingerprint();
  if (stamp?.version !== STAMP_VERSION || stamp?.fingerprint !== fingerprint) {
    process.stderr.write(
      'Ground-truth verification is missing or stale for the currently staged reconstruction changes.\n',
    );
    return 3;
  }
  return 0;
}

function clearStamp() {
  try {
    unlinkSync(STAMP_PATH);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function runGroundTruth() {
  clearStamp();
  const syncScript = resolve(SCRIPT_DIR, 'sync-recon-ground-truth.mjs');
  const syncResult = spawnSync(process.execPath, [syncScript, 'sync'], {
    cwd: CLIENT_ROOT,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (syncResult.error) {
    process.stderr.write(`${syncResult.error.message}\n`);
    return 2;
  }
  if (syncResult.status !== 0) return syncResult.status ?? 2;

  const vitestBin = resolve(CLIENT_ROOT, 'node_modules/vitest/vitest.mjs');
  if (!existsSync(vitestBin)) {
    process.stderr.write('Vitest is not installed. Run pnpm install in core first.\n');
    return 2;
  }

  const result = spawnSync(process.execPath, [vitestBin, 'run', GROUND_TRUTH_TEST], {
    cwd: CLIENT_ROOT,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 2;
  }
  if (result.status !== 0) return result.status ?? 2;

  const fingerprint = computeFingerprint();
  mkdirSync(dirname(STAMP_PATH), { recursive: true });
  writeFileSync(STAMP_PATH, `${JSON.stringify({
    version: STAMP_VERSION,
    fingerprint,
    testedAt: new Date().toISOString(),
    test: GROUND_TRUTH_TEST,
  }, null, 2)}\n`, 'utf8');
  process.stdout.write(`Ground-truth credential refreshed: ${fingerprint.slice(0, 12)}\n`);
  return 0;
}

function main() {
  const [mode = 'run', argument] = process.argv.slice(2);
  if (mode === 'run') return runGroundTruth();
  if (mode === 'check-staged') return checkStaged();
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
  process.exitCode = main();
}
