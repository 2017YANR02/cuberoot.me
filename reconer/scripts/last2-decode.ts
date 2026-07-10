/**
 * last2-decode.ts — 倒数第一步判定器 (末两步联合 + 960 跟踪定位 + HD 重采色)。
 *
 * 设计 (tail-probe/tailhd-probe 多轮诊断的结论):
 *   ① 960×540 下末两段链化近零 (提取窗口局限 + 分辨率墙), 但**全程** 960 跟踪
 *      (extractTrackedFrames, 先验跨段传递) 尾窗逐帧覆盖 ~100%。HD 检测 (1080p
 *      重跑检测器) 反而脆 (复原后整面同色粘连被 maxArea 拒)。
 *      → 几何用全程 960 跟踪晶格, 颜色从 1080p 尾窗帧格心重采 (坐标 ×2)。
 *   ② 单判末一步信息不足: 尾窗常只有 U 视角窗口, U 系候选前态 U 面全纯白不可分,
 *      方向判别信息在 S0 期链里 — 而 S0 只有联合假设末两步 (m1,m2) 才确定。
 *      故联合打分 36×36 对, 再对 m1 边缘化 (max) 得末一步排名。
 *   ③ 证据: 尾链 (agree 链化 + 共识) 按 split 分期 {[spA,spB)→{S0,S1},
 *      [spB,spC)→{S1,OK}} 双端点语义 + ±1 格平移边缘化 + probs 双段独立通道;
 *      指派种子从收尾整色投票 (锚定), 全对共享取 max。
 *
 * 用法: npx tsx scripts/last2-decode.ts [--video 3] [--probs 1] [--shift -1.5] [--res 1920x1080]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ColorName } from "../src/reconstruct.ts";
import { assignsForFaces } from "../src/anchored-search.ts";
import { IDENTITY_PERM, invertPerm, permKey, physicalPerm } from "../src/rotation-perms.ts";
import { activityMask, cellCenter, medianBackground, sampleCell, type FaceObservation } from "../src/sticker-blobs.ts";
import { extractTrackedFrames } from "../src/lattice-track.ts";
import type { Perm } from "../src/cube-state.ts";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ONLY = argAt("--video");
const PROBS_W = parseFloat(argAt("--probs") ?? "1");
const SHIFT_PEN = parseFloat(argAt("--shift") ?? "-1.5");
// 边缘格渗色混合权: 斜视角下窗口边缘格常采到邻面贴纸 (负⑩(a) 的"错位读真色")。
// 渗色格是方向判别的真信号 (如 U2' 前后侧面顶行翻色), 按 halo 映射建模而非当噪声
const PB = parseFloat(argAt("--bleed") ?? "0.35");
// logo 通道 (logo-probe2 → .tmp/logo-measure.json): 白心 logo 旋转角直接给出
// "U 层转量" (U=+90/U2=180/U'=270/非U层=0, 经 3 视频校准的图像轴约定)。
// 融合: score += LOGO_W × (ncc[k_pred] − ncc_max), 无 logo 视频通道自动缺席
const LOGO_W = parseFloat(argAt("--logo") ?? "40");
// 末步宽层先验: 宽层收尾 vs 外层收尾只差一个整体旋转, 尾窗证据原理不可分
// (收尾是全色面, 分不出哪色朝相机), 而真实速拧几乎全用外层收尾 — 不可辨识对
// 用先验断, 生产中由已知打乱锚全局朝向后此先验自动失效
const WIDE_PEN = parseFloat(argAt("--widepen") ?? "-1");
// 混淆矩阵锐化温度: looConf 统计自 960 管线, HD 重采读数比它可信 (对角更强)。
// conf^γ 重归一化, γ>1 = 更信读数 → 压 R/O 塌缩下"错读解释太便宜"的问题
const CONF_TEMP = parseFloat(argAt("--conftemp") ?? "1.6");
const [W2, H2] = (argAt("--res") ?? "1920x1080").split("x").map(Number);
const SC = W2 / 960;
const DIAG = process.argv.includes("--diag");

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const FACES = ["U", "R", "F", "D", "L", "B"] as const;
const ASSIGNS_24: readonly (readonly number[])[] = FACES.flatMap((f) => assignsForFaces([f]));
const MOVES36: string[] = [...FACES, ...FACES.map((f) => f.toLowerCase())].flatMap((f) => [f, `${f}2`, `${f}'`]);

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}
interface DumpVideo { name: string; omega: number[]; confusion: Record<string, number> }
const dump = JSON.parse(readFileSync(join(import.meta.dirname, "..", ".tmp", "obs-dump.json"), "utf8")) as {
  videos: DumpVideo[];
};
function buildLogConf(videos: DumpVideo[], temp: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of videos) for (const [k, n] of Object.entries(v.confusion)) counts[k] = (counts[k] ?? 0) + n;
  const logConf: Record<string, number> = {};
  for (const gt of COLOR_NAMES) {
    let row = 0;
    for (const rd of COLOR_NAMES) row += counts[`${gt}${rd}`] ?? 0;
    // p^γ 重归一化 (γ>1 锐化对角)
    const ps = COLOR_NAMES.map((rd) => (((counts[`${gt}${rd}`] ?? 0) + 1) / (row + 6)) ** temp);
    const z = ps.reduce((a, b) => a + b, 0);
    COLOR_NAMES.forEach((rd, i) => { logConf[`${gt}${rd}`] = Math.log(ps[i] / z); });
  }
  return logConf;
}
/** 两帧网格一致 (real-eval agree 同款): 共同非空格 ≥4 且不一致 ≤1 */
const agree = (a: FaceObservation, b: FaceObservation): boolean => {
  let common = 0, bad = 0;
  for (let i = 0; i < 9; i++) {
    const ca = a.colors[i], cb = b.colors[i];
    if (!ca || !cb) continue;
    common++;
    if (ca !== cb && ++bad > 1) return false;
  }
  return common >= 4;
};
const SHIFT_VARIANTS: readonly (readonly [number, number, number])[] = SHIFT_PEN !== 0
  ? [[0, 0, 0], [0, 1, SHIFT_PEN], [0, -1, SHIFT_PEN], [1, 0, SHIFT_PEN], [-1, 0, SHIFT_PEN]]
  : [[0, 0, 0]];

