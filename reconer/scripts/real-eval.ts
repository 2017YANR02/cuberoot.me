/**
 * real-eval.ts — 真实提取评测: 静止区间观测 + 指派边缘化准确率 + 端到端锚定搜索。
 *
 * 观测模型 (每视频):
 *   1. GT 物理回放 → 每 token 段起点空间态 (真值)
 *   2. 全程连续 framedump 逐帧提取 → 静止区间检测 (跨帧网格一致 = 魔方静止,
 *      状态有定义; 中途模糊/错位帧不会形成稳定区间, 从源头挡毒观测)
 *   3. 区间共识网格 (逐格跨帧多数) → 归属唯一 split 边界; 无区间的边界诚实置空
 *   4. 指派边缘化比对: 常数颜色重标 κ (24 候选, 全局拟合) × 每边界 24 指派取 max
 *   5. --search: 区间观测 + probs 喂 anchoredBeamSearch (rawFaces 限面)
 *
 * 用法: npx tsx scripts/real-eval.ts [--search] [--video 3] [--faces B,U]
 *       [--beam 2048] [--hist] [--minrun 3]
 */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ProbDist, ColorName } from "../src/reconstruct.ts";
import {
  anchoredBeamSearch,
  assignsForFaces,
  normalizeToken,
  type RawFaceObs,
} from "../src/anchored-search.ts";
import { IDENTITY_PERM, ORIENTATION_PERMS, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import {
  activityMask,
  cellCenter,
  medianBackground,
  sampleCell,
  type FaceObservation,
} from "../src/sticker-blobs.ts";
import { extractTrackedFrames } from "../src/lattice-track.ts";
import { refineHD } from "../src/hd-refine.ts";
import {
  blockMedianRGB,
  calibClassify as calibClassifyDiag,
  calibSummary,
  classProbs,
  COLOR_LIST,
  fitColorCalib,
  type ColorCalib,
  type ColorSample,
} from "../src/color-calib.ts";

const DO_SEARCH = process.argv.includes("--search");
const DO_HIST = process.argv.includes("--hist"); // 逐区间/逐边界明细
const vArg = process.argv.indexOf("--video");
const ONLY = vArg >= 0 ? process.argv[vArg + 1] : null;
const beamArg = process.argv.indexOf("--beam");
const BEAM = beamArg >= 0 ? parseInt(process.argv[beamArg + 1], 10) : 2048;
const mrArg = process.argv.indexOf("--minrun");
const MIN_RUN = mrArg >= 0 ? parseInt(process.argv[mrArg + 1], 10) : 3;
const maArg = process.argv.indexOf("--minarea");
const MIN_AREA = maArg >= 0 ? parseInt(process.argv[maArg + 1], 10) : undefined;
const STRICT = process.argv.includes("--strict"); // 链一致性零容错 (防跨拧转混态)
const NO_ANCHOR = process.argv.includes("--noanchor"); // 复刻 legacy 提取 (无重获取锚定) 供 A/B
const dumpObsArg = process.argv.indexOf("--dumpobs");
const DUMP_OBS = dumpObsArg >= 0 ? process.argv[dumpObsArg + 1] : null; // 转储对齐观测+混淆 (供 prior-sim)
const DUMP_BLOCKS = process.argv.includes("--dumpblocks"); // 转储每标注格原始像素块 (供 color-lab 离线试聚合策略)
const KNN_CLS = process.argv.includes("--knncls"); // 标定分类器用 kNN (Lab) 替对角高斯 (欠债 ~19 点); 需与 --calib/--calibgt 同用
// HD 重采 (正⑮ 全程化): 几何仍用 960 跟踪晶格, 颜色从原片高分辨率帧格心重采
// (ffmpeg 流式解码, 零磁盘缓存)。链形成/agree 仍用 960 vivid 保覆盖, 共识用 hdColors。
// 注意: 与高斯 --calib 的 pass2 重提取不叠 (grids 被替换丢 hdColors); kNN attach 可叠。
const hdArg = process.argv.indexOf("--hdres");
const HD_RES = hdArg >= 0
  ? (/^\d+x\d+$/.test(process.argv[hdArg + 1] ?? "") ? process.argv[hdArg + 1] : "1920x1080")
  : null;
// HD 亚格精修: 重采前先在 HD 帧上搜 ±0.4 格平移修晶格错位 (负⑩(a) 主噪声)
const HD_REFINE = process.argv.includes("--hdrefine");
// 链形成/agree 也用 HD 色 (覆盖实验): vivid 960 读不出的糊格 HD 可读 →
// 快转段可能成链。风险 = HD 逐帧抖动断链 (kNN 的教训), 用数据判
const HD_AGREE = process.argv.includes("--hdagree");
// 逐帧格 veto (正⑱ 阶段1): 共识投票前, 格心块 RGB 经 kNN 判"毒"(衣服/手/背景) 的
// 帧票剥夺。训练池 = VLM 普查标注 (scripts/vlm-census-cells.json), 分类时留一排除
// 本视频样本 (防自证)。外套格全程毒→格自然清零; 手指格瞬时毒→干净帧存活。
// 值 = 判毒票阈 (kNN k=5 毒票占比 ≥ 此值即剥夺), 0 = 关闭 (默认, 基线不变)。
const vetoArg = process.argv.indexOf("--cellveto");
const CELL_VETO = vetoArg >= 0 ? parseFloat(process.argv[vetoArg + 1] ?? "0.6") : 0;
// 魔方地理围栏 (正⑱ 阶段2, 用户"先造工具识别图中哪里是魔方"): 每链帧以晶格为
// 中心粗扫 ROI, kNN 把块标 毒(衣/手/背景)/暗(格缝, 中性)/魔方色, 非毒块 4 连通,
// 格心不落在"含 ≥3 魔方色块的连通域"内的帧票剥夺。与 --cellveto 互补: cellveto
// 孤立看单格色 (悬在外套上但色似贴纸的格漏网), geofence 用空间上下文杀。
// 只进 veto 轨 (链存在性/锚点/κ 不碰)。值 = 块判毒票阈, 0 = 关 (默认, 基线不变)。
const geoArg = process.argv.indexOf("--geofence");
const GEO_THR = geoArg >= 0 ? parseFloat(process.argv[geoArg + 1] ?? "0.6") : 0;
const PER_FRAME = process.argv.includes("--perframe"); // 跳过链, 逐帧网格直接喂搜索
const PIN_MODE = process.argv.includes("--pin"); // 路径级指派钉死
const DRIFT = process.argv.includes("--drift"); // 钉死 + 段间漂移切换 (隐含 --pin)
const TRACE = process.argv.includes("--trace"); // GT 路径在 beam 中的逐段存活排名
const junkArg = process.argv.indexOf("--junk");
const JUNK_P = junkArg >= 0 ? parseFloat(process.argv[junkArg + 1]) : 0; // 鲁棒垃圾混合权
const FORWARD = process.argv.includes("--forward"); // 正向搜索 (从打乱态出发)
// 神谕观测标定: 保持真实链的覆盖模式 (段位/条数/读格 mask), 内容换成 GT 态读数
// 并按指定准确率注噪 — 定位"现有覆盖 + probs 赤字下视觉层需要多准才锚定"
const oraArg = process.argv.indexOf("--oracleobs");
const ORACLE_ACC = oraArg >= 0 ? parseFloat(process.argv[oraArg + 1]) : 0;
// 全覆盖双窗口神谕: 每段 B+U 两张 9 格网格 (两面联合模型的理论上界)
const ORACLE_FULL = process.argv.includes("--oraclefull");
const ORACLE_SINGLE = process.argv.includes("--oraclesingle");
// 每视频颜色自标定 (两遍提取: pass1 默认阈值收标注样本 → 拟合 → pass2 标定重提取)
// --calib   合法样本: 观察期帧 (已知打乱态) + 收尾帧 (已知复原态), 生产可用
// --calibgt 天花板: 全段 GT 双端态收样本 (诊断用 — GT 标定都救不了就放弃此路)
const CALIB_LEGIT = process.argv.includes("--calib");
const CALIB_GT = process.argv.includes("--calibgt");
// --calibpool 生产界: 用其它视频的 GT 标注样本池 (留一) 建全局 kNN 应用到本视频。
// = "一次性标注语料训色, 部署到新视频" (无本视频 GT), 与解码器 buildLogConf 留一同法学。
// 前置: 先跑 --calibgt --dumpsamples 产 .tmp/calib-samples-*.json。隐含 kNN。
const CALIB_POOL = process.argv.includes("--calibpool");
// 软观测神谕: 满覆盖单 B 窗口, 逐格从该视频 GT 样本池抽真实特征 → 标定高斯
// 逐类似然 → 归一化概率向量 (真特征噪声 + 合成指派)。回答"软通道能否过墙",
// 不碰提取器。需与 --calibgt (或 --calib) 同用以拟合标定与样本池。
const ORACLE_SOFT = process.argv.includes("--oraclesoft");
const stArg = process.argv.indexOf("--softtemper");
const SOFT_TEMPER = stArg >= 0 ? parseFloat(process.argv[stArg + 1]) : 1;
const facesArg = process.argv.indexOf("--faces");
type FaceName = "U" | "R" | "F" | "D" | "L" | "B";
const SEARCH_FACES = (facesArg >= 0 ? process.argv[facesArg + 1] : "B,U").split(",") as FaceName[];

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const ALL_FACES: readonly FaceName[] = ["U", "R", "F", "D", "L", "B"];
const ASSIGNS = ALL_FACES.flatMap((f) => assignsForFaces([f]).map((assign) => ({ face: f, assign })));

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/** 格心小块所有像素 (flat RGB 三元组), 供 color-lab 离线试各聚合策略/色彩空间 */
function extractBlock(rgb: Uint8Array, w: number, h: number, cx: number, cy: number, radius: number): number[] {
  const x0 = Math.max(0, Math.round(cx - radius));
  const x1 = Math.min(w - 1, Math.round(cx + radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const y1 = Math.min(h - 1, Math.round(cy + radius));
  const out: number[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const p = (y * w + x) * 3;
      out.push(rgb[p], rgb[p + 1], rgb[p + 2]);
    }
  return out;
}

/**
 * 指派边缘化最优匹配: 相机网格 vs 空间态, max over 6面×4旋转。
 * omega = 常数颜色重标 κ 对应的朝向置换 (相机系 = κ∘GT 系, 共轭的外侧半,
 * 不被指派 max 吸收, 须按视频拟合)。
 */
function bestAssign(
  colors: readonly (ColorName | null)[],
  state: readonly number[],
  omega: readonly number[],
): { match: number; read: number; face: FaceName; rot: number } {
  let best = { match: -1, read: 0, face: "B" as FaceName, rot: 0 };
  for (let ai = 0; ai < ASSIGNS.length; ai++) {
    const { face, assign } = ASSIGNS[ai];
    let m = 0, rd = 0;
    for (let i = 0; i < 9; i++) {
      const c = colors[i];
      if (!c) continue;
      rd++;
      if (COLOR_NAMES[Math.floor(omega[state[assign[i]] ] / 9)] === c) m++;
    }
    if (m > best.match) best = { match: m, read: rd, face, rot: ai % 4 };
  }
  return best;
}

/** 静止区间: [from,to] 帧号闭区间 + 共识网格 */
interface RestRun {
  from: number;
  to: number;
  len: number;
  grid: (ColorName | null)[];
  /** 跟踪 span (prior 被杀重新冷获取才递增); 基连续化下 span 内面内旋转身份恒定 */
  span: number;
  /** 链帧运动量中位 (网格 bbox 帧间平均绝对差; 拧转中链的照妖镜) */
  motion: number;
  /** 链晶格中心 (画面像素, 链内均值) — 空间聚类 = 生产可得的窗口身份 */
  cx: number;
  cy: number;
  /** 链中间帧 index + 网格几何 (EM 探针 --dumpobs 重采样格心 RGB 用; 内部字段不序列化) */
  midI: number;
  midGrid: FaceObservation["grid"];
  /** 每格色块支撑率: 贡献颜色的帧里有实测色块 (grid.cells 非 null) 的占比。
   * 0 = 全程外插采样 (格心可能悬在衣服/手/背景上, 正⑱ 脱靶拒判判据) */
  sup: number[];
  /** --cellveto 双轨共识: 毒帧票剥夺后的读数, 只喂 dump bounds read (解码证据);
   * 链存在性/锚点 finals/κ 拟合全用原始 grid (veto 动锚会翻 v1 种子面) */
  gridVeto?: (ColorName | null)[];
  /** --geofence 诊断: 中帧 9 格心掩码成员位串 (如 "111011111", 对照普查逐格标签) */
  geoIn?: string;
}

/** 两帧网格一致: 共同非空格 ≥4 且不一致 ≤1 (--strict 零容错, 防跨拧转混态成链) */
function agree(a: FaceObservation, b: FaceObservation): boolean {
  const maxBad = STRICT ? 0 : 1;
  let common = 0, bad = 0;
  const va = HD_AGREE ? (a.hdColors ?? a.colors) : a.colors;
  const vb = HD_AGREE ? (b.hdColors ?? b.colors) : b.colors;
  for (let i = 0; i < 9; i++) {
    const ca = va[i], cb = vb[i];
    if (!ca || !cb) continue;
    common++;
    if (ca !== cb && ++bad > maxBad) return false;
  }
  return common >= 4;
}

interface VideoEval {
  name: string;
  nBounds: number;
  covered: number;
  margMatch: number;
  margRead: number;
  nullMatch: number;
  nullRead: number;
  rawObs: (RawFaceObs[] | null)[];
  /** 逐帧观测 (跳过链/共识; 每段 ≤8 个按可读格数排序的单帧网格) */
  rawObsFrames: (RawFaceObs[] | null)[];
  /** 神谕观测 (真实覆盖模式 + GT 内容 + 注噪; --oracleobs 标定用) */
  rawObsOracle: (RawFaceObs[] | null)[] | null;
  finalRawObsOracle: RawFaceObs | null;
  finalRawObs: RawFaceObs | null;
  probs: ProbDist[];
  scrambleSc: readonly number[];
  gtNoRot: string[];
  boundStates: readonly (readonly number[])[];
  /** 正向 trace 用: 第 t 段消费后的态 (= 段 t+1 起点; 末段后 = 复原) */
  afterStates: readonly (readonly number[])[];
}

// --cellveto 毒格分类器 (kNN k=5, z-score): 池 = VLM 普查标注格 (rgb + 毒/贴纸)。
// 返回毒票占比; 分类时排除与被测视频同源的样本 (留一防自证)。
let vetoKnn: ((rgb: { r: number; g: number; b: number }, vid: string) => number) | null = null;
if (CELL_VETO > 0 || GEO_THR > 0) {
  const rows = JSON.parse(
    readFileSync(join(import.meta.dirname, "vlm-census-cells.json"), "utf8"),
  ) as { v: string; rgb: [number, number, number]; bad: number }[];
  const feat = (r: number, g: number, b: number): number[] => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx ? ((mx - mn) / mx) * 255 : 0;
    let h = 0;
    if (mx > mn) {
      if (mx === r) h = (60 * (g - b)) / (mx - mn);
      else if (mx === g) h = 120 + (60 * (b - r)) / (mx - mn);
      else h = 240 + (60 * (r - g)) / (mx - mn);
      if (h < 0) h += 360;
    }
    return [h / 2, s, mx, r, g, b];
  };
  const pool = rows.map((r) => ({ v: r.v, bad: r.bad, f: feat(r.rgb[0], r.rgb[1], r.rgb[2]) }));
  const D = 6;
  const mu = new Array<number>(D).fill(0), sd = new Array<number>(D).fill(0);
  for (const s of pool) for (let d = 0; d < D; d++) mu[d] += s.f[d] / pool.length;
  for (const s of pool) for (let d = 0; d < D; d++) sd[d] += (s.f[d] - mu[d]) ** 2 / pool.length;
  for (let d = 0; d < D; d++) sd[d] = Math.sqrt(sd[d]) || 1;
  const zpool = pool.map((p) => ({ ...p, f: p.f.map((x, d) => (x - mu[d]) / sd[d]) }));
  vetoKnn = (rgb, vid) => {
    const zf = feat(rgb.r, rgb.g, rgb.b).map((x, d) => (x - mu[d]) / sd[d]);
    let best: { d: number; bad: number }[] = [];
    for (const p of zpool) {
      if (vid.startsWith(p.v)) continue;
      let dd = 0;
      for (let d = 0; d < D; d++) { const t = p.f[d] - zf[d]; dd += t * t; }
      if (best.length < 5) { best.push({ d: dd, bad: p.bad }); best.sort((a, b) => a.d - b.d); }
      else if (dd < best[4].d) { best[4] = { d: dd, bad: p.bad }; best.sort((a, b) => a.d - b.d); }
    }
    return best.reduce((a, x) => a + x.bad, 0) / best.length;
  };
  console.log(`cellveto: 票阈 ${CELL_VETO}, 训练池 ${pool.length} 格 (毒 ${pool.filter((p) => p.bad).length})`);
}

// 地理围栏掩码: 面心 ±3.6 pitch、步长 0.45 pitch 的粗块格, 每块 kNN 毒票率作
// "软毒场" — 单块硬标签用不上弱信号 (LOO 后外套块毒票常仅 1-2/5, 硬阈全漏),
// 但外套/皮肤是成片的低度可疑 (0.2-0.4), 魔方区 ~0.05-0.15, 3×3 块邻域平均后
// 分离 — 空间上下文的正确形式是软场平滑, 不是硬标签连通拓扑 (试过, 查杀仅 41%)。
// 暗块 (格缝黑线) 不计入平均。格心判死 = 邻域平滑毒率 ≥ GEO_THR。
function cubeMask(
  frame: Uint8Array, w: number, h: number,
  grid: FaceObservation["grid"], vid: string,
): (x: number, y: number) => boolean {
  const p = grid.pitch;
  const cx = grid.origin.x + grid.v1.x + grid.v2.x;
  const cy = grid.origin.y + grid.v1.y + grid.v2.y;
  const STEP = 0.45 * p, HALF = 3.6 * p;
  const N = Math.round((HALF * 2) / STEP) + 1;
  const x0 = cx - HALF, y0 = cy - HALF;
  const vote = new Float32Array(N * N).fill(-1); // -1 = 暗/出画 (不计入平均)
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const m = blockMedianRGB(frame, w, h, x0 + gx * STEP, y0 + gy * STEP, p * 0.2);
      if (!m || Math.max(m.r, m.g, m.b) < 40) continue;
      vote[gy * N + gx] = vetoKnn!(m, vid);
    }
  }
  return (x, y) => {
    const gx = Math.round((x - x0) / STEP), gy = Math.round((y - y0) / STEP);
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return false; // 出 ROI = 死
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const v = vote[ny * N + nx];
        if (v >= 0) { sum += v; n++; }
      }
    }
    return n > 0 && sum / n < GEO_THR;
  };
}

