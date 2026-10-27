import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

/** Verify the actual index without stashing, staging or overwriting another task's work. */
export function verifyStagedSnapshot({ repoRoot, verify }) {
  const tree = () => {
    // Preserve Git's temporary GIT_INDEX_FILE during `commit --only` / `commit -a`.
    const result = spawnSync('git', ['write-tree'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0 || !/^[a-f0-9]{40,64}$/.test(result.stdout.trim())) {
      throw new Error('Cannot capture the staged tree; resolve index conflicts before committing.');
    }
    return result.stdout.trim();
  };
  const stampPath = join(repoRoot, '.tmp', 'recon-ground-truth-staged-pass.json');
  let temporary;
  try {
    const stagedTree = tree();
    const identity = `${process.versions.node}:${process.platform}:${process.arch}:${stagedTree}`;
    try {
      const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
      if (stamp.version === 1 && stamp.identity === identity && tree() === stagedTree) return 0;
    } catch { /* Missing evidence requires a real verification. */ }

    temporary = mkdtempSync(join(tmpdir(), 'cuberoot-recon-staged-'));
    const snapshot = join(temporary, 'repo');
    mkdirSync(snapshot);
    // Checkout an independent index: archive's export-ignore/export-subst can
    // silently omit or rewrite tests, including through local info/attributes.
    const exportEnv = { ...process.env, GIT_INDEX_FILE: join(temporary, 'index'), GIT_LFS_SKIP_SMUDGE: '1' };
    const captured = spawnSync('git', ['read-tree', stagedTree], {
      cwd: repoRoot, env: exportEnv, stdio: 'inherit', windowsHide: true,
    });
    if (captured.status !== 0) return captured.status ?? 2;
    // Ground-truth runs in core; include all its packages, fixtures and vendored
    // inputs plus root configuration/docs/hooks, not unrelated upstream sites.
    const listed = spawnSync('git', ['ls-files', '-z'], {
      cwd: repoRoot, env: exportEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true,
    });
    if (listed.status !== 0) return listed.status ?? 2;
    const paths = listed.stdout.split('\0').filter(path => path && (!path.includes('/')
      || ['core/', 'docs/', '.codex/', '.githooks/'].some(prefix => path.startsWith(prefix))));
    const exported = spawnSync('git', ['checkout-index', '--stdin', '-z', `--prefix=${snapshot.replaceAll('\\', '/')}/`], {
      cwd: repoRoot, env: exportEnv, input: `${paths.join('\0')}\0`, stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true,
    });
    if (exported.status !== 0) return exported.status ?? 2;

    // The snapshot owns its dependencies and test reports. It must not inherit
    // the live commit's index/worktree or load modules from the developer's tree.
    const env = Object.fromEntries(Object.entries(process.env)
      .filter(([key]) => !key.startsWith('GIT_') && key !== 'NODE_PATH'));
    env.RECON_TEST_DISABLE_SYNC = '1';
    const status = verify(snapshot, env);
    if (status !== 0) return status;
    if (tree() !== stagedTree) {
      process.stderr.write('Staged content changed during verification; commit again to verify the new tree.\n');
      return 3;
    }
    mkdirSync(dirname(stampPath), { recursive: true });
    writeFileSync(stampPath, `${JSON.stringify({ version: 1, identity, testedAt: new Date().toISOString() })}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Staged ground-truth verification failed: ${error.message}\n`);
    return 2;
  } finally {
    if (temporary) {
      // Only remove the exact directory allocated by this invocation.
      const actual = realpathSync(temporary);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith('cuberoot-recon-staged-')) {
        throw new Error(`Refusing to clean an unexpected snapshot directory: ${actual}`);
      }
      rmSync(resolve(actual), { recursive: true, force: true, maxRetries: 3 });
    }
  }
}

export function runSnapshotGroundTruth(snapshot, env) {
  const cwd = join(snapshot, 'core');
  // Arguments are fixed; Windows needs its package-manager command shim.
  const pnpm = (args) => spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd, env, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32',
  });
  const install = pnpm(['install', '--offline', '--frozen-lockfile', '--ignore-scripts']);
  if (install.status !== 0) return install.status ?? 2;
  const build = pnpm(['--filter', '@cuberoot/client', 'build:deps']);
  if (build.status !== 0) return build.status ?? 2;
  const result = spawnSync(process.execPath, ['scripts/recon-ground-truth-gate.mjs', 'run', '--offline'], {
    cwd, env, stdio: 'inherit', windowsHide: true,
  });
  return result.status ?? 2;
}
