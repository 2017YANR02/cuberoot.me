// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(HERE, '..');
const REPO_ROOT = join(CLIENT_ROOT, '..', '..', '..');
const GATE = join(CLIENT_ROOT, 'scripts', 'recon-ground-truth-gate.mjs');

function runGate(args: string[]) {
  return spawnSync(process.execPath, [GATE, ...args], {
    cwd: CLIENT_ROOT,
    encoding: 'utf8',
  });
}

function isGuarded(path: string): boolean {
  return runGate(['is-guarded', path]).status === 0;
}

describe('reconstruction ground-truth commit gate', () => {
  it('covers reconstruction sources and a growing fixture registry without a fixed count', () => {
    expect(isGuarded('core/packages/client/app/[lang]/timer/_lib/reconstruct/recon_text.ts')).toBe(true);
    expect(isGuarded('core/packages/client/app/[lang]/timer/_lib/bluetooth/gyro_track.ts')).toBe(true);
    expect(isGuarded('core/packages/client/tests/recon_ground_truth.test.ts')).toBe(true);
    expect(isGuarded('core/packages/client/tests/fixtures/recon-ground-truth.json')).toBe(true);
    expect(isGuarded('core/packages/client/tests/fixtures/recon-workbook/0050.json')).toBe(true);
    expect(isGuarded('core/packages/shared/src/recon_ground_truth.ts')).toBe(true);
    expect(isGuarded('core/apps/api/src/routes/recon_ground_truth.ts')).toBe(true);
    expect(isGuarded('core/apps/api/migrations/0106_recon_ground_truth_candidates.sql')).toBe(true);
    expect(isGuarded('.githooks/pre-commit')).toBe(true);
    expect(isGuarded('core/scripts/recon-ground-truth-gate.mjs')).toBe(true);
    expect(isGuarded('core/scripts/recon-staged-snapshot.mjs')).toBe(true);
    expect(isGuarded('core/pnpm-lock.yaml')).toBe(true);
    for (const path of [
      'core/packages/timer-ui/src/reconstruct/StepMoveList.tsx',
      'core/packages/timer-ui/src/reconstruct/reconstruct.css',
      'core/packages/client/components/SolutionView.tsx',
      'core/packages/client/components/ReconLineDiagrams.tsx',
      'core/packages/client/lib/recon-f2l-links.ts',
      'core/packages/client/tests/recon-ground-truth-display.test.ts',
      'core/packages/client/tests/fixtures/f2l-rotation-cascade-recording.json',
    ]) expect(isGuarded(path), path).toBe(true);
    expect(isGuarded('core/packages/client/app/[lang]/timer/page.tsx')).toBe(false);
  });

  it('uses a package command that refreshes the content-fingerprint credential', () => {
    const pkg = JSON.parse(readFileSync(join(CLIENT_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:recon-ground-truth']).toBe('node scripts/recon-ground-truth-gate.mjs run');
    const workspace = JSON.parse(readFileSync(join(REPO_ROOT, 'core/package.json'), 'utf8'));
    expect(workspace.scripts.prepare).toBe('node scripts/recon-ground-truth-gate.mjs install');
  });

  it('fingerprints the canonical shared analysis, not just the website compatibility files', () => {
    const result = runGate(['list-guarded']);
    expect(result.status).toBe(0);
    const discovered: string[] = JSON.parse(result.stdout);
    for (const suffix of [
      '/shared/src/recon/popup_suggest.ts',
      '/shared/src/timer/reconstruct/recon_text.ts',
      '/shared/src/smart_cube/gyro_track.ts',
      '/shared/src/smart_cube/orientation.ts',
      '/shared/src/timer/sim_log.ts',
      '/timer-ui/src/reconstruct/StepMoveList.tsx',
      '/client/tests/recon-ground-truth-display.test.ts',
      '/client/tests/fixtures/recon-workbook/oPAYPI4Qe-I.json',
      '/client/tests/fixtures/recon-workbook/libraries.json',
    ]) {
      const file = discovered.find((path) => path.endsWith(suffix));
      expect(file, suffix).toBeDefined();
      expect(isGuarded(file!)).toBe(true);
    }
  });

  it('denies through the supported JSON decision and keeps CI as the fallback', () => {
    const hook = readFileSync(join(REPO_ROOT, '.codex', 'hooks', 'recon-ground-truth-gate.mts'), 'utf8');
    expect(hook).toContain("permissionDecision: 'deny'");
    expect(hook).toContain('check-staged');
    expect(hook).toContain('--preflight');
    expect(hook).not.toMatch(/exit\s+2\b/);

    const codexHooks = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const commandGroup = codexHooks.hooks.PreToolUse.find(
      (group: { matcher?: string }) => group.matcher === '^Bash$',
    );
    expect(commandGroup, '缺少 Codex Bash PreToolUse 守卫组').toBeDefined();
    expect(commandGroup.hooks.some(
      (entry: { commandWindows?: string }) => entry.commandWindows?.includes('recon-ground-truth-gate.mts'),
    )).toBe(true);

    const gitHook = readFileSync(join(REPO_ROOT, '.githooks', 'pre-commit'), 'utf8');
    expect(gitHook).toContain('recon-ground-truth-gate.mjs check-staged');

    const groundTruth = readFileSync(join(HERE, 'recon_ground_truth.test.ts'), 'utf8');
    expect(groundTruth).toContain('for (const fixture of FIXTURES)');
    expect(groundTruth).toContain("sync-recon-ground-truth.mjs");
    expect(groundTruth).not.toMatch(/FIXTURES\.(?:slice|splice)\(\s*0\s*,\s*4\s*\)/);

    const syncScript = readFileSync(join(CLIENT_ROOT, 'scripts', 'sync-recon-ground-truth.mjs'), 'utf8');
    expect(syncScript).toContain('/v1/recon-ground-truth/export');
    expect(syncScript).toContain('for (const [index, fixture] of value.fixtures.entries())');
    expect(syncScript).not.toContain('xlsx');
  });
  it('automatically tests missing/stale evidence, reuses unchanged passes and stops regressions through Git', () => {
    const temp = mkdtempSync(join(tmpdir(), 'recon-gate-'));
    // Real Git hooks export index/worktree variables. Never let those point
    // this isolated test at the developer's actual index (including commit -a).
    const isolatedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const run = (command: string, args: string[]) => spawnSync(command, args, {
      cwd: temp, encoding: 'utf8', env: { ...isolatedEnv, NODE_ENV: process.env.NODE_ENV ?? 'test', CI: '', RECON_TEST_DISABLE_SYNC: '1' },
    });
    const put = (path: string, text: string) => { mkdirSync(dirname(join(temp, path)), { recursive: true }); writeFileSync(join(temp, path), text); };
    try {
      expect(run('git', ['init', '-q']).status).toBe(0);
      for (const path of ['core/scripts/recon-ground-truth-gate.mjs',
        'core/scripts/recon-staged-snapshot.mjs',
        'core/scripts/recon-ground-truth-results.mts',
        'core/packages/client/lib/recon-test-history.server.ts',
        'core/packages/client/lib/recon-intake-regression.ts',
        'core/packages/client/scripts/recon-ground-truth-gate.mjs', '.githooks/pre-commit',
        'core/packages/client/scripts/sync-recon-ground-truth.mjs',
        'core/packages/client/tests/fixtures/recon-ground-truth.json']) {
        put(path, readFileSync(join(REPO_ROOT, path), 'utf8'));
      }
      put('.gitignore', '.tmp/\nnode_modules/\n');
      const gate = 'core/scripts/recon-ground-truth-gate.mjs';
      expect(run(process.execPath, [gate, 'install']).status).toBe(0);
      expect(run('git', ['config', '--get', 'core.hooksPath']).stdout.trim()).toBe('.githooks');
      const source = 'core/packages/timer-ui/src/reconstruct/StepMoveList.tsx';
      put(source, '// fixture version 1\n');
      // A controlled child process stands in for Vitest only in this isolated
      // repo. The real suite is executed by the outer ground-truth gate.
      put('core/packages/shared/node_modules/typescript/bin/tsc', `
        const fs = require('node:fs'); const path = require('node:path');
        const root = path.resolve(process.cwd(), '../../..');
        if (fs.existsSync(path.join(root, 'build-fail'))) process.exit(1);
        fs.appendFileSync(path.join(root, 'builds.log'), 'built\\n');
      `);
      put('core/packages/client/node_modules/vitest/vitest.mjs', `
        import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
        import { resolve } from 'node:path';
        const root = resolve(process.cwd(), '../../..');
        appendFileSync(resolve(root, 'runs.log'), JSON.stringify(process.argv.slice(2)) + '\\n');
        if (existsSync(resolve(root, 'mutate'))) writeFileSync(resolve(root, '${source}'), '// changed during test');
        const output = process.argv.find(arg => arg.startsWith('--outputFile.json='))?.split('=').slice(1).join('=');
        if (output) writeFileSync(output, JSON.stringify({ numPassedTests: 1, numTotalTests: 1, testResults: [] }));
        if (existsSync(resolve(root, 'fail'))) { console.error('known fixture regression'); process.exit(1); }
      `);
      expect(run('git', ['add', '.']).status).toBe(0);
      const hook = () => run('git', ['hook', 'run', 'pre-commit']);
      const preflight = () => run(process.execPath, [gate, 'check-staged', '--preflight']);
      expect(preflight().status).toBe(0);
      expect(existsSync(join(temp, 'runs.log'))).toBe(false);
      const stamp = '.tmp/recon-ground-truth-pass.json';
      const runs = () => readFileSync(join(temp, 'runs.log'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]);
      const indexBefore = run('git', ['write-tree']).stdout;
      expect(hook().status).toBe(0);
      expect(runs()).toHaveLength(1);
      expect(runs()[0]).toContain('tests/recon-ground-truth-display.test.ts');
      expect(runs()[0]).toContain('tests/recon_ground_truth.test.ts');
      expect(run('git', ['write-tree']).stdout).toBe(indexBefore);
      expect(existsSync(join(temp, stamp))).toBe(true);
      expect(hook().status).toBe(0);
      expect(runs()).toHaveLength(1); // exact same content: do not run twice
      put(source, '// fixture version 2\n');
      expect(hook().status).toBe(3);
      expect(preflight().status).toBe(3);
      expect(runs()).toHaveLength(1); // don't verify uncommitted staging differences
      expect(run('git', ['add', source]).status).toBe(0);
      expect(hook().status).toBe(0);
      expect(runs()).toHaveLength(2); // changed source: automatically retest
      put('build-fail', 'yes');
      put(source, '// build failure check\n');
      expect(run('git', ['add', source]).status).toBe(0);
      expect(hook().status).toBe(1);
      expect(runs()).toHaveLength(2);
      rmSync(join(temp, 'build-fail'));
      put('fail', 'yes');
      put(source, '// fixture version 3\n');
      expect(run('git', ['add', source]).status).toBe(0);
      const failed = hook();
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain('known fixture regression');
      expect(existsSync(join(temp, stamp))).toBe(false);
      rmSync(join(temp, 'fail'));
      put('mutate', 'yes');
      const changedDuringRun = hook();
      expect(changedDuringRun.status).toBe(3);
      expect(changedDuringRun.stderr).toContain('changed during verification');
      expect(existsSync(join(temp, stamp))).toBe(false);
      rmSync(join(temp, 'mutate'));
      expect(run('git', ['add', source]).status).toBe(0);
      expect(hook().status).toBe(0);
      // A developer's custom hooks must never be overwritten silently.
      expect(run('git', ['config', 'core.hooksPath', 'custom-hooks']).status).toBe(0);
      expect(run(process.execPath, [gate, 'install']).status).toBe(3);
      expect(preflight().status).toBe(3);
      expect(run('git', ['config', '--get', 'core.hooksPath']).stdout.trim()).toBe('custom-hooks');
    } finally { rmSync(temp, { recursive: true, force: true }); }
  // Windows runs many real Git/Node child processes here; startup alone can
  // exceed 15 seconds. Keep every gate assertion and give the integration time.
  }, process.platform === 'win32' ? 60_000 : 15_000);

  it('verifies only the index, preserves other work, and binds evidence to the exact staged tree', () => {
    const temp = mkdtempSync(join(tmpdir(), 'recon-snapshot-test-'));
    const isolatedEnv = {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
      NODE_ENV: process.env.NODE_ENV ?? 'test',
    };
    const runGit = (args: string[], env = isolatedEnv) => spawnSync('git', args, { cwd: temp, env, encoding: 'utf8' });
    const helper = pathToFileURL(join(REPO_ROOT, 'core/scripts/recon-staged-snapshot.mjs')).href;
    const verify = (expected: string, status = 0, mutate = false, env = isolatedEnv) => spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { verifyStagedSnapshot } from ${JSON.stringify(helper)};
      import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
      import { join } from 'node:path';
      import { spawnSync } from 'node:child_process';
      const root = process.cwd();
      const result = verifyStagedSnapshot({repoRoot: root, verify(snapshot, cleanEnv) {
        appendFileSync(join(root, 'calls.log'), 'verified\\n');
        writeFileSync(join(root, 'snapshot-path.txt'), snapshot);
        if (readFileSync(join(snapshot, 'source.txt'), 'utf8') !== ${JSON.stringify(expected)}) return 21;
        if (existsSync(join(snapshot, 'untracked.txt'))) return 22;
        if (Object.keys(cleanEnv).some(key => key.startsWith('GIT_')) || cleanEnv.NODE_PATH) return 23;
        if (${mutate}) {
          writeFileSync(join(root, 'source.txt'), 'changed during verification');
          spawnSync('git', ['add', 'source.txt'], {cwd: root});
        }
        return ${status};
      }});
      process.exitCode = result;
    `], { cwd: temp, env, encoding: 'utf8' });
    try {
      expect(runGit(['init', '-q']).status).toBe(0);
      writeFileSync(join(temp, 'source.txt'), 'staged');
      expect(runGit(['add', 'source.txt']).status).toBe(0);
      writeFileSync(join(temp, 'source.txt'), 'other work');
      writeFileSync(join(temp, 'untracked.txt'), 'keep me');
      // Local export attributes are not in the tree and must not remove tests.
      writeFileSync(join(temp, '.git', 'info', 'attributes'), 'source.txt export-ignore\n');
      const indexBefore = runGit(['write-tree']).stdout;
      const checked = verify('staged');
      expect(checked.status, checked.stderr).toBe(0);
      expect(runGit(['write-tree']).stdout).toBe(indexBefore);
      expect(readFileSync(join(temp, 'source.txt'), 'utf8')).toBe('other work');
      expect(readFileSync(join(temp, 'untracked.txt'), 'utf8')).toBe('keep me');
      expect(existsSync(readFileSync(join(temp, 'snapshot-path.txt'), 'utf8'))).toBe(false);
      expect(verify('staged').status).toBe(0);
      expect(readFileSync(join(temp, 'calls.log'), 'utf8')).toBe('verified\n');

      // A failed verification must not reuse or issue evidence for a different tree.
      expect(runGit(['add', 'source.txt']).status).toBe(0);
      expect(verify('other work', 19).status).toBe(19);
      expect(verify('other work', 19).status).toBe(19);
      expect(verify('other work', 0, true).status).toBe(3);

      // `git commit --only` supplies an alternate index; inspect that one while
      // clearing all Git variables from the snapshot's independent test process.
      const normalTree = runGit(['write-tree']).stdout;
      const alternate = join(temp, '.git', 'alternate-index');
      copyFileSync(join(temp, '.git', 'index'), alternate);
      const alternateEnv = { ...isolatedEnv, GIT_INDEX_FILE: alternate };
      writeFileSync(join(temp, 'source.txt'), 'alternate index');
      expect(runGit(['add', 'source.txt'], alternateEnv).status).toBe(0);
      const alternateCheck = verify('alternate index', 0, false, alternateEnv);
      expect(alternateCheck.status, alternateCheck.stderr).toBe(0);
      expect(runGit(['write-tree']).stdout).toBe(normalTree);
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }, process.platform === 'win32' ? 60_000 : 15_000);

});
