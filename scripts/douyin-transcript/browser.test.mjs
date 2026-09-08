import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { collect } from './browser.mjs';
import { ORIGIN, BASE_PATH, CONTENT_PATH, parseLink } from './transcript.mjs';

const require = createRequire(import.meta.url);
const { disableWebRTC } = require(join(homedir(), '.codex', 'bin', 'pw-no-webrtc.cjs'));
const config = JSON.parse(await readFile(join(homedir(), '.codex', 'playwright-mcp.json'), 'utf8'));
const id = '7682751505497279270';
const link = parseLink(`${ORIGIN}/anchor/review?roomId=${id}`);
const start = '2026-09-07 19:19:50', end = '2026-09-07 20:39:02';
const metadata = { code: 0, data: { series: [{ room_id: id, title: '合成测试', start_time: start, end_time: end }] } };
function contentUrl(a, b) {
  return CONTENT_PATH + '?' + new URLSearchParams({ roomID: id, roomStatsContentType: '4', startTime: a, endTime: b });
}

for (const privateRoom of [false, true]) test(privateRoom ? 'private replay is skipped before transcript bodies are read' : 'real browser fetches all windows with page session headers', async () => {
  const browser = await chromium.launch({ executablePath: config.browser.launchOptions.executablePath, headless: true });
  const context = await browser.newContext();
  await disableWebRTC(context);
  try {
    const page = await context.newPage();
    let requests = 0, bodiesRead = 0;
    // Entire browser network is intercepted; tests never call Douyin or use a login profile.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/anchor/review') {
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
          ${privateRoom ? '<p>不支持查看非公开开播间回放</p>' : '<video src="data:video/mp4;base64,AAAA"></video>'}
          <script>Promise.all([fetch(${JSON.stringify(BASE_PATH)}), fetch(${JSON.stringify(contentUrl(start, '2026-09-07 19:49:49'))}, {headers:{'client-id':'fixture'}})]);</script>
          </body></html>` });
      } else if (url.pathname === BASE_PATH) {
        await route.fulfill({ json: metadata });
      } else if (url.pathname === CONTENT_PATH) {
        requests++;
        assert.equal(route.request().headers()['client-id'], 'fixture');
        await route.fulfill({ json: { code: 0, data: { series: [{ contentTime: url.searchParams.get('startTime'), nickname: '测试', content: '测试文字' }] } } });
      } else { await route.abort(); }
    });
    page.on('response', response => {
      if (new URL(response.url()).pathname !== CONTENT_PATH) return;
      const original = response.json.bind(response);
      response.json = async () => { bodiesRead++; return original(); };
    });
    if (privateRoom) {
      await assert.rejects(collect(page, link, { log: () => {} }), { code: 'PRIVATE_ROOM' });
      assert.equal(bodiesRead, 0);
      assert.ok(requests <= 1);
    } else {
      const result = await collect(page, link, { log: () => {} });
      assert.equal(result.complete, true);
      assert.equal(result.rows.length, 3);
      assert.equal(requests, 3);
    }
    assert.equal(await page.evaluate(() => typeof window.RTCPeerConnection), 'undefined');
  } finally { await browser.close(); }
});
