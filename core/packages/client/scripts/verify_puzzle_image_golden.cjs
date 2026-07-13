/**
 * verify_puzzle_image_golden — 迁移零丢失的机器化铁证。
 *
 * tests/fixtures/puzzle-image-golden/*.svg 是「/visualcube 迁移前」的渲染输出快照
 * (28 条,覆盖全部渲染分派分支: visualcube renderCubeSVG / tnoodle _svg 展开图 /
 * sr-puzzlegen 立体图 / InteractiveCubeNet 涂色板 / scramble-display 自定义元素)。
 * 本脚本把同一组 query 喂给指定路由,抓 .vc-preview 的 innerHTML,与 fixture 逐字节比。
 *
 * 需要 dev server 常驻在 127.0.0.1:3000(项目规矩:别自己 pnpm dev / next build)。
 *
 *   node scripts/verify_puzzle_image_golden.cjs                     # 查 /visualcube(基线自证)
 *   node scripts/verify_puzzle_image_golden.cjs --route /sim --prefix img_ --sel .vc-preview
 *   node scripts/verify_puzzle_image_golden.cjs --update            # 重录(只有蓄意改渲染时才用)
 *
 * 不进 CI(要跑浏览器 + dev server),是本地迁移期的验收闸。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { disableWebRTC } = require('C:/Users/CubeRoot/.claude/bin/pw-no-webrtc.cjs');

const FIX = path.resolve(__dirname, '../tests/fixtures/puzzle-image-golden');
const CHROME = process.env.SAFE_CHROME_BIN
  || 'C:/Users/CubeRoot/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const ROUTE = arg('--route', '/visualcube');
const PREFIX = arg('--prefix', '');
const SEL = arg('--sel', '.vc-preview');
const ORIGIN = arg('--origin', 'http://127.0.0.1:3000');
const LANG = arg('--lang', '/zh');
const UPDATE = process.argv.includes('--update');

/** 给 query 的每个 key 加前缀(/sim 面板用 img_ 避免和 sim 自己的 puzzle/alg 撞车)。 */
function withPrefix(qs, prefix) {
  if (!prefix) return qs;
  return qs.split('&').map((kv) => {
    const eq = kv.indexOf('=');
    const k = eq < 0 ? kv : kv.slice(0, eq);
    const v = eq < 0 ? '' : kv.slice(eq);
    return `${prefix}${k}${v}`;
  }).join('&');
}

(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await disableWebRTC(ctx);
  const page = await ctx.newPage();

  let pass = 0;
  const fails = [];
  for (const { name, qs } of index) {
    const url = `${ORIGIN}${LANG}${ROUTE}?${withPrefix(qs, PREFIX)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    try { await page.waitForSelector(SEL, { timeout: 15000 }); } catch { /* record what's there */ }
    const got = await page.evaluate((sel) => document.querySelector(sel)?.innerHTML ?? '', SEL);
    const file = path.join(FIX, `${name}.svg`);

    if (UPDATE) { fs.writeFileSync(file, got, 'utf8'); console.log(`updated ${name}`); continue; }

    const want = fs.readFileSync(file, 'utf8');
    if (got === want) { pass++; console.log(`  ok   ${name}`); }
    else {
      fails.push({ name, url, wantBytes: want.length, gotBytes: got.length });
      console.log(`  FAIL ${name}  want ${want.length}B got ${got.length}B`);
      fs.writeFileSync(path.join(FIX, `${name}.actual.svg`), got, 'utf8');
    }
  }
  await browser.close();

  if (UPDATE) { console.log('\nfixtures updated'); return; }
  console.log(`\n${pass}/${index.length} match  (route ${ROUTE}, prefix "${PREFIX}")`);
  if (fails.length) {
    console.log('\nFAILURES (actual written next to the fixture as *.actual.svg):');
    for (const f of fails) console.log(`  ${f.name}\n    ${f.url}`);
    process.exit(1);
  }
})();
