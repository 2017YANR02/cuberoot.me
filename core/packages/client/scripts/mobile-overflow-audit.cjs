#!/usr/bin/env node
/*
 * mobile-overflow-audit.cjs — headless 390px sweep that flags horizontal overflow.
 *
 * WHY THIS EXISTS
 *   Mobile horizontal overflow ("溢出") has several unrelated causes — a fixed-width
 *   control that can't shrink inside a squeezed flex column, a JS-positioned dot that
 *   escapes a fixed-size bar, a data table whose min-content exceeds the viewport.
 *   No static lint catches all three. This loads each route in an emulated narrow
 *   viewport and MEASURES: (a) document-level horizontal scroll, and (b) any static
 *   element whose box pokes out of its (non-scrolling) parent. Empirical, not guessed.
 *
 *   The tests/no-fixed-width-dropdown-root.test.ts CI ratchet catches the ONE static
 *   sub-case (dropdown root with a fixed px width, no max-width) for free on every push;
 *   this script is the on-demand full-coverage complement. Run it after any responsive /
 *   filter-bar / table / picker change, or when a page "溢出 on mobile" is reported.
 *
 * USAGE  (dev server must be up at --base, default http://127.0.0.1:3000)
 *   node packages/client/scripts/mobile-overflow-audit.cjs                # default route list
 *   node packages/client/scripts/mobile-overflow-audit.cjs /zh/wca/results /zh/timer
 *   node packages/client/scripts/mobile-overflow-audit.cjs --base http://127.0.0.1:3000 --width 360
 *   pnpm -F @cuberoot/client audit:overflow                               # via package script
 *
 * FLAGS
 *   --base <url>   dev origin           (default http://127.0.0.1:3000)
 *   --width <px>   viewport width       (default 390 — common small phone)
 *   --wait <ms>    settle per page      (default 700)
 *   positional args = explicit routes to check (overrides the default list)
 *
 * EXIT CODE  non-zero if any page shows real overflow (usable as a gate).
 *
 * NOTE: per global rules, ad-hoc chromium launches must kill WebRTC first; this loads
 * ~/.claude/bin/pw-no-webrtc.cjs and calls disableWebRTC(ctx) before newPage() (same
 * kill the Playwright MCP applies). Helper is user-machine-local; warns + continues if absent.
 */
const os = require('os');
const path = require('path');

let pw;
try { pw = require('@playwright/test'); }
catch { pw = require('playwright'); }
const { chromium } = pw;

let disableWebRTC = async () => {};
try {
  ({ disableWebRTC } = require(path.join(os.homedir(), '.claude', 'bin', 'pw-no-webrtc.cjs')));
} catch {
  console.warn('[warn] pw-no-webrtc helper not found; WebRTC not disabled (dev-only harness).');
}

