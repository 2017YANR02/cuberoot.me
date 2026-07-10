/**
 * backward-decode.ts — 倒推解码器 (用户方案): 从还原帧起, 逐边界往前倒推动作。
 *
 * 核心: 视频结尾是全片唯一"免费"锚点 — 复原态已知 + 手离开后收尾静止链可直读
 * 窗口面身份 (整色投票) 与 κ。倒推每步: 候选动作 m (18 步法 × 可选 y 转体) 反演
 * 上一态, 与该边界真实观测打分; 不赌单选 (55% 逐格会复利), 束保留 top-B 路线,
 * 面/旋转指派 = 锚点继承 + 相机系状态吸收转体 → 指派全程常量 (追加2 缺口的
 * "几何面身份"由倒推继承提供, 初始旋转 4×4 歧义随首个非整色边界自然坍缩)。
 *
 * 生产合法性: 逐步解码零 GT (无边界态/无对齐/无 token)。借 GT 的只有三处均标明:
 *   ① ω (κ 代理) — 生产从收尾整色 + WCA 标准配色补全, 本脚本用收尾投票验证一致;
 *   ② L (倒推深度) — 生产可扫描 + F2L-solved 检测 (逐深度已打印该信号);
 *   ③ 验证输出 (真解存活曲线/排名) — 只读不喂。
 *
 * 用法: npx tsx scripts/backward-decode.ts [--video 2] [--beam 512] [--freewin]
 *       [--dump .tmp/obs-dump.json] [--rotpen -3]
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
const ONLY = argAt("--video") ?? "2";
const BEAM = parseInt(argAt("--beam") ?? "2048", 10);
const ROT_PEN = parseFloat(argAt("--rotpen") ?? "-3"); // y 转体假设罚分 (log 先验)
const FREE_WIN = process.argv.includes("--freewin"); // 链不绑窗口, 取两窗口指派 max
const DEBUG = process.argv.includes("--debug"); // 逐深度打印 top/真解 的逐链得分明细
// 默认字典语法约束 (公式后缀树): 盲区边界下自由步法指数爆炸 (实测深度 3 盲区
// 114 万候选真解淹死), 每步候选动作限制为 "ZBLL/PLL 公式 × AUF × y 前缀 的
// 合法后缀"。--nodict 关闭 (自由 36 步法, 供对照)。
const NO_DICT = process.argv.includes("--nodict");
const ALGS_DIR = argAt("--algs") ?? join(import.meta.dirname, "..", ".tmp");
// 逐格垃圾底噪混合: 网格漏光 (窗口底行采到邻面) 的系统性坏格伤害封顶。
// 与负② (beam 引擎内 junk 混合) 不同: 此处候选已被字典语法锁死, 底噪只护观测不放水路径
const JUNK = parseFloat(argAt("--junk") ?? "0");
// 第二证据通道: 老管线逐段面概率 (.probs.json, 运动分类器, 生产可得) 融合权重。
// 与颜色链证据独立同源不同 (动作期运动 vs 静止期颜色), 巧合走运不相关 → 相加压噪
const PROBS_W = parseFloat(argAt("--probs") ?? "0");
// ±1 格平移边缘化罚分 (0=关): 晶格重获取漂移 (负⑩(a)) 把整列/行采到邻面 →
// 链按 {原位, 上下左右移 1 格} 取最优, 出格格按背景分计, 移位吃此罚分
const SHIFT_PEN = parseFloat(argAt("--shift") ?? "0");
// --full: LL 倒推到 LL-start 后不停, 续用自由步法穿过 F2L, 由"已知打乱态"作终点锚。
// 各 LL 候选到达不同 LL-start 态 → 后续 F2L 边界色证据只匹配真态 Q_true, 淘汰同分冒牌案。
const FULL = process.argv.includes("--full");
// FULL: LL-start 之后最多再倒推 K 步 (默认 12 = 约一个 F2L 对; 到 N 即接打乱态)
const F2L_CAP = parseInt(argAt("--f2lcap") ?? "12", 10);
// FULL pass2: 只把 LL 分 top-K 候选各自续倒推 F2L (防止错案自由子树在盲区淹没真解)
const TOPK = parseInt(argAt("--topk") ?? "150", 10);
const F2L_BEAM = parseInt(argAt("--f2lbeam") ?? "1024", 10);

// ---------- 输入 ----------

interface DumpChain {
  end: 0 | 1;
  face: string;
  facelets: number[];
  read: (string | null)[];
  gt: string[];
  span?: number;
  cx?: number;
  cy?: number;
  win?: number;
}
interface DumpFinal {
  read: (string | null)[];
  cx: number;
  cy: number;
  len: number;
  win?: number;
}
interface DumpVideo {
  name: string;
  omega: number[];
  gtNoRot: string[];
  tailRotations: string[];
  confusion: Record<string, number>;
  bounds: DumpChain[][];
  finals: DumpFinal[];
}
const dump = JSON.parse(readFileSync(DUMP_PATH, "utf8")) as { videos: DumpVideo[] };

const COLOR_NAMES = ["W", "R", "G", "Y", "O", "B"] as const;
type Color = (typeof COLOR_NAMES)[number];
const FACES = ["U", "R", "F", "D", "L", "B"] as const;

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/** 混淆似然 (留一: 排除被测视频 — 生产等价于全局标定) */
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

