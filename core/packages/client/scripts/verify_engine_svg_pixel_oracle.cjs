/**
 * verify_engine_svg_pixel_oracle — 引擎 3D vs 引擎矢量伴图「同相机」分色面积判据。
 *
 * sr/visualcube 退役后,/sim 的静态图不再由外部渲染器画,而是把 live 3D 引擎的状态
 * 导成矢量(BSP 实模投影 或 schematic 平色示意)。本脚本是这条新路线的验收闸:
 * 同一个页面、同一台相机下,把 WebGL 画布 与 引擎导出的伴图 SVG 分别栅格化成 256²,
 * 逐色统计「该色像素 / 全部着色像素」的面积比,断言两侧比例一致(gross 回归 = 双位数差)。
 *
 * 为何是「面积比」而非逐像素:3D 有打光/倒角/缝隙,矢量是平色 + inset,逐像素永不重合;
 * 但同相机下每个面投影到屏幕的「相对占比」应当吻合 —— 打光只改亮度不改色相,最近色分类
 * (调色板取自 SVG 自己的 fill)按色相归桶,于是面积比对光照免疫。实测(2026-07-21):
 *   pyraminx 默认角 maxDiff 1.5% / 3x3 normal(BSP)6.0%。
 * 3x3 的 6% 是 U 白面在 3D 里占比略高(近白高光 + BSP 相机仰角),已记 PLAN §3 待查,
 * 非本判据 bug —— 故默认容差 8%(catch 得住「画错面/镜像/错打乱」的双位数差,放得过
 * 当前基线噪声)。saturated OR 近白 才计入,滤掉灰塑料倒角。
 *
 * 需要 dev server 常驻 127.0.0.1:3000(项目规矩:别自己 pnpm dev / next build)。
 *
 *   node scripts/verify_engine_svg_pixel_oracle.cjs                 # 全用例
 *   node scripts/verify_engine_svg_pixel_oracle.cjs --tol 0.05     # 收紧容差
 *   node scripts/verify_engine_svg_pixel_oracle.cjs --only pyraminx
 *
 * 不进 CI(要跑浏览器 + WebGL + dev server),是本地退役期的对齐判据。
 */
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');
// 起 ad-hoc playwright 前必须先禁 WebRTC(全局规矩);kill 走 homedir 解析,别硬编码机器路径。
const { disableWebRTC } = require(path.join(os.homedir(), '.claude', 'bin', 'pw-no-webrtc.cjs'));

const CHROME = process.env.SAFE_CHROME_BIN
  || 'C:/Users/CubeRoot/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const ORIGIN = arg('--origin', 'http://127.0.0.1:3000');
const LANG = arg('--lang', '/en');
const TOL = parseFloat(arg('--tol', '0.08'));
const ONLY = arg('--only', '');

// 引擎原生拼图(退役目标)默认角,覆盖两条导出路径:
//   NxN(cube-2/3/4/6)走 BSP 实模投影;pyra/skewb/mega/sq1 走 schematic 平色示意。
const CASES = [
  { name: 'cube-2',   qs: 'puzzle=2' },
  { name: 'cube-3',   qs: 'puzzle=3' },
  { name: 'cube-4',   qs: 'puzzle=4' },
  { name: 'cube-6',   qs: 'puzzle=6' },
  { name: 'pyraminx', qs: 'puzzle=pyraminx' },
  { name: 'skewb',    qs: 'puzzle=skewb' },
  { name: 'megaminx', qs: 'puzzle=megaminx' },
  { name: 'square1',  qs: 'puzzle=sq1' },
].filter((c) => !ONLY || c.name.includes(ONLY));

/**
 * 在页面里同相机对比:栅格化伴图 SVG 与 WebGL 画布,逐色算面积比,返回 maxDiff。
 * 单参对象({S, tol})—— page.evaluate 序列化函数体,闭包变量不过去,全靠入参带。
 */
