import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { analyzer, taskProgress } from './common.js';

test('task percentage follows completed units and never repeats a milestone', () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line: string) => { lines.push(line); };
  try {
    for (let done = 0; done <= 15; done++) taskProgress('fixture-progress', done, 15);
    assert.equal(lines[0], '[进度] fixture-progress 0% (0/15)');
    assert.equal(lines.at(-1), '[进度] fixture-progress 100% (15/15)');
    assert.equal(new Set(lines).size, lines.length);
    taskProgress('fixture-progress', 0, 2);
    taskProgress('fixture-progress', 0, 2);
    assert.equal(lines.at(-1), '[进度] fixture-progress 0% (0/2)');
  } finally { console.log = original; }
});

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
