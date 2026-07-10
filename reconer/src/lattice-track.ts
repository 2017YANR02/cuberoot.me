/**
 * lattice-track.ts — 逐帧晶格提取环 + 重获取一致性锚定 (负结果⑩三根因的修复层)。
 *
 * 三个漂移源 (conserve-eval --samecheck 实锤, 2026-07-10):
 *   1. 冷重拟合窗口平移: fitFaceGrid 的 3×3 窗口纯按色块覆盖选, 部分遮挡下 ±1 格
 *      歧义; 错位窗口再污染跟踪 prior → 同边界跨链对齐 p50 -30 (±1 格平移搜索后 -10);
 *   2. trackFaceGrid 平移搜索无运动惩罚, "邻格更好读"白拿 → 可逐帧走格;
 *   3. 第二面 (U 槽) 从不做基连续化, 旋转身份逐帧自由。
 *
 * 锚定策略 (相机固定 + 双手握持, 面中心帧间移动 ≪ 1 格):
 *   - 双槽参照 (此机位恒见 B/U 两面): 冷拟合面与参照按中心距联合匹配;
 *   - 基旋转连续化对任意 gap 都安全 (参照永不过期), 消根因 3;
 *   - 窗口平移 snap: ±1 格枚举, cost = 中心距/pitch + 0.6×出窗稳固色块数,
 *     显著优于不动才 snap — 满 9 格拟合天然不 snap (色块自证), 只救部分遮挡歧义;
 *   - snap 后用内点色块重放置 + 格心重采样重建观测 (窗口外流入格诚实重读);
 *   - 跟踪加运动惩罚 (走一格须净赚 ≥1 可读格), 消根因 2。
 * anchor=false 精确复刻 legacy 行为 (reorient 仅 cold[0]、无 snap、无惩罚) 供 A/B。
 */
import type { ColorCalib } from "./color-calib.ts";
import type { ColorName } from "./reconstruct.ts";
import {
  extractFaceObservations,
  reorientObsToBasis,
  sampleCell,
  trackFaceGrid,
  type Blob,
  type FaceGrid,
  type FaceObservation,
} from "./sticker-blobs.ts";

/** 槽平移参照: 该槽最后一次锚定成功的网格中心 (新鲜度敏感; 旋转参照=恒定规范基) */
interface SlotRef {
  grid: FaceGrid;
  lastIdx: number;
}

/** 槽 = 此机位一个可见面窗口 (B 下 / U 上): 规范基恒定 (pass1 全局拟合), 平移参照新鲜 */
interface Slot {
  v1: { x: number; y: number };
  v2: { x: number; y: number };
  pitch: number;
  cy: number;
  ref: SlotRef | null;
}

export interface AnchorStats {
  /** 冷拟合面成功匹配槽参照数 */
  matched: number;
  /** 其中发生 ±1 格窗口 snap 数 */
  snapped: number;
  /** 基旋转被连续化修正数 (bestK≠0) */
  rotFixed: number;
  /** 位置远离槽参照 (新建/重建参照) 数 */
  fresh: number;
  /** 基对不上任何槽规范基 (残差>阈/pitch 失调) 被丢弃的冷拟合面数 — 垃圾晶格拦截 */
  rejected: number;
}

export interface TrackedFrames {
  grids: FaceObservation[][];
  frameSpan: number[];
  nCold: number;
  nTracked: number;
  anchor: AnchorStats;
}

const OUT_PEN = 0.6; // 每个被 shift 排出窗口的稳固色块的代价 (pitch 单位)
const SNAP_MARGIN = 0.3; // k≠0 须比 k=0 净省的 cost, 防近平局抖动
const SNAP_RESID = 0.45; // snap 候选的平移残差上限 (pitch): 位移须 ≈ 精确整数格
const SNAP_MAX_GAP = 30; // 参照过这个帧龄不再 snap (魔方可能真移过格)
const SOLID_FRAC = 0.55; // "稳固色块" = 面积 ≥ 该比例×内点中位面积 (排除异面小条)
const CANON_COS = Math.cos((28 * Math.PI) / 180); // 基对齐容差: 最优旋转变体两轴皆须 ≥ cos28°
const CANON_PITCH = 1.35; // pitch 相对规范值容差 (倍率上限)
const MATCH_GATE = 1.7; // 槽平移参照匹配门 (pitch, 原始中心距; 槽间距 ~2.5-3.5p)
const REF_STALE = 40; // 平移参照超此帧龄视为过期 (fresh 面可直接顶替)

