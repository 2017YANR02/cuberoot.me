/**
 * 几何朝向探针 (阶段 1, 2026-07-11): 回答一个决定性问题 —— 相邻静止链之间
 * "窗口面身份发生变化" (= 发生了整体旋转/换握) 这件事, 用纯几何量可检出吗?
 *
 * 输入: real-eval --dumpobs .tmp/obs-geo.json (新版带 f0/f1/ang/pitch/motion/rot)
 * GT 标签: 链的 GT 最优对齐面 (face) —— 注意这本身是 55% 噪声下的拟合, 故分两口径:
 *   全部对 / 高置信对 (两端链 read≥5 格且 read-vs-gt 匹配率 ≥0.7)
 * 几何特征 (全部与颜色无关): |Δ基角|(折叠 mod 90), |Δpitch|/pitch, Δ中心/pitch,
 *   间隙帧数, span 断裂 (跟踪 prior 被杀 = 剧烈运动/遮挡代理)
 * 输出: 逐特征 AUC (Mann-Whitney) + 组合分 AUC + 每窗口 GT 面序列目检
 *
 * 判死条件 (方案约定): 高置信口径组合 AUC 上不了 ~0.8 → 几何路降级只修 v1 放下翻面。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Chain {
  end: number;
  face: string;
  read: (string | null)[];
  gt: string[];
  span: number;
  cx: number;
  cy: number;
  f0: number;
  f1: number;
  ang: number;
  pitch: number;
  motion: number;
  rot: number;
  /** 中帧仿射基 [v1x,v1y,v2x,v2y] */
  basis?: number[];
  win?: number;
  /** 边界序号 (载入时标注) */
  t?: number;
}
interface Video {
  name: string;
  gtNoRot: string[];
  bounds: Chain[][];
}
const dump = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", ".tmp", "obs-geo.json"), "utf8"),
) as { videos: Video[] };

/** 基角差折叠到 [0,45] (基向量 90° 重标歧义) */
const foldAng = (d: number): number => {
  let a = Math.abs(d) % 90;
  if (a > 45) a = 90 - a;
  return a;
};
/** read vs gt 匹配率 (非空格) */
const matchFrac = (c: Chain): { n: number; frac: number } => {
  let n = 0, m = 0;
  for (let i = 0; i < 9; i++) {
    if (!c.read[i]) continue;
    n++;
    if (c.read[i] === c.gt[i]) m++;
  }
  return { n, frac: n ? m / n : 0 };
};
/** Mann-Whitney AUC: 正类 (face 变) 特征值高于负类的概率 */
const auc = (pos: number[], neg: number[]): number => {
  if (!pos.length || !neg.length) return NaN;
  let u = 0;
  for (const p of pos) for (const q of neg) u += p > q ? 1 : p === q ? 0.5 : 0;
  return u / (pos.length * neg.length);
};

interface Pair {
  video: string;
  win: number;
  gapFrames: number;
  dAng: number;
  dPitch: number;
  dCenter: number;
  spanBreak: number;
  faceChange: boolean;
  rotChange: boolean;
  /** 干净 GT: 两链之间的真解动作含转体/宽层 (x/y/z 或小写宽层字母) — 真实朝向变化事件 */
  rotEvent: boolean;
  confident: boolean;
  a: Chain;
  b: Chain;
}
const pairs: Pair[] = [];

