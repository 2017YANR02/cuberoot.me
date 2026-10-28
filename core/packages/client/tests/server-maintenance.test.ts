import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { processReferences, pruneReleases, pruneStaging, type DeploymentAttempt } from '../../../../ops/maintenance/prune-api-releases';
import { capacityReport } from '../../../../ops/maintenance/stats-capacity';

const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'release-retention-')));
  temporary.push(root);
  const releases = Array.from({ length: 7 }, (_, i) => join(root, 'releases', `${i + 1}-1-${'a'.repeat(40)}`));
  for (const [i, path] of releases.entries()) {
    mkdirSync(join(path, 'dist'), { recursive: true });
    writeFileSync(join(path, 'dist/server.bundle.js'), 'fixture');
    utimesSync(path, 100 + i, 100 + i);
  }
  symlinkSync(join(releases[6], 'dist'), join(root, 'dist'));
  return { root, releases };
}

describe('server capacity and release retention', () => {
  it('deletes only staging backed by the exact completed deployment attempt, including partial uploads', () => {
    const { root } = fixture();
    const sha = 'b'.repeat(40);
    const evidence: DeploymentAttempt = { id: 10, run_attempt: 1, head_sha: sha, status: 'completed', head_branch: 'main',
      path: '.github/workflows/deploy_core.yml', repository: { full_name: '2017YANR02/cuberoot.me' } };
    const staging = join(root, 'releases', `.10-1-${sha}.staging`);
    mkdirSync(staging);
    writeFileSync(join(staging, 'partial-upload'), 'incomplete bundle');
    for (const record of [undefined, { ...evidence, status: 'in_progress' }, { ...evidence, status: 'queued' },
      { ...evidence, run_attempt: 2 }, { ...evidence, head_sha: 'a'.repeat(40) }, { ...evidence, head_branch: 'feature' },
      { ...evidence, path: '.github/workflows/other.yml' }, { ...evidence, repository: { full_name: 'other/repo' } }]) {
      expect(pruneStaging(root, [], record ? [record] : [], true).removed).toEqual([]);
      expect(existsSync(staging)).toBe(true);
    }
    expect(pruneStaging(root, [], [evidence], false).removed).toEqual([staging]);
    expect(existsSync(staging)).toBe(true);
    expect(pruneStaging(root, [], [evidence], true).removed).toEqual([staging]);
    expect(existsSync(staging)).toBe(false);
    expect(pruneStaging(root, [], [evidence], true).removed).toEqual([]);
  });

  it('preserves process references, rollback links and symlinked staging targets', () => {
    const { root } = fixture();
    const sha = 'c'.repeat(40);
    const evidence: DeploymentAttempt = { id: 11, run_attempt: 1, head_sha: sha, status: 'completed', head_branch: 'main',
      path: '.github/workflows/deploy_core.yml', repository: { full_name: '2017YANR02/cuberoot.me' } };
    const staging = join(root, 'releases', `.11-1-${sha}.staging`);
    mkdirSync(join(staging, 'dist'), { recursive: true });
    expect(pruneStaging(root, [`rsync\n${staging}/dist`], [evidence], true).removed).toEqual([]);
    const rollback = join(root, '.dist.rollback.fixture');
    symlinkSync(join(staging, 'dist'), rollback);
    expect(pruneStaging(root, [], [evidence], true).removed).toEqual([]);
    rmSync(rollback);
    const outside = join(root, 'external');
    mkdirSync(outside);
    rmSync(staging, { recursive: true });
    symlinkSync(outside, staging);
    expect(pruneStaging(root, [], [evidence], true).removed).toEqual([]);
    expect(existsSync(outside)).toBe(true);
  });

  it('previews without mutation, then preserves current, two recent versions, explicit rollback and process references', () => {
    const { root, releases } = fixture();
    const refs = [`node\n${releases[1]}/dist/server.bundle.js`, `${releases[2]}/dist`];
    expect(pruneReleases(root, refs, false, join(releases[3], 'dist')).removed).toEqual([releases[0]]);
    expect(existsSync(releases[0])).toBe(true);
    expect(pruneReleases(root, refs, true, join(releases[3], 'dist')).removed).toEqual([releases[0]]);
    expect(existsSync(releases[0])).toBe(false);
    for (const path of releases.slice(1)) expect(existsSync(path)).toBe(true);
    expect(pruneReleases(root, refs, true, join(releases[3], 'dist')).removed).toEqual([]);
  });

  it('keeps an older active rollback, staging, unknown directories and symlink targets', () => {
    const { root, releases } = fixture();
    rmSync(join(root, 'dist'));
    symlinkSync(join(releases[0], 'dist'), join(root, 'dist'));
    const stage = join(root, 'releases/.123.staging');
    mkdirSync(stage);
    mkdirSync(join(root, 'releases/manual-backup'));
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'keep'), 'untouched');
    symlinkSync(outside, join(root, 'releases', `99-1-${'b'.repeat(40)}`));
    symlinkSync(outside, join(releases[1], 'external'));
    utimesSync(releases[1], 101, 101);
    const result = pruneReleases(root, [], true);
    expect(result.kept.sort()).toEqual([releases[0], releases[5], releases[6]].sort());
    expect(existsSync(stage)).toBe(true);
    expect(existsSync(join(root, 'releases/manual-backup'))).toBe(true);
    expect(readFileSync(join(outside, 'keep'), 'utf8')).toBe('untouched');
  });

  it('refuses unsafe roots and invalid rollback references before deleting anything', () => {
    const { root, releases } = fixture();
    const alias = `${root}-alias`;
    temporary.push(alias);
    symlinkSync(root, alias);
    expect(() => pruneReleases(alias, [], true)).toThrow('Unsafe release root');
    expect(() => pruneReleases(root, [], true, join(root, 'missing'))).toThrow();
    for (const path of releases) expect(existsSync(path)).toBe(true);
  });

  it('reads process command, mappings and open files; an unreadable inventory fails closed', () => {
    const { root } = fixture();
    const proc = join(root, 'proc');
    mkdirSync(join(proc, '123/fd'), { recursive: true });
    writeFileSync(join(proc, '123/cmdline'), 'node\0/old/dist/server.bundle.js');
    writeFileSync(join(proc, '123/maps'), '/older/library.so');
    symlinkSync('/working', join(proc, '123/cwd'));
    symlinkSync('/node', join(proc, '123/exe'));
    symlinkSync('/old/open-file', join(proc, '123/fd/1'));
    expect(processReferences(proc)).toEqual(['node\n/old/dist/server.bundle.js', '/older/library.so', '/working', '/node', '/old/open-file']);
    expect(() => processReferences(join(root, 'missing-proc'))).toThrow();
  });

  it('rejects the observed failure and yesterday\'s marginal capacity, admits recovered capacity, and scales with data', () => {
    expect(capacityReport(5204275200, 1500000000).admitted).toBe(false);
    expect(capacityReport(5605191680, 1500000000).admitted).toBe(false);
    expect(capacityReport(9 * 1024 ** 3, 1500000000).admitted).toBe(true);
    expect(capacityReport(8 * 1024 ** 3, 1500000000).admitted).toBe(true);
    expect(capacityReport(9 * 1024 ** 3, 4 * 1024 ** 3)).toEqual({ available: 9 * 1024 ** 3, required: 10 * 1024 ** 3, historyHeap: 4 * 1024 ** 3, admitted: false });
    expect(() => capacityReport(NaN, 0)).toThrow();
    expect(() => capacityReport(100, -1)).toThrow();
  });

});