/** 解色块在网格基下的整数格坐标 (相对窗口原点); res 超阈丢弃 */
function blobLatticeCoords(g: FaceGrid, blobs: readonly Blob[]): { b: Blob; gc: number; gr: number }[] {
  const det = g.v1.x * g.v2.y - g.v1.y * g.v2.x;
  if (Math.abs(det) < 1e-9) return [];
  const out: { b: Blob; gc: number; gr: number }[] = [];
  for (const b of blobs) {
    const dx = b.cx - g.origin.x;
    const dy = b.cy - g.origin.y;
    const c = (dx * g.v2.y - dy * g.v2.x) / det;
    const r = (dy * g.v1.x - dx * g.v1.y) / det;
    const gc = Math.round(c);
    const gr = Math.round(r);
    if (Math.hypot(c - gc, r - gr) > 0.3) continue;
    out.push({ b, gc, gr });
  }
  return out;
}

/**
 * 窗口平移重建: 原点移 k1 列 k2 行, 9 格从内点色块重放置 (含原窗口外内点),
 * 无色块格按格心重采样。k=0 时等价原观测 (仅供 k≠0 调用)。
 */
export function shiftFaceObs(
  obs: FaceObservation,
  k1: number,
  k2: number,
  rgb: Uint8Array,
  w: number,
  h: number,
  calib: ColorCalib | null = null,
): FaceObservation {
  const g = obs.grid;
  const coords = blobLatticeCoords(g, g.inlierBlobs);
  const byCell = new Map<number, Blob>();
  for (const { b, gc, gr } of coords) {
    const c = gc - k1;
    const r = gr - k2;
    if (c < 0 || c > 2 || r < 0 || r > 2) continue;
    const key = r * 3 + c;
    const prev = byCell.get(key);
    if (!prev || b.area > prev.area) byCell.set(key, b);
  }
  const origin = {
    x: g.origin.x + k1 * g.v1.x + k2 * g.v2.x,
    y: g.origin.y + k1 * g.v1.y + k2 * g.v2.y,
  };
  const cells: (Blob | null)[] = new Array(9).fill(null);
  const colors: (ColorName | null)[] = new Array(9).fill(null);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const blob = byCell.get(i) ?? null;
      cells[i] = blob;
      if (blob) {
        colors[i] = blob.color;
      } else {
        const x = origin.x + c * g.v1.x + r * g.v2.x;
        const y = origin.y + c * g.v1.y + r * g.v2.y;
        colors[i] = sampleCell(rgb, w, h, x, y, g.pitch * 0.22, 0.6, calib);
      }
    }
  }
  return {
    colors,
    blobCount: obs.blobCount,
    grid: { ...g, cells, origin, filled: byCell.size },
  };
}

/** 面中心 (格 (1,1) 中心) */
function gridCenter(g: FaceGrid): { x: number; y: number } {
  return { x: g.origin.x + g.v1.x + g.v2.x, y: g.origin.y + g.v1.y + g.v2.y };
}

/**
 * 平移 snap 单面到槽参照 (基已由 alignToCanon 对齐, 此处纯平移): ±1 格窗口 snap。
 * snap 只在"位移 ≈ 精确整数格"时开火 (残差 ≤ SNAP_RESID): 亚格位移 = 魔方真实
 * 漂移, 不许按中心距硬吸 (v1 教训: 宽松距离 snap 会把正确拟合扳向过期参照);
 * 另须 gap ≤ SNAP_MAX_GAP 且比不动净省 ≥ SNAP_MARGIN, 出窗稳固色块照罚。
 */
