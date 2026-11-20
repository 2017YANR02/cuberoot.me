import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { transform } from 'esbuild';

const sourceRoot = resolve(import.meta.dirname, '../../../../tools/cstimer-scramble');
const files = ['lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble_sq1_new.js'].map(file => join(sourceRoot, file));
const license = join(sourceRoot, 'LICENSE');
export const DOUYIN_SQ1_HINT_INPUTS = [import.meta.filename, license, ...files];

export async function buildDouyinSq1Hint(outputRoot) {
  const sources = await Promise.all(files.map(file => readFile(file, 'utf8')));
  const output = join(outputRoot, 'workers/sq1-hint.js');
  await mkdir(dirname(output), { recursive: true });
  // The same vendored files as the Web classic Worker, adapted to the native
  // CommonJS Worker. The solver needs utility bindings and scramble registration.
  const { code } = await transform(`'use strict';
    const DEBUG = false;
    const $ = { isArray: Array.isArray, noop() {} };
    const scrMgr = { reg() {} };
    ${sources.join('\n')}
    module.exports.solveSq1Hint = scramble => sq1.solveScramble(scramble);
  `, { minify: true, target: 'chrome91' });
  await Promise.all([
    writeFile(output, code),
    copyFile(license, join(outputRoot, 'workers/sq1-hint.LICENSE.txt')),
  ]);
  return DOUYIN_SQ1_HINT_INPUTS;
}