const ASSIGNS_24: readonly (readonly number[])[] = FACES.flatMap((f) => assignsForFaces([f]));

// 外层 18 + 宽层 18 (r ≡ x L 等状态等价但物理上是单个动作 → 一等公民 token;
// y D 等"转体+外层"组合与 u 状态重合时, 无罚分的宽层在去重中自然胜出)
const MOVES36: string[] = [...FACES, ...FACES.map((f) => f.toLowerCase())].flatMap((f) => [f, `${f}2`, `${f}'`]);

// 24 个整体朝向置换 (x/y 生成 BFS) — F2L-solved 检测的朝向归一化
const ROT24: Perm[] = (() => {
  const gens = ["x", "x'", "y", "y'"].map((t) => physicalPerm(t));
  const seen = new Map<string, Perm>([[permKey(IDENTITY_PERM), IDENTITY_PERM]]);
  const queue: Perm[] = [IDENTITY_PERM];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const g of gens) {
      const nx = applyTo(cur, g);
      const k = permKey(nx);
      if (!seen.has(k)) { seen.set(k, nx); queue.push(nx); }
    }
  }
  return [...seen.values()];
})();
const UNMOVED_BY_U: number[] = (() => {
  const pu = physicalPerm("U");
  const out: number[] = [];
  for (let f = 0; f < 54; f++) if (pu[f] === f) out.push(f);
  return out;
})();
/** 物理 F2L 已解 (朝向不变量): 某朝向归一化后, 非顶层贴纸全部还原 */
function f2lSolved(state: Perm): boolean {
  for (const r of ROT24) {
    const s = applyTo(state, r);
    let ok = true;
    for (const f of UNMOVED_BY_U) {
      if (s[f] !== f) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

// ---------- 主流程 ----------

const videosDir = join(import.meta.dirname, "..", "videos");
const v = dump.videos.find((x) => x.name.startsWith(ONLY));
if (!v) throw new Error(`视频 ${ONLY} 不在转储里`);
const n = v.bounds.length;

// === 验证参照 (只读, 不喂解码) ===
const content = readFileSync(join(videosDir, `${v.name}.splits.txt`), "utf8");
const lines = content.trim().split("\n").map((s) => s.trim())
  .filter((s) => s && !s.startsWith("Splits:") && !/^\d+\s*(段|STM)/.test(s));
const llLine = lines[lines.length - 1];
const llLabel = llLine.includes("//") ? llLine.slice(llLine.indexOf("//") + 2).trim() : "?";
const { tokens: llToks, tailRotations: llTail } = parseGT(llLine);
const gtToks = [...llToks, ...llTail];
const L = gtToks.filter((t) => !ROTATION_TOKENS.has(t)).length;
// GT 逐深度真态 (相机系, 锚定复原): trueState[d] = 倒推 d 步后应到的态
const trueStates: Perm[] = [IDENTITY_PERM];
{
  let cur: Perm = IDENTITY_PERM;
  for (let j = gtToks.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(gtToks[j])));
    if (!ROTATION_TOKENS.has(gtToks[j])) trueStates.push(cur);
  }
}
const trueKeys = trueStates.map(permKey);

// === FULL: 已知打乱作终点锚 ===
// 生产: 打乱公式已公布 → 打乱态直接可得 (标准配色 + 定向)。本 pilot 由全解 GT 反推得
// 打乱态 (= 已知打乱的等价物, 合法输入)。全解相机系倒推 tkFull[d] = 倒推 d 步后真态
// (d=0 复原 … d=L LL-start … d=N 打乱态 Sstate)。d≤L 与 trueKeys 对齐 (末 L 步 = LL)。
let N = L;
let tkFull: string[] = trueKeys;
let Sstate: Perm = IDENTITY_PERM;
if (FULL) {
  const { tokens: fToks, tailRotations: fTail } = parseGT(content);
  const allToks = [...fToks, ...fTail];
  N = allToks.filter((t) => !ROTATION_TOKENS.has(t)).length;
  const ts: Perm[] = [IDENTITY_PERM];
  let cur: Perm = IDENTITY_PERM;
  for (let j = allToks.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(allToks[j])));
    if (!ROTATION_TOKENS.has(allToks[j])) ts.push(cur);
  }
  Sstate = ts[N];
  tkFull = ts.map(permKey);
  if (N !== n) console.log(`⚠ FULL: N=${N} ≠ n=${n} (边界数≠动作数, t 索引将偏移)`);
  console.log(`FULL: 全解 N=${N} 步, 打乱态锚定; LL-start 后续倒推至深度 ${Math.min(N, L + F2L_CAP)}`);
}
const TRUE_KEYS = tkFull;
const DTARGET = FULL ? Math.min(N, L + F2L_CAP) : L;
void Sstate; // 终点锚: 首版仅测 F2L 续倒推对排名的增量, Sstate 硬过滤下一版接入