function snapToRef(
  obs: FaceObservation,
  ref: FaceGrid,
  gap: number,
  rgb: Uint8Array,
  w: number,
  h: number,
  calib: ColorCalib | null,
): { obs: FaceObservation; snapped: boolean } {
  if (gap > SNAP_MAX_GAP) return { obs, snapped: false };
  const ro = obs;
  const g = ro.grid;
  const c = gridCenter(g);
  const rc = gridCenter(ref);
  const coords = blobLatticeCoords(g, g.inlierBlobs);
  const areas = coords.map((e) => e.b.area).sort((a, b) => a - b);
  const medArea = areas.length ? areas[areas.length >> 1] : 0;
  const eval2 = (k1: number, k2: number): { d: number; cost: number } => {
    const d =
      Math.hypot(
        c.x + k1 * g.v1.x + k2 * g.v2.x - rc.x,
        c.y + k1 * g.v1.y + k2 * g.v2.y - rc.y,
      ) / g.pitch;
    let out = 0;
    for (const { b, gc, gr } of coords) {
      if (b.area < SOLID_FRAC * medArea) continue;
      const wc = gc - k1;
      const wr = gr - k2;
      if (wc < 0 || wc > 2 || wr < 0 || wr > 2) out++;
    }
    return { d, cost: d + OUT_PEN * out };
  };
  const cost0 = eval2(0, 0).cost;
  let bestK1 = 0;
  let bestK2 = 0;
  let bestCost = cost0;
  for (let k2 = -1; k2 <= 1; k2++) {
    for (let k1 = -1; k1 <= 1; k1++) {
      if (!k1 && !k2) continue;
      const e = eval2(k1, k2);
      if (e.d > SNAP_RESID) continue; // 残差门: 位移须 ≈ 精确整数格
      if (e.cost < bestCost - 1e-9) {
        bestCost = e.cost;
        bestK1 = k1;
        bestK2 = k2;
      }
    }
  }
  if ((bestK1 || bestK2) && cost0 - bestCost >= SNAP_MARGIN) {
    return { obs: shiftFaceObs(ro, bestK1, bestK2, rgb, w, h, calib), snapped: true };
  }
  return { obs: ro, snapped: false };
}

export interface ExtractOptions {
  calib?: ColorCalib | null;
  minArea?: number;
  /** false = 精确复刻 legacy (reorient 仅 cold[0] 到活 prior, 无 snap/惩罚/双槽) */
  anchor?: boolean;
  /** 跟踪运动惩罚 (pitch 单位每可读格; anchor 模式默认 0.9) */
  motionPenalty?: number;
  /** 诊断: false = 关平移 snap (只旋转锚定) */
  snap?: boolean;
  /** 诊断: false = 跟踪帧不更新槽参照 (只有冷拟合喂参照) */
  trackedRefUpdate?: boolean;
}

/**
 * pass1: 从全部冷拟合面推每槽恒定规范基。槽按中心 y 中位分二 (B 恒在 U 下方;
 * cy 展布 < 1.6 pitch 时视为单槽)。每槽在强拟合池 (filled 阶梯 7→6→5→全部) 里
 * 先按 pitch 带筛, 再取 v1 角 (折叠 mod 90°) 的圆中位元, 用其真实 (v1,v2,pitch)。
 */
function computeSlots(coldAll: FaceObservation[][]): Slot[] {
  const faces: { cy: number; g: FaceGrid; filled: number }[] = [];
  for (const gs of coldAll) {
    for (const o of gs) {
      faces.push({ cy: gridCenter(o.grid).y, g: o.grid, filled: o.grid.filled });
    }
  }
  if (!faces.length) return [];
  const cys = faces.map((f) => f.cy).sort((a, b) => a - b);
  const cyMed = cys[cys.length >> 1];
  const pitches = faces.map((f) => f.g.pitch).sort((a, b) => a - b);
  const pitchMed = pitches[pitches.length >> 1];
  const spread = cys[Math.floor(0.9 * (cys.length - 1))] - cys[Math.floor(0.1 * (cys.length - 1))];
  const groups: (typeof faces)[] =
    spread < 1.6 * pitchMed
      ? [faces]
      : [faces.filter((f) => f.cy >= cyMed), faces.filter((f) => f.cy < cyMed)];
  const slots: Slot[] = [];
  for (const grp of groups) {
    if (grp.length < 3) continue;
    let pool = grp.filter((f) => f.filled >= 7);
    if (pool.length < 5) pool = grp.filter((f) => f.filled >= 6);
    if (pool.length < 5) pool = grp.filter((f) => f.filled >= 5);
    if (pool.length < 3) pool = grp;
    const ps = pool.map((f) => f.g.pitch).sort((a, b) => a - b);
    const pm = ps[ps.length >> 1];
    const banded = pool.filter((f) => f.g.pitch >= pm / 1.25 && f.g.pitch <= pm * 1.25);
    const cand = banded.length >= 3 ? banded : pool;
    // v1 角折叠 mod 90° 的圆中位元 (最小化对全体的圆距和)
    const fold = (g: FaceGrid) => {
      const a = (Math.atan2(g.v1.y, g.v1.x) * 180) / Math.PI;
      return ((a % 90) + 90) % 90;
    };
    const angs = cand.map((f) => fold(f.g));
    let bi = 0;
    let bs = Infinity;
    for (let i = 0; i < cand.length; i++) {
      let s = 0;
      for (let j = 0; j < cand.length; j++) {
        const d = Math.abs(angs[i] - angs[j]);
        s += Math.min(d, 90 - d);
      }
      if (s < bs) {
        bs = s;
        bi = i;
      }
    }
    const gcys = grp.map((f) => f.cy).sort((a, b) => a - b);
    slots.push({
      v1: cand[bi].g.v1,
      v2: cand[bi].g.v2,
      pitch: pm,
      cy: gcys[gcys.length >> 1],
      ref: null,
    });
  }
  return slots;
}