/** 动作是否改变相机可见面朝向: 含 x/y/z 转体或宽层 (小写字母) */
const isOrientMove = (m: string): boolean => /[a-z]/.test(m.replace(/['2]/g, ""));

for (const v of dump.videos) {
  const all = v.bounds.flatMap((cs, t) => cs.map((c) => ((c.t = t), c)));
  const orientAt = v.gtNoRot.map(isOrientMove);
  if (all.some((c) => c.f0 === undefined)) throw new Error(`${v.name}: 转储缺 f0 — 重跑新版 real-eval --dumpobs`);
  // 空间 2-means 窗口聚类 (prior-sim --winalign 同款, init 用 cy 极值对)
  const byY = [...all].sort((a, b) => a.cy - b.cy);
  let c1 = [byY[0].cx, byY[0].cy], c2 = [byY[byY.length - 1].cx, byY[byY.length - 1].cy];
  for (let it = 0; it < 20; it++) {
    for (const c of all) {
      const d1 = (c.cx - c1[0]) ** 2 + (c.cy - c1[1]) ** 2;
      const d2 = (c.cx - c2[0]) ** 2 + (c.cy - c2[1]) ** 2;
      c.win = d1 <= d2 ? 0 : 1;
    }
    const s = [[0, 0, 0], [0, 0, 0]];
    for (const c of all) { s[c.win!][0] += c.cx; s[c.win!][1] += c.cy; s[c.win!][2]++; }
    if (s[0][2]) c1 = [s[0][0] / s[0][2], s[0][1] / s[0][2]];
    if (s[1][2]) c2 = [s[1][0] / s[1][2], s[1][1] / s[1][2]];
  }
  for (const win of [0, 1]) {
    const seq = all.filter((c) => c.win === win).sort((a, b) => a.f0 - b.f0);
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i], b = seq[i + 1];
      const ma = matchFrac(a), mb = matchFrac(b);
      // 间隙跨过的动作 (ta, tb]: 任一为转体/宽层 → 真实朝向事件
      let rotEvent = false;
      for (let m = a.t! + 1; m <= b.t!; m++) if (orientAt[m]) rotEvent = true;
      pairs.push({
        rotEvent,
        video: v.name[0],
        win,
        gapFrames: Math.max(0, b.f0 - a.f1),
        dAng: foldAng(b.ang - a.ang),
        dPitch: Math.abs(b.pitch - a.pitch) / ((a.pitch + b.pitch) / 2),
        dCenter: Math.hypot(b.cx - a.cx, b.cy - a.cy) / ((a.pitch + b.pitch) / 2),
        spanBreak: a.span !== b.span ? 1 : 0,
        faceChange: a.face !== b.face,
        rotChange: a.face === b.face && a.rot !== b.rot,
        confident: ma.n >= 5 && ma.frac >= 0.7 && mb.n >= 5 && mb.frac >= 0.7,
        a,
        b,
      });
    }
  }
  // 目检: 每窗口 GT 面序列 (高置信链标 *, 面变化处标 |)
  for (const win of [0, 1]) {
    const seq = all.filter((c) => c.win === win).sort((a, b) => a.f0 - b.f0);
    if (!seq.length) continue;
    const parts = seq.map((c, i) => {
      const m = matchFrac(c);
      const conf = m.n >= 5 && m.frac >= 0.7 ? "*" : "";
      const sep = i > 0 && seq[i - 1].face !== c.face ? "| " : "";
      return `${sep}${c.face}${c.rot}${conf}@${c.f0}`;
    });
    console.log(`v${v.name[0]} win${win} (${seq.length} 链): ${parts.join(" ")}`);
  }
}

const FEATURES: [string, (p: Pair) => number][] = [
  ["|Δ基角|", (p) => p.dAng],
  ["|Δpitch|rel", (p) => p.dPitch],
  ["Δ中心/pitch", (p) => p.dCenter],
  ["间隙帧数", (p) => p.gapFrames],
  ["span断裂", (p) => p.spanBreak],
];

const report = (label: string, ps: Pair[], posOf: (p: Pair) => boolean = (p) => p.faceChange) => {
  const pos = ps.filter(posOf);
  const neg = ps.filter((p) => !posOf(p));
  console.log(`\n== ${label}: ${ps.length} 对, 正类 ${pos.length} (${((pos.length / Math.max(1, ps.length)) * 100).toFixed(0)}%) ==`);
  const q = (xs: number[], f: number) => {
    if (!xs.length) return NaN;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(f * s.length))];
  };
  // 组合分: 各特征按负类 p50/p90 标准化后取和
  const zs = FEATURES.map(([, f]) => {
    const nvs = neg.map(f);
    const p50 = q(nvs, 0.5), p90 = q(nvs, 0.9);
    const sc = Math.max(1e-6, p90 - p50);
    return (p: Pair) => (f(p) - p50) / sc;
  });
  const combo = (p: Pair) => zs.reduce((s, z) => s + Math.min(3, z(p)), 0);
  for (const [name, f] of FEATURES) {
    const a = auc(pos.map(f), neg.map(f));
    console.log(
      `  ${name.padEnd(12)} AUC ${isNaN(a) ? "-" : a.toFixed(3)}  变[p50 ${q(pos.map(f), 0.5)?.toFixed(1)}] 不变[p50 ${q(neg.map(f), 0.5)?.toFixed(1)} p90 ${q(neg.map(f), 0.9)?.toFixed(1)}]`,
    );
  }
  const a = auc(pos.map(combo), neg.map(combo));
  console.log(`  组合分         AUC ${isNaN(a) ? "-" : a.toFixed(3)}`);
  // 最优阈值工作点 (Youden)
  if (pos.length && neg.length) {
    const cand = [...pos, ...neg].map(combo).sort((x, y) => x - y);
    let bt = 0, bj = -1;
    for (const t of cand) {
      const tpr = pos.filter((p) => combo(p) > t).length / pos.length;
      const fpr = neg.filter((p) => combo(p) > t).length / neg.length;
      if (tpr - fpr > bj) { bj = tpr - fpr; bt = t; }
    }
    const tpr = pos.filter((p) => combo(p) > bt).length / pos.length;
    const fpr = neg.filter((p) => combo(p) > bt).length / neg.length;
    console.log(`  最优工作点: 检出 ${(tpr * 100).toFixed(0)}% / 虚警 ${(fpr * 100).toFixed(0)}%`);
  }
};