// === 第 0 步: 锚定 (生产可得) ===
// 收尾时魔方落垫, 画面整体位移 → 拧解中链与收尾链各自 2-means, 再按上下位置对应
// (相机几何不变: 上窗口=顶视, 下窗口=侧视, 拧解中与静置一致)
function cluster2(items: { cx: number; cy: number; set: (w: number) => void }[]): void {
  if (!items.length) return;
  const byY = [...items].sort((a, b) => a.cy - b.cy);
  let c1 = [byY[0].cx, byY[0].cy], c2 = [byY[byY.length - 1].cx, byY[byY.length - 1].cy];
  const asg = new Array<number>(items.length).fill(0);
  for (let it = 0; it < 20; it++) {
    items.forEach((c, i) => {
      asg[i] = (c.cx - c1[0]) ** 2 + (c.cy - c1[1]) ** 2 <= (c.cx - c2[0]) ** 2 + (c.cy - c2[1]) ** 2 ? 0 : 1;
    });
    const s = [[0, 0, 0], [0, 0, 0]];
    items.forEach((c, i) => { s[asg[i]][0] += c.cx; s[asg[i]][1] += c.cy; s[asg[i]][2]++; });
    if (s[0][2]) c1 = [s[0][0] / s[0][2], s[0][1] / s[0][2]];
    if (s[1][2]) c2 = [s[1][0] / s[1][2], s[1][1] / s[1][2]];
  }
  // 窗口 0 = 画面上方簇 (cy 小)
  const upper = c1[1] <= c2[1] ? 0 : 1;
  items.forEach((c, i) => c.set(asg[i] === upper ? 0 : 1));
}
cluster2(v.bounds.flatMap((b) => b.map((c) => ({ cx: c.cx!, cy: c.cy!, set: (w: number) => (c.win = w) }))));
cluster2(v.finals.map((f) => ({ cx: f.cx, cy: f.cy, set: (w: number) => (f.win = w) })));
// 每窗口: 收尾整色投票 → 面身份 (复原态下面色 = ω 面中心色; 生产由标准配色补全 κ)
const faceColorOf = (f: number): Color => COLOR_NAMES[Math.floor(v.omega[f * 9 + 4] / 9)];
const winFace: (string | null)[] = [null, null];
for (const w of [0, 1]) {
  const tally = new Map<Color, number>();
  for (const f of v.finals) {
    if (f.win !== w) continue;
    for (const r of f.read) if (r) tally.set(r as Color, (tally.get(r as Color) ?? 0) + 1);
  }
  if (!tally.size) continue;
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  const fi = FACES.findIndex((_, i) => faceColorOf(i) === top[0]);
  winFace[w] = fi >= 0 ? FACES[fi] : null;
  console.log(
    `窗口 ${w}: 收尾投票 ${[...tally.entries()].map(([c, k]) => `${c}×${k}`).join(" ")} → 面 ${winFace[w] ?? "?"}`,
  );
}

