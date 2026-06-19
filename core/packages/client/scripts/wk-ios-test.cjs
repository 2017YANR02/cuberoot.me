#!/usr/bin/env node
/*
 * wk-ios-test.cjs — local WebKit + iPhone emulation harness for iOS Safari debugging.
 *
 * WHY THIS EXISTS
 *   Desktop Chromium does NOT reproduce iOS Safari quirks. Playwright's WebKit build
 *   with an iPhone device descriptor is the closest local proxy. Industry practice
 *   (Playwright docs / BrowserStack / LambdaTest 2025-26): run ~80% of mobile-web
 *   cases on emulated WebKit (layout, responsive, touch, JS behavior, fixed/overflow,
 *   viewport), and reserve the remaining ~20% for a REAL device (Safari rendering,
 *   memory pressure, performance, and hardware-backed media).
 *
 * WHAT IT CAN test:   layout / overflow / fixed positioning / touch / JS logic /
 *                     console errors / page crashes / network / DOM state.
 * WHAT IT CANNOT test: <video> playback / WebCodecs / any media codec. On Windows the
 *                     WebKit build ships NO media stack, so every <video> returns
 *                     err=4 (MEDIA_ERR_SRC_NOT_SUPPORTED) regardless of format, and
 *                     VideoDecoder is undefined. For frame-count / any video bug, use
 *                     the on-device overlay instead: open the page with ?fcdiag=1 on a
 *                     real iPhone and screenshot. (See memory: project_frame_count.)
 *
 * USAGE
 *   node packages/client/scripts/wk-ios-test.cjs <path> [flags]
 *   node packages/client/scripts/wk-ios-test.cjs /zh/frame-count
 *   node packages/client/scripts/wk-ios-test.cjs /zh/wca/comp --shot comp --wait 3000
 *   node packages/client/scripts/wk-ios-test.cjs /en/timer --device "iPhone 15 Pro"
 *   node packages/client/scripts/wk-ios-test.cjs /zh/frame-count --upload .tmp/clip.mov
 *
 * FLAGS
 *   --base <url>     dev origin            (default http://127.0.0.1:3000)
 *   --device <name>  Playwright descriptor (default "iPhone 15")
 *   --shot <name>    screenshot basename   (default "wk-ios"; written to .tmp/png/)
 *   --upload <file>  set first <input type=file> to this path (then poll for ~30s)
 *   --wait <ms>      settle time before screenshot (default 1500; ignored if --upload)
 *   --eval <expr>    JS expression to evaluate in-page; its JSON result is printed
 *
 * CAVEATS (verified 2026-06-19)
 *   - RUN VIA pwsh (or pass a FULL http URL). Git Bash mangles a leading-slash arg
 *     like "/zh/frame-count" into a Windows path (C:/Program Files/Git/...) -> 404.
 *     Safe forms: `node ...wk-ios-test.cjs "http://127.0.0.1:3000/zh/frame-count"`
 *     or from pwsh `node ...wk-ios-test.cjs /zh/frame-count`.
 *   - Emulated WebKit reports navigator.maxTouchPoints === 0 (real iPhone = 5). Code
 *     that gates "is mobile" on maxTouchPoints won't trip here; UA/innerWidth do.
 *   - Needs the dev server up at --base (default http://127.0.0.1:3000).
 *
 * NOTE: per global rules, ad-hoc WebKit launches must kill WebRTC first; this script
 * loads ~/.claude/bin/pw-no-webrtc.cjs and calls disableWebRTC(ctx) before newPage().
 */
const os = require('os');
const path = require('path');

// Resolve playwright from the client devDep (@playwright/test re-exports the launchers).
let pw;
try { pw = require('@playwright/test'); }
catch { pw = require('playwright'); }
const { webkit, devices } = pw;

