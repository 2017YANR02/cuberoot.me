/**
 * em-probe.ts — EM 自训练可行性离线探针 (零 GT 逐视频颜色标定)。
 *
 * 真实 EM 形态: 候选状态给**全帧**格伪标签 (像 --calibgt 收 1200 样本/视频那样),
 * 非稀疏 obs 共识格。故训练池 = calib-samples (富样本), 测试 = obs 格 (解码器实际打分的格)。
 * 两问:
 *   ① 天花板 (f=0, 伪标签=GT): 富样本 kNN 测 obs 格 → 应复现 GT 上界 65.5%
 *   ② 抗噪: 伪标签错 f% (候选错→状态错) 后 obs 掉多少。realistic f (错误 LL 候选) ~15-25%。
 *      随机翻 (乐观, kNN 平均掉噪) + 整 obs 组翻 (贴近候选的时空相干错误) 双口径。
 *
 * 前置: real-eval --calibgt --dumpsamples (产 calib-samples-*.json)
 *      + real-eval --dumpobs .tmp/obs-rgb.json (带 rgbRead)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildKnn, knnClassify, type ColorSample } from "../src/color-calib.ts";
import type { ColorName } from "../src/reconstruct.ts";

const COLORS: ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const tmp = join(import.meta.dirname, "..", ".tmp");
type RGB = [number, number, number];
interface ObsCell { rgb: RGB; gt: ColorName; read: ColorName | null }

// 训练池: calib-samples (GT 标签, 带 obs 组 id), 按视频号归组
const samplesByVid = new Map<string, ColorSample[]>();
for (const f of readdirSync(tmp)) {
  const m = /^calib-samples-(\d)_/.exec(f);
  if (!m) continue;
  samplesByVid.set(m[1], JSON.parse(readFileSync(join(tmp, f), "utf8")) as ColorSample[]);
}
// 测试集: obs 格 (rgbRead + gt + vivid read), 按视频号归组
const dump = JSON.parse(readFileSync(join(tmp, "obs-rgb.json"), "utf8"));
const obsByVid = new Map<string, ObsCell[]>();
for (const v of dump.videos as any[]) {
  const vid = v.name[0];
  const cells: ObsCell[] = [];
  for (const bnd of v.bounds) {
    if (!bnd) continue;
    for (const ch of bnd) for (let i = 0; i < 9; i++) {
      const rgb = ch.rgbRead?.[i], gt = ch.gt?.[i];
      if (rgb && gt) cells.push({ rgb, gt, read: ch.read[i] ?? null });
    }
  }
  obsByVid.set(vid, cells);
}
const vids = [...obsByVid.keys()].sort();
const acc = (ok: number, tot: number) => `${((100 * ok) / Math.max(1, tot)).toFixed(1)}%`;

function testKnn(train: ColorSample[], test: ObsCell[]): { ok: number; tot: number } {
  const knn = buildKnn(train);
  if (!knn) return { ok: 0, tot: 0 };
  let ok = 0, tot = 0;
  for (const c of test) {
    const p = knnClassify(c.rgb[0], c.rgb[1], c.rgb[2], knn);
    if (p === null) continue;
    tot++; if (p === c.gt) ok++;
  }
  return { ok, tot };
}
let lcg = 999;
const rnd = () => { lcg = (lcg * 1103515245 + 12345) & 0x7fffffff; return lcg / 0x7fffffff; };
const flipLabel = (c: ColorName) => COLORS[(COLORS.indexOf(c) + 1 + Math.floor(rnd() * 5)) % 6];

// 整 obs 组翻: 同一 obs id 的样本整组换成同一错色 (候选错→整块状态错, 时空相干)
function corruptGroup(samples: ColorSample[], f: number): ColorSample[] {
  const groups = new Map<number, ColorSample[]>();
  for (const s of samples) {
    const id = s.obs ?? -1;
    (groups.get(id) ?? groups.set(id, []).get(id)!).push(s);
  }
  const out: ColorSample[] = [];
  for (const arr of groups.values()) {
    if (rnd() < f) { const wrong = flipLabel(arr[0].label); for (const s of arr) out.push({ ...s, label: wrong }); }
    else out.push(...arr);
  }
  return out;
}
const corruptCell = (samples: ColorSample[], f: number): ColorSample[] =>
  samples.map((s) => (rnd() < f ? { ...s, label: flipLabel(s.label) } : s));

console.log("=== EM 天花板: 富样本(calib-samples GT) kNN → 测 obs 格 vs vivid ===");
console.log("视频   vivid    天花板(f=0)  (训练n / obs-n)");
let gV = 0, gVt = 0, gC = 0, gCt = 0;
for (const vid of vids) {
  const tr = samplesByVid.get(vid) ?? [], te = obsByVid.get(vid) ?? [];
  const vivOk = te.filter((c) => c.read === c.gt).length;
  const r = testKnn(tr, te);
  gV += vivOk; gVt += te.length; gC += r.ok; gCt += r.tot;
  console.log(`  ${vid}    ${acc(vivOk, te.length).padStart(6)}   ${acc(r.ok, r.tot).padStart(7)}     (${tr.length} / ${te.length})`);
}
console.log(`  合计  ${acc(gV, gVt).padStart(6)}   ${acc(gC, gCt).padStart(7)}     ← 复现 GT 上界即机制对`);

for (const [mode, corrupt] of [["随机翻格", corruptCell], ["整 obs 组翻", corruptGroup]] as const) {
  console.log(`\n=== EM 抗噪 (${mode}): 伪标签错 f% → 富样本 refit → 测 obs 格 ===`);
  console.log("f      合计obs   (各视频)     [vivid=58.9%]");
  for (const f of [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4]) {
    let gO = 0, gT = 0; const per: string[] = [];
    for (const vid of vids) {
      lcg = 777 + Math.round(f * 100); // 每 f 固定种子, 可复现
      const tr = corrupt(samplesByVid.get(vid) ?? [], f);
      const r = testKnn(tr, obsByVid.get(vid) ?? []);
      gO += r.ok; gT += r.tot; per.push(`${vid}:${acc(r.ok, r.tot)}`);
    }
    const flag = (100 * gO) / Math.max(1, gT) > 58.9 ? "" : "  ← 跌破 vivid";
    console.log(`  ${(f * 100).toFixed(0).padStart(2)}%   ${acc(gO, gT).padStart(6)}   ${per.join(" ")}${flag}`);
  }
}
