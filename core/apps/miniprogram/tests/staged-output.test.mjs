import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { publishStagedDirectory } from '../scripts/staged-output.mjs';

const temporaryDirectories = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cuberoot-mini-output-'));
  temporaryDirectories.push(root);
  return {
    backupPath: join(root, 'dist-previous'),
    stagedPath: join(root, 'dist-next'),
    targetPath: join(root, 'dist'),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { force: true, recursive: true })
  )));
});

describe('staged build output publishing', () => {
  it('updates in place, keeps unchanged files and directories, and removes stale output', async () => {
    const paths = await fixture();
    for (const root of [paths.targetPath, paths.stagedPath]) {
      await mkdir(join(root, 'pages'), { recursive: true });
      await writeFile(join(root, 'unchanged.txt'), 'same');
    }
    await writeFile(join(paths.targetPath, 'pages', 'index.js'), 'old');
    await writeFile(join(paths.stagedPath, 'pages', 'index.js'), 'new');
    await writeFile(join(paths.targetPath, 'stale.js'), 'stale');
    await mkdir(join(paths.targetPath, 'stale-dir'));
    await writeFile(join(paths.targetPath, 'stale-dir', 'old.js'), 'stale');
    const before = await Promise.all(['', 'pages', 'unchanged.txt'].map((path) => stat(join(paths.targetPath, path))));

    await publishStagedDirectory({ ...paths, preserveRoot: true });

    const after = await Promise.all(['', 'pages', 'unchanged.txt'].map((path) => stat(join(paths.targetPath, path))));
    expect(after.map((entry) => entry.ino)).toEqual(before.map((entry) => entry.ino));
    expect(after[2].mtimeMs).toBe(before[2].mtimeMs);
    expect(await readFile(join(paths.targetPath, 'pages', 'index.js'), 'utf8')).toBe('new');
    for (const path of ['stale.js', 'stale-dir']) {
      await expect(stat(join(paths.targetPath, path))).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('creates first output and handles file/directory replacements in either direction', async () => {
    const paths = await fixture();
    await mkdir(paths.stagedPath);
    await writeFile(join(paths.stagedPath, 'entry'), 'file');
    await publishStagedDirectory({ ...paths, preserveRoot: true });
    await mkdir(join(paths.stagedPath, 'entry'), { recursive: true });
    await writeFile(join(paths.stagedPath, 'entry', 'index.js'), 'nested');
    await publishStagedDirectory({ ...paths, preserveRoot: true });
    expect(await readFile(join(paths.targetPath, 'entry', 'index.js'), 'utf8')).toBe('nested');
    await mkdir(paths.stagedPath);
    await writeFile(join(paths.stagedPath, 'entry'), 'file again');
    await publishStagedDirectory({ ...paths, preserveRoot: true });
    expect(await readFile(join(paths.targetPath, 'entry'), 'utf8')).toBe('file again');
  });

  it('leaves current output untouched if the candidate is missing', async () => {
    const paths = await fixture();
    await mkdir(paths.targetPath);
    await writeFile(join(paths.targetPath, 'marker.txt'), 'old');
    await expect(publishStagedDirectory({ ...paths, preserveRoot: true })).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(paths.targetPath, 'marker.txt'), 'utf8')).toBe('old');
  });

  it('rejects directory links before changing any live files', async () => {
    const paths = await fixture();
    await mkdir(paths.targetPath);
    await mkdir(paths.stagedPath);
    await writeFile(join(paths.targetPath, 'marker.txt'), 'old');
    await writeFile(join(paths.stagedPath, 'marker.txt'), 'new');
    await symlink(paths.targetPath, join(paths.stagedPath, 'linked'), 'junction');
    await expect(publishStagedDirectory({ ...paths, preserveRoot: true })).rejects.toThrow('不支持链接');
    expect(await readFile(join(paths.targetPath, 'marker.txt'), 'utf8')).toBe('old');
  });

  it('replaces the previous output only after staging is complete', async () => {
    const paths = await fixture();
    await mkdir(paths.targetPath);
    await mkdir(paths.stagedPath);
    await writeFile(join(paths.targetPath, 'marker.txt'), 'old', 'utf8');
    await writeFile(join(paths.stagedPath, 'marker.txt'), 'new', 'utf8');

    await publishStagedDirectory(paths);

    await expect(readFile(join(paths.targetPath, 'marker.txt'), 'utf8')).resolves.toBe('new');
    await expect(readFile(join(paths.backupPath, 'marker.txt'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('restores the previous output when staged publishing fails', async () => {
    const paths = await fixture();
    await mkdir(paths.targetPath);
    await writeFile(join(paths.targetPath, 'marker.txt'), 'old', 'utf8');

    await expect(publishStagedDirectory(paths)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(paths.targetPath, 'marker.txt'), 'utf8')).resolves.toBe('old');
  });

  it('recovers an interrupted backup before publishing the next candidate', async () => {
    const paths = await fixture();
    await mkdir(paths.backupPath);
    await writeFile(join(paths.backupPath, 'marker.txt'), 'recoverable', 'utf8');

    await expect(publishStagedDirectory(paths)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(paths.targetPath, 'marker.txt'), 'utf8')).resolves.toBe('recoverable');
  });
});
