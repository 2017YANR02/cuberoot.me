// 裁 4K 链中帧 + 叠画晶格窗口 (品红双线 + 0/1 号格圆点), 供 VLM 盲读普查 (正⑱)
// 用法: node scripts/vlm-overlay.cjs [视频前缀=1] [dump=.tmp/obs-geo.json]
// 产物: .tmp/png/vlm-v{P}/c-{b}-{i}-f{F}.png (裸裁片) + .tmp/png/vlm-v{P}-grid/g-...(叠网格)
// 零依赖: ffmpeg png/视频→rawvideo rgb24→JS 画线→rawvideo→png
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const W = 1000, H = 1000;

const PREFIX = process.argv[2] ?? "1";
const DUMP = process.argv[3] ?? ".tmp/obs-geo.json";
const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const v = dump.videos.find((x) => x.name.startsWith(PREFIX));
if (!v) throw new Error(`视频 ${PREFIX} 不在转储里`);
const video = `videos/${v.name}`;
// 源分辨率/帧率 (探针): 缩放 = 源宽/960 (framedump 960×540)
const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,width", "-of", "csv=p=0", video], { encoding: "utf8" });
// csv 字段序跟随 ffprobe 字典序而非查询序: 带 "/" 的是帧率, 纯数字是宽
const fields = probe.stdout.trim().split(",");
const fpsExpr = fields.find((s) => s.includes("/")) ?? "100/1";
const wStr = fields.find((s) => !s.includes("/"));
const FPS = Number(fpsExpr.split("/")[0]) / Number(fpsExpr.split("/")[1]);
const SC = Number(wStr) / 960;
if (!Number.isFinite(FPS) || !Number.isFinite(SC)) throw new Error(`探针解析失败: ${probe.stdout}`);
const SRCW = Number(wStr), SRCH = Math.round((SRCW * 9) / 16);
console.log(`${v.name}: fps=${FPS} 缩放=${SC}`);

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

const cropDir = `.tmp/png/vlm-v${PREFIX}`, gridDir = `.tmp/png/vlm-v${PREFIX}-grid`;
fs.mkdirSync(cropDir, { recursive: true });
fs.mkdirSync(gridDir, { recursive: true });
let made = 0;
for (let b = 0; b < v.bounds.length; b++) {
  for (let i = 0; i < v.bounds[b].length; i++) {
    const c = v.bounds[b][i];
    const f = Math.floor((c.f0 + c.f1) / 2);
    let x0 = SC * c.cx - W / 2, y0 = SC * c.cy - H / 2;
    x0 = Math.max(0, Math.min(SRCW - W, Math.round(x0)));
    y0 = Math.max(0, Math.min(SRCH - H, Math.round(y0)));
    const crop = `${cropDir}/c-${b}-${i}-f${f}.png`;
    if (!fs.existsSync(crop)) {
      spawnSync("ffmpeg", ["-v", "error", "-ss", String(f / FPS), "-i", video, "-frames:v", "1", "-vf", `crop=${W}:${H}:${x0}:${y0}`, "-y", crop]);
    }
    const dec = spawnSync("ffmpeg", ["-v", "error", "-i", crop, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 8e6 });
    const buf = dec.stdout;
    if (!buf || buf.length !== W * H * 3) { console.log(`skip ${crop} (${buf?.length})`); continue; }
    const cx = SC * c.cx - x0, cy = SC * c.cy - y0;
    const [v1x, v1y, v2x, v2y] = c.basis.map((z) => z * SC);
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      line(buf, cx + k * v1x - 1.5 * v2x, cy + k * v1y - 1.5 * v2y, cx + k * v1x + 1.5 * v2x, cy + k * v1y + 1.5 * v2y);
      line(buf, cx - 1.5 * v1x + k * v2x, cy - 1.5 * v1y + k * v2y, cx + 1.5 * v1x + k * v2x, cy + 1.5 * v1y + k * v2y);
    }
    dot(buf, cx - v1x - v2x, cy - v1y - v2y, 9);
    dot(buf, cx - v2x, cy - v2y, 5);
    const out = `${gridDir}/g-${b}-${i}-f${f}.png`;
    const enc = spawnSync("ffmpeg", ["-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-i", "-", "-y", out], { input: buf, maxBuffer: 8e6 });
    if (enc.status !== 0) console.log(`enc fail ${out}: ${enc.stderr}`);
    else made++;
  }
}
console.log(`done ${made} 张 → ${gridDir}`);