/** 基对齐检查: 旋到规范基最对齐变体; 两轴 cos ≥ CANON_COS 且 pitch 在带内才收, 否则判垃圾 */
function alignToCanon(obs: FaceObservation, slot: Slot): FaceObservation | null {
  const pr = obs.grid.pitch / slot.pitch;
  if (pr > CANON_PITCH || pr < 1 / CANON_PITCH) return null;
  const ro = reorientObsToBasis(obs, slot.v1, slot.v2);
  const g = ro.grid;
  const cosA =
    (g.v1.x * slot.v1.x + g.v1.y * slot.v1.y) /
    (Math.hypot(g.v1.x, g.v1.y) * Math.hypot(slot.v1.x, slot.v1.y) || 1);
  const cosB =
    (g.v2.x * slot.v2.x + g.v2.y * slot.v2.y) /
    (Math.hypot(g.v2.x, g.v2.y) * Math.hypot(slot.v2.x, slot.v2.y) || 1);
  if (cosA < CANON_COS || cosB < CANON_COS) return null;
  return ro;
}

/**
 * 共享逐帧提取环 (real-eval / conserve-eval 同款): 冷检测优先, 失败时时间连续性
 * 跟踪; anchor 模式 = 恒定规范基锚定 (pass1 全局拟合每槽规范基, pass2 逐帧对齐 +
 * 垃圾晶格拦截 + 残差门控平移 snap)。span 语义与 legacy 一致 (prior 死后首个
 * 被接受的冷拟合帧递增)。
 */