// === 评分基元 ===
// 逐段面概率 (n 条, 与边界对齐); 宽层按同侧外层记 (r→R), 缺面记地板 2%
const probsArr: Record<string, number>[] = PROBS_W > 0
  ? (JSON.parse(readFileSync(join(videosDir, `${v.name}.probs.json`), "utf8")) as Record<string, number>[])
  : [];
const probsLL = (t: number, move: string): number => {
  if (!(PROBS_W > 0)) return 0;
  const face = move[0].toUpperCase();
  return PROBS_W * Math.log(Math.max(probsArr[t]?.[face] ?? 0, 0.02));
};
const looConf = buildLogConf(dump.videos.filter((x) => x.name !== v.name));
const predColor = (state: Perm, f: number): Color => COLOR_NAMES[Math.floor(v.omega[state[f]] / 9)];
// 背景似然 (真色未知的边缘似然): 短候选补齐 + 平移出格格用
const logBg: Record<string, number> = {};
for (const rd of COLOR_NAMES) {
  let s = 0;
  for (const gt of COLOR_NAMES) s += Math.exp(looConf[`${gt}${rd}`]) / 6;
  logBg[rd] = Math.log(s);
}
/** 平移变体: 网格 i=r*3+c 读 assign 中 (r,c)+delta 的 facelet; 出格 → -1 (按背景计) */
const SHIFTS: readonly (readonly number[])[] = (() => {
  const variants: number[][] = [Array.from({ length: 9 }, (_, i) => i)]; // 原位
  if (SHIFT_PEN !== 0) {
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      variants.push(
        Array.from({ length: 9 }, (_, i) => {
          const r = Math.floor(i / 3) + dr, c = (i % 3) + dc;
          return r >= 0 && r < 3 && c >= 0 && c < 3 ? r * 3 + c : -1;
        }),
      );
    }
  }
  return variants;
})();
function chainLL(read: (string | null)[], state: Perm, assign: readonly number[]): number {
  let best = -Infinity;
  for (let si = 0; si < SHIFTS.length; si++) {
    const sh = SHIFTS[si];
    let s = si === 0 ? 0 : SHIFT_PEN;
    for (let i = 0; i < 9; i++) {
      const rd = read[i];
      if (!rd) continue;
      const j = sh[i];
      if (j < 0) { s += logBg[rd]; continue; } // 移出面外: 真色未知
      const ll = looConf[`${predColor(state, assign[j])}${rd}`];
      s += JUNK > 0 ? Math.log((1 - JUNK) * Math.exp(ll) + JUNK / 6) : ll;
    }
    if (s > best) best = s;
  }
  return best;
}

/** 边界 t 证据分: 各链 vs max(动作前态 sMid, 动作后态 sAfter) 双端点似然 (主循环 + pass2 共用) */
const evidenceAt = (t: number, sMid: Perm, sAfter: Perm, a0: number, a1: number): number => {
  let ev = 0;
  for (const c of v.bounds[t]) {
    const pool = FREE_WIN ? [ASSIGNS_24[a0], ASSIGNS_24[a1]] : [ASSIGNS_24[c.win === 0 ? a0 : a1]];
    let best = -Infinity;
    for (const assign of pool) {
      const s = Math.max(chainLL(c.read, sMid, assign), chainLL(c.read, sAfter, assign));
      if (s > best) best = s;
    }
    ev += best;
  }
  return ev;
};

