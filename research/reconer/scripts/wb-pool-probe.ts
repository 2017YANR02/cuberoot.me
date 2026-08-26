/**
 * wb-pool-probe.ts — 白平衡归一化能否救回跨视频池化 kNN?
 *
 * naive 跨视频 pool: 干净样本 64% 但真实 obs 塌回 55% (= vivid), 解码 v2 rank 35 (差于 vivid 7)。
 * 疑因: 各视频白平衡/曝光漂移。若 pool 前把每视频归一到统一白点, 能否恢复到同视频 74%?
 * 归一化须 legit (不用 GT): gray-world (全格均值, 零标签) / white-anchor (W 格中位, 复原态可得)。
 *
 * 前置: npx tsx scripts/real-eval.ts --calibgt --dumpsamples  (产 .tmp/calib-samples-*.json)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildKnn, knnClassify, type ColorSample } from "../src/color-calib.ts";
import type { ColorName } from "../src/reconstruct.ts";

const tmp = join(import.meta.dirname, "..", ".tmp");
const files = readdirSync(tmp).filter((f) => /^calib-samples-.*\.json$/.test(f)).sort();
const COLORS: ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const perVideo = files.map((f) => ({
  name: f.replace(/^calib-samples-|\.json$/g, ""),
  samples: JSON.parse(readFileSync(join(tmp, f), "utf8")) as ColorSample[],
}));

type Corr = { gr: number; gg: number; gb: number };
/** gray-world: 每通道增益 = 灰目标 / 该视频该通道均值 (全格, 零标签) */
function grayWorld(samples: ColorSample[]): Corr {
  let sr = 0, sg = 0, sb = 0;
  for (const s of samples) { sr += s.r; sg += s.g; sb += s.b; }
  const n = Math.max(1, samples.length);
  const mr = sr / n, mg = sg / n, mb = sb / n;
  const gray = (mr + mg + mb) / 3;
  return { gr: gray / mr, gg: gray / mg, gb: gray / mb };
}
/** white-anchor: 用 W 格中位 RGB 作白点, 归一到 canonical 白 235 (复原态白面 legit 可得) */
function whiteAnchor(samples: ColorSample[]): Corr | null {
  const ws = samples.filter((s) => s.label === "W");
  if (ws.length < 5) return null;
  const med = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1];
  const wr = med(ws.map((s) => s.r)), wg = med(ws.map((s) => s.g)), wb = med(ws.map((s) => s.b));
  return { gr: 235 / Math.max(1, wr), gg: 235 / Math.max(1, wg), gb: 235 / Math.max(1, wb) };
}
const apply = (s: ColorSample, c: Corr): ColorSample => ({
  ...s,
  r: Math.min(255, s.r * c.gr),
  g: Math.min(255, s.g * c.gg),
  b: Math.min(255, s.b * c.gb),
});

function looEval(corrOf: (v: { samples: ColorSample[] }) => Corr | null, label: string) {
  const corrected = perVideo.map((v) => {
    const c = corrOf(v);
    return { name: v.name, samples: c ? v.samples.map((s) => apply(s, c)) : v.samples, ok: !!c };
  });
  let totOk = 0, totTot = 0;
  const macro = new Map<ColorName, { ok: number; tot: number }>();
  const perVid: string[] = [];
  for (let vi = 0; vi < corrected.length; vi++) {
    const train = corrected.filter((_, i) => i !== vi).flatMap((v) => v.samples);
    const knn = buildKnn(train);
    if (!knn) continue;
    let ok = 0, tot = 0;
    for (const s of corrected[vi].samples) {
      const p = knnClassify(s.r, s.g, s.b, knn);
      if (p === null) continue;
      tot++; if (p === s.label) ok++;
      const e = macro.get(s.label) ?? { ok: 0, tot: 0 };
      e.tot++; if (p === s.label) e.ok++; macro.set(s.label, e);
    }
    totOk += ok; totTot += tot;
    perVid.push(`${corrected[vi].name.slice(0, 6)}${corrected[vi].ok ? "" : "*"}:${((ok / Math.max(1, tot)) * 100).toFixed(0)}`);
  }
  let ms = 0, mn = 0;
  for (const c of COLORS) { const e = macro.get(c); if (e?.tot) { ms += e.ok / e.tot; mn++; } }
  const perC = COLORS.map((c) => { const e = macro.get(c); return e?.tot ? `${c}:${((e.ok / e.tot) * 100).toFixed(0)}` : `${c}:-`; }).join(" ");
  console.log(`${label.padEnd(16)} 合计 ${((totOk / Math.max(1, totTot)) * 100).toFixed(1)}%  macro ${((ms / Math.max(1, mn)) * 100).toFixed(1)}%  [${perC}]  (${perVid.join(" ")})`);
}

console.log("=== 跨视频池化 kNN 留一: 白平衡归一化对比 (* = 该视频归一失败沿用原始) ===");
looEval(() => null, "无归一化");
looEval((v) => grayWorld(v.samples), "gray-world");
looEval((v) => whiteAnchor(v.samples), "white-anchor");