// === cubie 签名 → halo 映射 (窗口边缘之外 = 邻面同块贴纸) ===
// 签名 = 6 个外层 90° 转动里"动到该 facelet"的面集合: 角块 3 面 / 棱块 2 面 /
// 中心 1 面, 同签名 = 同 cubie。窗口某边缘之外的可见贴纸 = 该边缘贴纸的同块
// 邻面 partner (纯置换群推导, 无需硬编码布局)。
const faceOfFacelet = (x: number): number => Math.floor(x / 9);
const SIG: number[] = (() => {
  const sig = new Array<number>(54).fill(0);
  for (let fi = 0; fi < 6; fi++) {
    const p = physicalPerm(FACES[fi]);
    for (let i = 0; i < 54; i++) if (p[i] !== i) sig[i] |= 1 << fi;
  }
  return sig;
})();
const CUBIE = new Map<number, number[]>();
for (let i = 0; i < 54; i++) {
  const arr = CUBIE.get(SIG[i]);
  if (arr) arr.push(i);
  else CUBIE.set(SIG[i], [i]);
}
const partnerOnFace = (x: number, g: number): number => {
  for (const y of CUBIE.get(SIG[x]) ?? []) if (y !== x && faceOfFacelet(y) === g) return y;
  return -1;
};
const otherFaceOfEdge = (edgeFacelet: number, f: number): number => {
  for (let fi = 0; fi < 6; fi++) if (fi !== f && SIG[edgeFacelet] & (1 << fi)) return fi;
  return -1;
};
interface Halo {
  /** 每窗口格的渗色候选 facelet (边缘格 1-2 个, 中心 0 个) */
  bleed: number[][];
  /** 平移出窗位置 (r+1)*5+(c+1) → halo facelet (双向出窗 = -1 按背景) */
  out: Int32Array;
}
const haloCache = new Map<number, Halo>();
function getHalo(ai: number): Halo {
  let h = haloCache.get(ai);
  if (h) return h;
  const assign = ASSIGNS_24[ai];
  const f = faceOfFacelet(assign[4]);
  // 窗口四方向邻面 (由中行/中列边缘棱贴纸唯一决定)
  const gTop = otherFaceOfEdge(assign[1], f);
  const gRight = otherFaceOfEdge(assign[5], f);
  const gBottom = otherFaceOfEdge(assign[7], f);
  const gLeft = otherFaceOfEdge(assign[3], f);
  const bleed: number[][] = [];
  for (let j = 0; j < 9; j++) {
    const r = (j / 3) | 0, c = j % 3;
    const cands: number[] = [];
    if (r === 0) cands.push(partnerOnFace(assign[j], gTop));
    if (r === 2) cands.push(partnerOnFace(assign[j], gBottom));
    if (c === 0) cands.push(partnerOnFace(assign[j], gLeft));
    if (c === 2) cands.push(partnerOnFace(assign[j], gRight));
    bleed.push(cands.filter((x) => x >= 0));
  }
  const out = new Int32Array(25).fill(-1);
  for (let k = 0; k < 3; k++) {
    out[(0) * 5 + (k + 1)] = partnerOnFace(assign[k], gTop); // r=-1
    out[(4) * 5 + (k + 1)] = partnerOnFace(assign[6 + k], gBottom); // r=3
    out[(k + 1) * 5 + 0] = partnerOnFace(assign[k * 3], gLeft); // c=-1
    out[(k + 1) * 5 + 4] = partnerOnFace(assign[k * 3 + 2], gRight); // c=3
  }
  h = { bleed, out };
  haloCache.set(ai, h);
  return h;
}
const rotsOfFace = (face: string | null): number[] => {
  if (!face) return ASSIGNS_24.map((_, i) => i);
  const fi = FACES.indexOf(face as (typeof FACES)[number]);
  return [fi * 4, fi * 4 + 1, fi * 4 + 2, fi * 4 + 3];
};
const adjacentFaces = (face: string): string[] => {
  const fi = FACES.indexOf(face as (typeof FACES)[number]);
  const opp = [3, 4, 5, 0, 1, 2][fi];
  return FACES.filter((_, i) => i !== fi && i !== opp);
};