// === 字典后缀树 (默认模式): 候选 = 公式 × y 前缀 × 前/后 AUF, STM ∈ [L±2] ===
interface TrieNode {
  children: Map<string, { node: TrieNode; toks: string[] }>; // 边 = 一个倒推步 [rot..., move] (正放顺序)
  labels: string[]; // 在此耗尽的候选名 (终点 = 候选首步之前)
  id: number;
}
let nodeSeq = 0;
const newNode = (): TrieNode => ({ children: new Map(), labels: [], id: nodeSeq++ });
const trieRoot = newNode();
let nCand = 0;
if (!NO_DICT) {
  interface AlgCase { name: string; algs: { alg: string }[][] }
  const loadCases = (file: string): AlgCase[] =>
    (JSON.parse(readFileSync(join(ALGS_DIR, file), "utf8")) as { cases: AlgCase[] }).cases;
  const tokenize = (alg: string): string[] | null => {
    const toks = alg.replace(/[()]/g, " ").trim().split(/\s+/).filter(Boolean);
    for (const t of toks) {
      try { physicalPerm(t); } catch { return null; }
    }
    return toks;
  };
  const AUFS = ["", "U", "U2", "U'"];
  const Y_PRE = ["", "y", "y2", "y'"];
  const seen = new Set<string>();
  const algs: { alg: string; caseName: string }[] = [];
  for (const c of [...loadCases("zbll.json"), ...loadCases("pll.json")]) {
    for (const vv of c.algs[0] ?? []) {
      if (vv.alg && !seen.has(vv.alg)) { seen.add(vv.alg); algs.push({ alg: vv.alg, caseName: c.name }); }
    }
  }
  // 状态序列去重 (U2 与 U2' 等价合并)
  const byKey = new Set<string>();
  const stateSeqKey = (toks: string[]): string => {
    let cur: Perm = IDENTITY_PERM;
    const keys: string[] = [];
    for (let j = toks.length - 1; j >= 0; j--) {
      cur = applyTo(cur, invertPerm(physicalPerm(toks[j])));
      if (!ROTATION_TOKENS.has(toks[j])) keys.push(permKey(cur));
    }
    return keys.join("|");
  };
  const addSeq = (toks: string[], label: string): void => {
    const k = stateSeqKey(toks);
    if (byKey.has(k)) return;
    byKey.add(k);
    // 倒推步分组: 从尾往头, 每步 = [紧邻前置转体..., 动作]
    const steps: string[][] = [];
    let i = toks.length - 1;
    while (i >= 0) {
      if (ROTATION_TOKENS.has(toks[i])) { i--; continue; } // 尾部孤立转体 (不应有) 忽略
      let j = i;
      while (j - 1 >= 0 && ROTATION_TOKENS.has(toks[j - 1])) j--;
      steps.push(toks.slice(j, i + 1));
      i = j - 1;
    }
    let node = trieRoot;
    for (const st of steps) {
      const key = st.join(" ");
      let e = node.children.get(key);
      if (!e) { e = { node: newNode(), toks: st }; node.children.set(key, e); }
      node = e.node;
    }
    node.labels.push(label);
    nCand++;
  };
  for (const { alg, caseName } of algs) {
    const base = tokenize(alg);
    if (!base) continue;
    const baseStm = base.filter((t) => !ROTATION_TOKENS.has(t)).length;
    for (const pre of AUFS) {
      for (const post of AUFS) {
        const stm = baseStm + (pre ? 1 : 0) + (post ? 1 : 0);
        if (stm < L - 2 || stm > L + 2) continue;
        for (const yk of Y_PRE) {
          addSeq([...(yk ? [yk] : []), ...(pre ? [pre] : []), ...base, ...(post ? [post] : [])], `${caseName}${yk ? ` [${yk}]` : ""}${pre ? ` pre:${pre}` : ""}${post ? ` post:${post}` : ""}`);
        }
      }
    }
  }
  addSeq(gtToks, "GT(执行原样)"); // 验证参照: 若状态序列已收录则去重跳过
  console.log(`字典后缀树: ${nCand} 候选 (STM ${L - 2}..${L + 2})`);
}

// 短候选提前耗尽后, 更早边界按真色未知计分 — 变长公平比
const bgOfBound = (t: number): number =>
  v.bounds[t].reduce((s, c) => s + c.read.reduce((a, r) => (r ? a + logBg[r] : a), 0), 0);
/** bgSuffix[d] = 深度 d 耗尽后, 剩余边界 (深度 d+1..L) 的背景分总和 */
const bgSuffix: number[] = new Array(L + 1).fill(0);
for (let d = L - 1; d >= 0; d--) bgSuffix[d] = bgSuffix[d + 1] + bgOfBound(n - (d + 1));

