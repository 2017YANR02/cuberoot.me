/**
 * color-lab.ts — 颜色提取实验台。
 *
 * 读 real-eval --calibgt --dumpblocks 导出的每标注格**原始像素块**
 * (.tmp/calib-blocks-*.json), 离线试 [每格聚合策略 × 色彩空间], 用逐视频留一
 * k-NN 测可分性 (无参上限, 同 knn-ceiling), 专测 R/O/Y 三色混淆。
 *
 * 问题: 55% 逐格墙的疑因是"反光洗白把 R/O/Y 饱和度打下去 → 一起塌向色盘心"。
 * 当前取色 = 逐通道中位 (blockMedianRGB), 反光像素与真色像素混在一起。本台
 * 对比"剔除反光像素"的取色法能否把 R/O/Y 分开, 定位墙是取色噪声还是本质重叠。
 *
 * 用法: npx tsx scripts/color-lab.ts [k]   (默认 k=7)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rgbToHsvCv } from "../src/bface-color.ts";
import { fitColorCalib, calibClassify, type ColorSample } from "../src/color-calib.ts";
import type { ColorName } from "../src/reconstruct.ts";

const K = parseInt(process.argv[2] ?? "7", 10);
const dir = join(import.meta.dirname, "..", ".tmp");
const files = readdirSync(dir)
  .filter((f) => f.startsWith("calib-blocks-") && f.endsWith(".json"))
  .sort();

interface Block {
  label: string;
  px: number[];
}
interface Pix {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  v: number;
}

const COLORS = ["W", "R", "G", "Y", "O", "B"] as const;

function pixOf(px: number[]): Pix[] {
  const out: Pix[] = [];
  for (let i = 0; i + 2 < px.length; i += 3) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const [h, s, v] = rgbToHsvCv(r, g, b);
    out.push({ r, g, b, h, s, v });
  }
  return out;
}
function med(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}
function meanRGB(ps: Pix[]): [number, number, number] {
  let r = 0, g = 0, b = 0;
  for (const p of ps) { r += p.r; g += p.g; b += p.b; }
  const n = ps.length || 1;
  return [r / n, g / n, b / n];
}

// ===== 聚合策略: 像素块 → 代表 RGB =====
type Strat = (ps: Pix[]) => [number, number, number];
const STRATS: Record<string, Strat> = {
  // 基线: 逐通道中位 (blockMedianRGB 同款) — 当前生产取色
  median: (ps) => [med(ps.map((p) => p.r)), med(ps.map((p) => p.g)), med(ps.map((p) => p.b))],
  meanAll: (ps) => meanRGB(ps),
  // 只用最饱和的一部分像素 (反光/去饱和像素被排除): 真色在无眩光处透出
  topSat40: (ps) => {
    const s = [...ps].sort((a, b) => b.s - a.s);
    return meanRGB(s.slice(0, Math.max(1, Math.round(s.length * 0.4))));
  },
  topSat25: (ps) => {
    const s = [...ps].sort((a, b) => b.s - a.s);
    return meanRGB(s.slice(0, Math.max(1, Math.round(s.length * 0.25))));
  },
  // 饱和度地板 (自适应回退): s≥70 的像素; 太少则退回上半饱和
  satFloor: (ps) => {
    let f = ps.filter((p) => p.s >= 70);
    if (f.length < Math.max(3, ps.length * 0.15)) {
      const s = [...ps].sort((a, b) => b.s - a.s);
      f = s.slice(0, Math.max(1, Math.round(s.length * 0.5)));
    }
    return meanRGB(f);
  },
  // 剔除镜面眩光 (又亮又低饱和) + 去掉最暗淡的 25% 饱和 → 剩余取均值
  rejectGlare: (ps) => {
    let f = ps.filter((p) => !(p.v > 235 && p.s < 70));
    const bySat = [...f].sort((a, b) => a.s - b.s);
    f = bySat.slice(Math.round(bySat.length * 0.25));
    if (!f.length) f = ps;
    return meanRGB(f);
  },
};

// ===== 色彩空间: 代表 RGB → 特征向量 =====
function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number): number => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  let X = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  let Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let Z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;
  X /= 0.95047; Y /= 1.0; Z /= 1.08883;
  const fq = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = fq(X), fy = fq(Y), fz = fq(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
type Space = (rgb: [number, number, number]) => number[];
const SPACES: Record<string, Space> = {
  // 当前生产特征: 色度盘 (s·cosθ, s·sinθ) + 亮度 v
  hsvDisc: ([r, g, b]) => {
    const [h, s, v] = rgbToHsvCv(r, g, b);
    const rad = (h * Math.PI) / 90;
    return [s * Math.cos(rad), s * Math.sin(rad), v];
  },
  lab: ([r, g, b]) => rgb2lab(r, g, b),
  // Lab 只取色度 a*b* (丢亮度 L — 光照/反光主要动 L, 色度方向更稳)
  labAB: ([r, g, b]) => {
    const [, A, B] = rgb2lab(r, g, b);
    return [A, B];
  },
  // 归一化 RGB 色品 (去强度) + 亮度: R/O 差在 g 分量占比
  normRGB: ([r, g, b]) => {
    const s = r + g + b + 1e-6;
    return [(255 * r) / s, (255 * g) / s, (r + g + b) / 3];
  },
  // 对立通道: R-G (R/O 主判别) + 黄-蓝 + 亮度
  opponent: ([r, g, b]) => [r - g, (r + g) / 2 - b, (r + g + b) / 3],
  // YCbCr 色度 (Cb 蓝差, Cr 红差) + 亮度
  ycbcr: ([r, g, b]) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    return [cb, cr, y];
  },
};

// ===== 逐视频 LOO k-NN =====
interface KnnResult {
  ok: number;
  n: number;
  conf: Map<string, Map<string, number>>;
}
function looKnn(feats: number[][], labels: string[], k: number): KnnResult {
  const n = feats.length;
  const dims = feats[0].length;
  const scale = Array.from({ length: dims }, (_, d) => {
    const xs = feats.map((f) => f[d]).sort((a, b) => a - b);
    const m = xs[xs.length >> 1];
    const dev = xs.map((x) => Math.abs(x - m)).sort((a, b) => a - b);
    return Math.max(1, 1.4826 * dev[dev.length >> 1]);
  });
  const X = feats.map((f) => f.map((x, d) => x / scale[d]));
  const conf = new Map<string, Map<string, number>>();
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const dist: { d: number; l: string }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      let d = 0;
      for (let z = 0; z < dims; z++) {
        const dd = X[i][z] - X[j][z];
        d += dd * dd;
      }
      dist.push({ d, l: labels[j] });
    }
    dist.sort((a, b) => a.d - b.d);
    const tally = new Map<string, number>();
    for (let z = 0; z < Math.min(k, dist.length); z++) {
      tally.set(dist[z].l, (tally.get(dist[z].l) ?? 0) + 1);
    }
    const pred = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (pred === labels[i]) ok++;
    const row = conf.get(labels[i]) ?? new Map<string, number>();
    row.set(pred, (row.get(pred) ?? 0) + 1);
    conf.set(labels[i], row);
  }
  return { ok, n, conf };
}

// ===== 载入所有视频块 =====
const perVideo: { tag: string; blocks: Block[] }[] = [];
for (const f of files) {
  const blocks = JSON.parse(readFileSync(join(dir, f), "utf8")) as Block[];
  perVideo.push({ tag: f.replace("calib-blocks-", "").replace(".json", ""), blocks });
}
if (!perVideo.length) {
  console.error("无 calib-blocks-*.json — 先跑 real-eval --calibgt --dumpblocks");
  process.exit(1);
}
console.log(
  `载入 ${perVideo.length} 视频, 共 ${perVideo.reduce((s, v) => s + v.blocks.length, 0)} 标注格; k=${K}\n`,
);

// 预算像素解码 (每块 pixOf 一次, 各策略复用)
const decoded = perVideo.map((v) => ({
  tag: v.tag,
  labels: v.blocks.map((b) => b.label),
  pix: v.blocks.map((b) => pixOf(b.px)),
}));

function mergeConf(
  into: Map<string, Map<string, number>>,
  from: Map<string, Map<string, number>>,
): void {
  for (const [t, row] of from) {
    const r = into.get(t) ?? new Map<string, number>();
    for (const [p, c] of row) r.set(p, (r.get(p) ?? 0) + c);
    into.set(t, r);
  }
}
function macroAvg(conf: Map<string, Map<string, number>>): number {
  // 平衡准确率: 各类自准确率的均值 (不被大类主导 — 类极不平衡, micro 会骗人)
  const accs: number[] = [];
  for (const t of COLORS) {
    const row = conf.get(t);
    if (!row) continue;
    const tot = [...row.values()].reduce((s, c) => s + c, 0);
    accs.push(tot ? (row.get(t) ?? 0) / tot : 0);
  }
  return accs.length ? accs.reduce((s, a) => s + a, 0) / accs.length : 0;
}
function royAcc(conf: Map<string, Map<string, number>>): { acc: number; n: number } {
  // R/O/Y 三色: 真标签 ∈{R,O,Y} 中被正确判回自己的比例
  let ok = 0, n = 0;
  for (const t of ["R", "O", "Y"]) {
    const row = conf.get(t);
    if (!row) continue;
    for (const [p, c] of row) {
      n += c;
      if (p === t) ok += c;
    }
  }
  return { acc: n ? ok / n : 0, n };
}

// ===== 主网格: 策略 × 空间 =====
interface Cell {
  strat: string;
  space: string;
  ok: number;
  n: number;
  conf: Map<string, Map<string, number>>;
}
const grid: Cell[] = [];
for (const stratName of Object.keys(STRATS)) {
  const strat = STRATS[stratName];
  // 每策略先算各块代表 RGB (跨空间复用)
  const rgbPerVideo = decoded.map((v) => v.pix.map((ps) => strat(ps)));
  for (const spaceName of Object.keys(SPACES)) {
    const space = SPACES[spaceName];
    let ok = 0, n = 0;
    const conf = new Map<string, Map<string, number>>();
    for (let vi = 0; vi < decoded.length; vi++) {
      const feats = rgbPerVideo[vi].map((rgb) => space(rgb));
      const res = looKnn(feats, decoded[vi].labels, K);
      ok += res.ok;
      n += res.n;
      mergeConf(conf, res.conf);
    }
    grid.push({ strat: stratName, space: spaceName, ok, n, conf });
  }
}

// macro (平衡) 排序: 小类可分性才是墙, micro 被大类粉饰
grid.sort((a, b) => macroAvg(b.conf) - macroAvg(a.conf));
console.log("策略 × 空间           总LOO   macro平衡   R/O/Y三色");
console.log("─".repeat(52));
for (const c of grid) {
  const roy = royAcc(c.conf);
  const tag = `${c.strat}/${c.space}`.padEnd(20);
  const overall = `${((c.ok / c.n) * 100).toFixed(1)}%`.padStart(6);
  const macro = `${(macroAvg(c.conf) * 100).toFixed(1)}%`.padStart(8);
  const royStr = `${(roy.acc * 100).toFixed(1)}% (${roy.n})`.padStart(12);
  console.log(`${tag}${overall}  ${macro}  ${royStr}`);
}

// ===== 冠军 + 基线的混淆矩阵 =====
function printConf(title: string, conf: Map<string, Map<string, number>>): void {
  console.log(`\n${title} 混淆 (行=真, 列=判):`);
  console.log("     " + COLORS.map((c) => c.padStart(5)).join(""));
  for (const t of COLORS) {
    const row = conf.get(t);
    const tot = row ? [...row.values()].reduce((s, c) => s + c, 0) : 0;
    const cells = COLORS.map((p) => {
      const c = row?.get(p) ?? 0;
      return (c ? c.toString() : "·").padStart(5);
    }).join("");
    const selfPct = tot ? (((row?.get(t) ?? 0) / tot) * 100).toFixed(0) : "0";
    console.log(`  ${t}  ${cells}   ${selfPct}%×${tot}`);
  }
}
const best = grid[0];
const base = grid.find((c) => c.strat === "median" && c.space === "hsvDisc")!;
printConf(`基线 median/hsvDisc (${((base.ok / base.n) * 100).toFixed(1)}%)`, base.conf);
printConf(`冠军 ${best.strat}/${best.space} (${((best.ok / best.n) * 100).toFixed(1)}%)`, best.conf);

// ===== 相对色 (同/异色) 可分性: 为 partition-based 观测模型探路 =====
// 即使绝对标签混 (R/O/W), 原始色度距离能否判"两格同色否"? 高 AUC = 相对通道
// 可绕开标签墙 (⑫追加1 标记的未动用破局点)。暖色子集 = R/O/W 混淆簇的酸测。
function auc(neg: number[], pos: number[]): number {
  // Mann-Whitney: P(pos>neg); pos=异色距离 (应更大), neg=同色距离
  if (!neg.length || !pos.length) return NaN;
  const all = [...neg.map((d) => ({ d, p: 0 })), ...pos.map((d) => ({ d, p: 1 }))].sort((a, b) => a.d - b.d);
  let sumPosRank = 0;
  for (let i = 0; i < all.length; i++) if (all[i].p === 1) sumPosRank += i + 1;
  const u = sumPosRank - (pos.length * (pos.length + 1)) / 2;
  return u / (pos.length * neg.length);
}
const WARM = new Set(["R", "O", "W"]);
console.log("\n相对色 (同/异): 原始色度距离能否判「两格同色否」— 为 partition 观测模型探路");
console.log("视频          全体AUC   暖色{R,O,W}子集AUC");
const pool = { same: [] as number[], diff: [] as number[], wSame: [] as number[], wDiff: [] as number[] };
for (let vi = 0; vi < decoded.length; vi++) {
  const feats = decoded[vi].pix.map((ps) => rgb2lab(...STRATS.meanAll(ps)));
  const labs = decoded[vi].labels;
  const n = feats.length;
  const scale = [0, 1, 2].map((d) => {
    const xs = feats.map((f) => f[d]).sort((a, b) => a - b);
    const m = xs[xs.length >> 1];
    const dev = xs.map((x) => Math.abs(x - m)).sort((a, b) => a - b);
    return Math.max(1, 1.4826 * dev[dev.length >> 1]);
  });
  const same: number[] = [], diff: number[] = [], wSame: number[] = [], wDiff: number[] = [];
  const stride = Math.max(1, Math.floor((n * n) / 2 / 60000)); // cap ~60k 对/视频
  let cnt = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (cnt++ % stride !== 0) continue;
      let d = 0;
      for (let z = 0; z < 3; z++) {
        const dd = (feats[i][z] - feats[j][z]) / scale[z];
        d += dd * dd;
      }
      d = Math.sqrt(d);
      const s = labs[i] === labs[j];
      (s ? same : diff).push(d);
      if (WARM.has(labs[i]) && WARM.has(labs[j])) (s ? wSame : wDiff).push(d);
    }
  pool.same.push(...same); pool.diff.push(...diff); pool.wSame.push(...wSame); pool.wDiff.push(...wDiff);
  const a1 = auc(same, diff), a2 = auc(wSame, wDiff);
  console.log(`${decoded[vi].tag.padEnd(14)}${(a1 * 100).toFixed(1)}%       ${isNaN(a2) ? "—" : (a2 * 100).toFixed(1) + "%"}`);
}
console.log(
  `合计          ${(auc(pool.same, pool.diff) * 100).toFixed(1)}%       ${(auc(pool.wSame, pool.wDiff) * 100).toFixed(1)}%`,
);

// ===== 当前生产分类器 (逐类对角高斯 calibClassify) vs kNN: 量化管线欠债 =====
// 负⑤ 判死"静态分类器无解"是在"锚定需 75%"前提下; 倒推解码器无此前提, 把管线
// 从高斯(弱)换 kNN(强) 是纯增益。这里在同一批格上钉死两者差距。
console.log("\n当前生产分类器 (逐类对角高斯) 样本内 vs kNN-LOO — 同批格, 量化管线欠债");
let gOk = 0, gTot = 0, gRej = 0;
for (const v of decoded) {
  const samples: ColorSample[] = v.pix.map((ps, i) => {
    const [r, g, b] = STRATS.meanAll(ps);
    return { r, g, b, label: v.labels[i] as ColorName };
  });
  const calib = fitColorCalib(samples);
  if (!calib) continue;
  let ok = 0, tot = 0, rej = 0;
  for (const s of samples) {
    tot++;
    const p = calibClassify(s.r, s.g, s.b, calib);
    if (p === null) rej++;
    else if (p === s.label) ok++;
  }
  gOk += ok; gTot += tot; gRej += rej;
  console.log(`  ${v.tag.padEnd(14)} 高斯样本内 ${((ok / tot) * 100).toFixed(1)}% (拒判 ${((rej / tot) * 100).toFixed(0)}%)`);
}
const knnRef = grid.find((c) => c.strat === "meanAll" && c.space === "hsvDisc")!;
console.log(
  `  合计 高斯样本内 ${((gOk / gTot) * 100).toFixed(1)}% (拒判 ${((gRej / gTot) * 100).toFixed(0)}%)  vs  同表征 kNN-LOO ${((knnRef.ok / knnRef.n) * 100).toFixed(1)}%  →  欠债 ${(((knnRef.ok / knnRef.n) - (gOk / gTot)) * 100).toFixed(1)} 点`,
);
