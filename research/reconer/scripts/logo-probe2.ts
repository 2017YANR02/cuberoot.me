/**
 * logo-probe2.ts — 中心贴纸 logo 旋转判末步方向, v2: logo 自定位 (不依赖晶格)。
 *
 * v1 失败根因: 尾窗 960 跟踪晶格错位半格~一格 (跨面), 以格心找 logo 全灭。
 * v2 做法: logo 是"亮白邻域包围的小蓝墨块"— 在魔方区域 (960 网格中心 ±3.5 格,
 * 粗先验够用) 直接连通域检测蓝墨块, 过滤 (面积/长宽比/邻域亮度), 以墨块质心为
 * patch 中心, **图像轴** 4×90° 旋转 NCC (±24° 细扫吸收放下倾斜)。
 * fA (末步前) / fB (复原后) 帧在各自窗口内挑"找得到 logo 且最清晰"的。
 *
 * 用法: npx tsx scripts/logo-probe2.ts [--video 3]
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
const measures: Record<string, { ncc: number[]; fA: number; fB: number }> = {};
const W4 = 3840, H4 = 2160, S = 4;

// 每视频一次性抽 4K 尾段 bin ([lo..hi] 连续), 免逐帧全解码
interface Tail4k { lo: number; hi: number; bin: Uint8Array }
const tail4kCache = new Map<string, Tail4k>();
function loadTail4k(videoPath: string, name: string, lo: number, hi: number): Tail4k {
  let t = tail4kCache.get(name);
  if (t) return t;
  const p = join(tmpDir, `tail4k-${name[0]}.bin`);
  if (!existsSync(p) || statSync(p).size !== (hi - lo + 1) * W4 * H4 * 3) {
    const res = spawnSync("ffmpeg", [
      "-hide_banner", "-v", "error", "-threads", "12", "-i", videoPath,
      "-vf", `select=between(n\\,${lo}\\,${hi})`, "-fps_mode", "passthrough",
      "-pix_fmt", "rgb24", "-f", "rawvideo", p, "-y",
    ], { stdio: ["ignore", "inherit", "inherit"] });
    if (res.status !== 0 || !existsSync(p)) throw new Error(`ffmpeg 尾段失败 ${name}`);
  }
  t = { lo, hi, bin: readFileSync(p) };
  tail4kCache.set(name, t);
  return t;
}
let tailRange: [number, number] = [0, 0];
let curVideo = "";
function frame4k(videoPath: string, name: string, fr: number): Uint8Array {
  const t = loadTail4k(videoPath, name, tailRange[0], tailRange[1]);
  const i = fr - t.lo;
  if (i < 0 || i > t.hi - t.lo) throw new Error(`f${fr} 出 4K 尾段范围 [${t.lo}..${t.hi}]`);
  const fb = W4 * H4 * 3;
  return new Uint8Array(t.bin.buffer, t.bin.byteOffset + i * fb, fb);
}
void curVideo;

interface LogoBlob { x: number; y: number; area: number; ink: number; ring: number }
/** 区域内找 logo: 蓝墨连通域 + 面积/长宽比过滤 + 白亮邻域环过滤, 取墨量最大者 */
function findLogoBlob(rgb: Uint8Array, cx: number, cy: number, R: number, pitch4: number): LogoBlob | null {
  const x0 = Math.max(0, Math.round(cx - R)), x1 = Math.min(W4 - 1, Math.round(cx + R));
  const y0 = Math.max(0, Math.round(cy - R)), y1 = Math.min(H4 - 1, Math.round(cy + R));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const inkMap = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const q = ((y + y0) * W4 + (x + x0)) * 3;
      inkMap[y * w + x] = Math.max(0, rgb[q + 2] - (rgb[q] + rgb[q + 1]) / 2);
    }
  }
  const seen = new Uint8Array(w * h);
  const blobs: LogoBlob[] = [];
  const stack: number[] = [];
  const aMin = 0.02 * pitch4 * pitch4, aMax = 0.6 * pitch4 * pitch4;
  for (let s0 = 0; s0 < w * h; s0++) {
    if (seen[s0] || inkMap[s0] < 18) continue;
    stack.length = 0;
    stack.push(s0);
    seen[s0] = 1;
    let area = 0, sx = 0, sy = 0, ink = 0;
    let mnX = w, mxX = 0, mnY = h, mxY = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      area++;
      sx += x * inkMap[i]; sy += y * inkMap[i]; ink += inkMap[i];
      if (x < mnX) mnX = x;
      if (x > mxX) mxX = x;
      if (y < mnY) mnY = y;
      if (y > mxY) mxY = y;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || inkMap[j] < 18) continue;
        if (Math.abs((j % w) - x) > 1) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (area < aMin || area > aMax) continue;
    const bw = mxX - mnX + 1, bh = mxY - mnY + 1;
    if (Math.max(bw, bh) / Math.min(bw, bh) > 2.2) continue;
    const gx = sx / ink, gy = sy / ink;
    // 白亮邻域环 (半径 1.6× blob 半径): 均亮度须高 (白贴纸上)
    const rr = Math.max(bw, bh) * 0.8 + 6;
    let ringSum = 0, ringN = 0;
    for (let a = 0; a < 16; a++) {
      const ang = (a * Math.PI) / 8;
      const px = Math.round(gx + rr * Math.cos(ang)), py = Math.round(gy + rr * Math.sin(ang));
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      const q = ((py + y0) * W4 + (px + x0)) * 3;
      ringSum += (rgb[q] + rgb[q + 1] + rgb[q + 2]) / 3;
      ringN++;
    }
    const ring = ringN ? ringSum / ringN : 0;
    if (ring < 150) continue;
    blobs.push({ x: gx + x0, y: gy + y0, area, ink, ring });
  }
  blobs.sort((a, b) => b.ink - a.ink);
  return blobs[0] ?? null;
}

