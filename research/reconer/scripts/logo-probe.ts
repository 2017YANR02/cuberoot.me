/**
 * logo-probe.ts — 中心贴纸 logo 旋转 = 末步方向的独立证据 (可行性探针)。
 *
 * 机理: 外层 U 系转动把 U 面中心贴纸原地旋转 ±90/180 (u 同; 非 U 层动作不转
 * U 中心) — GAN 白心 logo 的旋转角直接给出末步的层+方向+转量, 与颜色链证据
 * 完全独立。54-facelet 置换模型表达不了中心旋转, 这是纯提取层新通道。
 *
 * 做法: 末段前静止帧 fA (S1) vs 复原静止帧 fB, 各自用 960 跟踪晶格 (canonical
 * 基全视频恒定 → 旋转量 well-defined) 在 4K 原片重采中心贴纸 canonical patch,
 * 蓝墨通道 (b-(r+g)/2) NCC 对 4 个 90° 旋转打分。GT 已知用于验证 (只读)。
 *
 * 用法: npx tsx scripts/logo-probe.ts [--video 3]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import { activityMask, cellCenter, medianBackground } from "../src/sticker-blobs.ts";
import { extractTrackedFrames } from "../src/lattice-track.ts";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ONLY = argAt("--video");
const videosDir = join(import.meta.dirname, "..", "videos");
const tmpDir = join(import.meta.dirname, "..", ".tmp");

/** 单帧 4K 原始 RGB 提取 (缓存): 全帧 3840×2160 rgb24 */
function frame4k(videoPath: string, name: string, fr: number): { rgb: Uint8Array; w: number; h: number } {
  const p = join(tmpDir, `f4k-${name[0]}-${fr}.bin`);
  if (!existsSync(p)) {
    const args = [
      "-hide_banner", "-v", "error", "-threads", "12", "-i", videoPath,
      "-vf", `select=eq(n\\,${fr})`, "-fps_mode", "passthrough",
      "-pix_fmt", "rgb24", "-f", "rawvideo", p, "-y",
    ];
    const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (res.status !== 0 || !existsSync(p)) throw new Error(`ffmpeg 单帧失败 ${name} f${fr}`);
  }
  if (statSync(p).size !== 3840 * 2160 * 3) throw new Error(`4K 帧尺寸不对 ${p}`);
  return { rgb: readFileSync(p), w: 3840, h: 2160 };
}

