import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { analyzer } from './common.js';

test('analyzer keeps quiet terminal output, preserves log/progress, and reports a failed subprocess', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stats-progress-test-'));
  try {
    const input = join(dir, 'chunk.txt');
    const script = join(dir, 'mock.cjs');
    const log = join(dir, 'analyzer.log');
    const progress = join(dir, 'progress.log');
    await writeFile(input, '1,R U\n');
    await writeFile(progress, '');
    await writeFile(script, `const fs=require('node:fs');
fs.appendFileSync(process.env.ANALYZER_PROGRESS_FILE,'[PROG] 2/3\\n[MONSTER] fixture\\n');
console.log('CUBE ROOT LOGO'); console.error('fixture failure'); process.exitCode=23;`);
    await assert.rejects(() => analyzer(process.execPath, [input], log, { ...process.env, ANALYZER_PROGRESS_FILE: progress }, 'mock', [script]), /exited with 23/);
    assert.match(await readFile(log, 'utf8'), /CUBE ROOT LOGO/);
    assert.match(await readFile(log, 'utf8'), /fixture failure/);
    assert.match(await readFile(progress, 'utf8'), /\[MONSTER\]/);
    await writeFile(script, "console.log('success');");
    await analyzer(process.execPath, [input], log, process.env, 'mock', [script]);
    assert.match(await readFile(log, 'utf8'), /success/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