const N = 64;
/** 以 (cx,cy) 为心, 图像轴旋 theta 采 patch (蓝墨通道, 双线性) */
function patchAt(rgb: Uint8Array, cx: number, cy: number, rad: number, theta: number): Float32Array {
  const out = new Float32Array(N * N);
  const ct = Math.cos(theta), st = Math.sin(theta);
  for (let vi = 0; vi < N; vi++) {
    const v = ((vi / (N - 1)) * 2 - 1) * rad;
    for (let ui = 0; ui < N; ui++) {
      const u = ((ui / (N - 1)) * 2 - 1) * rad;
      const x = cx + u * ct - v * st;
      const y = cy + u * st + v * ct;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      if (x0 < 0 || x0 >= W4 - 1 || y0 < 0 || y0 >= H4 - 1) continue;
      const fx = x - x0, fy = y - y0;
      let val = 0;
      for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as const) {
        const q = ((y0 + dy) * W4 + (x0 + dx)) * 3;
        val += wt * (rgb[q + 2] - (rgb[q] + rgb[q + 1]) / 2);
      }
      out[vi * N + ui] = val;
    }
  }
  return out;
}
function ncc(a: Float32Array, b: Float32Array): number {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
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
  tail4kCache.clear();
  tailRange = [spB - 12, spC + 14];

  const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as { w: number; h: number; frames: number[] };
  const lb = readFileSync(videoPath + ".framedump.bin");
  const lowBytes = meta.w * meta.h * 3;
  const lowAt = (i: number) => new Uint8Array(lb.buffer, lb.byteOffset + i * lowBytes, lowBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(lowAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask960 = activityMask(bgFrames, bg, meta.w, meta.h);
  const { grids } = extractTrackedFrames(lowAt, meta.frames.length, meta.w, meta.h, mask960, { calib: null, anchor: true });

  /** 帧 → (魔方粗中心 4K, pitch 4K); 无网格帧用最近有网格帧 */
  const roiOf = (fr: number): { cx: number; cy: number; p4: number } | null => {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < meta.frames.length; i++) {
      if (!grids[i]?.length) continue;
      const d = Math.abs(meta.frames[i] - fr);
      if (d < bd) { bd = d; bi = i; }
      if (d === 0) break;
    }
    if (bi < 0 || bd > 30) return null;
    const g = grids[bi][0].grid;
    const c = cellCenter(g, 1, 1);
    return { cx: c.x * S, cy: c.y * S, p4: g.pitch * S };
  };
  /** 在窗口内找 logo 帧列表: 每帧 4K 检测, 按环亮度排序取前 K (糊帧的蓝贴纸拖影
   * 墨量反而大 — v3 踩坑; 清晰 logo 的周围是干净亮白, 环亮才是"像 logo"的判据) */
  const findIn = (lo: number, hi: number, K = 3): { fr: number; blob: LogoBlob }[] => {
    const found: { fr: number; blob: LogoBlob }[] = [];
    for (let fr = lo; fr <= hi; fr++) {
      const roi = roiOf(fr);
      if (!roi) continue;
      const rgb = frame4k(videoPath, sf, fr);
      const blob = findLogoBlob(rgb, roi.cx, roi.cy, roi.p4 * 3.5, roi.p4);
      if (blob) found.push({ fr, blob });
    }
    return found.sort((a, b) => b.blob.ring - a.blob.ring).slice(0, K);
  };
  /** 帧对 4×90° 类 NCC (±24° 细扫吸收倾斜) */
  const clsOf = (A: { fr: number; blob: LogoBlob }, B: { fr: number; blob: LogoBlob }): number[] => {
    const rgbA = frame4k(videoPath, sf, A.fr);
    const rgbB = frame4k(videoPath, sf, B.fr);
    const rad = Math.sqrt(A.blob.area) * 1.15;
    const pA = patchAt(rgbA, A.blob.x, A.blob.y, rad, 0);
    const out: number[] = [];
    for (let k = 0; k < 4; k++) {
      let mx = -Infinity;
      for (let d = -24; d <= 24; d += 8) {
        const s = ncc(pA, patchAt(rgbB, B.blob.x, B.blob.y, rad, ((k * 90 + d) * Math.PI) / 180));
        if (s > mx) mx = s;
      }
      out.push(mx);
    }
    return out;
  };
  // fB 只许放下动作前 (紧跟末 split): 放下含整体旋转, 会把机体旋转混进 logo 测量
  const As = findIn(spB - 6, spB - 1);
  const Bs = findIn(spC, spC + 4);
  if (!As.length || !Bs.length) {
    console.log(`${sf[0]}: GT末步 ${gtM2}  logo 未找到 (fA=${As.length ? "✓" : "✗"} fB=${Bs.length ? "✓" : "✗"})`);
    continue;
  }
  // 多帧对平均 (最多 3×3 对) — 单对薄 margin 的噪声被平均掉
  const clsBest = [0, 0, 0, 0];
  let nPair = 0;
  for (const A of As) {
    for (const B of Bs) {
      const c = clsOf(A, B);
      for (let k = 0; k < 4; k++) clsBest[k] += c[k];
      nPair++;
    }
  }
  for (let k = 0; k < 4; k++) clsBest[k] /= nPair;
  const A = As[0], B = Bs[0];
  const order = clsBest.map((s, k) => ({ s, k })).sort((a, b) => b.s - a.s);
  // 自洽: fA 邻近帧应 0°
  let selfStr = "";
  const A2s = findIn(spB - 10, spB - 7, 1);
  if (A2s.length) {
    const sc = clsOf(A, A2s[0]);
    selfStr = `  | 自洽(f${A2s[0].fr}, 应0°): ${sc.indexOf(Math.max(...sc)) * 90}° [${sc.map((x) => x.toFixed(2)).join(",")}]`;
  }
  console.log(
    `${sf[0]}: GT末步 ${gtM2}  fA=f${A.fr}(墨${Math.round(A.blob.ink)}) fB=f${B.fr}(墨${Math.round(B.blob.ink)})` +
      `  NCC类[0,90,180,270] = ${clsBest.map((s) => s.toFixed(3)).join(", ")}  → ${order[0].k * 90}° (margin ${(order[0].s - order[1].s).toFixed(3)})${selfStr}`,
  );
  if (process.argv.includes("--dumpblob")) {
    console.log(`  blobA=(${Math.round(A.blob.x)},${Math.round(A.blob.y)}) 面积${A.blob.area} 环亮${Math.round(A.blob.ring)}  blobB=(${Math.round(B.blob.x)},${Math.round(B.blob.y)}) 面积${B.blob.area} 环亮${Math.round(B.blob.ring)}  4K范围[${tailRange[0]}..${tailRange[1]}]`);
  }
  measures[sf[0]] = { ncc: clsBest, fA: A.fr, fB: B.fr };
}
if (!ONLY) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(tmpDir, "logo-measure.json"), JSON.stringify(measures, null, 1));
  console.log(`\n已写 .tmp/logo-measure.json (${Object.keys(measures).length} 视频)`);
}
