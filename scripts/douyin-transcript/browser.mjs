import { chromium } from 'playwright';
import { Transcript, BASE_PATH, CONTENT_PATH, ORIGIN, windows } from './transcript.mjs';
import { browserExecutable, disableWebRTC, localPaths } from './runtime.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const PROFILE = localPaths().profile;

function fail(code, message) { return Object.assign(new Error(message), { code }); }

export async function replayState(page, roomId) {
  const current = new URL(page.url());
  const target = current.origin === ORIGIN && current.pathname === '/anchor/review' && current.searchParams.get('roomId') === roomId;
  const state = await page.evaluate(() => ({
    private: /不支持查看[^\n]{0,30}非公开/.test(document.body?.innerText ?? ''),
    playable: [...document.querySelectorAll('video')].some(v => Boolean(v.currentSrc || v.getAttribute('src'))),
    canSwitch: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '切换场次'),
  }));
  return { ...state, target };
}

async function requirePublic(page, roomId) {
  const state = await replayState(page, roomId);
  if (!state.target) throw fail('ROOM_CHANGED', '页面已切换到其他场次，本次导出已停止。');
  if (state.private) throw fail('PRIVATE_ROOM', '已跳过：该场次为非公开直播，不读取或导出文字记录。');
  if (!state.playable) throw fail('REPLAY_UNAVAILABLE', '未确认可播放的公开回放，停止读取文字记录。');
}

export async function launchBrowser(login) {
  const context = await chromium.launchPersistentContext(PROFILE, {
    executablePath: await browserExecutable(),
    headless: !login,
    viewport: { width: 1280, height: 900 },
    args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
  });
  try { await disableWebRTC(context); } catch (error) { await context.close(); throw error; }
  return context;
}

export async function collect(page, link, { login = false, timeout = 180_000, log = console.error } = {}) {
  const transcript = new Transcript(link.roomId);
  const pending = new Set();
  const deferred = [];
  let allowed = false;
  let template = null, fatal = null;
  const ingestResponse = response => {
    const url = new URL(response.url());
    const task = (async () => {
      let body;
      try { body = await response.json(); } catch { return; }
      try {
        const accepted = transcript.ingest(response.url(), response.status(), body);
        if (accepted && url.pathname === CONTENT_PATH && url.searchParams.get('roomID') === link.roomId) {
          const headers = await response.request().allHeaders();
          // App headers come from the actual successful page request, only in memory.
          const appHeaders = Object.fromEntries(Object.entries(headers).filter(([k]) =>
            ['accept', 'client-id', 'x-appid', 'x-requested-with', 'x-sub-web-id', 'x-use-bpsc'].includes(k)));
          template = { url: response.url(), headers: appHeaders };
        }
      } catch (error) { fatal = error; }
    })().finally(() => pending.delete(task));
    pending.add(task);
  };
  const listener = response => {
    const url = new URL(response.url());
    if (url.origin !== ORIGIN || ![CONTENT_PATH, BASE_PATH].includes(url.pathname)) return;
    if (url.pathname === CONTENT_PATH) {
      if (url.searchParams.get('roomID') !== link.roomId || url.searchParams.get('roomStatsContentType') !== '4') return;
      // Do not read transcript response bodies until the visible player confirms a public replay.
      if (!allowed) { deferred.push(response); return; }
    }
    ingestResponse(response);
  };
  page.on('response', listener);
  try {
    await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (login) log('请在打开的专用浏览器中登录抖音；登录完成后工具会自动继续，无需 F12。');
    const initialDeadline = Date.now() + (login ? 10 * 60_000 : 40_000);
    let restoredTarget = false;
    while ((!transcript.meta || !template) && Date.now() < initialDeadline) {
      if (page.isClosed()) throw new Error('登录窗口已关闭，尚未完成导出。');
      if (fatal) throw fatal;
      let state;
      try { state = await replayState(page, link.roomId); }
      catch { await sleep(500); continue; } // Login can replace the document mid-read.
      if (state.target && state.private) throw fail('PRIVATE_ROOM', '已跳过：该场次为非公开直播，不读取或导出文字记录。');
      if (!state.target && state.canSwitch && !restoredTarget) {
        restoredTarget = true;
        log('登录后页面跳到了其他场次，正在重新打开给定链接。');
        await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        continue;
      }
      if (state.target && state.playable && transcript.meta && !allowed) {
        allowed = true;
        for (const response of deferred.splice(0)) ingestResponse(response);
      }
      await sleep(500);
    }
    if (fatal) throw fatal;
    if (!transcript.meta || !template) throw fail('LOGIN_OR_REPLAY_REQUIRED', '未取得可播放的公开场次文字记录。请使用 --login 登录并确认账号能查看此复盘；已登录仍失败时可能是验证提示或平台接口变化。');
    await requirePublic(page, link.roomId);
    log(`已读取直播时间：${transcript.meta.start} 至 ${transcript.meta.end}`);
    await page.evaluate(() => document.querySelectorAll('video,audio').forEach(media => media.pause()));
    const deadline = Date.now() + timeout;
    let directFailed = false, lastCount = -1;
    while (!transcript.complete && Date.now() < deadline) {
      if (fatal) throw fatal;
      if (page.isClosed()) throw new Error('浏览器已关闭，尚未完成导出。');
      await requirePublic(page, link.roomId);
      if (!directFailed) {
        const gap = transcript.gaps[0];
        const url = new URL(template.url);
        // Reuse the successful request's other parameters and browser session.
        const segment = windows(gap.start, gap.end)[0];
        url.searchParams.set('startTime', segment.start);
        url.searchParams.set('endTime', segment.end);
        try {
          const result = await page.evaluate(async ({ url, headers }) => {
            try {
              const r = await fetch(url, { headers, credentials: 'same-origin', signal: AbortSignal.timeout(20_000) });
              return { status: r.status, body: await r.json() };
            } catch { return { status: 0, body: null }; }
          }, { url: url.href, headers: template.headers });
          if (!transcript.ingest(url.href, result.status, result.body)) directFailed = true;
        } catch { directFailed = true; }
        if (directFailed) log('直接补充分段未成功，改为自动滚动文字记录，让页面加载剩余内容。');
      } else {
        await scrollTranscript(page);
      }
      if (transcript.rows.length !== lastCount) {
        lastCount = transcript.rows.length;
        log(`已读取 ${lastCount} 条文字记录，${transcript.batches.size} 个时间段。`);
      }
      await sleep(directFailed ? 800 : 350);
    }
    await Promise.allSettled([...pending]);
    if (fatal) throw fatal;
    await requirePublic(page, link.roomId);
    transcript.assertComplete();
    return transcript;
  } finally {
    page.off('response', listener);
    await Promise.allSettled([...pending]);
  }
}

export async function scrollTranscript(page) {
  const search = page.getByPlaceholder('输入关键词（仅搜索当前加载的文字记录）', { exact: true });
  const selector = await search.evaluate(input => {
    let box = input.parentElement;
    while (box && !box.querySelector('.ReactVirtualized__Grid')) box = box.parentElement;
    const grid = box?.querySelector('.ReactVirtualized__Grid');
    if (!grid) return false;
    grid.setAttribute('data-douyin-transcript-scroll', '');
    return true;
  });
  if (!selector) throw new Error('找不到文字记录滚动区域，平台页面结构可能已变化。');
  const grid = page.locator('[data-douyin-transcript-scroll]').first();
  await grid.scrollIntoViewIfNeeded();
  await grid.hover();
  await page.mouse.wheel(0, 2500);
}
