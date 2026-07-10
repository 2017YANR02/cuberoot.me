/**
 * prior-sim.ts — 先验判决实验 (负⑪后): 尾段 LL 字典解码可行性。
 *
 * 问题: 颜色墙 (逐格 ~55%, 单格特征天花板 73% < 75% 悬崖) 下, 把搜索先验从
 * "任意步 (~18 分支)" 换成 "人类 LL 公式字典", 逐段证据的总分能否把真解排第一?
 * 逐段 beam 错误复利, 整段候选排序错误只做加法 — 这是先验侧唯一没试过的杠杆。
 *
 * 设计:
 *   候选 = (ZBLL 472 案例 ∪ PLL 21 案例的全部公式) × y^k 前缀 × 前/后 AUF,
 *          按尾段 STM 数硬过滤 (段数是观测量), 逆放锚定复原态 (终态约束内建)。
 *          GT 序列显式加入候选 (考判别力, 不考字典收录率 — 收录率单独报告;
 *          真实执行含手滑调整对如 v4 的 R' R, 字典天然不含)。
 *   证据 = real-eval --dumpobs 的真实对齐观测 (REAL), 或按池化混淆矩阵对
 *          同一覆盖骨架重采样读出色 (--synth N, Monte-Carlo 置信)。
 *   评分 = Σ_链 max(双端) Σ_格 log P(读出色 | 候选态色) — 所有候选共享 GT 对齐
 *          的 facelet 映射 ("朝向已知" 乐观假设, 对全体候选一视同仁)。
 *   对照 = 乱读 (均匀随机读出色) 下 GT 排名应 ~均匀 → 证明判别力来自信号。
 *
 * 用法: npx tsx scripts/prior-sim.ts [--dump <obs-dump.json>] [--algs <dir>]
 *       [--video 3] [--synth 200] [--seed 42] [--spanalign|--rotalign|--freealign]
 *   默认输入在 reconer/.tmp/ (gitignored), 重建:
 *     obs-dump.json: npx tsx scripts/real-eval.ts --dumpobs .tmp/obs-dump.json
 *     zbll.json / pll.json: https://api.cuberoot.me/v1/alg/sets/3x3/{zbll,pll} 快照
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGT } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import { IDENTITY_PERM, invertPerm, permKey, physicalPerm } from "../src/rotation-perms.ts";
import { assignsForFaces } from "../src/anchored-search.ts";
import type { Perm } from "../src/cube-state.ts";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const DUMP_PATH = argAt("--dump") ?? join(import.meta.dirname, "..", ".tmp", "obs-dump.json");
const ALGS_DIR = argAt("--algs") ?? join(import.meta.dirname, "..", ".tmp");
const ONLY = argAt("--video");
const SYNTH_N = parseInt(argAt("--synth") ?? "200", 10);
const SEED = parseInt(argAt("--seed") ?? "42", 10);
// 对齐四界 (生产真值 = --spanalign, 不借任何 GT):
//   默认       乐观界: 面+旋转+端全借 GT 对齐 ("朝向已知", 含 GT 过拟合)
//   --spanalign 生产界: B/U 双窗口模型, 每候选每 span 联合拟合 (B旋转×U旋转) 16 组合,
//              每链自由选窗口 (B/U) 与端 (前/后态) — 与 real-eval 已验证的 span 级
//              pin 模型同构, 全部信息生产可得 (span 身份 = lattice-track 规范基锚定)
//   --rotalign 诊断界: 面身份借 GT, 面内旋转每链自由 4 选 1
//   --freealign 悲观界: 每候选每链自由 24 指派 (纯颜色统计, 无任何跟踪身份)
const FREE_ALIGN = process.argv.includes("--freealign");
const ROT_ALIGN = process.argv.includes("--rotalign");
const SPAN_ALIGN = process.argv.includes("--spanalign");
// --pinalign 生产界(迁移版): 窗口指派从前段 (cross/F2L, 生产由已知打乱+联合解码
// 自洽钉定, 此处用前段 GT 对齐加权投票作代理) 拟合 top-2 后冻结, 尾段每链只剩
// 2 指派 × 双端 — 测 pin 跨阶段迁移性 (中途换握/倾斜是唯一破坏源)
const PIN_ALIGN = process.argv.includes("--pinalign");
let PIN_POOL: (readonly number[])[] = [];
// --winalign 生产界(尾段自拟合版): 链按晶格中心空间 2-means 聚成两个窗口 (窗口身份
// = 画面位置, 生产可得), 每候选每窗口在尾段内拟合单一指派 (24 选 1, 尾段单握恒定
// 假设), 链绑定自己窗口, 端自由 — pin 跨阶段迁移已证伪 (F2L↔LL 换握), 这是
// 不依赖迁移的最紧生产界
const WIN_ALIGN = process.argv.includes("--winalign");
// --epochs K 生产界(握持时间片版): 在 --winalign 基础上, 每窗口指派允许沿时间轴
// 切换 ≤K 次 (换握 = 离散时间事件 → 指派分段常量), 每候选每窗口 DP 精确解最优
// 分段 — 逐链自由 (freealign, 忽略时间连续性) 与全程单指派 (winalign, 否认换握)
// 之间物理正确的中间模型; K=0 退化为 winalign
const epochArg = process.argv.indexOf("--epochs");
const EPOCHS_K = epochArg >= 0 ? parseInt(process.argv[epochArg + 1], 10) : -1;
const EPOCH_ALIGN = EPOCHS_K >= 0;
// 整色性证据通道权重: 候选态预测格对同/异色 vs 读出一致性 (实测 同真色对读一致
// 45.3% vs 异真色 22.7%, ~2:1/对; 不依赖绝对颜色, 绕开 R/O/Y 色相塌缩)
const PAIR_W = parseFloat(argAt("--pairw") ?? "0");
const LP_PAIR = {
  sameAgree: Math.log(0.453), sameDis: Math.log(1 - 0.453),
  diffAgree: Math.log(0.227), diffDis: Math.log(1 - 0.227),
};
// 背景 (真色未知) 的格对一致边缘概率: (2326×0.453+4056×0.227)/6382 ≈ 0.309
const LP_PAIR_BG = { agree: Math.log(0.309), dis: Math.log(1 - 0.309) };

// ---------- 输入 ----------

interface DumpChain {
  end: 0 | 1;
  face: string;
  facelets: number[];
  read: (string | null)[];
  gt: string[];
  /** 跟踪 span 身份 (span 内窗口旋转恒定); 旧转储无此字段 → --spanalign 会报错 */
  span?: number;
  /** 链晶格中心 (画面像素) — --winalign 空间聚类窗口身份 */
  cx?: number;
  cy?: number;
  /** 载入后计算: 空间 2-means 窗口 id */
  win?: number;
}
interface DumpVideo {
  name: string;
  omega: number[];
  gtNoRot: string[];
  tailRotations: string[];
  confusion: Record<string, number>;
  bounds: DumpChain[][];
}
const dump = JSON.parse(readFileSync(DUMP_PATH, "utf8")) as { videos: DumpVideo[] };
if (WIN_ALIGN || EPOCH_ALIGN) {
  // 每视频全部链按 (cx,cy) 2-means → 窗口 id (init 用 cy 极值对, 两窗口画面上下分离)
  for (const v of dump.videos) {
    const all = v.bounds.flat();
    if (all.some((c) => c.cx === undefined)) throw new Error("转储缺 cx/cy — 用新版 real-eval --dumpobs 重建");
    const byY = [...all].sort((a, b) => a.cy! - b.cy!);
    let c1 = [byY[0].cx!, byY[0].cy!], c2 = [byY[byY.length - 1].cx!, byY[byY.length - 1].cy!];
    for (let it = 0; it < 20; it++) {
      for (const c of all) {
        const d1 = (c.cx! - c1[0]) ** 2 + (c.cy! - c1[1]) ** 2;
        const d2 = (c.cx! - c2[0]) ** 2 + (c.cy! - c2[1]) ** 2;
        c.win = d1 <= d2 ? 0 : 1;
      }
      const s = [[0, 0, 0], [0, 0, 0]];
      for (const c of all) { s[c.win!][0] += c.cx!; s[c.win!][1] += c.cy!; s[c.win!][2]++; }
      if (s[0][2]) c1 = [s[0][0] / s[0][2], s[0][1] / s[0][2]];
      if (s[1][2]) c2 = [s[1][0] / s[1][2], s[1][1] / s[1][2]];
    }
  }
}

