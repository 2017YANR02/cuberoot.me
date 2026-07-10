/**
 * legit-pool-probe.ts — 验证"生产 legit 路径"可行性 (零 GT)。
 *
 * legit 样本 = 只用打乱观察期帧 (态=已知打乱) + 收尾复原帧 (态=复原) 反标, 生产可得。
 * 每视频单独 <3 类拟合失败, 但跨视频池化后覆盖是否够 6 色? 池化 kNN 留一 (LOO video)
 * 准确率 vs GT 上界差多少? 这是 legit 能否喂解码器的闸门。
 *
 * 前置: npx tsx scripts/real-eval.ts --calib --dumpsamples  (产 .tmp/calib-samples-*.json)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildKnn, knnClassify, type ColorSample } from "../src/color-calib.ts";
import type { ColorName } from "../src/reconstruct.ts";

const tmp = join(import.meta.dirname, "..", ".tmp");
const files = readdirSync(tmp).filter((f) => /^calib-samples-.*\.json$/.test(f)).sort();
const COLORS: ColorName[] = ["W", "R", "G", "Y", "O", "B"];

const perVideo = files.map((f) => {
  const samples = JSON.parse(readFileSync(join(tmp, f), "utf8")) as ColorSample[];
  return { name: f.replace(/^calib-samples-|\.json$/g, ""), samples };
});

console.log("=== legit 样本颜色分布 (每视频) ===");
for (const v of perVideo) {
  const cnt = new Map<ColorName, number>();
  for (const s of v.samples) cnt.set(s.label, (cnt.get(s.label) ?? 0) + 1);
  const dist = COLORS.map((c) => `${c}:${cnt.get(c) ?? 0}`).join(" ");
  console.log(`  ${v.name.padEnd(14)} n=${String(v.samples.length).padStart(3)}  ${dist}  (${cnt.size} 色)`);
}

const allSamples = perVideo.flatMap((v) => v.samples);
const poolCnt = new Map<ColorName, number>();
for (const s of allSamples) poolCnt.set(s.label, (poolCnt.get(s.label) ?? 0) + 1);
console.log(`\n=== 池化 (全 5 视频) n=${allSamples.length}  ${COLORS.map((c) => `${c}:${poolCnt.get(c) ?? 0}`).join(" ")}  (${poolCnt.size} 色) ===`);

// 留一视频: 用其它视频池化 kNN 分类被测视频样本
console.log("\n=== legit 跨视频池化 kNN 留一 (LOO video) ===");
let totOk = 0, totTot = 0, totRej = 0;
for (let vi = 0; vi < perVideo.length; vi++) {
  const train = perVideo.filter((_, i) => i !== vi).flatMap((v) => v.samples);
  const test = perVideo[vi].samples;
  const knn = buildKnn(train);
  if (!knn) { console.log(`  ${perVideo[vi].name}: 训练池建 kNN 失败`); continue; }
  const conf = new Map<ColorName, { ok: number; tot: number; rej: number }>();
  for (const s of test) {
    const e = conf.get(s.label) ?? { ok: 0, tot: 0, rej: 0 };
    e.tot++;
    const p = knnClassify(s.r, s.g, s.b, knn);
    if (p === null) e.rej++;
    else if (p === s.label) e.ok++;
    conf.set(s.label, e);
  }
  let ok = 0, tot = 0, rej = 0;
  const per = COLORS.filter((c) => conf.has(c)).map((c) => {
    const e = conf.get(c)!;
    ok += e.ok; tot += e.tot; rej += e.rej;
    return `${c}:${((e.ok / Math.max(1, e.tot - e.rej)) * 100).toFixed(0)}%`;
  }).join(" ");
  totOk += ok; totTot += tot; totRej += rej;
  console.log(`  ${perVideo[vi].name.padEnd(14)} ${((ok / Math.max(1, tot - rej)) * 100).toFixed(1)}% (n=${tot} 拒${((rej / tot) * 100).toFixed(0)}%)  ${per}`);
}
console.log(`  ---\n  池化 LOO 合计: ${((totOk / Math.max(1, totTot - totRej)) * 100).toFixed(1)}% (拒判 ${((totRej / totTot) * 100).toFixed(0)}%)`);

// macro (平衡) 准确率: 各类自准确率平均, 抗不平衡
console.log("\n=== 池化 LOO macro (平衡) 准确率 ===");
const macroConf = new Map<ColorName, { ok: number; tot: number }>();
for (let vi = 0; vi < perVideo.length; vi++) {
  const train = perVideo.filter((_, i) => i !== vi).flatMap((v) => v.samples);
  const knn = buildKnn(train);
  if (!knn) continue;
  for (const s of perVideo[vi].samples) {
    const p = knnClassify(s.r, s.g, s.b, knn);
    if (p === null) continue;
    const e = macroConf.get(s.label) ?? { ok: 0, tot: 0 };
    e.tot++;
    if (p === s.label) e.ok++;
    macroConf.set(s.label, e);
  }
}
let macroSum = 0, macroN = 0;
for (const c of COLORS) {
  const e = macroConf.get(c);
  if (!e || !e.tot) continue;
  macroSum += e.ok / e.tot; macroN++;
  console.log(`  ${c}: ${((e.ok / e.tot) * 100).toFixed(0)}% (n=${e.tot})`);
}
console.log(`  macro: ${((macroSum / Math.max(1, macroN)) * 100).toFixed(1)}% (${macroN} 类)`);
