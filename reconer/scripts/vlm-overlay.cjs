// 在 4K 裁片上叠画晶格窗口 (品红双线 + 0 号格圆点), 供 VLM 盲读定位
// 零依赖: ffmpeg png→rawvideo rgb24→JS 画线→rawvideo→png
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const W = 1000, H = 1000;

const dump = JSON.parse(fs.readFileSync(".tmp/obs-geo.json", "utf8"));
const v = dump.videos.find((x) => x.name.startsWith("1"));

function setPx(buf, x, y, r, g, b) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
}
function line(buf, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) setPx(buf, x + dx, y + dy, 255, 0, 255);
  }
}
function dot(buf, x, y, rad) {
  for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++)
    if (dx * dx + dy * dy <= rad * rad) setPx(buf, x + dx, y + dy, 255, 0, 255);
}

for (let b = 0; b < v.bounds.length; b++) {
  for (let i = 0; i < v.bounds[b].length; i++) {
    const c = v.bounds[b][i];
    const f = Math.floor((c.f0 + c.f1) / 2);
    const src = `.tmp/png/vlm-v1/c-${b}-${i}-f${f}.png`;
    if (!fs.existsSync(src)) continue;
    let x0 = 4 * c.cx - 500, y0 = 4 * c.cy - 500;
    x0 = Math.max(0, Math.min(2840, x0)); y0 = Math.max(0, Math.min(1160, y0));
    const dec = spawnSync("ffmpeg", ["-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 8e6 });
    const buf = dec.stdout;
    if (!buf || buf.length !== W * H * 3) { console.log(`skip ${src} (${buf?.length})`); continue; }
    const cx = 4 * c.cx - x0, cy = 4 * c.cy - y0;
    const [v1x, v1y, v2x, v2y] = c.basis.map((z) => z * 4);
    // 网格线: i,j ∈ {-1.5,-0.5,0.5,1.5}
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      line(buf, cx + k * v1x - 1.5 * v2x, cy + k * v1y - 1.5 * v2y, cx + k * v1x + 1.5 * v2x, cy + k * v1y + 1.5 * v2y);
      line(buf, cx - 1.5 * v1x + k * v2x, cy - 1.5 * v1y + k * v2y, cx + 1.5 * v1x + k * v2x, cy + 1.5 * v1y + k * v2y);
    }
    // 0 号格 (read 序首格 = 格 (-1,-1)) 圆点 + 1 号格小点 (行方向)
    dot(buf, cx - v1x - v2x, cy - v1y - v2y, 9);
    dot(buf, cx - v2x, cy - v2y, 5);
    const out = `.tmp/png/vlm-v1-grid/g-${b}-${i}-f${f}.png`;
    fs.mkdirSync(".tmp/png/vlm-v1-grid", { recursive: true });
    const enc = spawnSync("ffmpeg", ["-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-i", "-", "-y", out], { input: buf, maxBuffer: 8e6 });
    if (enc.status !== 0) console.log(`enc fail ${out}: ${enc.stderr}`);
  }
}
console.log("done", fs.readdirSync(".tmp/png/vlm-v1-grid").length);