interface AlgCase {
  name: string;
  algs: { alg: string }[][];
}
const loadCases = (file: string): AlgCase[] =>
  (JSON.parse(readFileSync(join(ALGS_DIR, file), "utf8")) as { cases: AlgCase[] }).cases;
const dictAlgs: { alg: string; caseName: string }[] = [];
{
  const seen = new Set<string>();
  for (const c of [...loadCases("zbll.json"), ...loadCases("pll.json")]) {
    for (const v of c.algs[0] ?? []) {
      if (!v.alg || seen.has(v.alg)) continue;
      seen.add(v.alg);
      dictAlgs.push({ alg: v.alg, caseName: c.name });
    }
  }
}

// ---------- 魔方 / 评分基元 ----------

const COLOR_NAMES = ["W", "R", "G", "Y", "O", "B"] as const;
type Color = (typeof COLOR_NAMES)[number];

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/** 逆放候选序列 (锚定终态复原): 每个非转体 token 的前/后态, 相机系与 real-eval 一致 */
function replayStates(toks: string[], tailRot: string[]): { starts: Perm[]; afters: Perm[] } {
  const full = [...toks, ...tailRot];
  const startAll: Perm[] = new Array(full.length + 1);
  startAll[full.length] = IDENTITY_PERM;
  let cur: Perm = IDENTITY_PERM;
  for (let j = full.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(full[j])));
    startAll[j] = cur;
  }
  const starts: Perm[] = [];
  const afters: Perm[] = [];
  for (let j = 0; j < toks.length; j++) {
    if (ROTATION_TOKENS.has(toks[j])) continue;
    starts.push(startAll[j]);
    afters.push(startAll[j + 1]);
  }
  return { starts, afters };
}

