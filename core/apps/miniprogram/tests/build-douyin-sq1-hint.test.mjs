import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { applySq1Scramble, isSq1Solved } from '@cuberoot/shared/sq1-notation';
import { expect, it } from 'vitest';
import { buildDouyinSq1Hint } from '../scripts/build-douyin-sq1-hint.mjs';

it('builds the vendored Square-1 hint and returns a full-state solution', async () => {
  const scratch = resolve(import.meta.dirname, '../../../../.tmp/scratch');
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'douyin-sq1-test-'));
  try {
    await buildDouyinSq1Hint(root);
    const program = await readFile(join(root, 'workers/sq1-hint.js'), 'utf8');
    const sandbox = { module: { exports: {} } };
    runInNewContext(program, sandbox);
    const scramble = '(1, 0)';
    const solution = sandbox.module.exports.solveSq1Hint(scramble);
    expect(solution).toBeTruthy();
    expect(isSq1Solved(applySq1Scramble(`${scramble} ${solution}`))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