const videosDir = join(import.meta.dirname, "..", "videos");
let nTop1 = 0, nJointTop1 = 0, nVid = 0;
const summary: string[] = [];

for (const dv of dump.videos) {
  if (ONLY && !dv.name.startsWith(ONLY)) continue;
  nVid++;
  const videoPath = join(videosDir, dv.name);
  const content = readFileSync(videoPath + ".splits.txt", "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const splitFrames = parseSplitFrames(content);
  const omega = dv.omega;

  // GT 末两步 (验证参照)
  const fullSeq = [...tokens, ...tailRotations];
  const moveToks = fullSeq.filter((x) => !ROTATION_TOKENS.has(x));
  const gtM2 = moveToks[moveToks.length - 1], gtM1 = moveToks[moveToks.length - 2];
  const gtKey2 = permKey(applyTo(IDENTITY_PERM, invertPerm(physicalPerm(gtM2))));

  // === HD 尾窗提取 (缓存 .tmp/) ===
  const spA = splitFrames[splitFrames.length - 3];
  const spB = splitFrames[splitFrames.length - 2];
  const spC = splitFrames[splitFrames.length - 1];
  const from = spA - 5, to = spC + 25;
  const binPath = join(import.meta.dirname, "..", ".tmp", `tailhd-${dv.name[0]}-${W2}.bin`);
  if (!existsSync(binPath)) {
    const args = [
      "-hide_banner", "-v", "error", "-threads", "12", "-i", videoPath,
      "-vf", `select=between(n\\,${from}\\,${to}),scale=${W2}:${H2}`,
      "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", binPath, "-y",
    ];
    const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (res.status !== 0) throw new Error(`ffmpeg failed on ${dv.name}`);
  }
  const frameBytes = W2 * H2 * 3;
  const nHd = Math.floor(statSync(binPath).size / frameBytes);
  const bin = readFileSync(binPath);
  const hdAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  // 全程 960 跟踪 (先验跨段传递 → 尾窗逐帧覆盖 ~100%)
  const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as { w: number; h: number; frames: number[] };
  const lb = readFileSync(videoPath + ".framedump.bin");
  const lowBytes = meta.w * meta.h * 3;
  const lowAt = (i: number) => new Uint8Array(lb.buffer, lb.byteOffset + i * lowBytes, lowBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(lowAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask960 = activityMask(bgFrames, bg, meta.w, meta.h);
  const { grids: gFull } = extractTrackedFrames(lowAt, meta.frames.length, meta.w, meta.h, mask960, {
    calib: null,
    anchor: true,
  });
  // 尾窗: 960 晶格 ×SC 作初值, HD 帧上亚格对齐精修 (搜平移 ±1.3 格; 目标 =
  // 格内色一致性 + 格间隙黑线暗度 — 错位半格会跨缝混色, 整片同色区域没有黑缝),
  // 修掉负⑩(a) 的重获取平移漂移后再重采格心色
  const classifyHsv = (rr: number, gg: number, bb: number): ColorName | null => {
    const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
    const v = mx, s = mx === 0 ? 0 : (255 * (mx - mn)) / mx;
    if (s < 40 && v > 170) return "W";
    if (v < 60 || s < 45) return null;
    const d = mx - mn;
    let hh = 0;
    if (mx === rr) hh = (60 * (gg - bb)) / d / 2;
    else if (mx === gg) hh = (120 + (60 * (bb - rr)) / d) / 2;
    else hh = (240 + (60 * (rr - gg)) / d) / 2;
    if (hh < 0) hh += 180;
    if (hh < 8 || hh >= 168) return "R";
    if (hh < 22) return "O";
    if (hh < 38) return "Y";
    if (hh < 85) return "G";
    if (hh >= 95 && hh < 135) return "B";
    return null;
  };
  const refineHD = (rgb: Uint8Array, grid: FaceObservation["grid"]) => {
    const p2 = grid.pitch * SC;
    const base: { x: number; y: number }[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const { x, y } = cellCenter(grid, r, c);
        base.push({ x: x * SC, y: y * SC });
      }
    const rad = Math.max(4, Math.round(p2 * 0.2));
    const stepPx = Math.max(2, Math.round(rad / 6));
    const evalAt = (dx: number, dy: number): number => {
      let cellScore = 0;
      for (const bc of base) {
        const cx = bc.x + dx, cy = bc.y + dy;
        const counts = new Map<ColorName, number>();
        let tot = 0;
        for (let y = Math.round(cy - rad); y <= cy + rad; y += stepPx) {
          if (y < 0 || y >= H2) continue;
          for (let x = Math.round(cx - rad); x <= cx + rad; x += stepPx) {
            if (x < 0 || x >= W2) continue;
            const q = (y * W2 + x) * 3;
            tot++;
            const cc = classifyHsv(rgb[q], rgb[q + 1], rgb[q + 2]);
            if (cc) counts.set(cc, (counts.get(cc) ?? 0) + 1);
          }
        }
        if (!tot) continue;
        let mx = 0;
        for (const n of counts.values()) if (n > mx) mx = n;
        cellScore += mx / tot;
      }
      // 格间隙黑线: 相邻格心中点应是暗缝 (12 条内缝)
      let dark = 0, nGap = 0;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          for (const [r2, c2] of [[r, c + 1], [r + 1, c]] as const) {
            if (r2 > 2 || c2 > 2) continue;
            const a = base[r * 3 + c], b = base[r2 * 3 + c2];
            const gx = Math.round((a.x + b.x) / 2 + dx), gy = Math.round((a.y + b.y) / 2 + dy);
            if (gx < 0 || gx >= W2 || gy < 0 || gy >= H2) continue;
            nGap++;
            const q = (gy * W2 + gx) * 3;
            const v = Math.max(rgb[q], rgb[q + 1], rgb[q + 2]);
            if (v < 90) dark++;
          }
        }
      return cellScore + (nGap ? 1.5 * (9 * dark) / nGap : 0) / 9 * 1.5;
    };
    // 亚格精修 ±0.4 格 (整格漂移交给 shift 边缘化 — 搜索范围过格会跳上邻面/
    // 整色面的等优对齐): 粗 (步 p/8) → 细 (±p/8 步 p/12)
    let bx = 0, by = 0, bs = -Infinity;
    const R1 = 0.4 * p2, S1 = p2 / 8;
    for (let dy = -R1; dy <= R1; dy += S1)
      for (let dx = -R1; dx <= R1; dx += S1) {
        const s = evalAt(dx, dy);
        if (s > bs) { bs = s; bx = dx; by = dy; }
      }
    const R2 = p2 / 8, S2 = Math.max(1, p2 / 12);
    let fx = bx, fy = by;
    for (let dy = by - R2; dy <= by + R2; dy += S2)
      for (let dx = bx - R2; dx <= bx + R2; dx += S2) {
        const s = evalAt(dx, dy);
        if (s > bs) { bs = s; fx = dx; fy = dy; }
      }
    return { dx: fx, dy: fy };
  };
  const nTail = nHd;
  const grids: FaceObservation[][] = Array.from({ length: nTail }, () => []);
  for (let i = 0; i < meta.frames.length; i++) {
    const fr = meta.frames[i];
    const hi = fr - from;
    if (hi < 0 || hi >= nHd) continue;
    const rgb = hdAt(hi);
    for (const obs of gFull[i] ?? []) {
      const { dx, dy } = refineHD(rgb, obs.grid);
      const colors: (ColorName | null)[] = new Array(9).fill(null);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const { x, y } = cellCenter(obs.grid, r, c);
          colors[r * 3 + c] = sampleCell(rgb, W2, H2, x * SC + dx, y * SC + dy, obs.grid.pitch * SC * 0.22);
        }
      }
      grids[hi].push({ ...obs, colors });
    }
  }

  // === 链化 + 共识 (MIN_RUN 2, 桥接 ≤2) ===
  interface TailChain { read: (ColorName | null)[]; from: number; to: number; cy: number }
  const chains: TailChain[] = [];
  {
    let chain: FaceObservation[] = [], sFrame = -1, lastFrame = -1, gap = 0;
    const flush = () => {
      if (chain.length >= 2) {
        const read: (ColorName | null)[] = [];
        for (let c = 0; c < 9; c++) {
          const tally = new Map<ColorName, number>();
          let tot = 0;
          for (const g of chain) {
            const col = g.colors[c];
            if (!col) continue;
            tot++;
            tally.set(col, (tally.get(col) ?? 0) + 1);
          }
          const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
          read.push(top && top[1] >= 2 && top[1] > tot * 0.6 ? top[0] : null);
        }
        if (read.filter(Boolean).length >= 5) {
          let cy = 0;
          for (const g of chain) cy += g.grid.origin.y + g.grid.v1.y + g.grid.v2.y;
          chains.push({ read, from: from + sFrame, to: from + lastFrame, cy: cy / chain.length });
        }
      }
      chain = []; sFrame = -1; lastFrame = -1; gap = 0;
    };
    for (let i = 0; i < nTail; i++) {
      const gs = grids[i] ?? [];
      if (!gs.length) {
        if (sFrame >= 0 && ++gap > 2) flush();
        continue;
      }
      if (sFrame < 0) { sFrame = i; lastFrame = i; chain = [gs[0]]; continue; }
      const cont = gs.find((g) => agree(chain[chain.length - 1], g));
      if (cont) { chain.push(cont); lastFrame = i; gap = 0; continue; }
      flush();
      sFrame = i; lastFrame = i; chain = [gs[0]];
    }
    flush();
  }

  // === 锚定: 收尾链 (≥spC) 整色投票 → 窗口面; 期归属按链中心帧 ===
  const faceColorOf = (f: number): ColorName => COLOR_NAMES[Math.floor(omega[f * 9 + 4] / 9)];
  const tally = new Map<ColorName, number>();
  for (const c of chains) {
    if ((c.from + c.to) / 2 < spC) continue;
    for (const r of c.read) if (r) tally.set(r, (tally.get(r) ?? 0) + 1);
  }
  let winFace: string | null = null;
  if (tally.size) {
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    const fi = FACES.findIndex((_, i) => faceColorOf(i) === top[0]);
    winFace = fi >= 0 ? FACES[fi] : null;
  }
  const wfArg = argAt("--winface");
  if (wfArg) winFace = wfArg === "null" ? null : wfArg;
  // 已试并回撤: 投票面对面也进种子 (放下 y 族旋转翻面, v1 的下窗口 F→B) —
  // 额外自由度让错误候选同样受益, v1 未解反把 v3 挤掉 (过拟合双刃剑)
  const seeds: [number, number][] = [];
  const f1Cands = winFace ? adjacentFaces(winFace) : [null];
  for (const a0 of rotsOfFace(winFace)) for (const f1 of f1Cands) for (const a1 of rotsOfFace(f1)) seeds.push([a0, a1]);

  // === 评分基元 ===
  const looConf = buildLogConf(dump.videos.filter((x) => x.name !== dv.name), CONF_TEMP);
  const logBg: Record<string, number> = {};
  for (const rd of COLOR_NAMES) {
    let s = 0;
    for (const gt of COLOR_NAMES) s += Math.exp(looConf[`${gt}${rd}`]) / 6;
    logBg[rd] = Math.log(s);
  }
  const predColor = (state: Perm, f: number): ColorName => COLOR_NAMES[Math.floor(omega[state[f]] / 9)];
  const chainLL = (read: (ColorName | null)[], state: Perm, ai: number): number => {
    const assign = ASSIGNS_24[ai];
    const halo = getHalo(ai);
    let best = -Infinity;
    for (const [dr, dc, pen] of SHIFT_VARIANTS) {
      let s = pen;
      for (let i = 0; i < 9; i++) {
        const rd = read[i];
        if (!rd) continue;
        const r = ((i / 3) | 0) + dr, c = (i % 3) + dc;
        if (r >= 0 && r < 3 && c >= 0 && c < 3) {
          const j = r * 3 + c;
          const pOn = Math.exp(looConf[`${predColor(state, assign[j])}${rd}`]);
          const cands = halo.bleed[j];
          if (cands.length) {
            let pH = 0;
            for (const hf of cands) pH += Math.exp(looConf[`${predColor(state, hf)}${rd}`]);
            s += Math.log((1 - PB) * pOn + PB * (pH / cands.length));
          } else s += Math.log(pOn);
        } else {
          const hf = halo.out[(r + 1) * 5 + (c + 1)];
          const pBg = Math.exp(logBg[rd]);
          const pH = hf >= 0 ? Math.exp(looConf[`${predColor(state, hf)}${rd}`]) : pBg;
          s += Math.log(0.5 * pH + 0.5 * pBg);
        }
      }
      if (s > best) best = s;
    }
    return best;
  };
  const probsArr: Record<string, number>[] = PROBS_W > 0
    ? (JSON.parse(readFileSync(videoPath + ".probs.json", "utf8")) as Record<string, number>[])
    : [];
  // probs 段索引: 用 probs 自身长度对齐末两段 (moveToks 数在有 y 段/复合段时
  // 与段数不等, nSeg-1 索引会错位)
  const nSeg = probsArr.length || moveToks.length;
  const probsLL = (t: number, move: string): number =>
    PROBS_W > 0 ? PROBS_W * Math.log(Math.max(probsArr[t]?.[move[0].toUpperCase()] ?? 0, 0.02)) : 0;
  // logo 通道: 末步 U 层转量 → NCC 类打分差
  const logoPath = join(import.meta.dirname, "..", ".tmp", "logo-measure.json");
  const logoNcc: number[] | null = LOGO_W > 0 && existsSync(logoPath)
    ? ((JSON.parse(readFileSync(logoPath, "utf8")) as Record<string, { ncc: number[] }>)[dv.name[0]]?.ncc ?? null)
    : null;
  const logoMax = logoNcc ? Math.max(...logoNcc) : 0;
  const logoLL = (m2: string): number => {
    if (!logoNcc) return 0;
    const k = m2[0].toUpperCase() !== "U" ? 0 : m2.endsWith("2") ? 2 : m2.endsWith("'") ? 3 : 1;
    return LOGO_W * (logoNcc[k] - logoMax);
  };

  // === 联合打分 (m1, m2): 期分类 {S0,S1} / {S1,OK} / OK(常数, 略) ===
  // spA 之前的链属更早状态 (S₋₁, 假设无关) 排除; 跨进放下期 (>spC+3) 的链吃
  // 放下垃圾, 也排除 (收尾锚已由 winFace 投票承担)
  const mid = (c: TailChain) => (c.from + c.to) / 2;
  const chP0 = chains.filter((c) => mid(c) >= spA && mid(c) < spB);
  const chP1 = chains.filter((c) => mid(c) >= spB && mid(c) < spC && c.to <= spC + 3);
  interface Joint { m1: string; m2: string; score: number }
  const joints: Joint[] = [];
  const invCache = new Map<string, Perm>();
  const getInv = (tok: string): Perm => {
    let p = invCache.get(tok);
    if (!p) { p = invertPerm(physicalPerm(tok)); invCache.set(tok, p); }
    return p;
  };
  for (const m2 of MOVES36) {
    const s1 = applyTo(IDENTITY_PERM, getInv(m2));
    for (const m1 of MOVES36) {
      if (m1[0].toUpperCase() === m2[0].toUpperCase()) continue; // 相邻同面必并段
      const s0 = applyTo(s1, getInv(m1));
      let best = -Infinity;
      for (const [a0, a1] of seeds) {
        let ev = 0;
        for (const c of chP0) {
          let b = -Infinity;
          for (const ai of [a0, a1]) {
            const s = Math.max(chainLL(c.read, s0, ai), chainLL(c.read, s1, ai));
            if (s > b) b = s;
          }
          ev += b;
        }
        for (const c of chP1) {
          let b = -Infinity;
          for (const ai of [a0, a1]) {
            const s = Math.max(chainLL(c.read, s1, ai), chainLL(c.read, IDENTITY_PERM, ai));
            if (s > b) b = s;
          }
          ev += b;
        }
        if (ev > best) best = ev;
      }
      const widePen = m2[0] >= "a" ? WIDE_PEN : 0; // 末步宽层 (小写首字母)
      joints.push({ m1, m2, score: best + probsLL(nSeg - 2, m1) + probsLL(nSeg - 1, m2) + logoLL(m2) + widePen });
    }
  }
  joints.sort((a, b) => b.score - a.score);

  // m2 边缘化 (前态等价类: U2≡U2')
  const cls = new Map<string, { moves: string[]; score: number }>();
  for (const j of joints) {
    const key = permKey(applyTo(IDENTITY_PERM, getInv(j.m2)));
    const c = cls.get(key);
    if (!c) cls.set(key, { moves: [j.m2], score: j.score });
    else {
      if (!c.moves.includes(j.m2)) c.moves.push(j.m2);
      c.score = Math.max(c.score, j.score);
    }
  }
  const ranked = [...cls.entries()].sort((a, b) => b[1].score - a[1].score);
  const gtRank = ranked.findIndex(([k]) => k === gtKey2);
  const margin = gtRank === 0
    ? ranked.length > 1 ? ranked[0][1].score - ranked[1][1].score : Infinity
    : ranked[gtRank][1].score - ranked[0][1].score;
  if (gtRank === 0) nTop1++;
  const gtJointRank = joints.findIndex(
    (j) => permKey(applyTo(IDENTITY_PERM, getInv(j.m2))) === gtKey2 &&
      permKey(applyTo(applyTo(IDENTITY_PERM, getInv(j.m2)), getInv(j.m1))) ===
        permKey(applyTo(applyTo(IDENTITY_PERM, getInv(gtM2)), getInv(gtM1))),
  );
  if (gtJointRank === 0) nJointTop1++;

  console.log(`\n=== ${dv.name}  GT 末两步 ${gtM1} ${gtM2}  (链 P0:${chP0.length} P1:${chP1.length} 收尾:${chains.length - chP0.length - chP1.length}, 窗口面 ${winFace}, 种子 ${seeds.length}) ===`);
  if (DIAG) {
    for (const c of chains) {
      const per = (c.from + c.to) / 2 < spB ? "P0" : (c.from + c.to) / 2 < spC ? "P1" : "收尾";
      console.log(`  [链 ${per}] f${c.from}-${c.to}  ${c.read.map((x) => x ?? ".").join("")}`);
    }
    // GT vs top1 逐链得分明细 (最优种子下)
    const diagJoint = (m1: string, m2: string, tag: string) => {
      const s1 = applyTo(IDENTITY_PERM, getInv(m2));
      const s0 = applyTo(s1, getInv(m1));
      let bestSeed: [number, number] = seeds[0];
      let bs = -Infinity;
      for (const [a0, a1] of seeds) {
        let ev = 0;
        for (const c of chP0) ev += Math.max(...[a0, a1].flatMap((ai) => [chainLL(c.read, s0, ai), chainLL(c.read, s1, ai)]));
        for (const c of chP1) ev += Math.max(...[a0, a1].flatMap((ai) => [chainLL(c.read, s1, ai), chainLL(c.read, IDENTITY_PERM, ai)]));
        if (ev > bs) { bs = ev; bestSeed = [a0, a1]; }
      }
      const [a0, a1] = bestSeed;
      const parts: string[] = [];
      for (const [pool, states, nm] of [[chP0, [s0, s1], "P0"], [chP1, [s1, IDENTITY_PERM], "P1"]] as const) {
        for (const c of pool) {
          let bl = -Infinity, bst = "";
          for (const ai of [a0, a1]) {
            for (let si = 0; si < states.length; si++) {
              const v = chainLL(c.read, states[si], ai);
              if (v > bl) {
                bl = v;
                bst = `${nm}${si} ${ASSIGNS_24[ai].map((f) => predColor(states[si], f)).join("")}`;
              }
            }
          }
          parts.push(`${c.read.map((x) => x ?? ".").join("")}⟵${bst}:${bl.toFixed(1)}`);
        }
      }
      console.log(`  [${tag} ${m1}·${m2}] 总${bs.toFixed(1)} probs ${probsLL(nSeg - 2, m1).toFixed(1)}/${probsLL(nSeg - 1, m2).toFixed(1)} logo ${logoLL(m2).toFixed(1)}\n    ${parts.join("\n    ")}`);
    };
    diagJoint(gtM1, gtM2, "GT");
    if (joints.length) diagJoint(joints[0].m1, joints[0].m2, "top1");
  }
  ranked.slice(0, 5).forEach(([k, c], i) => {
    console.log(`  #${i + 1} ${c.score.toFixed(1).padStart(8)}  ${c.moves.join("≡")}${k === gtKey2 ? "  ← GT" : ""}`);
  });
  if (gtRank >= 5) console.log(`  ...
  #${gtRank + 1} ${ranked[gtRank][1].score.toFixed(1).padStart(8)}  ${ranked[gtRank][1].moves.join("≡")}  ← GT`);
  console.log(`  联合 top3: ${joints.slice(0, 3).map((j) => `${j.m1}·${j.m2}(${j.score.toFixed(1)})`).join("  ")}  | GT 联合排名 ${gtJointRank + 1}`);
  summary.push(`${dv.name[0]}: ${gtM1} ${gtM2} → 末步排名 ${gtRank + 1}/${ranked.length} (margin ${margin === Infinity ? "∞" : margin.toFixed(1)}), 联合 ${gtJointRank + 1}`);
}

console.log(`\n====== 汇总 (probs=${PROBS_W}, shift=${SHIFT_PEN}, ${W2}×${H2}) ======`);
for (const s of summary) console.log(`  ${s}`);
console.log(`末步排第 1: ${nTop1}/${nVid}, 联合排第 1: ${nJointTop1}/${nVid}`);