/** 混淆似然 log P(读出色 | 真色), +1 平滑; 打分默认留一 (排除被测视频, 免循环) */
type LogConf = Record<string, number>;
function buildLogConf(videos: DumpVideo[]): LogConf {
  const counts: Record<string, number> = {};
  for (const v of videos) {
    for (const [k, n] of Object.entries(v.confusion)) counts[k] = (counts[k] ?? 0) + n;
  }
  const logConf: LogConf = {};
  for (const gt of COLOR_NAMES) {
    let row = 0;
    for (const rd of COLOR_NAMES) row += counts[`${gt}${rd}`] ?? 0;
    for (const rd of COLOR_NAMES) {
      logConf[`${gt}${rd}`] = Math.log(((counts[`${gt}${rd}`] ?? 0) + 1) / (row + 6));
    }
  }
  return logConf;
}

/** 混淆行的采样 CDF (SYNTH 生成器 — 用视频自身噪声) */
function buildConfCdf(logConf: LogConf): Record<string, { c: Color; p: number }[]> {
  const cdf: Record<string, { c: Color; p: number }[]> = {};
  for (const gt of COLOR_NAMES) {
    let acc = 0;
    cdf[gt] = COLOR_NAMES.map((rd) => {
      acc += Math.exp(logConf[`${gt}${rd}`]);
      return { c: rd, p: acc };
    });
  }
  return cdf;
}