// Kill WebRTC (global rule + write-time hook). Helper is user-machine-local; no-op if absent.
let disableWebRTC = async () => {};
try {
  ({ disableWebRTC } = require(path.join(os.homedir(), '.claude', 'bin', 'pw-no-webrtc.cjs')));
} catch {
  console.warn('[warn] pw-no-webrtc helper not found; WebRTC not disabled (dev-only harness).');
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const REL = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/zh/frame-count';
const BASE = arg('base', 'http://127.0.0.1:3000').replace(/\/$/, '');
const URL = REL.startsWith('http') ? REL : BASE + (REL.startsWith('/') ? REL : '/' + REL);
const DEVICE = arg('device', 'iPhone 15');
const SHOT = arg('shot', 'wk-ios');
const UPLOAD = arg('upload', null);
const WAIT = Number(arg('wait', '1500'));
const EVAL = arg('eval', null);

const shotPath = path.join(process.cwd(), '.tmp', 'png', `${SHOT}.jpeg`);

(async () => {
  if (!devices[DEVICE]) {
    const ios = Object.keys(devices).filter((k) => /^iPhone/.test(k) && !/landscape/.test(k));
    console.error(`Unknown device "${DEVICE}". iPhone descriptors:\n  ${ios.join('\n  ')}`);
    process.exit(1);
  }

  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices[DEVICE], permissions: [] });
  await disableWebRTC(ctx);
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
  page.on('crash', () => logs.push('[CRASH] page crashed'));

  console.log(`device=${DEVICE}\nurl=${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  const env = await page.evaluate(() => ({
    ua: navigator.userAgent,
    innerWidth: window.innerWidth,
    maxTouchPoints: navigator.maxTouchPoints,
    hasVideoDecoder: typeof VideoDecoder !== 'undefined',
  }));
  console.log('env:', JSON.stringify(env));

  if (UPLOAD) {
    await page.waitForTimeout(800);
    await page.locator('input[type=file]').first().setInputFiles(path.resolve(UPLOAD));
    console.log(`\nuploaded ${UPLOAD}; polling page/video state for ~30s...`);
    let last = null;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000);
      last = await page.evaluate(() => {
        const v = document.querySelector('video');
        const diag = typeof window.__fcDiag === 'function' ? window.__fcDiag() : null;
        return {
          diag,
          video: v
            ? { readyState: v.readyState, networkState: v.networkState, dur: v.duration,
                w: v.videoWidth, h: v.videoHeight, err: v.error ? v.error.code : null }
            : null,
        };
      });
      const v = last.video;
      console.log(`t=${(i + 1) * 2}s | video ${v ? `rs=${v.readyState} err=${v.err} ${v.w}x${v.h} dur=${v.dur}` : '(none)'}` +
        (last.diag ? ` | diag ready=${last.diag.isReady} samples=${last.diag.samples}` : ''));
      if (v && v.err === null && v.readyState >= 2) { console.log('-> video ready'); break; }
      if (v && v.err) { console.log('-> video err set (expected on WebKit-Windows; use real device + ?fcdiag=1)'); break; }
    }
    console.log('\nfinal:', JSON.stringify(last, null, 2));
  } else {
    await page.waitForTimeout(WAIT);
  }

  if (EVAL) {
    try {
      const r = await page.evaluate((e) => {
        // eslint-disable-next-line no-eval
        const out = eval(e);
        return out;
      }, EVAL);
      console.log('\neval:', JSON.stringify(r, null, 2));
    } catch (e) {
      console.log('\neval error:', e.message);
    }
  }

  await page.screenshot({ path: shotPath, type: 'jpeg', quality: 85 });
  console.log(`\nscreenshot -> ${shotPath}`);

  const interesting = logs.filter((l) => /error|warn|PAGEERROR|CRASH|Error/i.test(l));
  if (interesting.length) {
    console.log('\n===== console (errors/warnings) =====');
    for (const l of interesting) console.log(l);
  }
  console.log(`\n(${logs.length} total console lines)`);

  await browser.close();
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