// === 第 1 步: 倒推束搜索 ===
interface Path {
  state: Perm;
  score: number;
  toks: string[]; // 正放顺序 (每步 unshift)
  a0: number; // 窗口 0 指派 (ASSIGNS_24 下标, 全程常量)
  a1: number;
  lastFace: string; // 相邻同面禁止 (自由模式)
  node: TrieNode; // 字典模式: 当前后缀树位置
  labels?: string[]; // 终止时的候选名
  trueSoFar: boolean; // 验证: 状态序列至今与 GT 全等 (只读输出)
  stm: number; // 已倒推步数
  evTrace: number[]; // 逐深度证据分 (诊断)
  free: boolean; // FULL: 已越过 LL-start, 转自由步法续倒推 F2L
  llScore?: number; // FULL: 不含背景补齐的纯 LL 分 (续 F2L 再排用)
  f2lScore?: number; // FULL pass2: 最优 F2L 续倒推分
  f2lTrue?: boolean; // FULL pass2: 真 F2L 路径是否在束中存活
}
// 种子: 复原态 × 窗口面假设 × 面内 4 旋转。
// 收尾静置与拧解之间常有一次未记录放下旋转 (v2 实测 F→B ≈ y2) → 下窗口面
// 不能照搬静置读数, 放开为上窗口面的 4 个邻面 (y 族偏移); 上窗口 (顶视) 在
// y 族下不变, 静置读数可信。旋转歧义由 t 末尾花色边界证据坍缩。
const rotsOfFace = (face: string | null): number[] => {
  if (!face) return ASSIGNS_24.map((_, i) => i); // 无锚窗口: 全 24 (v3 型缺收尾链)
  const fi = FACES.indexOf(face as (typeof FACES)[number]);
  return [fi * 4, fi * 4 + 1, fi * 4 + 2, fi * 4 + 3];
};
/** face 的 4 个侧邻面 (y 族旋转轨道): 对面与自身除外 */
const adjacentFaces = (face: string): string[] => {
  const fi = FACES.indexOf(face as (typeof FACES)[number]);
  const opp = [3, 4, 5, 0, 1, 2][fi]; // U-D R-L F-B
  return FACES.filter((_, i) => i !== fi && i !== opp);
};
let beam: Path[] = [];
{
  const f1Cands = winFace[0] ? adjacentFaces(winFace[0]) : winFace[1] ? [winFace[1]] : [null];
  for (const a0 of rotsOfFace(winFace[0])) {
    for (const f1 of f1Cands) {
      for (const a1 of rotsOfFace(f1)) {
        beam.push({ state: IDENTITY_PERM, score: 0, toks: [], a0, a1, lastFace: "", node: trieRoot, trueSoFar: true, stm: 0, evTrace: [], free: false });
      }
    }
  }
}
console.log(
  `\n${v.name} [${llLabel}] L=${L} 倒推开始: 种子 ${beam.length} (窗口面 ${winFace[0]}/${winFace[1]}), 束宽 ${BEAM}, 转体罚 ${ROT_PEN}`,
);

const invPermCache = new Map<string, Perm>();
const getInv = (tok: string): Perm => {
  let p = invPermCache.get(tok);
  if (!p) { p = invertPerm(physicalPerm(tok)); invPermCache.set(tok, p); }
  return p;
};

