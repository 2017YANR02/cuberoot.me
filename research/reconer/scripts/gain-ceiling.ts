/**
 * gain-ceiling.ts — render&compare 核心机制的离线生死判: 假设条件化每观测增益。
 *
 * render&compare 的内环 = 给定假设态, 该帧 9 格真色已知 → 反拟合该帧光照增益
 * (色相偏移 + 饱和缩放) → 残差作观测似然。此处用 GT 标签模拟"真假设"最优情形:
 * 若增益校正后逐格可分性 (LOO k-NN / 高斯) 仍 <80%, 说明混淆不是每帧光照造成
 * (而是每格级反光/模糊), render&compare 的颜色侧同样封顶, 投入前必须知道。
 *
 * 用法: npx tsx scripts/gain-ceiling.ts [k]   (读 .tmp/calib-samples-*.json 带 obs 分组)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rgbToHsvCv } from "../src/bface-color.ts";
import type { ColorSample } from "../src/color-calib.ts";
import type { ColorName } from "../src/reconstruct.ts";

const K = parseInt(process.argv[2] ?? "7", 10);
const dir = join(import.meta.dirname, "..", ".tmp");
const files = readdirSync(dir).filter((f) => f.startsWith("calib-samples-") && f.endsWith(".json"));

interface Feat {
  h: number; // OpenCV 半度 [0,180)
  s: number;
  v: number;
  label: ColorName;
  obs: number;
}

const circMeanH = (hs: readonly number[]): number => {
  let x = 0, y = 0;
  for (const h of hs) {
    const r = (h * 2 * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  return (((Math.atan2(y, x) * 180) / Math.PI / 2) + 180) % 180;
};
const hDiff = (a: number, b: number): number => {
  // 环差 → (-90, 90]
  let d = a - b;
  while (d > 90) d -= 180;
  while (d <= -90) d += 180;
  return d;
};

for (const f of files.sort()) {
  const samples = (JSON.parse(readFileSync(join(dir, f), "utf8")) as ColorSample[]).filter(
    (s) => s.obs !== undefined,
  );
  if (!samples.length) {
    console.log(`${f}: 无 obs 分组 (旧 dump), 跳过 — 先重跑 --calibgt --dumpsamples`);
    continue;
  }
  const feats: Feat[] = samples.map((s) => {
    const [h, sv, v] = rgbToHsvCv(s.r, s.g, s.b);
    return { h, s: sv, v, label: s.label, obs: s.obs! };
  });

  // 全局逐类参考 (中位): 增益的锚
  const byClass = new Map<ColorName, Feat[]>();
  for (const ft of feats) (byClass.get(ft.label) ?? byClass.set(ft.label, []).get(ft.label)!).push(ft);
  const refH = new Map<ColorName, number>();
  const refS = new Map<ColorName, number>();
  for (const [c, xs] of byClass) {
    refH.set(c, circMeanH(xs.map((x) => x.h)));
    const ss = xs.map((x) => x.s).sort((a, b) => a - b);
    refS.set(c, ss[ss.length >> 1]);
  }

  // 每观测增益: Δh = 圆均值(格色相 − 类参考色相), satScale = 中位(格饱和/类参考饱和)
  // 只用高饱和彩色格拟合 (W/低饱和的色相无意义); <2 个可拟合格 → 增益恒等
  const byObs = new Map<number, Feat[]>();
  for (const ft of feats) (byObs.get(ft.obs) ?? byObs.set(ft.obs, []).get(ft.obs)!).push(ft);
  const gainOf = (cells: readonly Feat[], excl: Feat | null): { dh: number; ks: number } => {
    const fit = cells.filter((c) => c !== excl && c.label !== "W" && c.s >= 60);
    if (fit.length < 2) return { dh: 0, ks: 1 };
    const dhs = fit.map((c) => hDiff(c.h, refH.get(c.label)!));
    // 圆均值化简: 差值已折到 (-90,90], 直接均值 (小角近似足够)
    const dh = dhs.reduce((a, b) => a + b, 0) / dhs.length;
    const kss = fit.map((c) => c.s / Math.max(1, refS.get(c.label)!)).sort((a, b) => a - b);
    return { dh, ks: kss[kss.length >> 1] };
  };

  // 校正特征 (两版: 全拟合 = 忠实模拟搜索里的真假设; 留格 = 保守)
  const corrected = (variant: "full" | "loo"): { a: number; b: number; v: number; label: ColorName; obs: number }[] =>
    feats.map((ft) => {
      const cells = byObs.get(ft.obs)!;
      const { dh, ks } = gainOf(cells, variant === "loo" ? ft : null);
      const h2 = (((ft.h - dh) % 180) + 180) % 180;
      const s2 = ft.s / Math.max(0.25, ks);
      const rad = (h2 * 2 * Math.PI) / 180;
      return { a: s2 * Math.cos(rad), b: s2 * Math.sin(rad), v: ft.v, label: ft.label, obs: ft.obs };
    });

  const knn = (X: { a: number; b: number; v: number; label: ColorName; obs: number }[]): number => {
    // 逐维 MAD 归一
    const dims = ["a", "b", "v"] as const;
    const scale = dims.map((d) => {
      const xs = X.map((x) => x[d]).sort((p, q) => p - q);
      const med = xs[xs.length >> 1];
      const dev = xs.map((x) => Math.abs(x - med)).sort((p, q) => p - q);
      return Math.max(1, 1.4826 * dev[dev.length >> 1]);
    });
    const P = X.map((x) => dims.map((d, j) => x[d] / scale[j]));
    let ok = 0;
    for (let i = 0; i < X.length; i++) {
      const dist: { d: number; l: ColorName }[] = [];
      for (let j = 0; j < X.length; j++) {
        if (j === i || X[j].obs === X[i].obs) continue; // 同观测共享增益, 排除防泄漏
        const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = P[i][2] - P[j][2];
        dist.push({ d: dx * dx + dy * dy + dz * dz, l: X[j].label });
      }
      dist.sort((p, q) => p.d - q.d);
      const tally = new Map<ColorName, number>();
      for (let k = 0; k < Math.min(K, dist.length); k++) {
        tally.set(dist[k].l, (tally.get(dist[k].l) ?? 0) + 1);
      }
      const pred = [...tally.entries()].sort((p, q) => q[1] - p[1])[0][0];
      if (pred === X[i].label) ok++;
    }
    return (ok / X.length) * 100;
  };

  const base = knn(
    feats.map((ft) => {
      const rad = (ft.h * 2 * Math.PI) / 180;
      return { a: ft.s * Math.cos(rad), b: ft.s * Math.sin(rad), v: ft.v, label: ft.label, obs: ft.obs };
    }),
  );
  const corrFull = knn(corrected("full"));
  const corrLoo = knn(corrected("loo"));
  const nObs = byObs.size;
  const fitable = [...byObs.values()].filter((cells) => cells.filter((c) => c.label !== "W" && c.s >= 60).length >= 2).length;
  console.log(
    `${f.replace("calib-samples-", "").replace(".json", "")}: 基线 ${base.toFixed(1)}% → 增益校正 全拟合 ${corrFull.toFixed(1)}% / 留格 ${corrLoo.toFixed(1)}%  (${feats.length} 格, ${nObs} 观测, 可拟合增益 ${fitable})`,
  );
}
