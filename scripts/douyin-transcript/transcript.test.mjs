import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transcript, ORIGIN, BASE_PATH, CONTENT_PATH, parseLink, seconds, formatTime, windows, fromHar, renderText, saveText } from './transcript.mjs';

const id = '7682751505497279270';
const start = '2026-09-07 19:19:50', end = '2026-09-07 20:39:02';
const meta = { code: 0, data: { series: [{ room_id: id, title: '测试直播', start_time: start, end_time: end }] } };
function url(a, b, roomId = id) {
  const u = new URL(CONTENT_PATH, ORIGIN);
  u.search = new URLSearchParams({ roomID: roomId, roomStatsContentType: '4', startTime: a, endTime: b });
  return u.href;
}
function add(t, a, b, rows = []) { return t.ingest(url(a, b), 200, { code: 0, data: { series: rows } }); }
function setup() { const t = new Transcript(id); t.ingest(ORIGIN + BASE_PATH, 200, meta); return t; }

test('URL validates origin and preserves a room ID beyond Number precision', () => {
  assert.equal(parseLink(`${ORIGIN}/anchor/review?roomId=${id}`).roomId, id);
  for (const u of [`http://anchor.douyin.com/anchor/review?roomId=${id}`, `${ORIGIN}.evil.test/anchor/review?roomId=${id}`, `${ORIGIN}/anchor/review`, `${ORIGIN}/anchor/review?roomId=NaN`]) {
    assert.throws(() => parseLink(u));
  }
});

test('China time is independent of OS timezone; leap days and midnight are checked', () => {
  assert.equal(formatTime(seconds('2024-02-29 23:59:59') + 1), '2024-03-01 00:00:00');
  for (const time of ['2026-02-29 12:00:00', '2026-09-07 24:00:00', '2026-13-01 00:00:00', 'bad']) assert.throws(() => seconds(time));
  assert.deepEqual(windows('2026-12-31 23:50:00', '2027-01-01 00:30:00'), [
    { start: '2026-12-31 23:50:00', end: '2027-01-01 00:19:59' },
    { start: '2027-01-01 00:20:00', end: '2027-01-01 00:49:59' },
  ]);
});

test('first 30 minutes never pass as complete; out-of-order final batches close coverage', () => {
  const t = setup();
  add(t, start, '2026-09-07 19:49:49');
  assert.equal(t.complete, false);
  assert.throws(() => renderText(t), /缺少/);
  add(t, '2026-09-07 20:19:50', '2026-09-07 20:49:49');
  assert.deepEqual(t.gaps, [{ start: '2026-09-07 19:49:50', end: '2026-09-07 20:19:49' }]);
  add(t, '2026-09-07 19:49:50', '2026-09-07 20:19:49');
  assert.equal(t.complete, true);
});

test('HTTP errors, other rooms/types, and malformed data never count as loaded', () => {
  const t = setup(), u = url(start, '2026-09-07 19:49:49');
  assert.equal(t.ingest(u, 403, { code: 0, data: { series: [] } }), false);
  assert.equal(t.ingest(u, 200, { code: 1, data: { series: [] } }), false);
  assert.equal(t.ingest(u, 200, { code: 0, data: {} }), false);
  assert.equal(t.ingest(url(start, end, '123'), 200, { code: 0, data: { series: [] } }), false);
  assert.equal(t.ingest(u.replace('roomStatsContentType=4', 'roomStatsContentType=1'), 200, { code: 0, data: { series: [] } }), false);
  assert.throws(() => add(t, start, '2026-09-07 19:49:49', [{ contentTime: end, content: '超出分段', nickname: '测试' }]));
  assert.equal(t.batches.size, 0);
});

test('deduplication preserves repeated speech at distinct timestamps and overlapping batches', () => {
  const t = setup();
  const row = { contentTime: '2026-09-07 19:20:00', nickname: '测试', content: '相同文字' };
  add(t, start, '2026-09-07 19:49:49', [row, row, { ...row, contentTime: '2026-09-07 19:20:01' }]);
  add(t, '2026-09-07 19:20:00', '2026-09-07 19:49:59', [row]);
  assert.equal(t.rows.length, 2);
  assert.equal(t.gaps[0].start, '2026-09-07 19:50:00');
});

test('TXT contains only speech paragraphs without timestamps, names or metadata', () => {
  const t = setup();
  for (const w of windows(start, end)) add(t, w.start, w.end, [
    { contentTime: w.start, nickname: '魔***根', content: '正文一行\r\n保留原文换行' },
  ]);
  assert.equal(renderText(t), '\uFEFF' + Array(3).fill('正文一行\n保留原文换行').join('\n\n') + '\n');
});

test('HAR base64 import, BOM/LF output, and no-overwrite behavior', async () => {
  // A scratch directory contains only synthetic test data.
  const root = fileURLToPath(new URL('../../.tmp/png/', import.meta.url));
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'douyin-transcript-test-'));
  try {
    const entries = [{ request: { url: ORIGIN + BASE_PATH }, response: { status: 200, content: { text: JSON.stringify(meta) } } }];
    for (const w of windows(start, end)) entries.push({ request: { url: url(w.start, w.end) }, response: {
      status: 200, content: { encoding: 'base64', text: Buffer.from(JSON.stringify({ code: 0, data: { series: [] } })).toString('base64') },
    } });
    const har = join(dir, 'fixture.har');
    await writeFile(har, JSON.stringify({ log: { entries } }));
    const t = await fromHar(har);
    assert.equal(t.roomId, id);
    assert.equal(t.complete, true);
    const file = await saveText(t, join(dir, 'result.txt'));
    const result = await readFile(file, 'utf8');
    assert.equal(result.charCodeAt(0), 0xFEFF);
    assert.equal(result.includes('\r'), false);
    await assert.rejects(saveText(t, file), { code: 'EEXIST' });
    assert.equal(await readFile(file, 'utf8'), result);
  } finally {
    assert.ok(dir.startsWith(root));
    await rm(dir, { recursive: true, force: true });
  }
});