/** 背景似然: 未被候选覆盖的边界按真色未知打分 log Σ_g (1/6)P(读|g) — 变长候选公平比 */
function buildLogBg(logConf: LogConf): Record<string, number> {
  const bg: Record<string, number> = {};
  for (const rd of COLOR_NAMES) {
    let s = 0;
    for (const gt of COLOR_NAMES) s += Math.exp(logConf[`${gt}${rd}`]) / 6;
    bg[rd] = Math.log(s);
  }
  return bg;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 候选生成 ----------

const AUFS = ["", "U", "U2", "U'"];
const Y_PRE = ["", "y", "y2", "y'"];

interface Candidate {
  label: string;
  isGT: boolean;
  len: number;
  starts: Perm[];
  afters: Perm[];
  key: string;
}

function tokenizeAlg(alg: string): string[] | null {
  const toks = alg.replace(/[()]/g, " ").trim().split(/\s+/).filter(Boolean);
  for (const t of toks) {
    try {
      physicalPerm(t);
    } catch {
      return null;
    }
  }
  return toks;
}

function genCandidates(Lmin: number, Lmax: number, tailRot: string[], gtToks: string[]): { cands: Candidate[]; gtInDict: boolean; nRaw: number } {
  const byKey = new Map<string, Candidate>();
  let nRaw = 0;
  for (const { alg, caseName } of dictAlgs) {
    const base = tokenizeAlg(alg);
    if (!base) continue;
    const baseStm = base.filter((t) => !ROTATION_TOKENS.has(t)).length;
    for (const pre of AUFS) {
      for (const post of AUFS) {
        const stm = baseStm + (pre ? 1 : 0) + (post ? 1 : 0);
        if (stm < Lmin || stm > Lmax) continue;
        for (const yk of Y_PRE) {
          const toks = [
            ...(yk ? [yk] : []),
            ...(pre ? [pre] : []),
            ...base,
            ...(post ? [post] : []),
          ];
          nRaw++;
          const { starts, afters } = replayStates(toks, tailRot);
          const key = starts.map(permKey).join("|");
          if (!byKey.has(key)) {
            byKey.set(key, {
              label: `${caseName}${yk ? ` [${yk}]` : ""}${pre ? ` pre:${pre}` : ""}${post ? ` post:${post}` : ""}`,
              isGT: false,
              len: stm,
              starts,
              afters,
              key,
            });
          }
        }
      }
    }
  }
  // GT 显式加入 (若字典已有同态序列则只打标)
  const gtStates = replayStates(gtToks, tailRot);
  const gtKey = gtStates.starts.map(permKey).join("|");
  const gtInDict = byKey.has(gtKey);
  if (gtInDict) {
    byKey.get(gtKey)!.isGT = true;
    byKey.get(gtKey)!.label += " =GT";
  } else {
    byKey.set(gtKey, {
      label: "GT(执行原样)",
      isGT: true,
      len: gtStates.starts.length,
      starts: gtStates.starts,
      afters: gtStates.afters,
      key: gtKey,
    });
  }
  return { cands: [...byKey.values()], gtInDict, nRaw };
}

// ---------- 评分 ----------

const predColor = (omega: number[], state: Perm, f: number): Color =>
  COLOR_NAMES[Math.floor(omega[state[f]] / 9)];

/** 全部 24 个 (面×旋转) 指派: 网格格 i → facelet (--freealign 用) */
const ASSIGNS_24: readonly (readonly number[])[] = (["U", "R", "F", "D", "L", "B"] as const).flatMap(
  (f) => assignsForFaces([f]),
);
/** 每面 4 个旋转指派 (--rotalign 用) */
const ROT_POOLS: Record<string, readonly (readonly number[])[]> = Object.fromEntries(
  (["U", "R", "F", "D", "L", "B"] as const).map((f) => [f, assignsForFaces([f])]),
);

/** 单链单指派似然: Σ_格 log P(读|候选态色) (+ 整色性通道 PAIR_W>0 时) */
function assignLL(
  rdArr: readonly (string | null)[],
  omega: number[],
  state: Perm,
  assign: readonly number[],
  logConf: LogConf,
): number {
  let s = 0;
  for (let i = 0; i < 9; i++) {
    const rd = rdArr[i];
    if (!rd) continue;
    s += logConf[`${predColor(omega, state, assign[i])}${rd}`];
  }
  if (PAIR_W > 0) {
    // 整色性通道: 候选态预测格对同/异色 vs 读出一致性 (与绝对色标互补)
    for (let i = 0; i < 9; i++) {
      if (!rdArr[i]) continue;
      const pi = predColor(omega, state, assign[i]);
      for (let j = i + 1; j < 9; j++) {
        if (!rdArr[j]) continue;
        const same = pi === predColor(omega, state, assign[j]);
        const agree = rdArr[i] === rdArr[j];
        s += PAIR_W * (same ? (agree ? LP_PAIR.sameAgree : LP_PAIR.sameDis) : agree ? LP_PAIR.diffAgree : LP_PAIR.diffDis);
      }
    }
  }
  return s;
}

/** 背景似然/边界: 未被候选覆盖的边界按真色未知的边缘似然记分 — 变长候选公平比 */
function computeBgLL(
  llBounds: DumpChain[][],
  reads: (string | null)[][][],
  logBg: Record<string, number>,
): number[] {
  return llBounds.map((b, t) =>
    b.reduce((s, chain, ci) => {
      let x = chain.read.reduce((acc, _, i) => {
        const rd = reads[t][ci][i];
        return rd ? acc + logBg[rd] : acc;
      }, 0);
      if (PAIR_W > 0) {
        for (let i = 0; i < 9; i++) {
          if (!reads[t][ci][i]) continue;
          for (let j = i + 1; j < 9; j++) {
            if (!reads[t][ci][j]) continue;
            x += PAIR_W * (reads[t][ci][i] === reads[t][ci][j] ? LP_PAIR_BG.agree : LP_PAIR_BG.dis);
          }
        }
      }
      return s + x;
    }, 0),
  );
}

/**
 * 对窗口 (末 W 个边界) 观测给全体候选打分。
 * 候选右锚定 (都终于复原态): 长 Lc 的候选覆盖窗口末 Lc 个边界, 之前的边界记背景似然。
 * reads[t][k] = 链读出色 (REAL 用 dump 原文, SYNTH/NULL 用重采样)。
 * 按 (边界, 态) 记忆化 — 候选间态高度重合 (都锚定复原), 避免重复算链似然。
 */
function scoreAll(
  cands: Candidate[],
  llBounds: DumpChain[][],
  reads: (string | null)[][][],
  omega: number[],
  logConf: LogConf,
  logBg: Record<string, number>,
): number[] {
  const W = llBounds.length;
  const bgLL = computeBgLL(llBounds, reads, logBg);
  const memo: Map<string, number>[] = Array.from({ length: W }, () => new Map());
  const chainSumLL = (t: number, state: Perm): number => {
    const k = permKey(state);
    const m = memo[t];
    const hit = m.get(k);
    if (hit !== undefined) return hit;
    let sum = 0;
    llBounds[t].forEach((chain, ci) => {
      const rdArr = reads[t][ci];
      const evalAssign = (assign: readonly number[]): number => assignLL(rdArr, omega, state, assign, logConf);
      if (FREE_ALIGN || ROT_ALIGN || PIN_ALIGN) {
        // 池内取最优: 24 全 (悲观) / 本面 4 旋转 (诊断) / 前段冻结 pin ≤2 (生产迁移)
        const pool = FREE_ALIGN ? ASSIGNS_24 : PIN_ALIGN ? PIN_POOL : ROT_POOLS[chain.face];
        let best = -Infinity;
        for (const assign of pool) {
          const s = evalAssign(assign);
          if (s > best) best = s;
        }
        sum += best;
      } else {
        sum += evalAssign(chain.facelets);
      }
    });
    m.set(k, sum);
    return sum;
  };
  return cands.map((c) => {
    const offset = W - c.len;
    let total = 0;
    for (let t = 0; t < W; t++) {
      if (!llBounds[t].length) continue;
      if (t < offset) {
        total += bgLL[t];
      } else {
        total += Math.max(chainSumLL(t, c.starts[t - offset]), chainSumLL(t, c.afters[t - offset]));
      }
    }
    return total;
  });
}

/**
 * 生产界打分 (--spanalign): 不借任何 GT 对齐。
 * 自由双窗口模型 (相机固定 → 每 span 两个可见窗口, 各一常量指派): 每候选每 span
 * 在 24×24 指派对里联合拟合两个窗口常量取总分最优, 每链自由选窗口与端 (段前/后态)。
 * span 内窗口指派恒定由 lattice-track 规范基锚定构造性保证; 窗口对应哪个空间面
 * 不硬编码 (B/U 硬编码已试: LL 期侧面下 2/3 整色块使面/旋转身份简并, 真窗口
 * 非 B/U 的视频直接崩) — 拟合本身生产可得 (解码时自洽联合优化)。
 */
function scoreAllSpan(
  cands: Candidate[],
  llBounds: DumpChain[][],
  reads: (string | null)[][][],
  omega: number[],
  logConf: LogConf,
  logBg: Record<string, number>,
): number[] {
  const W = llBounds.length;
  const bgLL = computeBgLL(llBounds, reads, logBg);
  const NA = ASSIGNS_24.length; // 24
  // 记忆化: (边界, 态) → 每链 LL[24 指派]
  const memo: Map<string, number[][]>[] = Array.from({ length: W }, () => new Map());
  const chainEvals = (t: number, state: Perm): number[][] => {
    const k = permKey(state);
    const m = memo[t];
    let hit = m.get(k);
    if (!hit) {
      hit = llBounds[t].map((_, ci) => {
        const rdArr = reads[t][ci];
        return ASSIGNS_24.map((a) => assignLL(rdArr, omega, state, a, logConf));
      });
      m.set(k, hit);
    }
    return hit;
  };
  // 覆盖区链按 span 分组 (只依赖候选长度 → 按 offset 缓存)
  const groupCache = new Map<number, Map<number, { t: number; ci: number }[]>>();
  const groupsFor = (offset: number): Map<number, { t: number; ci: number }[]> => {
    let g = groupCache.get(offset);
    if (!g) {
      g = new Map();
      for (let t = offset; t < W; t++) {
        llBounds[t].forEach((chain, ci) => {
          if (chain.span === undefined) throw new Error("转储缺 span 字段 — 用新版 real-eval --dumpobs 重建");
          const arr = g!.get(chain.span) ?? [];
          arr.push({ t, ci });
          g!.set(chain.span, arr);
        });
      }
      groupCache.set(offset, g);
    }
    return g;
  };
  return cands.map((c) => {
    const offset = W - c.len;
    let total = 0;
    for (let t = 0; t < offset; t++) total += bgLL[t];
    for (const entries of groupsFor(offset).values()) {
      // 每链先做端 max → 24 指派向量; 再在 (a1 ≤ a2) 对上联合拟合
      const evs = entries.map(({ t, ci }) => {
        const s = chainEvals(t, c.starts[t - offset])[ci];
        const a = chainEvals(t, c.afters[t - offset])[ci];
        const v = new Array<number>(NA);
        for (let i = 0; i < NA; i++) v[i] = Math.max(s[i], a[i]);
        return v;
      });
      let best = -Infinity;
      for (let a1 = 0; a1 < NA; a1++) {
        for (let a2 = a1; a2 < NA; a2++) {
          let tot = 0;
          for (const v of evs) tot += Math.max(v[a1], v[a2]);
          if (tot > best) best = tot;
        }
      }
      total += best;
    }
    return total;
  });
}

/**
 * 生产界打分 (--winalign / --epochs K): 链按空间聚类绑定窗口, 每候选每窗口
 * 沿时间轴把链分成 ≤K+1 个连续时间片, 每片单一指派 (24 选 1), DP 精确解 —
 * 换握 = 离散时间事件, 指派分段常量; K=0 即尾段单握恒定。零 GT。
 */
function scoreAllWin(
  cands: Candidate[],
  llBounds: DumpChain[][],
  reads: (string | null)[][][],
  omega: number[],
  logConf: LogConf,
  logBg: Record<string, number>,
): number[] {
  const W = llBounds.length;
  const bgLL = computeBgLL(llBounds, reads, logBg);
  const NA = ASSIGNS_24.length;
  const memo: Map<string, number[][]>[] = Array.from({ length: W }, () => new Map());
  const chainEvals = (t: number, state: Perm): number[][] => {
    const k = permKey(state);
    const m = memo[t];
    let hit = m.get(k);
    if (!hit) {
      hit = llBounds[t].map((_, ci) => {
        const rdArr = reads[t][ci];
        return ASSIGNS_24.map((a) => assignLL(rdArr, omega, state, a, logConf));
      });
      m.set(k, hit);
    }
    return hit;
  };
  const groupCache = new Map<number, Map<number, { t: number; ci: number }[]>>();
  const groupsFor = (offset: number): Map<number, { t: number; ci: number }[]> => {
    let g = groupCache.get(offset);
    if (!g) {
      g = new Map();
      for (let t = offset; t < W; t++) {
        llBounds[t].forEach((chain, ci) => {
          const arr = g!.get(chain.win!) ?? [];
          arr.push({ t, ci });
          g!.set(chain.win!, arr);
        });
      }
      groupCache.set(offset, g);
    }
    return g;
  };
  const E = EPOCH_ALIGN ? EPOCHS_K + 1 : 1; // 每窗口最多时间片数
  return cands.map((c) => {
    const offset = W - c.len;
    let total = 0;
    for (let t = 0; t < offset; t++) total += bgLL[t];
    for (const entries of groupsFor(offset).values()) {
      // entries 按 t 升序 (groupsFor 构造序) ≈ 时间序
      const T = entries.length;
      const evs = entries.map(({ t, ci }) => {
        const s = chainEvals(t, c.starts[t - offset])[ci];
        const a = chainEvals(t, c.afters[t - offset])[ci];
        const v = new Array<number>(NA);
        for (let i = 0; i < NA; i++) v[i] = Math.max(s[i], a[i]);
        return v;
      });
      // 前缀和 P[k][a] = Σ_{i<k} evs[i][a]; 片 [i,j) 得分 = max_a (P[j][a]-P[i][a])
      const P: number[][] = [new Array<number>(NA).fill(0)];
      for (let k = 0; k < T; k++) {
        const prev = P[k], row = new Array<number>(NA);
        for (let a = 0; a < NA; a++) row[a] = prev[a] + evs[k][a];
        P.push(row);
      }
      const blockScore = (i: number, j: number): number => {
        let best = -Infinity;
        for (let a = 0; a < NA; a++) {
          const s = P[j][a] - P[i][a];
          if (s > best) best = s;
        }
        return best;
      };
      // DP: dp[j] = 用 ≤e 片覆盖前 j 条的最优
      let dp = new Array<number>(T + 1).fill(-Infinity);
      dp[0] = 0;
      for (let e = 0; e < E; e++) {
        const next = [...dp];
        for (let j = 1; j <= T; j++) {
          for (let i = 0; i < j; i++) {
            if (dp[i] === -Infinity) continue;
            const s = dp[i] + blockScore(i, j);
            if (s > next[j]) next[j] = s;
          }
        }
        dp = next;
      }
      total += dp[T];
    }
    return total;
  });
}

function rankOfGT(cands: Candidate[], scores: number[]): { rank: number; margin: number; tied: number; top: string[] } {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const gtIdx = cands.findIndex((c) => c.isGT);
  const rank = order.indexOf(gtIdx) + 1;
  const bestRival = order.find((i) => i !== gtIdx)!;
  const tied = scores.filter((s, i) => i !== gtIdx && Math.abs(s - scores[gtIdx]) < 1e-9).length;
  return {
    rank,
    margin: scores[gtIdx] - scores[bestRival],
    tied,
    top: order.slice(0, 3).map((i) => `${cands[i].label}(${scores[i].toFixed(1)})`),
  };
}

// ---------- 主流程 ----------

const videosDir = join(import.meta.dirname, "..", "videos");
console.log(`字典: ${dictAlgs.length} 条公式 (ZBLL+PLL); 混淆池化自 ${dump.videos.length} 视频`);

for (const v of dump.videos) {
  if (ONLY && !v.name.startsWith(ONLY)) continue;
  const content = readFileSync(join(videosDir, `${v.name}.splits.txt`), "utf8");
  const lines = content
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("Splits:") && !/^\d+\s*(段|STM)/.test(s));
  const llLine = lines[lines.length - 1];
  const llLabel = llLine.includes("//") ? llLine.slice(llLine.indexOf("//") + 2).trim() : "?";
  const { tokens: llToks, tailRotations: llTail } = parseGT(llLine);
  const gtToks = [...llToks, ...llTail];
  const L = gtToks.filter((t) => !ROTATION_TOKENS.has(t)).length;
  const n = v.gtNoRot.length;
  const llBounds = v.bounds.slice(n - L);
  const covered = llBounds.filter((b) => b.length).length;
  const nCells = llBounds.flat().reduce((s, c) => s + c.read.filter(Boolean).length, 0);

  // GT 自检: GT 候选按转储 end 端的预测色必须逐格等于转储 gt 色 (帧/共轭数学的神谕)
  const gtStates = replayStates(gtToks, v.tailRotations);
  for (let t = 0; t < L; t++) {
    for (const chain of llBounds[t]) {
      const st = chain.end === 1 ? gtStates.afters[t] : gtStates.starts[t];
      for (let i = 0; i < 9; i++) {
        const pred = predColor(v.omega, st, chain.facelets[i]);
        if (pred !== chain.gt[i]) {
          throw new Error(`${v.name} 自检失败: 边界 ${t} 格 ${i} 预测 ${pred} ≠ 转储 GT ${chain.gt[i]}`);
        }
      }
    }
  }

  // 打分混淆 = 留一 (其余 4 视频); SYNTH 生成器 = 本视频自身混淆 (噪声真貌)
  const looConf = buildLogConf(dump.videos.filter((x) => x.name !== v.name));
  const looBg = buildLogBg(looConf);
  const ownCdf = buildConfCdf(buildLogConf([v]));

  console.log(
    `\n${v.name} [${llLabel}] L=${L} 段覆盖 ${covered}/${L} 读格 ${nCells}`,
  );

  if (PIN_ALIGN) {
    // 前段 (t < n-L-2, 避开 L±2 窗口) 链按 GT 对齐加权投票 → top-2 窗口指派冻结。
    // 前段 GT 对齐是"已知打乱+前段联合解码"的代理 (打乱态色彩丰富, 无整色简并)。
    const votes = new Map<string, { assign: number[]; w: number }>();
    for (const b of v.bounds.slice(0, Math.max(0, n - L - 2))) {
      for (const c of b) {
        const rd = c.read.filter(Boolean).length;
        if (rd < 5) continue;
        const m = c.read.reduce((s, r, i) => s + (r && r === c.gt[i] ? 1 : 0), 0);
        const k = c.facelets.join(",");
        const e = votes.get(k) ?? { assign: c.facelets, w: 0 };
        e.w += m;
        votes.set(k, e);
      }
    }
    const top = [...votes.values()].sort((a, b) => b.w - a.w).slice(0, 2);
    PIN_POOL = top.map((e) => e.assign);
    console.log(`  pin(前段拟合 top2): ${top.map((e) => `[${e.assign.slice(0, 2).join(",")}..]×${e.w}`).join(" ")}`);
    if (!PIN_POOL.length) {
      console.log("  (无可用 pin — 跳过)");
      continue;
    }
  }

  for (const mode of [
    { tag: `L 已知`, Lmin: L, Lmax: L },
    { tag: `L±2`, Lmin: L - 2, Lmax: L + 2 },
  ]) {
    const { cands, gtInDict, nRaw } = genCandidates(mode.Lmin, mode.Lmax, v.tailRotations, gtToks);
    const wBounds = v.bounds.slice(n - mode.Lmax);
    const scorer = SPAN_ALIGN ? scoreAllSpan : WIN_ALIGN || EPOCH_ALIGN ? scoreAllWin : scoreAll;
    const realReads = wBounds.map((b) => b.map((c) => c.read));
    const real = rankOfGT(cands, scorer(cands, wBounds, realReads, v.omega, looConf, looBg));

    // 乱读对照: 均匀随机读出色, GT 排名应 ~均匀散布
    const rng = mulberry32(SEED);
    const nullReads = wBounds.map((b) =>
      b.map((c) => c.read.map((r) => (r ? COLOR_NAMES[Math.floor(rng() * 6)] : null))),
    );
    const nul = rankOfGT(cands, scorer(cands, wBounds, nullReads, v.omega, looConf, looBg));

    // SYNTH: 同覆盖骨架, 读出色按本视频混淆行重采样 (以转储 gt 为真色)
    let synthTop1 = 0, synthTop5 = 0;
    const synthRanks: number[] = [];
    for (let trial = 0; trial < SYNTH_N; trial++) {
      const r2 = mulberry32(SEED + 1000 + trial);
      const sReads = wBounds.map((b) =>
        b.map((c) =>
          c.read.map((r, i) => {
            if (!r) return null;
            const u = r2();
            return ownCdf[c.gt[i]].find((e) => u <= e.p)?.c ?? "B";
          }),
        ),
      );
      const sr = rankOfGT(cands, scorer(cands, wBounds, sReads, v.omega, looConf, looBg));
      synthRanks.push(sr.rank);
      if (sr.rank === 1) synthTop1++;
      if (sr.rank <= 5) synthTop5++;
    }
    synthRanks.sort((a, b) => a - b);
    const synthMed = synthRanks[Math.floor(synthRanks.length / 2)] ?? 0;

    console.log(
      `  [${mode.tag}] 候选 raw ${nRaw} → 去重 ${cands.length} (GT在字典: ${gtInDict ? "是" : "否"})` +
        ` | REAL: GT 排名 ${real.rank}/${cands.length} (margin ${real.margin.toFixed(1)}, 并列 ${real.tied})  乱读: ${nul.rank}` +
        ` | SYNTH×${SYNTH_N}: rank1 ${((synthTop1 / SYNTH_N) * 100).toFixed(0)}% top5 ${((synthTop5 / SYNTH_N) * 100).toFixed(0)}% 中位 ${synthMed}`,
    );
    console.log(`    REAL top3: ${real.top.join(" | ")}`);
  }
}