const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .filter((f) => !ONLY || f.startsWith(ONLY))
  .sort();

const evals: VideoEval[] = [];
const dumpVideos: object[] = [];

for (const sf of files) {
  const splitsPath = join(videosDir, sf);
  const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
  const dumpJson = videoPath + ".framedump.json";
  if (!existsSync(dumpJson)) {
    console.warn(`跳过 (无 dump): ${sf}`);
    continue;
  }
  const content = readFileSync(splitsPath, "utf8");
  const probs = JSON.parse(readFileSync(videoPath + ".probs.json", "utf8")) as ProbDist[];
  const { tokens, tailRotations } = parseGT(content);
  const gtNoRot = tokens.filter((t) => !ROTATION_TOKENS.has(t));
  const splitFrames = parseSplitFrames(content);

  // GT 物理回放 (相机系 = κ∘GT 记谱系, κ 由拟合吸收)
  const fullSeq = [...tokens, ...tailRotations];
  const startState: number[][] = new Array(fullSeq.length);
  let cur: number[] = [...IDENTITY_PERM];
  for (let j = fullSeq.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(fullSeq[j])));
    startState[j] = cur;
  }
  const scrambleSc = cur;
  const nonRotIdx = tokens.map((t, j) => (ROTATION_TOKENS.has(t) ? -1 : j)).filter((j) => j >= 0);
  const boundStates = nonRotIdx.map((j) => startState[j]); // probs 段起点态 (+末态另加)
  const finalState = IDENTITY_PERM;

  // dump 读取 (全程连续帧)
  const meta = JSON.parse(readFileSync(dumpJson, "utf8")) as { w: number; h: number; frames: number[] };
  const bin = readFileSync(videoPath + ".framedump.bin");
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);

  // 逐帧提取 (每帧 0-2 面): 共享锚定提取环 (src/lattice-track.ts) — 冷检测优先,
  // 失败时晶格跟踪; 默认带重获取一致性锚定 (--noanchor 复刻 legacy 供 A/B)。
  // 函数化: 标定模式跑两遍 (pass1 默认阈值收样本 → pass2 带 calib 重提取)
  const extractAllGrids = (calib: ColorCalib | null) =>
    extractTrackedFrames(frameAt, meta.frames.length, meta.w, meta.h, mask, {
      calib,
      minArea: MIN_AREA,
      anchor: !NO_ANCHOR,
    });
  let { grids, frameSpan, nCold, nTracked, anchor } = extractAllGrids(null);
  // HD 重采就地附加: 原片流式解码到 HD_RES, 逐帧按 960 晶格坐标 ×SC 格心重采,
  // 附 hdColors (不改链形成)。帧序 = select between 输出序 = meta.frames 序 (连续 dump)。
  if (HD_RES) {
    const [W2, H2] = HD_RES.split("x").map(Number);
    const SC = W2 / meta.w;
    const hdBytes = W2 * H2 * 3;
    const f0 = meta.frames[0], f1 = meta.frames[meta.frames.length - 1];
    const t0 = Date.now();
    const proc = spawn("ffmpeg", [
      "-hide_banner", "-v", "error", "-threads", "12", "-i", videoPath,
      "-vf", `select=between(n\\,${f0}\\,${f1}),scale=${W2}:${H2}`,
      "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
    ], { stdio: ["ignore", "pipe", "inherit"] });
    const fbuf = Buffer.allocUnsafe(hdBytes);
    let fi = 0, off = 0, attached = 0;
    const onFrame = () => {
      const i = fi++;
      if (i >= grids.length || !grids[i]?.length) return;
      const rgb = new Uint8Array(fbuf.buffer, fbuf.byteOffset, hdBytes);
      for (const obs of grids[i]) {
        const { dx, dy } = HD_REFINE ? refineHD(rgb, W2, H2, obs.grid, SC) : { dx: 0, dy: 0 };
        const hc: (ColorName | null)[] = new Array(9).fill(null);
        const hr: ([number, number, number] | null)[] = new Array(9).fill(null);
        const rad = obs.grid.pitch * SC * 0.22;
        for (let c = 0; c < 9; c++) {
          const { x, y } = cellCenter(obs.grid, (c / 3) | 0, c % 3);
          hc[c] = sampleCell(rgb, W2, H2, x * SC + dx, y * SC + dy, rad);
          const m = blockMedianRGB(rgb, W2, H2, x * SC + dx, y * SC + dy, rad);
          hr[c] = m ? [m.r, m.g, m.b] : null;
        }
        obs.hdColors = hc;
        obs.hdRgb = hr;
        attached++;
      }
    };
    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
      let cOff = 0;
      while (cOff < chunk.length) {
        const n = Math.min(hdBytes - off, chunk.length - cOff);
        chunk.copy(fbuf, off, cOff, cOff + n);
        off += n;
        cOff += n;
        if (off === hdBytes) { onFrame(); off = 0; }
      }
    }
    await new Promise<void>((res, rej) => {
      proc.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exit ${code} on ${videoPath}`))));
    });
    if (fi !== meta.frames.length) console.warn(`  WARN: HD 流出 ${fi} 帧, framedump ${meta.frames.length}`);
    console.log(`  HD 重采: ${fi} 帧 → ${attached} 网格附色 (${W2}×${H2}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  // 帧运动量: 网格 bbox 内与上帧的平均绝对差。100fps 下相邻模糊帧彼此相似,
  // agree() 挡不住拧转中帧成链 (目检 f1122: 大幅运动模糊 3 帧照样"稳定")。
  // 静止 vs 拧转在帧差上双峰, 这才是 rest 的物理定义; 超阈值帧不准进链。
  const buildRuns = (grids: FaceObservation[][], frameSpan: number[]) => {
  const frameMotion: number[] = new Array(meta.frames.length).fill(Infinity);
  for (let i = 1; i < meta.frames.length; i++) {
    const g = (grids[i][0] ?? grids[i - 1][0])?.grid;
    if (!g) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of [-0.5, 2.5]) {
      for (const c of [-0.5, 2.5]) {
        const x = g.origin.x + c * g.v1.x + r * g.v2.x;
        const y = g.origin.y + c * g.v1.y + r * g.v2.y;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const x0 = Math.max(0, Math.round(minX)), x1 = Math.min(meta.w - 1, Math.round(maxX));
    const y0 = Math.max(0, Math.round(minY)), y1 = Math.min(meta.h - 1, Math.round(maxY));
    if (x1 <= x0 || y1 <= y0) continue;
    const a = frameAt(i), b = frameAt(i - 1);
    let sum = 0, n = 0;
    for (let y = y0; y <= y1; y += 2) {
      for (let x = x0; x <= x1; x += 2) {
        const p = (y * meta.w + x) * 3;
        sum += Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]);
        n++;
      }
    }
    frameMotion[i] = sum / (3 * n);
  }
  const motSorted = frameMotion.filter((m) => Number.isFinite(m)).sort((a, b) => a - b);
  const motP = (q: number) => motSorted[Math.min(motSorted.length - 1, Math.floor(q * motSorted.length))] ?? 0;

  const runs: RestRun[] = [];
  {
    // 空帧桥接: 提取单帧失败不断链 (≤2 帧空隙), 只有"读到且全不一致"才断
    let sFrame = -1, lastFrame = -1, gap = 0;
    let chain: FaceObservation[] = [];
    let chainIdx: number[] = [];
    const flush = () => {
      if (chain.length >= MIN_RUN) {
        const colors: (ColorName | null)[] = [];
        const colorsVeto: (ColorName | null)[] = [];
        const sup: number[] = [];
        // 地理围栏: 逐帧掩码 (v3 手指遮挡是瞬时的, 掩码必须逐帧; v1 外套是全程的)
        const geoMasks = GEO_THR > 0
          ? chain.map((g, gi) => cubeMask(frameAt(chainIdx[gi]), meta.w, meta.h, g.grid, sf))
          : null;
        const consensus = (tally: Map<ColorName, number>, tot: number): ColorName | null => {
          const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
          return top && (tot === 1 || (top[1] >= 2 && top[1] > tot * 0.6)) ? top[0] : null;
        };
        for (let c = 0; c < 9; c++) {
          const tally = new Map<ColorName, number>();
          const tallyV = new Map<ColorName, number>();
          let tot = 0, totV = 0, supN = 0;
          for (let gi = 0; gi < chain.length; gi++) {
            const g = chain[gi];
            const col = (g.knnColors ?? g.hdColors ?? g.colors)[c]; // 共识优先 kNN (在场时, 特征源可为 HD) > HD 重采 > vivid; agree/链检测仍用稳定 colors
            if (!col) continue;
            tot++;
            if (g.grid.cells[c]) supN++; // 实测色块支撑 (非外插采样)
            tally.set(col, (tally.get(col) ?? 0) + 1);
            // 逐帧格 veto (正⑱): 格心块 RGB 判毒 (衣服/手/背景) 的帧票剥夺, 只进
            // veto 轨。外套格全程毒→格清零, 手指格瞬时毒→干净帧存活 (整格删除会误
            // 杀 v3)。链存在性/锚点/κ 拟合全走原始轨 — veto 动收尾锚会翻 v1 种子面。
            if (vetoKnn && (CELL_VETO > 0 || geoMasks)) {
              const cc = cellCenter(g.grid, (c / 3) | 0, c % 3);
              if (CELL_VETO > 0) {
                const m = blockMedianRGB(frameAt(chainIdx[gi]), meta.w, meta.h, cc.x, cc.y, g.grid.pitch * 0.22);
                if (m && vetoKnn(m, sf) >= CELL_VETO) continue;
              }
              if (geoMasks && !geoMasks[gi](cc.x, cc.y)) continue;
            }
            totV++;
            tallyV.set(col, (tallyV.get(col) ?? 0) + 1);
          }
          colors.push(consensus(tally, tot));
          colorsVeto.push(consensus(tallyV, totV));
          sup.push(tot ? Math.round((supN / tot) * 100) / 100 : 0);
        }
        if (colors.filter(Boolean).length >= 5) {
          // 链桥接 ≤2 帧空隙 < prior 存活 5 帧, 链内 span 恒定, 取起帧的即可
          const mots = chainIdx.map((ci) => frameMotion[ci]).filter(Number.isFinite).sort((a, b) => a - b);
          let geoIn: string | undefined;
          if (geoMasks) {
            const mi = chain.length >> 1, mg = chain[mi].grid;
            geoIn = "";
            for (let c = 0; c < 9; c++) {
              const cc = cellCenter(mg, (c / 3) | 0, c % 3);
              geoIn += geoMasks[mi](cc.x, cc.y) ? "1" : "0";
            }
          }
          let cx = 0, cy = 0;
          for (const g of chain) {
            cx += g.grid.origin.x + g.grid.v1.x + g.grid.v2.x;
            cy += g.grid.origin.y + g.grid.v1.y + g.grid.v2.y;
          }
          runs.push({
            from: meta.frames[sFrame],
            to: meta.frames[lastFrame],
            len: chain.length,
            grid: colors,
            span: frameSpan[sFrame],
            motion: mots.length ? mots[mots.length >> 1] : Infinity,
            cx: cx / chain.length,
            cy: cy / chain.length,
            midI: chainIdx[chain.length >> 1],
            midGrid: chain[chain.length >> 1].grid,
            sup,
            gridVeto: vetoKnn ? colorsVeto : undefined,
            geoIn,
          });
        }
      }
      sFrame = -1;
      lastFrame = -1;
      gap = 0;
      chain = [];
      chainIdx = [];
    };
    for (let i = 0; i < meta.frames.length; i++) {
      const gs = grids[i];
      if (!gs.length) {
        if (sFrame >= 0 && ++gap > 2) flush();
        continue;
      }
      if (sFrame < 0) {
        sFrame = i;
        lastFrame = i;
        gap = 0;
        chain = [gs[0]];
        chainIdx = [i];
        continue;
      }
      const cont = gs.find((g) => agree(chain[chain.length - 1], g));
      if (cont) {
        chain.push(cont);
        chainIdx.push(i);
        lastFrame = i;
        gap = 0;
        continue;
      }
      flush();
      sFrame = i;
      lastFrame = i;
      chain = [gs[0]];
      chainIdx = [i];
    }
    flush();
  }
  return { runs, motP };
  };
  let { runs, motP } = buildRuns(grids, frameSpan);

  // 常数颜色重标 κ 拟合: 归属无关 (每区间对全部边界态取 max), 24 候选取总匹配最优
  const fitOmega = (runs: RestRun[]) => {
  const allStates = [...boundStates, finalState];
  let omega: readonly number[] = IDENTITY_PERM, omegaIdx = 0, omegaBest = -1;
  for (let oi = 0; oi < 24; oi++) {
    const cand = ORIENTATION_PERMS[oi];
    let tot = 0;
    for (const run of runs) {
      let m = 0;
      for (const st of allStates) {
        const b = bestAssign(run.grid, st, cand);
        if (b.match > m) m = b.match;
      }
      tot += m;
    }
    if (tot > omegaBest) {
      omegaBest = tot;
      omega = cand;
      omegaIdx = oi;
    }
  }
  return { omega, omegaIdx };
  };
  let { omega, omegaIdx } = fitOmega(runs);

  // 段起点后继态 + token→probs 下标 (供标定样本收集与后续段证据共用)
  const afterState = (j: number): readonly number[] =>
    j + 1 < fullSeq.length ? startState[j + 1] : IDENTITY_PERM;
  const tokIdxToProbsPre = new Map<number, number>(nonRotIdx.map((jj, tt) => [jj, tt]));

  // kNN 标定就地附加: 不重提取 (重提取改链形成→丢覆盖)。给 pass1 vivid 网格附 kNN
  // 重分类标签 (格心 RGB → kNN); agree/链检测仍用 vivid colors 保覆盖, 共识用 knn 保精度。
  const attachKnnColors = (calib: ColorCalib) => {
    for (let i = 0; i < grids.length; i++) {
      if (!grids[i]?.length) continue;
      const rgb = frameAt(i);
      for (const obs of grids[i]) {
        const kc: (ColorName | null)[] = new Array(9).fill(null);
        for (let c = 0; c < 9; c++) {
          // 特征源优先 HD 精修块中位 (漂移已修, 跨视频迁移更干净), 无 HD 时 960 块中位
          const hm = obs.hdRgb?.[c];
          const m = hm
            ? { r: hm[0], g: hm[1], b: hm[2] }
            : (() => {
                const { x, y } = cellCenter(obs.grid, (c / 3) | 0, c % 3);
                return blockMedianRGB(rgb, meta.w, meta.h, x, y, obs.grid.pitch * 0.22);
              })();
          if (m) kc[c] = calibClassifyDiag(m.r, m.g, m.b, calib);
        }
        obs.knnColors = kc;
      }
    }
  };

  // ===== 每视频颜色自标定 (两遍提取) =====
  // pass1 (默认阈值) 网格 → 已知态帧反标样本 → 拟合 → pass2 带标定重提取。
  // 合法模式: 观察期帧 (态=打乱) + 收尾帧 (态=复原), 生产无 GT 可用;
  // GT 模式: 全段双端态, 天花板诊断。标签取"最优平局候选一致"的格 (歧义格弃)。
  let calibFitted: ColorCalib | null = null;
  let calibPool: Map<ColorName, ColorSample[]> | null = null;
  let omegaAtCalib: readonly number[] = IDENTITY_PERM;
  if (CALIB_LEGIT || CALIB_GT) {
    const samples: ColorSample[] = [];
    const blocks: { label: ColorName; px: number[] }[] = [];
    const segOfFrameCal = (frame: number): number => {
      if (frame < splitFrames[0]) return 0;
      for (let si = 0; si < splitFrames.length - 1; si++) {
        if (frame >= splitFrames[si] && frame < splitFrames[si + 1]) {
          let t = tokIdxToProbsPre.get(si);
          if (t === undefined) {
            for (let jj = si - 1; jj >= 0 && t === undefined; jj--) t = tokIdxToProbsPre.get(jj);
            for (let jj = si + 1; jj < tokens.length && t === undefined; jj++) t = tokIdxToProbsPre.get(jj);
          }
          return t ?? -1;
        }
      }
      return -1;
    };
    let obsId = 0;
    const collectFrom = (obs: FaceObservation, states: readonly (readonly number[])[], rgb: Uint8Array) => {
      const myObsId = obsId++;
      // 全 (态×指派) 打分, 收集并列最优; 读格 ≥5 且匹配 ≥60% 才可信
      interface Cand { st: readonly number[]; ai: number }
      let cands: Cand[] = [];
      let bestM = -1, read = 0;
      for (const st of states) {
        for (let ai = 0; ai < ASSIGNS.length; ai++) {
          const { assign } = ASSIGNS[ai];
          let m = 0, rd = 0;
          for (let i = 0; i < 9; i++) {
            const c = obs.colors[i];
            if (!c) continue;
            rd++;
            if (COLOR_NAMES[Math.floor(omega[st[assign[i]]] / 9)] === c) m++;
          }
          if (m > bestM) { bestM = m; cands = [{ st, ai }]; read = rd; }
          else if (m === bestM) cands.push({ st, ai });
        }
      }
      if (!cands.length || read < 5 || bestM < read * 0.6) return;
      // 逐格标签: 并列候选给出不同标签的格 = 指派歧义, 弃; 一致的格才是可信标注
      // (段双端态共享可见面时天然并列, 标签相同无害 — 全局 margin 会误杀这类帧)
      for (let i = 0; i < 9; i++) {
        let label: ColorName | null = null, ok = true;
        for (const c of cands) {
          const l = COLOR_NAMES[Math.floor(omega[c.st[ASSIGNS[c.ai].assign[i]]] / 9)];
          if (label === null) label = l;
          else if (label !== l) { ok = false; break; }
        }
        if (!ok || !label) continue;
        if (DUMP_BLOCKS) {
          const cc = cellCenter(obs.grid, (i / 3) | 0, i % 3);
          const px = extractBlock(rgb, meta.w, meta.h, cc.x, cc.y, Math.round(obs.grid.pitch * 0.26));
          if (px.length >= 27) blocks.push({ label, px });
        }
        // 特征源优先 HD 精修块中位 (与 attachKnnColors 同源, 训练/应用特征一致)
        const hm = obs.hdRgb?.[i];
        if (hm) {
          samples.push({ r: hm[0], g: hm[1], b: hm[2], label, obs: myObsId });
          continue;
        }
        const blob = obs.grid.cells[i];
        if (blob) {
          samples.push({ r: blob.r, g: blob.g, b: blob.b, label, obs: myObsId });
          continue;
        }
        // null 读格仅在高读出帧收集 (读出 ≥7 时 null 多为阈值失败如暖白, 非手指遮挡)
        if (!obs.colors[i] && read < 7) continue;
        const { x, y } = cellCenter(obs.grid, (i / 3) | 0, i % 3);
        const m = blockMedianRGB(rgb, meta.w, meta.h, x, y, obs.grid.pitch * 0.22);
        if (m) samples.push({ r: m.r, g: m.g, b: m.b, label, obs: myObsId });
      }
    };
    for (let i = 0; i < meta.frames.length; i++) {
      if (!grids[i].length) continue;
      const frame = meta.frames[i];
      let states: (readonly number[])[] | null = null;
      if (CALIB_GT) {
        const t = segOfFrameCal(frame);
        if (t >= 0) states = [boundStates[t], afterState(nonRotIdx[t])];
      } else if (frame < splitFrames[0]) states = [scrambleSc];
      else if (frame >= splitFrames[splitFrames.length - 1]) states = [IDENTITY_PERM];
      if (!states) continue;
      const rgb = frameAt(i);
      for (const obs of grids[i]) collectFrom(obs, states, rgb);
    }
    if (process.argv.includes("--dumpsamples")) {
      mkdirSync(join(import.meta.dirname, "..", ".tmp"), { recursive: true });
      const p = join(
        import.meta.dirname, "..", ".tmp",
        `calib-samples${HD_RES ? "-hd" : ""}-${basename(videoPath).replace(/\s+/g, "_")}.json`,
      );
      writeFileSync(p, JSON.stringify(samples));
      console.log(`  样本已 dump: ${p} (${samples.length})`);
    }
    if (DUMP_BLOCKS) {
      mkdirSync(join(import.meta.dirname, "..", ".tmp"), { recursive: true });
      const p = join(
        import.meta.dirname, "..", ".tmp",
        `calib-blocks-${basename(videoPath).replace(/\s+/g, "_")}.json`,
      );
      writeFileSync(p, JSON.stringify(blocks));
      console.log(`  块已 dump: ${p} (${blocks.length})`);
    }
    const calib = fitColorCalib(samples, { knn: KNN_CLS });
    if (calib) {
      console.log(`  标定[${CALIB_GT ? "GT" : "合法"}${calib.knn ? "+kNN" : ""}]: ${samples.length} 样本  ${calibSummary(calib)}`);
      // 样本内自分类 = 该特征在此模型下的贝叶斯天花板估计。低 (≲70%) 说明
      // 类间特征本质重叠 (视角/光照条件性混淆), 静态标定无解, 别再调阈值
      {
        const tally = new Map<ColorName, { ok: number; tot: number; rej: number }>();
        for (const s of samples) {
          const e = tally.get(s.label) ?? { ok: 0, tot: 0, rej: 0 };
          e.tot++;
          const p = calibClassifyDiag(s.r, s.g, s.b, calib);
          if (p === null) e.rej++;
          else if (p === s.label) e.ok++;
          tally.set(s.label, e);
        }
        let ok = 0, tot = 0, rej = 0;
        const per = [...tally.entries()]
          .sort((a, b) => b[1].tot - a[1].tot)
          .map(([c, e]) => {
            ok += e.ok; tot += e.tot; rej += e.rej;
            return `${c}:${((e.ok / Math.max(1, e.tot - e.rej)) * 100).toFixed(0)}%`;
          })
          .join(" ");
        console.log(
          `  样本内天花板: ${((ok / Math.max(1, tot - rej)) * 100).toFixed(1)}% (拒判 ${((rej / tot) * 100).toFixed(0)}%)  ${per}`,
        );
      }
      // 软神谕挂钩: 标定 + 按类样本池 + 收集时 κ (池标签与合成真值须同一 κ 口径)
      calibFitted = calib;
      omegaAtCalib = omega;
      calibPool = new Map();
      for (const s of samples) {
        (calibPool.get(s.label) ?? calibPool.set(s.label, []).get(s.label)!).push(s);
      }
      if (calib.knn) {
        attachKnnColors(calib);
      } else {
        ({ grids, frameSpan, nCold, nTracked, anchor } = extractAllGrids(calib));
      }
      ({ runs, motP } = buildRuns(grids, frameSpan));
      ({ omega, omegaIdx } = fitOmega(runs));
    } else {
      console.log(`  标定失败 (实拟合类 <3, 共 ${samples.length} 样本), 沿用默认阈值`);
    }
  } else if (CALIB_POOL) {
    // 跨视频 GT-pool 留一: 其它视频的 GT 样本池 → 全局 kNN → 应用到本视频 (零本视频 GT)
    const tmpDir = join(import.meta.dirname, "..", ".tmp");
    const myKey = basename(videoPath).replace(/\s+/g, "_");
    const pooled: ColorSample[] = [];
    const poolRe = HD_RES ? /^calib-samples-hd-(.*)\.json$/ : /^calib-samples-(?!hd-)(.*)\.json$/;
    for (const f of readdirSync(tmpDir)) {
      const m = poolRe.exec(f);
      if (!m || m[1] === myKey) continue;
      pooled.push(...(JSON.parse(readFileSync(join(tmpDir, f), "utf8")) as ColorSample[]));
    }
    const calib = fitColorCalib(pooled, { knn: true });
    if (calib?.knn) {
      console.log(`  标定[池化kNN 留一, 排除本视频]: ${pooled.length} 外部样本  ${calibSummary(calib)}`);
      attachKnnColors(calib);
      ({ runs, motP } = buildRuns(grids, frameSpan));
      ({ omega, omegaIdx } = fitOmega(runs));
    } else {
      console.log(`  池化标定失败 (外部样本 ${pooled.length}, 先跑 --calibgt --dumpsamples?), 沿用默认阈值`);
    }
  }

  // 归属规则学习诊断: GT 最像边界 vs 两种规则 (区间就近 / 终点锚定)
  const nearestByInterval = (run: RestRun): number => {
    let bi = -1, bd = Infinity;
    for (let si = 0; si < splitFrames.length; si++) {
      const d = splitFrames[si] < run.from ? run.from - splitFrames[si] : splitFrames[si] > run.to ? splitFrames[si] - run.to : 0;
      if (d < bd) { bd = d; bi = si; }
    }
    return bd <= 12 ? bi : -1;
  };
  const nearestToEnd = (run: RestRun): number => {
    let bi = -1, bd = Infinity;
    for (let si = 0; si < splitFrames.length; si++) {
      const d = Math.abs(splitFrames[si] - (run.to + 1));
      if (d < bd) { bd = d; bi = si; }
    }
    return bd <= 12 ? bi : -1;
  };
  /** split 下标 → probs 边界下标 (-1 = 转体段起点或超界; 末 split = boundStates.length) */
  const tokIdxToProbs = new Map<number, number>(nonRotIdx.map((j, t) => [j, t]));
  const splitToBound = (si: number): number => {
    if (si < 0) return -1;
    if (si === splitFrames.length - 1) return boundStates.length; // 末态
    return tokIdxToProbs.get(si) ?? -1;
  };
  const stateOf = (b: number) => (b === boundStates.length ? finalState : boundStates[b]);

  let agreeInterval = 0, agreeEnd = 0, nDiag = 0;
  if (DO_HIST) {
    const nExtracted = grids.filter((g) => g.length > 0).length;
    const nTwo = grids.filter((g) => g.length >= 2).length;
    console.log(
      `--- ${basename(videoPath)} 逐帧提取 ${nExtracted}/${grids.length} (冷 ${nCold} 跟踪 ${nTracked} 双面 ${nTwo}), 静止区间 ${runs.length} 个 (minrun=${MIN_RUN}, κ=ω${omegaIdx})  帧运动量 p10=${motP(0.1).toFixed(1)} p25=${motP(0.25).toFixed(1)} p50=${motP(0.5).toFixed(1)} p75=${motP(0.75).toFixed(1)} p90=${motP(0.9).toFixed(1)} ---`,
    );
  }
  for (const run of runs) {
    // GT 最像边界 (需要明显赢: 读格 ≥5)
    let gtB = -1, gtFrac = -1, gtFace: FaceName = "B", gtRot = 0;
    for (let b = 0; b <= boundStates.length; b++) {
      const r = bestAssign(run.grid, stateOf(b), omega);
      const f = r.read ? r.match / r.read : 0;
      if (f > gtFrac) { gtFrac = f; gtB = b; gtFace = r.face; gtRot = r.rot; }
    }
    const ruleI = splitToBound(nearestByInterval(run));
    const ruleE = splitToBound(nearestToEnd(run));
    if (gtFrac >= 0.8) {
      nDiag++;
      if (ruleI === gtB) agreeInterval++;
      if (ruleE === gtB) agreeEnd++;
    }
    if (DO_HIST) {
      console.log(
        `  [${run.from}..${run.to}] len${run.len} mot${run.motion.toFixed(1)} [${run.grid.map((c) => c ?? ".").join("")}] GT最像 b${gtB}(${(gtFrac * 100).toFixed(0)}%) 赢面 ${gtFace}r${gtRot}  就近→b${ruleI} 终点→b${ruleE}`,
      );
    }
  }

  // 软覆盖天花板: 每边界 ±12 帧内是否存在与 GT 态匹配 ≥75% (读格 ≥5) 的区间
  // (= "边界从邻近区间挑最匹配"方案在完美挑选下的可达覆盖)
  let softCov = 0;
  for (let t = 0; t < boundStates.length; t++) {
    const sp = splitFrames[nonRotIdx[t]];
    for (const run of runs) {
      if (run.to + 12 < sp || run.from - 12 > sp) continue;
      const b = bestAssign(run.grid, boundStates[t], omega);
      if (b.read >= 5 && b.match / b.read >= 0.75) {
        softCov++;
        break;
      }
    }
  }

  // 双端点段证据: 链按中心帧归属所在段, 匹配 = max(段起点态, 段终点态)。
  // 段内任意时刻的读数必属两端之一 (拧转前=起点, 拧转后=终点, 拧转中非转动层两者皆合),
  // 标注滞后的 ±1 归属歧义在此语义下自动消解。(afterState/tokIdxToProbsPre 已上移)
  const segChains: RestRun[][] = Array.from({ length: boundStates.length }, () => []);
  let segYDropped = 0;
  for (const run of runs) {
    const center = (run.from + run.to) / 2;
    let j = -1;
    if (center < splitFrames[0]) j = 0; // 前置静止 (观察期) 归段 0, 双端语义含打乱态
    else {
      for (let si = 0; si < splitFrames.length - 1; si++) {
        if (center >= splitFrames[si] && center < splitFrames[si + 1]) {
          j = si;
          break;
        }
      }
    }
    if (j < 0) continue; // 末 split 之后 → final 观测已单独处理
    let t = tokIdxToProbsPre.get(j);
    if (t === undefined) {
      // y 转体段: y 是整机旋转, 面边缘化天然吸收 (旋转态在另一指派下匹配同一状态)
      // → 归给前一个非转体段作"终点态"证据; 开头的 y 则归给后一个段作"起点态"证据
      for (let jj = j - 1; jj >= 0 && t === undefined; jj--) t = tokIdxToProbsPre.get(jj);
      for (let jj = j + 1; jj < tokens.length && t === undefined; jj++) t = tokIdxToProbsPre.get(jj);
      if (t === undefined) {
        segYDropped++;
        continue;
      }
    }
    segChains[t].push(run);
  }
  let segCov = 0, segMatch = 0, segRead = 0;
  for (let t = 0; t < boundStates.length; t++) {
    let got = false;
    for (const run of segChains[t]) {
      const b1 = bestAssign(run.grid, boundStates[t], omega);
      const b2 = bestAssign(run.grid, afterState(nonRotIdx[t]), omega);
      const best = b1.match >= b2.match ? b1 : b2;
      segMatch += best.match;
      segRead += best.read;
      if (best.read >= 5 && best.match / best.read >= 0.75) got = true;
    }
    if (got) segCov++;
  }

  // ===== 全局钉死指派 (面内旋转 = 全视频常量) =====
  // 逐链在 24 指派里自由取 max 把乱态底噪抬到 ~48% (9 格 1/6 巧合的 max 膨胀)。
  // 相机不动 + 握持稳定 → 每个可见窗口 (B/U) 的面内旋转应是全视频常量, 像 κ 一样
  // 全局拟合钉死; 逐链只剩 2 窗口 × 双端点 = 4 假设。乱态对照用"乱态自拟合 pin"
  // (搜索侧 pin 是路径级变量, 错误路径也能挑自己的最优 pin — 这才是公平底噪)。
  const PIN_B = assignsForFaces(["B"]);
  const PIN_U = assignsForFaces(["U"]);
  const pinnedBest = (
    colors: readonly (ColorName | null)[],
    state: readonly number[],
    aB: readonly number[],
    aU: readonly number[],
  ): { match: number; read: number } => {
    let bm = -1, br = 0;
    for (const assign of [aB, aU]) {
      let m = 0, rd = 0;
      for (let i = 0; i < 9; i++) {
        const c = colors[i];
        if (!c) continue;
        rd++;
        if (COLOR_NAMES[Math.floor(omega[state[assign[i]]] / 9)] === c) m++;
      }
      if (m > bm) { bm = m; br = rd; }
    }
    return { match: bm, read: br };
  };
  /** 归属绑定拟合: 每段链绑定该段双端态, 16 组合取总匹配最优 (include 过滤链子集) */
  const fitPinBound = (
    statesOf: (t: number) => [readonly number[], readonly number[]],
    include: (run: RestRun) => boolean = () => true,
  ) => {
    let best = { b: 0, u: 0, tot: -1 };
    for (let rb = 0; rb < PIN_B.length; rb++) {
      for (let ru = 0; ru < PIN_U.length; ru++) {
        let tot = 0;
        for (let t = 0; t < boundStates.length; t++) {
          const [s1, s2] = statesOf(t);
          for (const run of segChains[t]) {
            if (!include(run)) continue;
            const m1 = pinnedBest(run.grid, s1, PIN_B[rb], PIN_U[ru]).match;
            const m2 = pinnedBest(run.grid, s2, PIN_B[rb], PIN_U[ru]).match;
            tot += Math.max(m1, m2);
          }
        }
        if (tot > best.tot) best = { b: rb, u: ru, tot };
      }
    }
    return best;
  };
  const evalPin = (
    statesOf: (t: number) => [readonly number[], readonly number[]],
    pinOf: (run: RestRun) => { b: number; u: number },
  ) => {
    let match = 0, read = 0, good = 0, mid = 0, junk = 0;
    for (let t = 0; t < boundStates.length; t++) {
      const [s1, s2] = statesOf(t);
      for (const run of segChains[t]) {
        const pin = pinOf(run);
        const r1 = pinnedBest(run.grid, s1, PIN_B[pin.b], PIN_U[pin.u]);
        const r2 = pinnedBest(run.grid, s2, PIN_B[pin.b], PIN_U[pin.u]);
        const r = r1.match >= r2.match ? r1 : r2;
        match += r.match;
        read += r.read;
        const frac = r.read ? r.match / r.read : 0;
        if (frac >= 0.85) good++;
        else if (frac >= 0.6) mid++;
        else junk++;
      }
    }
    return { match, read, good, mid, junk };
  };
  const nSeg = boundStates.length;
  const halfSeg = Math.floor(nSeg / 2);
  const sigStates = (t: number): [readonly number[], readonly number[]] => [
    boundStates[t],
    afterState(nonRotIdx[t]),
  ];
  const nulStates = (t: number): [readonly number[], readonly number[]] => {
    const s = (t + halfSeg) % nSeg;
    return [boundStates[s], afterState(nonRotIdx[s])];
  };
  // 视频级 pin (对照: 已证伪 — 十字/F2L/OLL 换握持, 面内旋转非全视频常量)
  const sigPin = fitPinBound(sigStates);
  const nulPin = fitPinBound(nulStates);
  const pinSig = evalPin(sigStates, () => sigPin);
  const pinNul = evalPin(nulStates, () => nulPin);
  // span 级 pin: 基连续化下跟踪 span 内旋转身份构造性恒定; 乱态对照同样每 span 自拟合
  // (搜索侧 pin 是路径级变量, 错误路径也能按 span 挑最优 pin — 公平底噪)
  const attachedSpans = [...new Set(segChains.flat().map((r) => r.span))].sort((a, b) => a - b);
  const spanPinSig = new Map(attachedSpans.map((s) => [s, fitPinBound(sigStates, (r) => r.span === s)]));
  const spanPinNul = new Map(attachedSpans.map((s) => [s, fitPinBound(nulStates, (r) => r.span === s)]));
  const spanSig = evalPin(sigStates, (r) => spanPinSig.get(r.span)!);
  const spanNul = evalPin(nulStates, (r) => spanPinNul.get(r.span)!);
  const spanSizes = new Map<number, number>();
  for (const r of segChains.flat()) spanSizes.set(r.span, (spanSizes.get(r.span) ?? 0) + 1);
  const multiSpans = [...spanSizes.values()].filter((n) => n >= 2).length;

  // 诊断: ① 颜色混淆矩阵 (链在自由指派最优对齐下 GT 色 vs 读出色 — 系统性混淆
  // 可按视频标定修复; 均匀散布 = 错位/垃圾) ② 冷 vs 跟踪帧分层逐格准确率
  // (跟踪采样 translation-only + step 量化, 若明显差于冷帧色块色, 毒在跟踪器)
  const confusion = new Map<string, number>();
  {
    for (let t = 0; t < boundStates.length; t++) {
      const [s1, s2] = [boundStates[t], afterState(nonRotIdx[t])];
      for (const run of segChains[t]) {
        // 双端取最优态 + 自由指派最优对齐 (给链最公平的对齐, 剩下的错就是颜色/错位)
        const b1 = bestAssign(run.grid, s1, omega);
        const b2 = bestAssign(run.grid, s2, omega);
        const st = b1.match >= b2.match ? s1 : s2;
        const bb = b1.match >= b2.match ? b1 : b2;
        const assign = ASSIGNS.find((a) => a.face === bb.face)!; // 该面 rot0 起始下标
        const ai = ASSIGNS.indexOf(assign) + bb.rot;
        for (let i = 0; i < 9; i++) {
          const c = run.grid[i];
          if (!c) continue;
          const gt = COLOR_NAMES[Math.floor(omega[st[ASSIGNS[ai].assign[i]]] / 9)];
          confusion.set(`${gt}${c}`, (confusion.get(`${gt}${c}`) ?? 0) + 1);
        }
      }
    }
  }
  if (DUMP_OBS) {
    // 转储每边界每链的 GT 最优对齐观测 (facelet 映射 + 读出色 + GT 色) — prior-sim 消费。
    // 对齐 (面/rot/端) 用 GT 最优 = "朝向已知" 乐观假设; 所有候选共享同一映射, 排名公平。
    const bounds = boundStates.map((_, t) => {
      const s1 = boundStates[t], s2 = afterState(nonRotIdx[t]);
      // veto 空壳过滤: 票被剥到 <5 可读格的链不进边界证据 (残格是稀疏噪声, 实测
      // 害 v3); 锚点 finals/κ 不受影响 (走原始 grid)
      // 地理围栏诊断行 (过滤前原始链序, 与 VLM 普查 g-<t>-<ci> 对账贴合评级)
      if (GEO_THR > 0) {
        for (let ci = 0; ci < segChains[t].length; ci++) {
          console.log(`GEOIN ${sf[0]} b${t} c${ci} in=${segChains[t][ci].geoIn}`);
        }
      }
      return segChains[t]
        .filter((run) => !run.gridVeto || run.gridVeto.filter(Boolean).length >= 5)
        .map((run) => {
        const b1 = bestAssign(run.grid, s1, omega);
        const b2 = bestAssign(run.grid, s2, omega);
        const useS2 = b2.match > b1.match;
        const st = useS2 ? s2 : s1;
        const bb = useS2 ? b2 : b1;
        const rot0 = ASSIGNS.findIndex((a) => a.face === bb.face);
        const facelets = ASSIGNS[rot0 + bb.rot].assign;
        return {
          end: useS2 ? 1 : 0,
          face: bb.face,
          facelets: [...facelets],
          // veto 轨只换解码证据 read; face/rot 拟合与 gt 仍走原始 grid (与锚点/κ 同轨)
          read: (run.gridVeto ?? run.grid).map((c) => c ?? null),
          // 读到色的格重采样格心原始 RGB (EM 探针 refit kNN 用; 未读格 null=遮挡不可信)
          rgbRead: (run.gridVeto ?? run.grid).map((c, i) => {
            if (!c) return null;
            const cc = cellCenter(run.midGrid, (i / 3) | 0, i % 3);
            const m = blockMedianRGB(frameAt(run.midI), meta.w, meta.h, cc.x, cc.y, run.midGrid.pitch * 0.22);
            return m ? [m.r, m.g, m.b] : null;
          }),
          gt: facelets.map((f) => COLOR_NAMES[Math.floor(omega[st[f]] / 9)]),
          span: run.span, // 跟踪 span 身份 (span 内窗口旋转恒定) — prior-sim --spanalign 生产界用
          cx: Math.round(run.cx), // 链晶格中心 — prior-sim --winalign 空间聚类窗口身份用
          cy: Math.round(run.cy),
          // 几何朝向探针 (orient-probe) 用: 帧区间 + 中帧晶格基角/pitch + 链运动量 + GT rot
          f0: run.from,
          f1: run.to,
          ang: Math.round(((Math.atan2(run.midGrid.v1.y, run.midGrid.v1.x) * 180) / Math.PI) * 10) / 10,
          pitch: Math.round(run.midGrid.pitch * 10) / 10,
          motion: Math.round(run.motion * 100) / 100,
          rot: bb.rot,
          // 完整仿射基 (orient-probe 逐链姿态分类: 各向异性/剪切 = 倾斜度读数)
          basis: [run.midGrid.v1.x, run.midGrid.v1.y, run.midGrid.v2.x, run.midGrid.v2.y].map((x) => Math.round(x * 10) / 10),
          // 每格色块支撑率 (正⑱ 脱靶拒判: 0=全程外插, 格心可能悬在衣服/手/背景)
          sup: run.sup,
        };
      });
    });
    // 收尾静止链 (末 split 之后, 态=复原, 手已离开) — 倒推解码的锚点观测
    const finals = runs
      .filter((run) => (run.from + run.to) / 2 > splitFrames[splitFrames.length - 1])
      .map((run) => ({
        read: run.grid.map((c) => c ?? null),
        span: run.span,
        cx: Math.round(run.cx),
        cy: Math.round(run.cy),
        len: run.len,
        f0: run.from,
        f1: run.to,
        ang: Math.round(((Math.atan2(run.midGrid.v1.y, run.midGrid.v1.x) * 180) / Math.PI) * 10) / 10,
        pitch: Math.round(run.midGrid.pitch * 10) / 10,
      }));
    dumpVideos.push({
      name: basename(videoPath),
      omega: [...omega],
      omegaIdx,
      gtNoRot,
      tailRotations,
      confusion: Object.fromEntries(confusion),
      bounds,
      finals,
    });
  }
  let coldMatch = 0, coldRead = 0, trkMatch = 0, trkRead = 0;
  let frNullMatch = 0, frNullRead = 0;
  const segFrameObs: FaceObservation[][] = Array.from({ length: boundStates.length }, () => []);
  {
    // 帧 → 所在段 (含段双端语义): 复用链归属逻辑的简化版
    const segOfFrame = (frame: number): number => {
      if (frame < splitFrames[0]) return 0;
      for (let si = 0; si < splitFrames.length - 1; si++) {
        if (frame >= splitFrames[si] && frame < splitFrames[si + 1]) {
          let t = tokIdxToProbsPre.get(si);
          if (t === undefined) {
            for (let jj = si - 1; jj >= 0 && t === undefined; jj--) t = tokIdxToProbsPre.get(jj);
            for (let jj = si + 1; jj < tokens.length && t === undefined; jj++) t = tokIdxToProbsPre.get(jj);
          }
          return t ?? -1;
        }
      }
      return -1;
    };
    const halfB = Math.floor(boundStates.length / 2);
    for (let i = 0; i < meta.frames.length; i++) {
      for (const g of grids[i]) {
        const t = segOfFrame(meta.frames[i]);
        if (t < 0) continue;
        segFrameObs[t].push(g);
        const b1 = bestAssign(g.colors, boundStates[t], omega);
        const b2 = bestAssign(g.colors, afterState(nonRotIdx[t]), omega);
        const b = b1.match >= b2.match ? b1 : b2;
        const isTracked = g.blobCount === 0; // trackFaceGrid 产出 blobCount=0
        if (isTracked) { trkMatch += b.match; trkRead += b.read; }
        else { coldMatch += b.match; coldRead += b.read; }
        // 帧级乱态对照 (远边界态双端, 同样自由指派 — 逐帧判别余量)
        const s = (t + halfB) % boundStates.length;
        const n1 = bestAssign(g.colors, boundStates[s], omega);
        const n2 = bestAssign(g.colors, afterState(nonRotIdx[s]), omega);
        const nb = n1.match >= n2.match ? n1 : n2;
        frNullMatch += nb.match;
        frNullRead += nb.read;
      }
    }
  }

  // 帧级软覆盖: 不要求成链, ±12/±25 帧内任一单帧网格与 GT 态匹配 ≥75% (读格 ≥5)
  // — "搜索侧状态对齐取代时间归属"方案的可达覆盖上限估计
  let frameCov12 = 0, frameCov25 = 0;
  for (let t = 0; t < boundStates.length; t++) {
    const sp = splitFrames[nonRotIdx[t]];
    let got12 = false, got25 = false;
    for (let i = 0; i < meta.frames.length && !got12; i++) {
      const d = Math.abs(meta.frames[i] - sp);
      if (d > 25) continue;
      for (const g of grids[i]) {
        const b = bestAssign(g.colors, boundStates[t], omega);
        if (b.read >= 5 && b.match / b.read >= 0.75) {
          got25 = true;
          if (d <= 12) got12 = true;
          break;
        }
      }
    }
    if (got12) frameCov12++;
    if (got25) frameCov25++;
  }

  // 归属 (区间就近规则; 学习诊断打印两规则命中率供比对) → 每边界取最长区间
  const boundObs: (RawFaceObs | null)[] = new Array(boundStates.length).fill(null);
  const boundLen: number[] = new Array(boundStates.length).fill(0);
  let finalRawObs: RawFaceObs | null = null, finalLen = 0;
  for (const run of runs) {
    const b = splitToBound(nearestByInterval(run));
    if (b < 0) continue;
    if (b === boundStates.length) {
      if (run.len > finalLen) { finalRawObs = { colors: run.grid }; finalLen = run.len; }
    } else if (run.len > boundLen[b]) {
      boundObs[b] = { colors: run.grid };
      boundLen[b] = run.len;
    }
  }

  // 指派边缘化统计 + 乱态对照 + 赢面直方图
  let covered = 0, margMatch = 0, margRead = 0, nullMatch = 0, nullRead = 0;
  let nGood = 0, nMid = 0, nJunk = 0;
  const faceWins = new Map<string, number>();
  const half = Math.floor(boundStates.length / 2);
  for (let t = 0; t < boundStates.length; t++) {
    const e = boundObs[t];
    if (!e) continue;
    covered++;
    const b = bestAssign(e.colors, boundStates[t], omega);
    margMatch += b.match;
    margRead += b.read;
    faceWins.set(b.face, (faceWins.get(b.face) ?? 0) + 1);
    const frac = b.read ? b.match / b.read : 0;
    if (frac >= 0.85) nGood++;
    else if (frac >= 0.6) nMid++;
    else nJunk++;
    const nb = bestAssign(e.colors, boundStates[(t + half) % boundStates.length], omega);
    nullMatch += nb.match;
    nullRead += nb.read;
  }

  const name = basename(videoPath).replace(/\.MP4$/i, "");
  const oracleObs = ((): {
    rawObsOracle: (RawFaceObs[] | null)[] | null;
    finalRawObsOracle: RawFaceObs | null;
  } => {
    if (!(ORACLE_ACC > 0) && !ORACLE_SOFT) return { rawObsOracle: null, finalRawObsOracle: null };
    let seed = 42 ^ boundStates.length;
    const rng = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let z = seed;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    const BU = assignsForFaces(["B", "U"]);
    // 软神谕: 满覆盖单 B 窗口, 逐格抽本视频 GT 样本池真实特征 → 标定高斯概率向量
    if (ORACLE_SOFT) {
      if (!calibFitted || !calibPool) {
        console.warn(`  --oraclesoft 需要 --calibgt/--calib 标定成功, ${name} 跳过软合成`);
        return { rawObsOracle: null, finalRawObsOracle: null };
      }
      const cf = calibFitted, pool = calibPool, om = omegaAtCalib;
      let softOk = 0, softTot = 0;
      const synthSoft = (state: readonly number[], forcedAssign: readonly number[]): RawFaceObs => {
        const colors: (ColorName | null)[] = new Array(9).fill(null);
        const probs: (number[] | null)[] = new Array(9).fill(null);
        for (let i = 0; i < 9; i++) {
          const truth = COLOR_NAMES[Math.floor(om[state[forcedAssign[i]]] / 9)];
          const ps = pool.get(truth);
          if (!ps?.length) {
            // 池缺类 (罕见): one-hot 真值, 等效完美格 — 打印口径里会看出来
            colors[i] = truth;
            probs[i] = COLOR_LIST.map((c) => (c === truth ? 1 : 0));
            softOk++; softTot++;
            continue;
          }
          const smp = ps[Math.floor(rng() * ps.length)];
          const p = classProbs(smp.r, smp.g, smp.b, cf);
          let bi = 0;
          for (let k = 1; k < 6; k++) if (p[k] > p[bi]) bi = k;
          colors[i] = COLOR_LIST[bi];
          probs[i] = p;
          softTot++;
          if (COLOR_LIST[bi] === truth) softOk++;
        }
        return { colors, probs };
      };
      const res = {
        rawObsOracle: boundStates.map((st) => [synthSoft(st, BU[0])]),
        finalRawObsOracle: synthSoft(IDENTITY_PERM, BU[0]),
      };
      console.log(
        `  软神谕运行点: argmax 精度 ${((softOk / softTot) * 100).toFixed(1)}% (${softTot} 格, 满覆盖单窗, temper=${SOFT_TEMPER})`,
      );
      return res;
    }
    const FULL_MASK: (ColorName | null)[] = new Array(9).fill("W");
    const synth = (
      mask: readonly (ColorName | null)[],
      state: readonly number[],
      forcedAssign?: readonly number[],
    ): RawFaceObs => {
      const assign = forcedAssign ?? BU[Math.floor(rng() * BU.length)];
      return {
        colors: mask.map((c, i) => {
          if (!c) return null;
          const truth = COLOR_NAMES[Math.floor(omega[state[assign[i]]] / 9)];
          if (rng() < ORACLE_ACC) return truth;
          const wrong = COLOR_NAMES[(COLOR_NAMES.indexOf(truth) + 1 + Math.floor(rng() * 5)) % 6];
          return wrong;
        }),
      };
    };
    return {
      rawObsOracle: ORACLE_SINGLE
        ? boundStates.map((st) => [synth(FULL_MASK, st, BU[0])])
        : ORACLE_FULL
        ? boundStates.map((st) => [synth(FULL_MASK, st, BU[0]), synth(FULL_MASK, st, BU[4])])
        : segChains.map((chains, t) => {
            const gated = chains
              .filter((run) => run.len >= 4 && run.grid.filter(Boolean).length >= 7)
              .sort((a, b) => b.len - a.len)
              .slice(0, 3)
              .map((run) => synth(run.grid, boundStates[t]));
            return gated.length ? gated : null;
          }),
      finalRawObsOracle: ORACLE_FULL || ORACLE_SINGLE
        ? synth(FULL_MASK, IDENTITY_PERM, BU[0])
        : finalRawObs
          ? synth(finalRawObs.colors, IDENTITY_PERM)
          : null,
    };
  })();
  evals.push({
    name,
    nBounds: boundStates.length,
    covered,
    margMatch,
    margRead,
    nullMatch,
    nullRead,
    // 搜索观测 = 每段高置信静止链 (len≥4 且填格 ≥7, 宁缺毋滥 — 55% 准确率的
    // 弱观测是负资产, 垃圾链惩罚会把真路径挤出 beam; 实测门控前 e2e 更差), ≤3 条
    rawObs: segChains.map((chains) => {
      const gated = chains
        .filter((run) => run.len >= 4 && run.grid.filter(Boolean).length >= 7)
        .sort((a, b) => b.len - a.len)
        .slice(0, 3)
        .map((run) => ({ colors: run.grid }));
      return gated.length ? gated : null;
    }),
    // 逐帧观测: 链共识会被垃圾帧多数覆盖纯净单帧 (帧级软覆盖 70% vs GOOD 链 ~12%),
    // 直接喂单帧网格 + 搜索侧 drift-pin 平滑, 垃圾帧对所有假设近似等罚
    rawObsFrames: segFrameObs.map((gs) => {
      const picked = [...gs]
        .sort((a, b) => b.colors.filter(Boolean).length - a.colors.filter(Boolean).length)
        .slice(0, 8)
        .map((g) => ({ colors: g.colors }));
      return picked.length ? picked : null;
    }),
    ...oracleObs,
    finalRawObs,
    probs,
    scrambleSc,
    gtNoRot,
    boundStates,
    // trace 模 24 朝向比较, y 转体差异被吸收, afterState 直接可用
    afterStates: nonRotIdx.map((j) => afterState(j)),
  });

  // probs 质量: GT 面命中率 + 真路径概率赤字 (Σ log(p_max/p_gt), 视觉必须补回的分)
  let greedyHit = 0, probDeficit = 0, worstDef = 0;
  {
    const FLOOR = 0.03;
    for (let t = 0; t < boundStates.length; t++) {
      const tok = gtNoRot[t];
      const face = tok ? tok[0].toUpperCase() : null;
      const dist = probs[t] ?? {};
      const entries = Object.entries(dist) as [string, number][];
      const pMax = entries.reduce((m, [, p]) => Math.max(m, p), FLOOR);
      const pGt = face ? Math.max(dist[face] ?? 0, FLOOR) : FLOOR;
      const argmax = entries.reduce((b, e) => (e[1] > b[1] ? e : b), ["", 0] as [string, number])[0];
      if (face && argmax === face) greedyHit++;
      const d = Math.log(pMax / pGt);
      probDeficit += d;
      if (d > worstDef) worstDef = d;
      if (DO_HIST && d > 1.5) {
        console.log(`  probs坏段 t${t}: GT=${tok} p(${face})=${(dist[face ?? ""] ?? 0).toFixed(3)} argmax=${argmax}(${pMax.toFixed(3)}) 赤字${d.toFixed(1)}`);
      }
    }
  }

  const acc = margRead ? ((margMatch / margRead) * 100).toFixed(1) : "-";
  const nacc = nullRead ? ((nullMatch / nullRead) * 100).toFixed(1) : "-";
  const wins = [...faceWins.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}×${n}`).join(" ");
  console.log(
    `${name}: 区间 ${runs.length}, 边界 ${covered}/${boundStates.length} 有观测, 软覆盖天花板 ${softCov}/${boundStates.length}, 帧级软覆盖 ±12:${frameCov12} ±25:${frameCov25}/${boundStates.length}, **段双端证据 覆盖 ${segCov}/${boundStates.length} 逐格 ${segRead ? ((segMatch / segRead) * 100).toFixed(1) : "-"}%** (y段丢链 ${segYDropped}), 读格 ${margRead}, 边缘化逐格 ${acc}% (乱态对照 ${nacc}%)  质量 GOOD ${nGood}/mid ${nMid}/JUNK ${nJunk}  归属规则命中(GT≥80%区间): 就近 ${agreeInterval}/${nDiag} 终点 ${agreeEnd}/${nDiag}  κ=ω${omegaIdx}  赢面: ${wins}  末帧=${finalRawObs ? finalRawObs.colors.filter(Boolean).length + "格" : "无"}`,
  );
  console.log(
    `  probs质量: GT面命中 ${greedyHit}/${boundStates.length}, 概率赤字合计 ${probDeficit.toFixed(1)} (最坏单段 ${worstDef.toFixed(1)})`,
  );
  if (!NO_ANCHOR) {
    console.log(
      `  锚定: 冷面匹配 ${anchor.matched} (snap ${anchor.snapped}, 基修 ${anchor.rotFixed}, 新槽 ${anchor.fresh})`,
    );
  }
  console.log(
    `  钉死指派 视频级: 信号 ${pinSig.read ? ((pinSig.match / pinSig.read) * 100).toFixed(1) : "-"}% vs 乱态 ${pinNul.read ? ((pinNul.match / pinNul.read) * 100).toFixed(1) : "-"}% (分离 ${pinSig.read && pinNul.read ? ((pinSig.match / pinSig.read - pinNul.match / pinNul.read) * 100).toFixed(1) : "-"}pp)  |  span 级(${attachedSpans.length} span, ≥2链 ${multiSpans}): 信号 ${spanSig.read ? ((spanSig.match / spanSig.read) * 100).toFixed(1) : "-"}% (GOOD ${spanSig.good}/mid ${spanSig.mid}/JUNK ${spanSig.junk}) vs 乱态 ${spanNul.read ? ((spanNul.match / spanNul.read) * 100).toFixed(1) : "-"}% (分离 ${spanSig.read && spanNul.read ? ((spanSig.match / spanSig.read - spanNul.match / spanNul.read) * 100).toFixed(1) : "-"}pp)  |  自由24指派: ${segRead ? ((segMatch / segRead) * 100).toFixed(1) : "-"}% vs ${nacc}%`,
  );
  {
    const perColor = new Map<string, { ok: number; tot: number }>();
    const offDiag: [string, number][] = [];
    for (const [k, n] of confusion) {
      const gt = k[0], rd = k[1];
      const e = perColor.get(gt) ?? { ok: 0, tot: 0 };
      e.tot += n;
      if (gt === rd) e.ok += n;
      else offDiag.push([k, n]);
      perColor.set(gt, e);
    }
    offDiag.sort((a, b) => b[1] - a[1]);
    const colStr = [...perColor.entries()]
      .sort((a, b) => b[1].tot - a[1].tot)
      .map(([c, e]) => `${c}:${((e.ok / e.tot) * 100).toFixed(0)}%×${e.tot}`)
      .join(" ");
    console.log(
      `  逐色准确率(自由对齐): ${colStr}  混淆TOP: ${offDiag.slice(0, 8).map(([k, n]) => `${k[0]}→${k[1]}×${n}`).join(" ")}  |  冷帧逐格 ${coldRead ? ((coldMatch / coldRead) * 100).toFixed(1) : "-"}% (${coldRead})  跟踪帧逐格 ${trkRead ? ((trkMatch / trkRead) * 100).toFixed(1) : "-"}% (${trkRead})  帧级乱态对照 ${frNullRead ? ((frNullMatch / frNullRead) * 100).toFixed(1) : "-"}%`,
    );
  }
}

// 汇总
const totRead = evals.reduce((s, e) => s + e.margRead, 0);
const totOk = evals.reduce((s, e) => s + e.margMatch, 0);
const totNullRead = evals.reduce((s, e) => s + e.nullRead, 0);
const totNull = evals.reduce((s, e) => s + e.nullMatch, 0);
const totCov = evals.reduce((s, e) => s + e.covered, 0);
const totBounds = evals.reduce((s, e) => s + e.nBounds, 0);
console.log(
  `\n===== 提取汇总: 覆盖 ${totCov}/${totBounds} = ${((totCov / totBounds) * 100).toFixed(1)}%, 边缘化逐格 ${totOk}/${totRead} = ${totRead ? ((totOk / totRead) * 100).toFixed(1) : "-"}% (乱态对照底噪 ${totNullRead ? ((totNull / totNullRead) * 100).toFixed(1) : "-"}%) =====`,
);

if (DUMP_OBS) {
  writeFileSync(DUMP_OBS, JSON.stringify({ videos: dumpVideos }));
  console.log(`观测转储 → ${DUMP_OBS} (${dumpVideos.length} 视频)`);
}

if (DO_SEARCH) {
  console.log(
    `\n===== 端到端锚定搜索 (${PER_FRAME ? "逐帧观测" : "静止区间观测"} + probs, 限面 ${SEARCH_FACES.join("/")}${DRIFT ? ", drift-pin" : PIN_MODE ? ", 钉死pin" : ""}) =====`,
  );
  let sumOk = 0, sumTot = 0, anchoredCount = 0;
  for (const e of evals) {
    // 门控后的高置信链可信度高于全体链实测均值, 取固定 0.75; 逐帧观测更噪, 0.7
    const hitProb = PER_FRAME ? 0.7 : 0.75;
    const traceLog: string[] = [];
    const t0 = performance.now();
    const r = anchoredBeamSearch(e.probs, e.scrambleSc, {
      beamWidth: BEAM,
      maxRotInserts: 3,
      rawObservations: e.rawObsOracle ?? (PER_FRAME ? e.rawObsFrames : e.rawObs),
      finalRawObservation: (e.rawObsOracle ? e.finalRawObsOracle : e.finalRawObs) ?? undefined,
      rawHitProb: hitProb,
      rawMissProb: (1 - hitProb) / 5,
      rawSoftTemper: SOFT_TEMPER,
      rawFaces: SEARCH_FACES,
      rawPinWindows: PIN_MODE || DRIFT,
      rawPinDrift: DRIFT,
      rawJunkProb: JUNK_P,
      forward: FORWARD,
      // 相邻帧观测强相关 (~10ms 间隔同姿态同错误), 有效独立样本 ~1/3
      visualWeight: PER_FRAME ? 0.35 : 1,
      debugGtStates: TRACE ? (FORWARD ? e.afterStates : e.boundStates) : undefined,
      onSegmentTrace: TRACE
        ? (t, info) => {
            traceLog.push(info.rank < 0 ? `t${t}:†` : `t${t}:${info.rank}(落后${info.gap.toFixed(1)})`);
          }
        : undefined,
    });
    if (TRACE) {
      // 逆序搜索, traceLog 按 t 降序; 真路径死亡点 = 最后一个非 † 之后的首个 †
      console.log(`  GT存活: ${traceLog.join(" ")}`);
    }
    const ms = Math.round(performance.now() - t0);
    const res = r.anchored ? r : r.bestUnanchored;
    let correct = 0;
    if (res) {
      const n = Math.min(res.segTokens.length, e.gtNoRot.length);
      for (let i = 0; i < n; i++) {
        if (normalizeToken(res.segTokens[i]) === normalizeToken(e.gtNoRot[i])) correct++;
      }
    }
    console.log(
      `${e.name}: anchored=${r.anchored} 逐段 ${correct}/${e.gtNoRot.length} (hitProb=${hitProb.toFixed(2)}) ${ms}ms${res && r.anchored ? "" : " (未锚定)"}`,
    );
    if (res && !r.anchored) {
      console.log(`  best: ${res.movesFlat.slice(0, 20).join(" ")}...`);
    }
    sumOk += correct;
    sumTot += e.gtNoRot.length;
    if (r.anchored) anchoredCount++;
  }
  console.log(`\n端到端: 锚定 ${anchoredCount}/${evals.length}, 逐段 ${sumOk}/${sumTot} = ${((sumOk / sumTot) * 100).toFixed(1)}%`);
}
