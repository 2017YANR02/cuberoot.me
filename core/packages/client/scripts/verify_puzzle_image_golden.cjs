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

/** codec 的 pzl 短名 → sim 自己的 puzzle 取值(数字直接透传)。 */
function simPuzzleValue(pzl) {
  if (/^\d+$/.test(pzl)) return pzl;      // NxN 阶数
  if (pzl === 'pyra') return 'pyraminx';
  if (pzl === 'mega') return 'megaminx';
  if (pzl === 'cube') return '3';
  return pzl;                              // sq1 / skewb 同名
}

/**
 * 给 query 的每个 key 加前缀(/sim 面板用 img_ 避免和 sim 自己的 puzzle/alg 撞车)。
 * 迁移后 studio 面板没有自己的 puzzle 选择器——拼图类型只有一个来源:sim 的 `puzzle`
 * 下拉(codec 在面板模式下根本不读写 img_pzl)。所以把 fixture 的 `pzl=X` 翻译成
 * `puzzle=<映射>` 喂给 sim,其余 key 照常加 img_ 前缀。
 */
function withPrefix(qs, prefix) {
  if (!prefix) return qs;
  const out = [];
  for (const kv of qs.split('&')) {
    const eq = kv.indexOf('=');
    const k = eq < 0 ? kv : kv.slice(0, eq);
    const v = eq < 0 ? '' : kv.slice(eq + 1);
    if (k === 'pzl') out.push(`puzzle=${simPuzzleValue(v)}`);
    else out.push(`${prefix}${k}=${v}`);
  }
  return out.join('&');
}

(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await disableWebRTC(ctx);
  // /sim 的图像面板默认折叠(仅非默认 img_ 参数才自动展开),纯 3x3 用例会抓到空的
  // .vc-preview。用持久化偏好把它钉成展开(SimPage 读 localStorage['sim.panel.image'])。
  // /visualcube 没有这个 key,设了也无副作用。
  if (PREFIX) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('sim.panel.image', '1'); } catch { /* private mode */ }
    });
  }
  const page = await ctx.newPage();

  // Canonicalize an HTML string in the browser so the comparison survives the ONE
  // difference between the SSR'd /visualcube page and the client-mounted /sim panel:
  // browser CSSOM re-serialization. React writes an SSR'd element's style as a compact
  // attribute string (`width:256px;height:187px`, hex colours, JSX attr order), but a
  // client-mounted element's style goes through element.style.* so innerHTML reads it
  // back CSSOM-normalized (`width: 256px; height: 187px;`, rgb() colours, style attr
  // last). Parsing BOTH sides into a detached DOM and reading each element's
  // style.cssText + sorted attributes collapses exactly that noise — a real difference
  // (different coordinate / colour value / missing element) still survives.
  const canon = (html) => page.evaluate((h) => {
    const root = document.createElement('div');
    root.innerHTML = h;
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node;
      const attrs = [...el.attributes].map((a) => (
        a.name === 'style'
          ? `style=${JSON.stringify(el.style.cssText)}`   // CSSOM-normalized, both sides
          : `${a.name}=${JSON.stringify(a.value)}`
      )).sort().join(' ');
      const kids = [...el.childNodes].map(walk).join('');
      return `<${el.tagName.toLowerCase()} ${attrs}>${kids}</${el.tagName.toLowerCase()}>`;
    };
    return [...root.childNodes].map(walk).join('');
  }, html);

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
    if (got === want) { pass++; console.log(`  ok   ${name}`); continue; }
    // Not byte-identical — retry under DOM canonicalization (SSR vs CSR serialization).
    const [gc, wc] = await Promise.all([canon(got), canon(want)]);
    if (gc === wc) { pass++; console.log(`  ok*  ${name}  (normalized: browser style re-serialization)`); }
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