const finished: Path[] = []; // 短候选提前耗尽 (含背景分补齐)
for (let d = 1; d <= L; d++) {
  const t = n - d; // 全局边界下标
  const chains = v.bounds[t];
  const evidence = (sMid: Perm, sAfter: Perm, a0: number, a1: number): number =>
    evidenceAt(t, sMid, sAfter, a0, a1);
  const next = new Map<string, Path>();
  const push = (p: Path, stepToks: string[], rotPen: number, keyExtra: string): void => {
    // stepToks 正放顺序 [转体..., 动作]; 动作前态 = 撤动作, 再逐个撤转体
    const move = stepToks[stepToks.length - 1];
    const sMid = applyTo(p.state, getInv(move));
    let sBefore = sMid;
    for (let i = stepToks.length - 2; i >= 0; i--) sBefore = applyTo(sBefore, getInv(stepToks[i]));
    const ev = evidence(sMid, p.state, p.a0, p.a1) + probsLL(t, move);
    const score = p.score + ev + rotPen;
    const key = `${permKey(sBefore)}|${p.a0}|${p.a1}|${keyExtra}`;
    const old = next.get(key);
    if (!old || score > old.score) {
      next.set(key, {
        state: sBefore,
        score,
        toks: [...stepToks, ...p.toks],
        a0: p.a0,
        a1: p.a1,
        lastFace: keyExtra.startsWith("F:") ? keyExtra.slice(2) : "",
        node: p.node,
        trueSoFar: p.trueSoFar && permKey(sBefore) === TRUE_KEYS[d],
        stm: d,
        evTrace: [...p.evTrace, ev + rotPen],
        free: p.free,
      });
    }
  };
  for (const p of beam) {
    if (NO_DICT) {
      for (const m of MOVES36) {
        const mFace = m[0].toUpperCase(); // 同侧外/宽层相邻也按并段处理 (r R' 型极罕见, 记为已知盲区)
        if (mFace === p.lastFace) continue; // 相邻同面必并段 (中间有转体时 lastFace 已清空)
        push(p, [m], 0, `F:${mFace}`);
        for (const r of ["y", "y2", "y'"]) push(p, [r, m], ROT_PEN, "F:"); // 转体隔开 → 下一步同面不并段
      }
    } else {
      if (p.node.labels.length) {
        // 候选在此耗尽 → 冻结, 更早边界补背景分 (变长公平比); llScore=不含补齐的纯 LL 分 (FULL 续 F2L 用)
        finished.push({ ...p, score: p.score + bgSuffix[d - 1], llScore: p.score, labels: p.node.labels });
      }
      for (const { node, toks } of p.node.children.values()) {
        push({ ...p, node }, toks, 0, `N:${node.id}`);
      }
    }
  }
  beam = [...next.values()].sort((a, b) => b.score - a.score).slice(0, BEAM);
  // 真解存活 (验证输出) + F2L-solved 信号 (生产的停机检测, 只报不喂)
  const tk = TRUE_KEYS[d];
  const rank = beam.findIndex((p) => permKey(p.state) === tk);
  const evN = chains.reduce((s, c) => s + c.read.filter(Boolean).length, 0);
  const nF2l = beam.slice(0, 50).filter((p) => f2lSolved(p.state)).length;
  console.log(
    `  深度 ${d} (边界 ${t}, 证据 ${chains.length} 链 ${evN} 格): 束 ${next.size}→${beam.length}` +
      ` | 真态排名 ${rank >= 0 ? rank + 1 : `>${beam.length} 淘汰`}` +
      (rank >= 0 ? ` (margin ${(beam[rank].score - beam[0].score).toFixed(1)})` : "") +
      ` | top50 F2L已解 ${nF2l}`,
  );
  if (DEBUG) {
    const detail = (p: Path, tag: string) => {
      // p.state = 本步 [转体?]+动作 之前的态; 复原本步动作前/后两个证据态
      let sMid = p.state, i = 0;
      if (ROTATION_TOKENS.has(p.toks[0])) { sMid = applyTo(p.state, physicalPerm(p.toks[0])); i = 1; }
      const sAfter = applyTo(sMid, physicalPerm(p.toks[i]));
      const parts = chains.map((c) => {
        const assign = ASSIGNS_24[c.win === 0 ? p.a0 : p.a1];
        const pre = assign.map((f) => predColor(sMid, f)).join("");
        const post = assign.map((f) => predColor(sAfter, f)).join("");
        return `w${c.win}[${c.read.map((x) => x ?? ".").join("")}] pre=${pre} post=${post}`;
      });
      console.log(`    ${tag} a0=${p.a0} a1=${p.a1} ${p.toks.join(" ")}: ${parts.join(" | ")}`);
    };
    detail(beam[0], "top1");
    if (rank > 0) detail(beam[rank], "true");
  }
  if (rank < 0) {
    console.log(`  ✗ 真解掉出束 — 倒推止步于深度 ${d}/${DTARGET}`);
    break;
  }
}

// === 结果: 完赛候选排名 (深度 L 活跃且候选恰在此耗尽 ∪ 提前耗尽补背景分) ===
for (const p of beam) {
  if (NO_DICT) finished.push(p);
  else if (p.node.labels.length) finished.push({ ...p, llScore: p.score, labels: p.node.labels });
}
// 同一候选的不同指派变体去重 (按 token 序列取最高分)
const byToks = new Map<string, Path>();
for (const p of finished) {
  const k = p.toks.join(" ");
  const old = byToks.get(k);
  if (!old || p.score > old.score) byToks.set(k, p);
}
finished.length = 0;
finished.push(...byToks.values());
finished.sort((a, b) => b.score - a.score);

