import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { createTerminalProgressFilter } from './terminal-progress.js';

function output(tty: boolean, columns = 80): { stream: NodeJS.WriteStream; read: () => string } {
  const stream = new PassThrough() as unknown as NodeJS.WriteStream;
  stream.isTTY = tty;
  stream.columns = columns;
  let text = '';
  stream.on('data', chunk => { text += chunk.toString(); });
  return { stream, read: () => text };
}

test('TTY percentage updates reuse one terminal line', () => {
  const { stream, read } = output(true);
  const filter = createTerminalProgressFilter(stream);
  filter.push('=== stages: 补缺 ===');
  filter.push('[进度] stages 25% (4/16)');
  filter.push('[进度] stages 37% (6/16)');
  filter.push('[进度] stages 50% (8/16)');
  filter.push('[进度] stages 50% (8/16)');
  filter.push('=== Set: wca ===');
  filter.finish();
  const text = read();
  assert.equal((text.match(/\n/gu) ?? []).length, 3);
  assert.equal((text.match(/50%/gu) ?? []).length, 1);
  assert.match(text, /\u001b\[2K/);
  assert.match(text, /stages 25%.*stages 37%.*stages 50%/su);
  assert.doesNotMatch(text, /\[进度\]/u);
});

test('long download status fits the terminal and keeps its percentage', () => {
  const { stream, read } = output(true, 64);
  const filter = createTerminalProgressFilter(stream);
  filter.push('[取数] 下载 WCA export 1/6 | 50.0/378.0 MB (13.2%) | 2.5 MB/s | 剩余 约 00:02:11 | 已运行 00:00:30');
  filter.finish();
  assert.match(read(), /13\.2%/u);
  assert.doesNotMatch(read(), /MB\/s/u);
});

test('redirected output keeps meaningful milestones as separate lines', () => {
  const { stream, read } = output(false);
  const filter = createTerminalProgressFilter(stream);
  filter.push('[进度] stages 25% (4/16)');
  filter.push('[进度] stages 25% (4/16)');
  filter.push('[进度] stages 50% (8/16)');
  filter.finish();
  assert.equal(read(), 'stages 25% (4/16)\nstages 50% (8/16)\n');
});
