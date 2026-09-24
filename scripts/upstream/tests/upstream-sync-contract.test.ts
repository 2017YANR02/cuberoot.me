import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';
import { repositoryRoot, restoreStash, stash, versionRecord } from '../lib.js';
import { syncSolver } from '../sync-rubiks-solver-demo.js';
import { syncCstimerScramble } from '../sync-cstimer-scramble.js';

const root = repositoryRoot;
const tsx = join(root, 'core/node_modules/.bin/tsx');
const directory = dirname(fileURLToPath(import.meta.url));
const temp = () => mkdtempSync(join(tmpdir(), 'upstream-contract-'));
const write = (path: string, value: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

test('all TypeScript entries validate from an unrelated current directory', () => {
  for (const entry of ['sync_upstream.ts', 'scripts/upstream/sync-all.ts', 'scripts/upstream/sync-cstimer.ts', 'scripts/upstream/sync-cstimer-scramble.ts', 'scripts/upstream/sync-rubiks-solver-demo.ts', 'scripts/upstream/sync-alg-trainers.ts', 'scripts/upstream/sync-blddb.ts', 'scripts/upstream/sync-recordranks.ts']) {
    const result = spawnSync(tsx, [join(root, entry), '--validate-only'], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
  }
});

test('root rejects an incomplete RepoRoot and invalid Only without touching upstream', () => {
  const invalidRoot = spawnSync(tsx, [join(root, 'sync_upstream.ts'), '--repo-root', tmpdir(), '--validate-only'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.notEqual(invalidRoot.status, 0);
  assert.match(invalidRoot.stderr, /RepoRoot/);
  const invalidOnly = spawnSync(tsx, [join(root, 'sync_upstream.ts'), '--only', 'unknown', '--validate-only'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.notEqual(invalidOnly.status, 0);
  assert.match(invalidOnly.stderr, /--only/);
});

test('Solver dry run previews without changing repository files', () => {
  const sandbox = temp();
  try {
    const project = join(sandbox, 'project');
    const clone = join(sandbox, 'clone');
    mkdirSync(join(clone, '.git'), { recursive: true });
    write(join(clone, 'src', 'main.js'), 'upstream');
    write(join(clone, 'index.html'), '<html><head><meta charset="UTF-8"></head><body style="background-color: #121212"><h1>Hello</h1><script src="analytics.js" defer></script></body></html>');
    write(join(project, '.sync/page_config.json'), JSON.stringify({ rootFiles: [], rootDirs: [], pages: [{ upstream: 'index.html', subdir: 'solver', i18nTitle: 'solver.title' }], analytics: { trackingId: 'G-TEST' } }));
    write(join(project, '.sync/menu_template.html'), '<a href="/">Home</a>');
    write(join(project, 'docs/generated-artifacts.json'), '{}');
    write(join(project, 'scripts/upstream/sync-rubiks-solver-demo.ts'), 'fixture');
    write(join(project, 'scripts/upstream/lib.ts'), 'fixture');
    write(join(project, 'tools/sw.js'), "\t'analytics.js',\n");
    const before = readFileSync(join(project, 'tools/sw.js'));
    syncSolver({ root: project, upstream: clone, dryRun: true });
    assert.deepEqual(readFileSync(join(project, 'tools/sw.js')), before);
    assert.equal(existsSync(join(project, 'tools/src/main.js')), false);
    assert.equal(existsSync(join(project, 'tools/solver/index.html')), false);
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
});

test('shared version writer records verified clone SHA and rejects escape paths', () => {
  const sandbox = temp();
  try {
    const project = join(sandbox, 'project');
    const clone = join(sandbox, 'clone');
    mkdirSync(clone, { recursive: true });
    git(clone, 'init', '-q');
    git(clone, 'remote', 'add', 'origin', 'https://github.com/example/upstream.git');
    write(join(clone, 'README.md'), 'source');
    git(clone, 'add', 'README.md');
    execFileSync('git', ['-C', clone, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture']);
    const artifact = { id: 'fixture', source: { url: 'https://github.com/example/upstream', ref: { type: 'branch', value: 'main' } }, license: { spdx: 'MIT' }, patchOwner: ['scripts/upstream/lib.ts'], outputs: ['tools/fixture/**'], versionRecord: { format: 'structured-v1', path: 'tools/fixture/UPSTREAM.txt' } };
    write(join(project, 'docs/generated-artifacts.json'), JSON.stringify({ artifacts: [artifact] }));
    versionRecord(project, 'fixture', clone);
    const record = readFileSync(join(project, artifact.versionRecord.path), 'utf8');
    assert.match(record, new RegExp(`Commit: ${git(clone, 'rev-parse', 'HEAD')}`));
    assert.match(record, /Patch owners:\n- scripts\/upstream\/lib.ts/);
    assert.throws(() => versionRecord(project, 'fixture', clone, join(sandbox, 'outside.txt')), /escapes repository/);
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
});

test('stash guard restores only the stash created by this sync', () => {
  const clone = temp();
  try {
    git(clone, 'init', '-q');
    write(join(clone, 'tracked.txt'), 'base\n');
    git(clone, 'add', 'tracked.txt');
    execFileSync('git', ['-C', clone, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'base']);
    write(join(clone, 'tracked.txt'), 'local patch\n');
    write(join(clone, 'untracked.txt'), 'keep me\n');
    const created = stash(clone, 'contract test');
    assert.match(created ?? '', /^[a-f\d]{40}$/);
    assert.equal(existsSync(join(clone, 'untracked.txt')), false);
    restoreStash(clone, created!);
    assert.equal(readFileSync(join(clone, 'tracked.txt'), 'utf8'), 'local patch\n');
    assert.equal(readFileSync(join(clone, 'untracked.txt'), 'utf8'), 'keep me\n');
  } finally { rmSync(clone, { recursive: true, force: true }); }
});

test('csTimer scramble performs a three-way merge and preserves CubeRoot exports', () => {
  const sandbox = temp();
  try {
    const project = join(sandbox, 'project');
    const clone = join(sandbox, 'clone');
    mkdirSync(clone, { recursive: true });
    git(clone, 'init', '-q');
    git(clone, 'remote', 'add', 'origin', 'https://github.com/cs0x7f/cstimer.git');
    const libraries = ['utillib', 'isaac', 'mathlib', 'grouplib', 'poly3dlib', 'pat3x3', 'min2phase'];
    for (const name of libraries) write(join(clone, `src/js/lib/${name}.js`), `${name}\n`);
    for (const name of ['scramble_sq1_new', 'pyraminx', 'redi']) write(join(clone, `src/js/scramble/${name}.js`), 'const solveScramble = () => 1;\nconst selfCheck = () => true;\n');
    write(join(clone, 'LICENSE'), 'GPL');
    git(clone, 'add', '.');
    execFileSync('git', ['-C', clone, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'base']);
    const base = git(clone, 'rev-parse', 'HEAD');
    for (const name of libraries) write(join(project, `tools/cstimer-scramble/lib/${name}.js`), `${name}\n`);
    for (const name of ['scramble_sq1_new', 'pyraminx', 'redi']) write(join(project, `tools/cstimer-scramble/scramble/${name}.js`), 'const solveScramble = () => 1;\nconst selfCheck = () => true;\nexport default { solveScramble: solveScramble, selfCheck: selfCheck };\n');
    write(join(project, 'tools/cstimer-scramble/UPSTREAM.txt'), `Commit: ${base}\n`);
    write(join(project, 'scripts/upstream/lib.ts'), 'fixture');
    write(join(project, 'scripts/upstream/sync-cstimer-scramble.ts'), 'fixture');
    const artifact = { id: 'tools.cstimer-scramble', source: { url: 'https://github.com/cs0x7f/cstimer', ref: { type: 'branch', value: 'master' } }, license: { spdx: 'GPL-3.0-only' }, patchOwner: ['scripts/upstream/sync-cstimer-scramble.ts'], outputs: ['tools/cstimer-scramble/**'], versionRecord: { format: 'structured-v1', path: 'tools/cstimer-scramble/UPSTREAM.txt' } };
    write(join(project, 'docs/generated-artifacts.json'), JSON.stringify({ artifacts: [artifact] }));
    write(join(clone, 'src/js/scramble/pyraminx.js'), 'const solveScramble = () => 2;\nconst selfCheck = () => true;\n');
    git(clone, 'add', '.');
    execFileSync('git', ['-C', clone, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'upstream update']);
    syncCstimerScramble({ root: project, upstream: clone, skipPull: true });
    const result = readFileSync(join(project, 'tools/cstimer-scramble/scramble/pyraminx.js'), 'utf8');
    assert.match(result, /solveScramble = \(\) => 2/);
    assert.match(result, /solveScramble: solveScramble/);
    assert.match(readFileSync(join(project, 'tools/cstimer-scramble/UPSTREAM.txt'), 'utf8'), new RegExp(`Commit: ${git(clone, 'rev-parse', 'HEAD')}`));
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
});
