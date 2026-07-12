/**
 * snap4k.ts — 4K 网格贴合 + 证据重读 (dump 后处理)。
 *
 * 正⑱系列确认 v1/v3 残差主因是晶格脱靶 (半格至一格半, 飘上外套/背景), 而 4K 原片
 * 连拧转中帧都保留锐利块边界 (100fps 快门; 无贴纸魔方无黑缝, 边界 = 颜色跳变,
 * 黑缝探针 960p/4K AUC 均 ≈0.5 的死因是特征前提不成立, 非分辨率/模糊墙)。
 * 对 dump 每条链: 在链中帧 4K 原片上以链晶格为先验搜平移修正 (±1.5 格), 目标 =
 * 8 条格线「跨线跳变中位数」均值 (中位数杀蹭剪影投机: 真格线整条大部分点有跳变)
 * + 九格 kNN 非毒率 (4K 域普查池, LOO, 专治外套绿破整格周期错位) − 轻离先验惩罚。
 * 修正后按新格心重采九格中位 RGB, kNN 分类颜色 (普查字母池, LOO), 覆写链 read
 * (原值存 read0, 修正量存 snap)。锚点/finals/confusion gt 全不动 (cellveto 双轨教训)。
 * 普查相关性验证 (snap-probe): 毒0格帧 |Δ|p50≈0.22, 毒≥3格帧 |Δ|p50≈1.1, 单调。
 *
 * 用法: npx tsx scripts/snap4k.ts [--dump .tmp/obs-geo.json] [--out .tmp/obs-snap.json] [--video 1] [--keep]
 *
 * --sidecar <path>: 只输出链级修正量 {name: [{f0,f1,cx,cy,dx,dy}]}, 不改 read。
 * 供 real-eval --snapfix 在 HD 重采时按修正位重读 — dump 直改 read 会让 gt/混淆
 * 失配 (gt 是按旧读数 bestAssign 拟合的对齐, 窗口挪过格后 facelet 映射已变,
 * 实测新读 vs 旧 gt 假性 27-41%), 必须回 real-eval 重拟合。
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const DUMP = argAt("--dump") ?? ".tmp/obs-geo.json";
const OUT = argAt("--out") ?? ".tmp/obs-snap.json";
const ONLY = argAt("--video");
const KEEP = process.argv.includes("--keep");
const SIDE = argAt("--sidecar");
const W = 3840, H = 2160, SC = 4, FB = W * H * 3;
const ROOT = join(import.meta.dirname, "..");

type Chain = {
  read: (string | null)[]; read0?: (string | null)[]; snap?: [number, number] | null;
  basis: [number, number, number, number]; cx: number; cy: number; pitch: number;
  f0: number; f1: number;
};
const dump = JSON.parse(readFileSync(join(ROOT, DUMP), "utf8")) as {
  videos: { name: string; bounds: Chain[][] }[];
};

// ── 普查解析 (颜色字母 + 毒标) ──────────────────────────────────────────────
const censusSrc = readFileSync(join(import.meta.dirname, "vlm-patch-dump.cjs"), "utf8");
const censusOf = (vid: string): { bound: number; ci: number; cells: string }[] => {
  const block = censusSrc.split(`"${vid}": \``)[1]?.split("`")[0];
  if (!block) return [];
  const out: { bound: number; ci: number; cells: string }[] = [];
  for (const line of block.trim().split("\n")) {
    const m = line.match(/^g-(\d+)-(\d+)-f\d+\.png [A-E] (\S{9})/);
    if (m) out.push({ bound: +m[1], ci: +m[2], cells: m[3] });
  }
  return out;
};

// ── 4K 帧提取 (链中帧, 一遍解码; 收尾删除) ──────────────────────────────────
const extracted: string[] = [];
function extractFrames(name: string, frames: number[]): (f: number) => Uint8Array {
  const bin = join(ROOT, ".tmp", `snap4k-${name[0]}.bin`);
  if (!existsSync(bin) || statSync(bin).size !== frames.length * FB) {
    const sel = frames.map((f) => `eq(n\\,${f})`).join("+");
    const r = spawnSync("ffmpeg", [
      "-hide_banner", "-v", "error", "-threads", "14",
      "-i", join(ROOT, "videos", name),
      "-vf", `select=${sel},scale=${W}:${H}`,
      "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", bin, "-y",
    ], { stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0 || statSync(bin).size !== frames.length * FB)
      throw new Error(`ffmpeg 抽帧失败: ${name} (期望 ${frames.length} 帧)`);
  }
  extracted.push(bin);
  const buf = readFileSync(bin);
  const idx = new Map(frames.map((f, i) => [f, i]));
  return (f) => buf.subarray(idx.get(f)! * FB, (idx.get(f)! + 1) * FB);
}

const midOf = (c: Chain) => (c.f0 + c.f1) >> 1;
const framesOf = (v: { bounds: Chain[][] }) =>
  [...new Set(v.bounds.flatMap((b) => (b ?? []).map(midOf)))].sort((a, b) => a - b);

// ── 像素采样 ────────────────────────────────────────────────────────────────
const rgbAt = (fr: Uint8Array, x: number, y: number, out: number[]) => {
  let r = 0, g = 0, b = 0, n = 0;
  const xi = Math.round(x), yi = Math.round(y);
  for (let yy = yi - 1; yy <= yi + 1; yy++) {
    for (let xx = xi - 1; xx <= xi + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = (yy * W + xx) * 3;
      r += fr[p]; g += fr[p + 1]; b += fr[p + 2]; n++;
    }
  }
  out[0] = n ? r / n : -1; out[1] = n ? g / n : -1; out[2] = n ? b / n : -1;
};
const med3: number[][] = [[], [], []];
const blockMedRGB = (fr: Uint8Array, x: number, y: number, rad: number, out: number[]) => {
  med3[0].length = med3[1].length = med3[2].length = 0;
  for (let yy = Math.round(y - rad); yy <= y + rad; yy += 4) {
    for (let xx = Math.round(x - rad); xx <= x + rad; xx += 4) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = (yy * W + xx) * 3;
      med3[0].push(fr[p]); med3[1].push(fr[p + 1]); med3[2].push(fr[p + 2]);
    }
  }
  if (med3[0].length < 8) { out[0] = -1; return; }
  for (let c = 0; c < 3; c++) {
    med3[c].sort((a, b) => a - b);
    out[c] = med3[c][med3[c].length >> 1];
  }
};
const qa = [0, 0, 0], qb = [0, 0, 0];
const diffAt = (fr: Uint8Array, x1: number, y1: number, x2: number, y2: number) => {
  rgbAt(fr, x1, y1, qa); rgbAt(fr, x2, y2, qb);
  if (qa[0] < 0 || qb[0] < 0) return 0;
  return Math.min(150, Math.abs(qa[0] - qb[0]) + Math.abs(qa[1] - qb[1]) + Math.abs(qa[2] - qb[2]));
};

// ── kNN 池 (4K 域: 普查格按原格心在 4K 帧重采 RGB) ─────────────────────────
const feat = (r: number, g: number, b: number): number[] => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const s = mx ? ((mx - mn) / mx) * 255 : 0;
  let h = 0;
  if (mx > mn) {
    if (mx === r) h = (60 * (g - b)) / (mx - mn);
    else if (mx === g) h = 120 + (60 * (b - r)) / (mx - mn);
    else h = 240 + (60 * (r - g)) / (mx - mn);
    if (h < 0) h += 360;
  }
  return [h / 2, s, mx, r, g, b];
};
type PoolRow = { v: string; bad: number; color: string | null; f: number[] };
const pool: PoolRow[] = [];
for (const vid of ["1", "3"]) {
  const census = censusOf(vid);
  if (!census.length) continue;
  const v = dump.videos.find((x) => x.name.startsWith(vid));
  if (!v) continue; // --video 过滤后的单视频 dump: 池视频可能缺席
  const frameAt = extractFrames(v.name, framesOf(v));
  for (const { bound, ci, cells } of census) {
    const ch = v.bounds[bound]?.[ci];
    if (!ch) continue;
    const fr = frameAt(midOf(ch));
    const [v1x, v1y, v2x, v2y] = ch.basis.map((z) => z * SC);
    for (let c = 0; c < 9; c++) {
      const lab = cells[c];
      const bad = lab === "J" || lab === "S" || lab === "." ? 1 : "WRGYOB".includes(lab) ? 0 : -1;
      if (bad < 0) continue;
      const a = (c % 3) - 1, b = ((c / 3) | 0) - 1;
      blockMedRGB(fr, ch.cx * SC + a * v1x + b * v2x, ch.cy * SC + a * v1y + b * v2y, ch.pitch * SC * 0.2, qa);
      if (qa[0] < 0) continue;
      pool.push({ v: vid, bad, color: bad ? null : lab, f: feat(qa[0], qa[1], qa[2]) });
    }
  }
}
if (!pool.length) throw new Error("普查池为空 (dump 需含 v1/v3)");
const D = 6;
const mu = new Array<number>(D).fill(0), sd = new Array<number>(D).fill(0);
for (const s of pool) for (let d = 0; d < D; d++) mu[d] += s.f[d] / pool.length;
for (const s of pool) for (let d = 0; d < D; d++) sd[d] += (s.f[d] - mu[d]) ** 2 / pool.length;
for (let d = 0; d < D; d++) sd[d] = Math.sqrt(sd[d]) || 1;
for (const p of pool) p.f = p.f.map((x, d) => (x - mu[d]) / sd[d]);
console.log(`4K 普查池: ${pool.length} 格 (毒 ${pool.filter((p) => p.bad).length}, 颜色 ${pool.filter((p) => p.color).length})`);

// k=5 近邻; 返回 {poison 票率, 颜色多数}
function knn(vid: string, r: number, g: number, b: number): { poison: number; color: string | null } {
  const zf = feat(r, g, b).map((x, d) => (x - mu[d]) / sd[d]);
  const best: { d: number; row: PoolRow }[] = [];
  for (const p of pool) {
    if (p.v === vid) continue;
    let dd = 0;
    for (let d = 0; d < D; d++) { const t = p.f[d] - zf[d]; dd += t * t; }
    if (best.length < 5) { best.push({ d: dd, row: p }); best.sort((x, y) => x.d - y.d); }
    else if (dd < best[4].d) { best[4] = { d: dd, row: p }; best.sort((x, y) => x.d - y.d); }
  }
  const poison = best.reduce((a, x) => a + x.row.bad, 0) / best.length;
  const tally = new Map<string, number>();
  for (const x of best) if (x.row.color) tally.set(x.row.color, (tally.get(x.row.color) ?? 0) + 1);
  const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
  return { poison, color: top && top[1] >= 3 ? top[0] : null };
}

// ── 贴合评分 (格线中位跳变 + 内容项; 内容按格心位置量化记忆) ────────────────
const lineDiffs: number[] = [];
function snapChain(fr: Uint8Array, ch: Chain, vid: string): { dx: number; dy: number; s0: number; s1: number } {
  const [v1x, v1y, v2x, v2y] = ch.basis.map((z) => z * SC);
  const cx0 = ch.cx * SC, cy0 = ch.cy * SC;
  const pitch = ch.pitch * SC;
  const contMemo = new Map<number, number>();
  const contentCell = (u: number, v: number): number => {
    const key = Math.round(u * 33.33) * 4096 + Math.round(v * 33.33);
    let c = contMemo.get(key);
    if (c === undefined) {
      blockMedRGB(fr, cx0 + u * v1x + v * v2x, cy0 + u * v1y + v * v2y, pitch * 0.2, qa);
      c = qa[0] < 0 || Math.max(qa[0], qa[1], qa[2]) < 60 ? 0 : 1 - knn(vid, qa[0], qa[1], qa[2]).poison;
      contMemo.set(key, c);
    }
    return c;
  };
  const ev = (dx: number, dy: number): number => {
    const cx = cx0 + dx * v1x + dy * v2x, cy = cy0 + dx * v1y + dy * v2y;
    let E = 0;
    for (const dir of [0, 1]) {
      for (const k of [-1.5, -0.5, 0.5, 1.5]) {
        lineDiffs.length = 0;
        for (let t = -1.45; t <= 1.451; t += 0.1) {
          lineDiffs.push(dir === 0
            ? diffAt(fr,
                cx + (k - 0.12) * v1x + t * v2x, cy + (k - 0.12) * v1y + t * v2y,
                cx + (k + 0.12) * v1x + t * v2x, cy + (k + 0.12) * v1y + t * v2y)
            : diffAt(fr,
                cx + t * v1x + (k - 0.12) * v2x, cy + t * v1y + (k - 0.12) * v2y,
                cx + t * v1x + (k + 0.12) * v2x, cy + t * v1y + (k + 0.12) * v2y));
        }
        lineDiffs.sort((a, b) => a - b);
        E += lineDiffs[lineDiffs.length >> 1];
      }
    }
    let C = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) C += contentCell(a + dx, b + dy);
    return E / 8 / 150 + 0.5 * (C / 9) - 0.04 * (dx * dx + dy * dy);
  };
  const s0 = ev(0, 0);
  let best = { dx: 0, dy: 0, s: s0 };
  for (let dx = -1.5; dx <= 1.51; dx += 0.15) {
    for (let dy = -1.5; dy <= 1.51; dy += 0.15) {
      const s = ev(dx, dy);
      if (s > best.s) best = { dx, dy, s };
    }
  }
  for (let dx = best.dx - 0.12; dx <= best.dx + 0.121; dx += 0.03) {
    for (let dy = best.dy - 0.12; dy <= best.dy + 0.121; dy += 0.03) {
      const s = ev(dx, dy);
      if (s > best.s) best = { dx, dy, s };
    }
  }
  return { dx: best.dx, dy: best.dy, s0, s1: best.s };
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
const sidecar: Record<string, { f0: number; f1: number; cx: number; cy: number; dx: number; dy: number }[]> = {};
for (const v of dump.videos) {
  if (ONLY && !v.name.startsWith(ONLY)) continue;
  const vid = v.name[0];
  const frameAt = extractFrames(v.name, framesOf(v));
  let snapped = 0, kept = 0, moved: number[] = [], changedCells = 0, totCells = 0;
  for (const b of v.bounds) {
    for (const ch of b ?? []) {
      const fr = frameAt(midOf(ch));
      const r = snapChain(fr, ch, vid);
      if (SIDE) {
        if (r.s1 >= 0.55) {
          (sidecar[v.name] ??= []).push({
            f0: ch.f0, f1: ch.f1, cx: ch.cx, cy: ch.cy,
            dx: Math.round(r.dx * 100) / 100, dy: Math.round(r.dy * 100) / 100,
          });
          moved.push(Math.hypot(r.dx, r.dy));
          snapped++;
        } else kept++;
        continue;
      }
      ch.read0 = ch.read;
      if (r.s1 < 0.55) { ch.snap = null; kept++; continue; } // 面不可见 (全遮挡): 保守保留原读
      const [v1x, v1y, v2x, v2y] = ch.basis.map((z) => z * SC);
      const cx = ch.cx * SC + r.dx * v1x + r.dy * v2x, cy = ch.cy * SC + r.dx * v1y + r.dy * v2y;
      const read: (string | null)[] = [];
      for (let c = 0; c < 9; c++) {
        const a = (c % 3) - 1, b2 = ((c / 3) | 0) - 1;
        blockMedRGB(fr, cx + a * v1x + b2 * v2x, cy + a * v1y + b2 * v2y, ch.pitch * SC * 0.2, qa);
        if (qa[0] < 0 || Math.max(qa[0], qa[1], qa[2]) < 50) { read.push(null); continue; }
        const k = knn(vid, qa[0], qa[1], qa[2]);
        read.push(k.poison >= 0.6 ? null : k.color);
      }
      totCells += 9;
      for (let c = 0; c < 9; c++) if (read[c] !== ch.read[c]) changedCells++;
      ch.read = read;
      ch.snap = [Math.round(r.dx * 100) / 100, Math.round(r.dy * 100) / 100];
      moved.push(Math.hypot(r.dx, r.dy));
      snapped++;
    }
  }
  moved.sort((a, b) => a - b);
  console.log(`${v.name}: 贴合 ${snapped} 链 (保留 ${kept}), |Δ|p50=${moved[moved.length >> 1]?.toFixed(2) ?? "-"}, 改格 ${changedCells}/${totCells}`);
}

if (SIDE) {
  writeFileSync(join(ROOT, SIDE), JSON.stringify(sidecar));
  console.log(`→ ${SIDE}`);
} else {
  writeFileSync(join(ROOT, OUT), JSON.stringify(dump));
  console.log(`→ ${OUT}`);
}
if (!KEEP) for (const b of new Set(extracted)) rmSync(b, { force: true });