async function measure({ S, tol }) {
    const svg = document.querySelector('.vc-preview svg');
    if (!svg) return { err: 'no companion svg (panel collapsed / engine mirror off)' };

    const hexToRgb = (h) => {
      h = h.trim();
      if (h[0] === '#') {
        if (h.length === 4) h = '#' + [...h.slice(1)].map((c) => c + c).join('');
        return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      }
      const m = h.match(/rgba?\(([^)]+)\)/);
      if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2]]; }
      return null;
    };
    // 调色板 = SVG fill 集合,滤掉近黑(描边/壳)与中灰(壳体色)。
    const fills = new Map();
    for (const el of svg.querySelectorAll('[fill]')) {
      const f = el.getAttribute('fill');
      if (!f || f === 'none') continue;
      fills.set(f, (fills.get(f) || 0) + 1);
    }
    const palette = [...fills.entries()]
      .map(([hex, n]) => ({ hex, n, rgb: hexToRgb(hex) }))
      .filter((p) => p.rgb
        && !(p.rgb[0] < 45 && p.rgb[1] < 45 && p.rgb[2] < 45)
        && !(Math.abs(p.rgb[0] - p.rgb[1]) < 14 && Math.abs(p.rgb[1] - p.rgb[2]) < 14
          && p.rgb[0] > 60 && p.rgb[0] < 210));
    if (!palette.length) return { err: 'empty palette' };

    const rasterize = async (source) => {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const ctx = c.getContext('2d');
      ctx.drawImage(source, 0, 0, S, S);
      return ctx.getImageData(0, 0, S, S).data;
    };
    // 伴图 SVG → Image → 栅格
    const svgStr = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = rej;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
    const dSvg = await rasterize(img);
    // WebGL 画布(等两帧确保是新鲜帧)
    const gl = document.querySelector('.sim-canvas-wrap canvas');
    if (!gl) return { err: 'no 3D canvas' };
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const dGl = await rasterize(gl);

    // saturated OR 近白 才计入(滤灰塑料);最近色归桶,超阈判为背景/壳不计。
    const classify = (data) => {
      const hist = new Map(palette.map((p) => [p.hex, 0]));
      let colored = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const sat = mx ? (mx - mn) / mx : 0;
        if (!(sat > 0.34 || mn > 205)) continue;
        let best = null, bd = 1e9;
        for (const p of palette) {
          const dr = r - p.rgb[0], dg = g - p.rgb[1], db = b - p.rgb[2];
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bd) { bd = dist; best = p.hex; }
        }
        if (bd > 130 * 130) continue;
        hist.set(best, hist.get(best) + 1); colored++;
      }
      return { hist, colored };
    };
    const hs = classify(dSvg), hg = classify(dGl);
    if (!hs.colored || !hg.colored) return { err: `no colored pixels (svg ${hs.colored} gl ${hg.colored})` };
    const frac = (h) => new Map([...h.hist].map(([k, v]) => [k, v / h.colored]));
    const fs = frac(hs), fg = frac(hg);
    let maxDiff = 0; const per = {};
    for (const p of palette) {
      const d = Math.abs((fs.get(p.hex) || 0) - (fg.get(p.hex) || 0));
      per[p.hex] = { svg: +(fs.get(p.hex) || 0).toFixed(3), gl: +(fg.get(p.hex) || 0).toFixed(3), diff: +d.toFixed(3) };
      if (d > maxDiff) maxDiff = d;
    }
    return { maxDiff: +maxDiff.toFixed(3), per, pass: maxDiff <= tol, svgColored: hs.colored, glColored: hg.colored };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await disableWebRTC(ctx);
  // 图像面板默认折叠;持久化偏好钉成展开(SimPage 读 localStorage['sim.panel.image'])。
  await ctx.addInitScript(() => { try { localStorage.setItem('sim.panel.image', '1'); } catch { /* private */ } });
  const page = await ctx.newPage();

  let pass = 0; const fails = [];
  for (const { name, qs } of CASES) {
    const url = `${ORIGIN}${LANG}/sim?${qs}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    try { await page.waitForSelector('.vc-preview svg', { timeout: 20000 }); } catch { /* report */ }
    await page.waitForTimeout(1500); // 让引擎导出效应静止(rAF 两拍 ≈0.25s + 余量)
    const r = await page.evaluate(measure, { S: 256, tol: TOL });
    if (r.err) { fails.push({ name, url, err: r.err }); console.log(`  ERR  ${name}  ${r.err}`); continue; }
    const flag = r.pass ? ' ok ' : 'FAIL';
    if (r.pass) pass++; else fails.push({ name, url, maxDiff: r.maxDiff });
    console.log(`  ${flag} ${name.padEnd(14)} maxDiff ${(r.maxDiff * 100).toFixed(1)}%  (svg ${r.svgColored} / gl ${r.glColored} px)`);
    for (const [hex, v] of Object.entries(r.per)) {
      if (v.diff >= 0.02) console.log(`         ${hex}  svg ${v.svg}  gl ${v.gl}  Δ${(v.diff * 100).toFixed(1)}%`);
    }
  }
  await browser.close();

  console.log(`\n${pass}/${CASES.length} within ${(TOL * 100).toFixed(0)}% (engine 3D vs engine SVG, same camera)`);
  if (fails.length) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log(`  ${f.name}  ${f.err || `maxDiff ${(f.maxDiff * 100).toFixed(1)}%`}\n    ${f.url}`);
    process.exit(1);
  }
})();
