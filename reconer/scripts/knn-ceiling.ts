/**
 * knn-ceiling.ts — 标定样本特征可分性上限: 留一法 k-NN (无参, 吃任意分布形状)。
 *
 * 目的: 区分"高斯标定模型太粗" vs "特征本质重叠"。LOO k-NN ≈ 该特征空间下
 * 任何静态分类器的现实上限; 若它也 ≲70%, 静态颜色标定这条路即证伪, 别再调模型。
 *
 * 用法: npx tsx scripts/knn-ceiling.ts [k]   (读 .tmp/calib-samples-*.json)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rgbFeature, type ColorSample } from "../src/color-calib.ts";

const K = parseInt(process.argv[2] ?? "7", 10);
const dir = join(import.meta.dirname, "..", ".tmp");
const files = readdirSync(dir).filter((f) => f.startsWith("calib-samples-") && f.endsWith(".json"));

let allOk = 0, allTot = 0;
for (const f of files.sort()) {
  const samples = JSON.parse(readFileSync(join(dir, f), "utf8")) as ColorSample[];
  const feats = samples.map((s) => rgbFeature(s.r, s.g, s.b));
  // 逐维全局尺度归一 (MAD), 避免 v 量纲主导
  const dims = ["a", "b", "v"] as const;
  const scale = dims.map((d) => {
    const xs = feats.map((ft) => ft[d]).sort((x, y) => x - y);
    const med = xs[xs.length >> 1];
    const dev = xs.map((x) => Math.abs(x - med)).sort((x, y) => x - y);
    return Math.max(1, 1.4826 * dev[dev.length >> 1]);
  });
  const X = feats.map((ft) => dims.map((d, j) => ft[d] / scale[j]));
  const n = samples.length;
  let ok = 0;
  const perClass = new Map<string, { ok: number; tot: number }>();
  for (let i = 0; i < n; i++) {
    // 最近 K 邻 (排除自身) 多数票
    const dist: { d: number; l: string }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1], dz = X[i][2] - X[j][2];
      dist.push({ d: dx * dx + dy * dy + dz * dz, l: samples[j].label });
    }
    dist.sort((p, q) => p.d - q.d);
    const tally = new Map<string, number>();
    for (let k = 0; k < Math.min(K, dist.length); k++) {
      tally.set(dist[k].l, (tally.get(dist[k].l) ?? 0) + 1);
    }
    const pred = [...tally.entries()].sort((p, q) => q[1] - p[1])[0][0];
    const e = perClass.get(samples[i].label) ?? { ok: 0, tot: 0 };
    e.tot++;
    if (pred === samples[i].label) { ok++; e.ok++; }
    perClass.set(samples[i].label, e);
  }
  allOk += ok;
  allTot += n;
  const per = [...perClass.entries()]
    .sort((p, q) => q[1].tot - p[1].tot)
    .map(([c, e]) => `${c}:${((e.ok / e.tot) * 100).toFixed(0)}%×${e.tot}`)
    .join(" ");
  console.log(`${f.replace("calib-samples-", "").replace(".json", "")}: LOO ${K}-NN ${((ok / n) * 100).toFixed(1)}% (${n})  ${per}`);
}
console.log(`\n合计: ${((allOk / allTot) * 100).toFixed(1)}% (${allTot})`);