export function extractTrackedFrames(
  frameAt: (i: number) => Uint8Array,
  nFrames: number,
  w: number,
  h: number,
  mask: Uint8Array | null,
  opts: ExtractOptions = {},
): TrackedFrames {
  const calib = opts.calib ?? null;
  const anchor = opts.anchor ?? true;
  const motionPenalty = opts.motionPenalty ?? (anchor ? 0.9 : 0);
  const snapOn = opts.snap ?? true;
  // 跟踪帧喂平移参照默认开: 接受后的冷拟合太稀 (~40/视频, gap≈80 帧 > SNAP_MAX_GAP),
  // 没有跟踪续参照 snap 永远过期。v1 的跟踪毒化已被规范基 + 残差门关死。
  const trackedRefUpdate = opts.trackedRefUpdate ?? true;
  const grids: FaceObservation[][] = new Array(nFrames);
  const frameSpan: number[] = new Array(nFrames).fill(-1);
  const stats: AnchorStats = { matched: 0, snapped: 0, rotFixed: 0, fresh: 0, rejected: 0 };
  let prior: FaceGrid | null = null;
  let priorColors: readonly (ColorName | null)[] | null = null;
  let priorMiss = 0;
  let nCold = 0;
  let nTracked = 0;
  let spanId = -1;

  // pass0: 冷提取只跑一遍 (锚定/legacy 共用)
  const coldAll: FaceObservation[][] = new Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    coldAll[i] = extractFaceObservations(frameAt(i), w, h, mask, { minArea: opts.minArea, calib });
  }
  const slots: Slot[] = anchor ? computeSlots(coldAll) : [];

  /** 锚定单帧的冷拟合面: 槽指派 (双面按 cy 序, 单面按参照中心距/槽 cy) → 基对齐拦截 → snap */
  const anchorFaces = (cold: FaceObservation[], i: number, rgb: Uint8Array): FaceObservation[] => {
    if (!slots.length) return cold;
    const out: FaceObservation[] = [];
    // 槽指派: 2 面按 cy 排序对号 (B=cy 大槽), 1 面取最近槽
    const byCyDesc = [...slots].sort((a, b) => b.cy - a.cy);
    const assign = (obs: FaceObservation): Slot => {
      if (slots.length === 1) return slots[0];
      const c = gridCenter(obs.grid);
      let best = slots[0];
      let bd = Infinity;
      for (const s of slots) {
        const d = s.ref
          ? Math.hypot(c.x - gridCenter(s.ref.grid).x, c.y - gridCenter(s.ref.grid).y) / s.pitch
          : Math.abs(c.y - s.cy) / s.pitch;
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };
    const pairs: [FaceObservation, Slot][] =
      cold.length >= 2 && slots.length >= 2
        ? [...cold]
            .sort((a, b) => gridCenter(b.grid).y - gridCenter(a.grid).y)
            .map((o, k) => [o, byCyDesc[Math.min(k, byCyDesc.length - 1)]] as [FaceObservation, Slot])
        : cold.map((o) => [o, assign(o)] as [FaceObservation, Slot]);
    for (const [obs, slot] of pairs) {
      const aligned = alignToCanon(obs, slot);
      if (!aligned) {
        stats.rejected++; // 垃圾晶格 (基/间距对不上该槽规范): 丢弃, 让跟踪路径接管
        continue;
      }
      if (aligned !== obs) stats.rotFixed++;
      const c = gridCenter(aligned.grid);
      const ref = slot.ref;
      const refDist = ref
        ? Math.hypot(c.x - gridCenter(ref.grid).x, c.y - gridCenter(ref.grid).y) / slot.pitch
        : Infinity;
      if (ref && refDist <= MATCH_GATE) {
        const res = snapOn
          ? snapToRef(aligned, ref.grid, i - ref.lastIdx, rgb, w, h, calib)
          : { obs: aligned, snapped: false };
        stats.matched++;
        if (res.snapped) stats.snapped++;
        slot.ref = { grid: res.obs.grid, lastIdx: i };
        out.push(res.obs);
      } else {
        // 位置远离参照 (魔方大位移/首见): 参照缺失或过期才顶替, 防单帧毒参照
        stats.fresh++;
        if (!ref || i - ref.lastIdx > REF_STALE) slot.ref = { grid: aligned.grid, lastIdx: i };
        out.push(aligned);
      }
    }
    return out;
  };

  for (let i = 0; i < nFrames; i++) {
    const rgb = frameAt(i);
    const cold = coldAll[i];
    let faces: FaceObservation[] = [];
    if (cold.length) {
      if (anchor) {
        faces = anchorFaces(cold, i, rgb);
      } else if (prior) {
        faces = [reorientObsToBasis(cold[0], prior.v1, prior.v2), ...cold.slice(1)];
      } else {
        faces = cold;
      }
    }
    if (faces.length) {
      if (!prior) spanId++;
      grids[i] = faces;
      frameSpan[i] = spanId;
      prior = faces[0].grid;
      priorColors = faces[0].colors;
      priorMiss = 0;
      nCold++;
      continue;
    }
    // 冷失败或全被拦截: 时间连续性跟踪
    const tracked: FaceObservation | null = prior
      ? trackFaceGrid(rgb, w, h, prior, priorColors, { calib, motionPenalty })
      : null;
    if (tracked) {
      grids[i] = [tracked];
      frameSpan[i] = spanId;
      if (anchor && trackedRefUpdate) {
        const c = gridCenter(tracked.grid);
        let near: Slot | null = null;
        let bd = Infinity;
        for (const s of slots) {
          if (!s.ref) continue;
          const rc = gridCenter(s.ref.grid);
          const d = Math.hypot(c.x - rc.x, c.y - rc.y);
          if (d < bd) {
            bd = d;
            near = s;
          }
        }
        if (near && bd <= 1.6 * tracked.grid.pitch) {
          near.ref = { grid: tracked.grid, lastIdx: i };
        }
      }
      prior = tracked.grid;
      priorColors = tracked.colors;
      priorMiss = 0;
      nTracked++;
    } else {
      grids[i] = [];
      if (prior && ++priorMiss > 5) {
        prior = null;
        priorColors = null;
      }
    }
  }
  return { grids, frameSpan, nCold, nTracked, anchor: stats };
}
