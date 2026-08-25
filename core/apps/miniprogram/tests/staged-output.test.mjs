import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