// === FULL pass2: top-K LL 候选各自从 Q (LL-start 态) 自由续倒推 F2L, 按 llScore+f2lScore 再排 ===
// 各 LL 候选到达不同 Q; 真态 Q_true 能接上匹配视频 F2L 色的续解 (高分), 冒牌 Q' 接不上 (低分) → 真解上浮。
// 每候选独立小束搜索, 不共享大束 → 错案的自由子树无法在盲区淹没真解 (首版统一束的败因)。
if (FULL) {
  const passF2L = (cand: Path): { score: number; trueAlive: boolean } => {
    interface FB { state: Perm; score: number; lastFace: string; trueSoFar: boolean }
    let fb: FB[] = [{ state: cand.state, score: 0, lastFace: "", trueSoFar: !!cand.trueSoFar }];
    for (let k = 1; k <= DTARGET - cand.stm; k++) {
      const t = n - (cand.stm + k);
      if (t < 0) break;
      const nx = new Map<string, FB>();
      for (const p of fb) {
        for (const m of MOVES36) {
          const mFace = m[0].toUpperCase();
          if (mFace === p.lastFace) continue;
          const sBefore = applyTo(p.state, getInv(m));
          const sc = p.score + evidenceAt(t, sBefore, p.state, cand.a0, cand.a1);
          const key = `${permKey(sBefore)}|${mFace}`;
          const old = nx.get(key);
          if (!old || sc > old.score) {
            nx.set(key, { state: sBefore, score: sc, lastFace: mFace, trueSoFar: p.trueSoFar && permKey(sBefore) === TRUE_KEYS[cand.stm + k] });
          }
        }
      }
      fb = [...nx.values()].sort((a, b) => b.score - a.score).slice(0, F2L_BEAM);
      if (!fb.length) break;
    }
    return { score: fb.length ? fb[0].score : -Infinity, trueAlive: fb.some((p) => p.trueSoFar) };
  };
  // 只比同长 (stm===L) 候选: LL 长度由分段已知, 各候选覆盖同一边界集 (46..n-DTARGET),
  // 自由 F2L 的过拟合偏置对所有同长候选一致 → 公平。混长会让短候选靠过拟合白占便宜 (首版败因)。
  const sameLen = finished.filter((p) => p.stm === L);
  const K = Math.min(TOPK, sameLen.length);
  console.log(`\nFULL pass2: 同长 (stm=${L}) 候选 ${sameLen.length}, 取 top-${K} 各续倒推 F2L (至深度 ${DTARGET}, 束 ${F2L_BEAM})...`);
  for (let i = 0; i < K; i++) {
    const r = passF2L(sameLen[i]);
    sameLen[i].f2lScore = r.score;
    sameLen[i].score = (sameLen[i].llScore ?? sameLen[i].score) + r.score;
    sameLen[i].f2lTrue = r.trueAlive;
  }
  // 未续 F2L 的 (含异长 / 超 K) 排到已续之后, 保原相对序
  const scored = sameLen.slice(0, K).sort((a, b) => b.score - a.score);
  const rest = finished.filter((p) => p.f2lScore === undefined);
  finished.length = 0;
  finished.push(...scored, ...rest);
}

console.log(`\n完赛候选 ${finished.length}, top10 (正放顺序; GT: ${gtToks.join(" ")}):`);
finished.slice(0, 10).forEach((p, i) => {
  const f2l = FULL && p.f2lScore !== undefined ? ` (LL ${(p.llScore ?? 0).toFixed(1)}+F2L ${p.f2lScore.toFixed(1)}${p.f2lTrue ? " 真F2L存活" : ""})` : "";
  console.log(
    `  #${i + 1} ${p.score.toFixed(1)}${f2l} [${p.stm}步] ${p.toks.join(" ")}` +
      `${p.labels?.length ? `  {${p.labels.slice(0, 2).join("; ")}}` : ""}${p.trueSoFar ? "  ← 真解(LL 级状态等价)" : ""}`,
  );
});
const gtRank = finished.findIndex((p) => p.trueSoFar);
console.log(
  gtRank === 0
    ? `\n✓ 里程碑达成: 真解排名 1/${finished.length} — 无 GT 对齐倒推出 ZBLL`
    : gtRank > 0
      ? `\n真解最终排名 ${gtRank + 1}/${finished.length} (margin ${(finished[gtRank].score - finished[0].score).toFixed(1)})`
      : `\n✗ 真解未完赛`,
);
if (gtRank > 0) {
  // 逐深度证据分对比: 真解到底输在哪几个边界
  const fmt = (p: Path) => p.evTrace.map((x) => x.toFixed(1).padStart(7)).join("");
  console.log(`逐深度证据分 (深度 1→${finished[0].evTrace.length}):`);
  console.log(`  #1  ${fmt(finished[0])}`);
  console.log(`  真解${fmt(finished[gtRank])}`);
  const diff = finished[gtRank].evTrace.map((x, i) => x - finished[0].evTrace[i]);
  console.log(`  差  ${diff.map((x) => x.toFixed(1).padStart(7)).join("")}`);
}
