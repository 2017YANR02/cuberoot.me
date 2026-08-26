// 脱靶格自动分类器探针 (正⑱ 阶段1 信号#2): 格心块中位 RGB → 毒(衣/手/背景) vs 贴纸
// 训练标签 = VLM 普查 (vlm-patch-dump.cjs 内嵌); 特征 = 转储 rgbRead (960 块中位)
// 跨视频留一 (v1训→v3测 / v3训→v1测) — 判死线: 杀毒 ≥70% 且误杀 ≤10%
// 用法: node scripts/vlm-cell-classifier.cjs [dump=.tmp/obs-geo2.json]
const fs = require("node:fs");
const src = fs.readFileSync("scripts/vlm-patch-dump.cjs", "utf8");
const CENSUS = {};
for (const m of src.matchAll(/"(\d)": `\n([\s\S]*?)`/g)) CENSUS[m[1]] = m[2];

const DUMP = process.argv[2] ?? ".tmp/obs-geo2.json";
const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const CUBE = new Set(["W", "Y", "R", "O", "G", "B"]);

function feats([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = mx, s = mx ? ((mx - mn) / mx) * 255 : 0;
  let h = 0;
  if (mx > mn) {
    if (mx === r) h = (60 * (g - b)) / (mx - mn);
    else if (mx === g) h = 120 + (60 * (b - r)) / (mx - mn);
    else h = 240 + (60 * (r - g)) / (mx - mn);
    if (h < 0) h += 360;
  }
  return [h / 2, s, v, r, g, b]; // OpenCV 式 h/2 + sv + 原始 rgb
}

const samples = [];
for (const [prefix, raw] of Object.entries(CENSUS)) {
  const v = dump.videos.find((x) => x.name.startsWith(prefix));
  const map = new Map(raw.trim().split("\n").map((l) => l.trim().split(/\s+/))
    .map(([k, , s]) => [k.replace(/^g-/, "").replace(".png", ""), s]));
  for (let b = 0; b < v.bounds.length; b++) {
    for (let i = 0; i < v.bounds[b].length; i++) {
      const c = v.bounds[b][i];
      const s = map.get(`${b}-${i}-f${Math.floor((c.f0 + c.f1) / 2)}`);
      if (!s) continue;
      for (let k = 0; k < 9; k++) {
        if (c.read[k] === null || s[k] === "." || !c.rgbRead[k]) continue;
        samples.push({ video: prefix, bad: !CUBE.has(s[k]), f: feats(c.rgbRead[k]) });
      }
    }
  }
}
console.log(`样本: ${samples.length} (毒 ${samples.filter((x) => x.bad).length})`);

// z-score 归一 + kNN(k=5), 跨视频留一
const dims = samples[0].f.length;
const mu = Array(dims).fill(0), sd = Array(dims).fill(0);
for (const s of samples) for (let d = 0; d < dims; d++) mu[d] += s.f[d] / samples.length;
for (const s of samples) for (let d = 0; d < dims; d++) sd[d] += (s.f[d] - mu[d]) ** 2 / samples.length;
for (let d = 0; d < dims; d++) sd[d] = Math.sqrt(sd[d]) || 1;
const z = (f) => f.map((x, d) => (x - mu[d]) / sd[d]);

function knnBad(test, pool, k = 5) {
  const zt = z(test.f);
  const ds = pool.map((p) => ({ p, d: z(p.f).reduce((a, x, i) => a + (x - zt[i]) ** 2, 0) }));
  ds.sort((a, b) => a.d - b.d);
  const top = ds.slice(0, k);
  return top.filter((x) => x.p.bad).length / k; // 毒票占比
}

for (const test of ["1", "3"]) {
  const pool = samples.filter((s) => s.video !== test);
  const ts = samples.filter((s) => s.video === test);
  for (const thr of [0.4, 0.6]) {
    let kill = 0, badN = 0, fk = 0, goodN = 0;
    for (const s of ts) {
      const vote = knnBad(s, pool);
      if (s.bad) { badN++; if (vote >= thr) kill++; }
      else { goodN++; if (vote >= thr) fk++; }
    }
    console.log(`留一 v${test} (票阈 ${thr}): 杀毒 ${((kill / badN) * 100).toFixed(0)}% (${kill}/${badN})  误杀 ${((fk / goodN) * 100).toFixed(0)}% (${fk}/${goodN})  ${kill / badN >= 0.7 && fk / goodN <= 0.1 ? "✓ 达标" : ""}`);
  }
}