// ================= 第二部分: 逐链姿态→面身份 (目检发现面随手腕连续变, 事件模型不成立) =================
// 几何特征 = 仿射基形态 (各向异性/剪切: 透视压缩即倾斜度) + 尺度 + 屏幕位置。
// 决定性问题: 高置信链上, 这些与颜色无关的特征能否 kNN-LOO 分出 GT 面? 基线 = 多数类占比。
if (dump.videos[0].bounds.flat().some((c) => c.basis)) {
  console.log("\n===== 逐链几何面身份 (kNN-LOO, k=3) =====");
  interface Row { f: number[]; face: string }
  const featNames = ["aspect", "shear", "pitch", "cx", "cy", "ang"];
  const featsOf = (c: Chain): number[] => {
    const [x1, y1, x2, y2] = c.basis!;
    const a1 = Math.hypot(x1, y1), a2 = Math.hypot(x2, y2);
    const dot = (x1 * x2 + y1 * y2) / (a1 * a2 || 1);
    return [a2 / (a1 || 1), (Math.asin(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI, c.pitch, c.cx, c.cy, c.ang];
  };
  const knnLoo = (rows: Row[], k = 3): number => {
    // 特征 z 标准化
    const d = rows[0].f.length;
    const mu = new Array(d).fill(0), sd = new Array(d).fill(0);
    for (const r of rows) for (let j = 0; j < d; j++) mu[j] += r.f[j] / rows.length;
    for (const r of rows) for (let j = 0; j < d; j++) sd[j] += (r.f[j] - mu[j]) ** 2 / rows.length;
    for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1;
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const ds = rows
        .map((r, j) => ({ j, d: j === i ? Infinity : r.f.reduce((s, x, m) => s + ((x - rows[i].f[m]) / sd[m]) ** 2, 0) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, k);
      const vote = new Map<string, number>();
      for (const { j } of ds) vote.set(rows[j].face, (vote.get(rows[j].face) ?? 0) + 1);
      const best = [...vote.entries()].sort((a, b) => b[1] - a[1])[0][0];
      if (best === rows[i].face) ok++;
    }
    return ok / rows.length;
  };
  const tiers: [string, (c: Chain) => boolean][] = [
    ["高置信 (read≥5,匹配≥0.7)", (c) => { const m = matchFrac(c); return m.n >= 5 && m.frac >= 0.7; }],
    ["全部链", () => true],
  ];
  for (const [tier, filt] of tiers) {
    const pooled: Row[] = [];
    const lines: string[] = [];
    for (const v of dump.videos) {
      const all = v.bounds.flat().filter(filt);
      const rows: Row[] = all.map((c) => ({ f: featsOf(c), face: c.face }));
      if (rows.length < 8) { lines.push(`  v${v.name[0]}: n=${rows.length} 太少`); continue; }
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.face, (counts.get(r.face) ?? 0) + 1);
      const maj = Math.max(...counts.values()) / rows.length;
      const acc = knnLoo(rows);
      lines.push(`  v${v.name[0]}: n=${rows.length} 面数 ${counts.size} kNN-LOO ${(acc * 100).toFixed(0)}% vs 多数类 ${(maj * 100).toFixed(0)}% (${[...counts.entries()].map(([f, n]) => f + n).join(" ")})`);
      // 跨视频池化: 特征逐视频 z 标准化后合并
      const d = rows[0].f.length;
      const mu = new Array(d).fill(0), sd = new Array(d).fill(0);
      for (const r of rows) for (let j = 0; j < d; j++) mu[j] += r.f[j] / rows.length;
      for (const r of rows) for (let j = 0; j < d; j++) sd[j] += (r.f[j] - mu[j]) ** 2 / rows.length;
      for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1;
      for (const r of rows) pooled.push({ f: r.f.map((x, j) => (x - mu[j]) / sd[j]), face: r.face });
    }
    console.log(`\n-- ${tier} (特征: ${featNames.join(",")}) --`);
    for (const l of lines) console.log(l);
    if (pooled.length >= 20) {
      const counts = new Map<string, number>();
      for (const r of pooled) counts.set(r.face, (counts.get(r.face) ?? 0) + 1);
      const maj = Math.max(...counts.values()) / pooled.length;
      console.log(`  池化: n=${pooled.length} kNN-LOO ${(knnLoo(pooled) * 100).toFixed(0)}% vs 多数类 ${(maj * 100).toFixed(0)}%`);
    }
  }
}

console.log();
for (const v of dump.videos) {
  const evts = v.gtNoRot.filter(isOrientMove);
  console.log(`v${v.name[0]}: ${v.gtNoRot.length} 步, 转体/宽层事件 ${evts.length} [${evts.join(" ")}]`);
}
report("面标签: 全部对 (标签=GT 拟合面变, 噪声大)", pairs);
report("面标签: 高置信对 (两端 read≥5 & 匹配≥0.7)", pairs.filter((p) => p.confident));
report("事件标签: 全部对 (标签=间隙跨转体/宽层动作, 干净 GT)", pairs, (p) => p.rotEvent);
report("事件标签: 单边界对 (间隙恰跨 1 步, 归属无歧义)", pairs.filter((p) => p.b.t! - p.a.t! <= 1), (p) => p.rotEvent);
for (const vn of ["1", "2", "3", "4", "5"]) {
  const ps = pairs.filter((p) => p.video === vn);
  if (ps.length >= 6) report(`v${vn} 事件标签`, ps, (p) => p.rotEvent);
}