function flag(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const BASE = flag('base', 'http://127.0.0.1:3000').replace(/\/$/, '');
const WIDTH = Number(flag('width', '390'));
const WAIT = Number(flag('wait', '700'));

// Explicit positional routes (anything not starting with '-' and not a flag value) override the default list.
const flagVals = new Set();
for (const n of ['base', 'width', 'wait']) { const i = process.argv.indexOf(`--${n}`); if (i > -1) flagVals.add(process.argv[i + 1]); }
const cliRoutes = process.argv.slice(2).filter((a) => a.startsWith('/') && !flagVals.has(a));

const DEFAULT_ROUTES = [
  '/zh/wca/results?show=persons', '/zh/wca/records', '/zh/wca/fun-stats', '/zh/wca/comp',
  '/zh/wca/viz', '/zh/wca/globe', '/zh/wca/prediction', '/zh/wca/sor',
  '/zh/scramble/gen', '/zh/scramble/stats', '/zh/scramble/solver', '/zh/scramble/analyzer',
  '/zh/timer', '/zh/battle', '/zh/calc', '/zh/recon', '/zh/alg',
  '/zh/membership', '/zh/support', '/zh/mosaic', '/zh/frame-count', '/zh/paint', '/zh/sim',
  '/zh/math/group', '/zh/math/god', '/zh/code', '/zh/code/architecture', '/zh/code/solvers',
  '/zh/recognize/pll', '/zh/regulation', '/zh/regulation/events', '/zh/nemesizer',
  '/zh/why-cube', '/zh/tutorial',
];
const ROUTES = cliRoutes.length ? cliRoutes : DEFAULT_ROUTES;

// Runs in-page: reports doc-level scroll + static boxes poking out of a non-scrolling parent.
// Skips display:contents / zero-width parents (degenerate boxes → false positives) and
// scroll-container descendants (tables etc. legitimately scroll).
const DETECTOR = () => {
  const vw = document.documentElement.clientWidth;
  const SKIP = new Set(['td', 'th', 'tr', 'tbody', 'thead', 'table', 'tfoot', 'col', 'colgroup', 'svg', 'path', 'g', 'rect', 'line', 'circle', 'image', 'canvas', 'br', 'hr']);
  const scrollable = new Set();
  document.querySelectorAll('*').forEach((el) => {
    const ox = getComputedStyle(el).overflowX;
    if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') scrollable.add(el);
  });
  const inScroll = (el) => { let p = el.parentElement, n = 0; while (p && n < 12) { if (scrollable.has(p)) return true; p = p.parentElement; n++; } return false; };
  const off = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (SKIP.has(el.tagName.toLowerCase())) return;
    const cs = getComputedStyle(el);
    if (['absolute', 'fixed', 'sticky'].includes(cs.position)) return;
    if (cs.display === 'none' || cs.float !== 'none') return;
    const parent = el.parentElement; if (!parent) return;
    const pcs = getComputedStyle(parent);
    if (pcs.overflowX !== 'visible' || pcs.display === 'contents') return;
    if (inScroll(el)) return;
    const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
    if (r.width === 0 || pr.width < 1) return;   // degenerate parent → skip
    const over = r.right - pr.right;
    if (over > 3) off.push({
      cls: (el.className?.toString?.() || '').trim().slice(0, 55), tag: el.tagName.toLowerCase(),
      w: Math.round(r.width), over: Math.round(over),
      parent: (parent.className?.toString?.() || '').trim().slice(0, 45),
    });
  });
  const map = new Map();
  off.forEach((o) => { const k = o.cls + '|' + o.parent; const e = map.get(k); if (!e || o.over > e.over) map.set(k, o); });
  return {
    docOverflow: document.documentElement.scrollWidth - vw,
    boxOverflow: [...map.values()].sort((a, b) => b.over - a.over).slice(0, 8),
  };
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 800 } });
  await disableWebRTC(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', () => {});

  const flagged = [];
  console.log(`sweep @${WIDTH}px  base=${BASE}  routes=${ROUTES.length}\n`);
  for (const route of ROUTES) {
    let r;
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(WAIT);
      r = await page.evaluate(DETECTOR);
    } catch (e) {
      flagged.push({ route, error: String(e).slice(0, 120) });
      console.log(`  ERR  ${route}  ${String(e).slice(0, 80)}`);
      continue;
    }
    const bad = r.docOverflow > 2 || r.boxOverflow.length > 0;
    console.log(`  ${bad ? 'FLAG' : ' ok '} ${route}  docOverflow=${r.docOverflow}px  boxes=${r.boxOverflow.length}`);
    if (bad) flagged.push({ route, ...r });
  }
  await browser.close();

  if (flagged.length) {
    console.log(`\n=== ${flagged.length} FLAGGED ===`);
    console.log(JSON.stringify(flagged, null, 1));
    console.log('\nNote: a flag with docOverflow<=0 and only zero-width-parent boxes is usually a false positive; confirm visually.');
    process.exit(1);
  }
  console.log(`\nAll ${ROUTES.length} routes clean @${WIDTH}px.`);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