for (const sf of ["1 4.448.MP4", "2 4.369.MP4", "3 4.375.MP4", "4 4.610.MP4", "5 4.067.MP4"]) {
  if (ONLY && !sf.startsWith(ONLY)) continue;
  const videoPath = join(videosDir, sf);
  const content = readFileSync(videoPath + ".splits.txt", "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const splitFrames = parseSplitFrames(content);
  const moveToks = [...tokens, ...tailRotations].filter((x) => !ROTATION_TOKENS.has(x));
  const gtM2 = moveToks[moveToks.length - 1];
  const spB = splitFrames[splitFrames.length - 2];
  const spC = splitFrames[splitFrames.length - 1];

  // 960 全程跟踪 (晶格几何源)
  const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as { w: number; h: number; frames: number[] };
  const lb = readFileSync(videoPath + ".framedump.bin");
  const lowBytes = meta.w * meta.h * 3;
  const lowAt = (i: number) => new Uint8Array(lb.buffer, lb.byteOffset + i * lowBytes, lowBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(lowAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask960 = activityMask(bgFrames, bg, meta.w, meta.h);
  const { grids } = extractTrackedFrames(lowAt, meta.frames.length, meta.w, meta.h, mask960, {
    calib: null,
    anchor: true,
  });
  const gridOf = (fr: number) => {
    const i = meta.frames.indexOf(fr);
    return i >= 0 ? grids[i]?.[0]?.grid ?? null : null;
  };
  // 帧清晰度 (960 下中心 3×3 bbox 内拉普拉斯能量) — 挑最不糊的帧
  const sharpness = (fr: number): number => {
    const i = meta.frames.indexOf(fr);
    const g = i >= 0 ? grids[i]?.[0]?.grid : null;
    if (!g) return -1;
    const rgb = lowAt(i);
    const c = cellCenter(g, 1, 1);
    const R = Math.round(g.pitch * 1.6);
    let e = 0, n = 0;
    for (let y = Math.max(1, Math.round(c.y - R)); y < Math.min(meta.h - 1, c.y + R); y++) {
      for (let x = Math.max(1, Math.round(c.x - R)); x < Math.min(meta.w - 1, c.x + R); x++) {
        const q = (y * meta.w + x) * 3 + 1;
        const lap = 4 * rgb[q] - rgb[q - 3] - rgb[q + 3] - rgb[q - meta.w * 3] - rgb[q + meta.w * 3];
        e += lap * lap;
        n++;
      }
    }
    return n ? e / n : -1;
  };
  const pickSharp = (lo: number, hi: number): number => {
    let best = -1, bs = -1;
    for (let fr = lo; fr <= hi; fr++) {
      const s = sharpness(fr);
      if (s > bs) { bs = s; best = fr; }
    }
    return best;
  };
  const fA = pickSharp(spB - 5, spB - 1); // 末步前 (S1)
  const fB = pickSharp(spC + 1, spC + 10); // 复原后
  if (fA < 0 || fB < 0) {
    console.log(`${sf[0]}: 找不到可用帧 (fA=${fA} fB=${fB}), 跳过`);
    continue;
  }

  // canonical patch: 中心贴纸, 网格坐标 (u,v)∈[-0.38,0.38]², 4K 双线性。
  // refBasis: 把本帧基折叠 (90° 步) 到与参考基最对齐后再采样 — 消除两帧间
  // 基折叠跳变把测量整体偏 90° 的混淆 (真实机体旋转 <45° 时折叠唯一)。
  interface Basis { v1: { x: number; y: number }; v2: { x: number; y: number } }
  const foldTo = (g: { v1: { x: number; y: number }; v2: { x: number; y: number } }, ref: Basis): Basis => {
    let best: Basis = { v1: g.v1, v2: g.v2 };
    let bs = -Infinity;
    let cur: Basis = { v1: g.v1, v2: g.v2 };
    for (let k = 0; k < 4; k++) {
      const dot = (cur.v1.x * ref.v1.x + cur.v1.y * ref.v1.y) + (cur.v2.x * ref.v2.x + cur.v2.y * ref.v2.y);
      if (dot > bs) { bs = dot; best = cur; }
      cur = { v1: { x: cur.v2.x, y: cur.v2.y }, v2: { x: -cur.v1.x, y: -cur.v1.y } }; // 基旋 90°
    }
    return best;
  };
  const N = 56;
  const S = 4; // 960→4K
  const inkAt = (rgb: Uint8Array, w: number, h: number, x: number, y: number): number => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || xi >= w || yi < 0 || yi >= h) return 0;
    const q = (yi * w + xi) * 3;
    return Math.max(0, rgb[q + 2] - (rgb[q] + rgb[q + 1]) / 2);
  };
  /** 网格中心 ±0.6 格内找蓝墨质心 (白面上 logo 是唯一蓝墨块); 墨量不足 → null */
  const findLogo = (
    rgb: Uint8Array, w: number, h: number,
    g0: { v1: { x: number; y: number }; v2: { x: number; y: number } },
    c: { x: number; y: number },
  ): { x: number; y: number; tot: number } | null => {
    let sx = 0, sy = 0, tot = 0;
    const M = 48;
    for (let vi = 0; vi <= M; vi++) {
      const v = -0.6 + (1.2 * vi) / M;
      for (let ui = 0; ui <= M; ui++) {
        const u = -0.6 + (1.2 * ui) / M;
        const x = (c.x + u * g0.v1.x + v * g0.v2.x) * S;
        const y = (c.y + u * g0.v1.y + v * g0.v2.y) * S;
        const e = inkAt(rgb, w, h, x, y);
        if (e < 12) continue; // 噪声地板
        sx += x * e; sy += y * e; tot += e;
      }
    }
    return tot > 800 ? { x: sx / tot, y: sy / tot, tot } : null;
  };
  const patchOf = (fr: number, refBasis?: Basis): Float32Array | null => {
    const g0 = gridOf(fr);
    if (!g0) return null;
    const fb = refBasis ? foldTo(g0, refBasis) : { v1: g0.v1, v2: g0.v2 };
    const { rgb, w, h } = frame4k(videoPath, sf, fr);
    const c0 = cellCenter(g0, 1, 1);
    const logo = findLogo(rgb, w, h, g0, c0);
    if (!logo) return null;
    // patch 以 logo 质心为中心 (logo 居中于中心贴纸, 绕自身质心旋转 = 贴纸旋转)
    const out = new Float32Array(N * N);
    for (let vi = 0; vi < N; vi++) {
      const v = -0.33 + (0.66 * vi) / (N - 1);
      for (let ui = 0; ui < N; ui++) {
        const u = -0.33 + (0.66 * ui) / (N - 1);
        const x = logo.x + (u * fb.v1.x + v * fb.v2.x) * S;
        const y = logo.y + (u * fb.v1.y + v * fb.v2.y) * S;
        const x0 = Math.floor(x), y0 = Math.floor(y);
        if (x0 < 0 || x0 >= w - 1 || y0 < 0 || y0 >= h - 1) return null;
        const fx = x - x0, fy = y - y0;
        let val = 0;
        for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as const) {
          const q = ((y0 + dy) * w + (x0 + dx)) * 3;
          val += wt * (rgb[q + 2] - (rgb[q] + rgb[q + 1]) / 2); // 蓝墨通道
        }
        out[vi * N + ui] = val;
      }
    }
    return out;
  };
  const rot90 = (p: Float32Array): Float32Array => {
    const out = new Float32Array(N * N);
    for (let vi = 0; vi < N; vi++)
      for (let ui = 0; ui < N; ui++) out[vi * N + ui] = p[(N - 1 - ui) * N + vi];
    return out;
  };
  const ncc = (a: Float32Array, b: Float32Array): number => {
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
    ma /= a.length; mb /= b.length;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) {
      const xa = a[i] - ma, xb = b[i] - mb;
      num += xa * xb; da += xa * xa; db += xb * xb;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
  };
  const gA = gridOf(fA);
  const pA = patchOf(fA);
  const pB0 = gA ? patchOf(fB, { v1: gA.v1, v2: gA.v2 }) : null;
  // 自洽检验: 同静止期两帧 (状态不变) 应测 0°
  const fA2 = pickSharp(spB - 9, spB - 6);
  const pA2 = fA2 >= 0 && gA ? patchOf(fA2, { v1: gA.v1, v2: gA.v2 }) : null;
  if (!pA || !pB0) {
    console.log(`${sf[0]}: patch 采样失败 (fA=${fA} fB=${fB})`);
    continue;
  }
  const rotScores = (a: Float32Array, b0: Float32Array): number[] => {
    const out: number[] = [];
    let b = b0;
    for (let k = 0; k < 4; k++) {
      out.push(ncc(a, b));
      b = rot90(b);
    }
    return out;
  };
  const scores = rotScores(pA, pB0);
  const order = scores.map((s, k) => ({ s, k })).sort((a, b) => b.s - a.s);
  const selfChk = pA2 ? rotScores(pA, pA2) : null;
  const selfBest = selfChk ? selfChk.indexOf(Math.max(...selfChk)) : -1;
  console.log(
    `${sf[0]}: GT末步 ${gtM2}  fA=f${fA} fB=f${fB}  NCC[0°,90°,180°,270°] = ${scores.map((s) => s.toFixed(3)).join(", ")}` +
      `  → 最优旋转 ${order[0].k * 90}° (margin ${(order[0].s - order[1].s).toFixed(3)})` +
      (selfChk ? `  | 自洽(f${fA2}vs f${fA}, 应0°): ${selfBest * 90}° [${selfChk.map((s) => s.toFixed(2)).join(",")}]` : ""),
  );
}
