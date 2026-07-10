/**
 * last-move-probe.ts — 用户方案最小单元: 只判"倒数第一步"。
 *
 * 从复原帧锚定 (全片唯一免费锚), 候选 = 36 步法 (18 外层 + 18 宽层), 每候选
 * 反演出"末步前态", 只用最后一个边界的静止链证据打分 (双端点语义 + 平移边缘化
 * + probs 独立通道), 指派对锚定种子取 max。按前态等价类归并 (U2≡U2' 不可分),
 * 报 GT 末步等价类的排名。5/5 排第 1 = 倒数第一步可完全判定。
 *
 * 用法: npx tsx scripts/last-move-probe.ts [--probs 1] [--shift -1.5] [--nofreewin]
 * 前置: real-eval --dumpobs .tmp/obs-dump.json
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
const PROBS_W = parseFloat(argAt("--probs") ?? "1");
const SHIFT_PEN = parseFloat(argAt("--shift") ?? "-1.5");
const FREE_WIN = !process.argv.includes("--nofreewin");
const DIAG = process.argv.includes("--diag");

interface DumpChain {
  end: 0 | 1;
  face: string;
  read: (string | null)[];
  gt: string[];
  cx?: number;
  cy?: number;
  win?: number;
}
interface DumpFinal { read: (string | null)[]; cx: number; cy: number; win?: number }
interface DumpVideo {
  name: string;
  omega: number[];
  confusion: Record<string, number>;
  bounds: DumpChain[][];
  finals: DumpFinal[];
}
const dump = JSON.parse(readFileSync(DUMP_PATH, "utf8")) as { videos: DumpVideo[] };

const COLOR_NAMES = ["W", "R", "G", "Y", "O", "B"] as const;
type Color = (typeof COLOR_NAMES)[number];
const FACES = ["U", "R", "F", "D", "L", "B"] as const;
const ASSIGNS_24: readonly (readonly number[])[] = FACES.flatMap((f) => assignsForFaces([f]));
const MOVES36: string[] = [...FACES, ...FACES.map((f) => f.toLowerCase())].flatMap((f) => [f, `${f}2`, `${f}'`]);

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}
function buildLogConf(videos: DumpVideo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of videos) {
    for (const [k, n] of Object.entries(v.confusion)) counts[k] = (counts[k] ?? 0) + n;
  }
  const logConf: Record<string, number> = {};
  for (const gt of COLOR_NAMES) {
    let row = 0;
    for (const rd of COLOR_NAMES) row += counts[`${gt}${rd}`] ?? 0;
    for (const rd of COLOR_NAMES) {
      logConf[`${gt}${rd}`] = Math.log(((counts[`${gt}${rd}`] ?? 0) + 1) / (row + 6));
    }
  }
  return logConf;
}
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
  const upper = c1[1] <= c2[1] ? 0 : 1;
  items.forEach((c, i) => c.set(asg[i] === upper ? 0 : 1));
}
const SHIFTS: readonly (readonly number[])[] = (() => {
  const variants: number[][] = [Array.from({ length: 9 }, (_, i) => i)];
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
let nTop1 = 0;
const summary: string[] = [];

for (const v of dump.videos) {
  const n = v.bounds.length;
  const t = n - 1; // 最后一个边界 (末步)

  // GT 末步 (验证参照, 只读不喂)
  const content = readFileSync(join(videosDir, `${v.name}.splits.txt`), "utf8");
  const lines = content.trim().split("\n").map((s) => s.trim())
    .filter((s) => s && !s.startsWith("Splits:") && !/^\d+\s*(段|STM)/.test(s));
  const { tokens: llToks, tailRotations } = parseGT(lines[lines.length - 1]);
  const gtToks = [...llToks, ...tailRotations];
  const moveToks = gtToks.filter((x) => !ROTATION_TOKENS.has(x));
  const gtLast = moveToks[moveToks.length - 1];
  const gtKey = permKey(applyTo(IDENTITY_PERM, invertPerm(physicalPerm(gtLast))));

  // 锚定 (与 backward-decode 同法): 窗口 2-means + 收尾整色投票 → 面身份种子
  cluster2(v.bounds.flatMap((b) => b.map((c) => ({ cx: c.cx!, cy: c.cy!, set: (w: number) => (c.win = w) }))));
  cluster2(v.finals.map((f) => ({ cx: f.cx, cy: f.cy, set: (w: number) => (f.win = w) })));
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
  }
  const seeds: [number, number][] = [];
  const f1Cands = winFace[0] ? adjacentFaces(winFace[0]) : winFace[1] ? [winFace[1]] : [null];
  for (const a0 of rotsOfFace(winFace[0])) {
    for (const f1 of f1Cands) for (const a1 of rotsOfFace(f1)) seeds.push([a0, a1]);
  }

  // 评分基元 (留一混淆 + 背景 + 平移边缘化 + 双端点)
  const looConf = buildLogConf(dump.videos.filter((x) => x.name !== v.name));
  const logBg: Record<string, number> = {};
  for (const rd of COLOR_NAMES) {
    let s = 0;
    for (const gt of COLOR_NAMES) s += Math.exp(looConf[`${gt}${rd}`]) / 6;
    logBg[rd] = Math.log(s);
  }
  const predColor = (state: Perm, f: number): Color => COLOR_NAMES[Math.floor(v.omega[state[f]] / 9)];
  const chainLL = (read: (string | null)[], state: Perm, assign: readonly number[]): number => {
    let best = -Infinity;
    for (let si = 0; si < SHIFTS.length; si++) {
      const sh = SHIFTS[si];
      let s = si === 0 ? 0 : SHIFT_PEN;
      for (let i = 0; i < 9; i++) {
        const rd = read[i];
        if (!rd) continue;
        const j = sh[i];
        s += j < 0 ? logBg[rd] : looConf[`${predColor(state, assign[j])}${rd}`];
      }
      if (s > best) best = s;
    }
    return best;
  };
  const bgChain = (read: (string | null)[]): number =>
    read.reduce((s: number, r) => (r ? s + logBg[r] : s), 0);
  // 边界 t: 链 ∈ {S1(末步前态), solved}; 边界 t-1: 链 ∈ {S0(未知→背景), S1} — 双端点语义
  const evidenceAt = (sMid: Perm, sAfter: Perm, a0: number, a1: number): number => {
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
    if (t - 1 >= 0) {
      for (const c of v.bounds[t - 1]) {
        const pool = FREE_WIN ? [ASSIGNS_24[a0], ASSIGNS_24[a1]] : [ASSIGNS_24[c.win === 0 ? a0 : a1]];
        let best = bgChain(c.read);
        for (const assign of pool) {
          const s = chainLL(c.read, sMid, assign);
          if (s > best) best = s;
        }
        ev += best;
      }
    }
    return ev;
  };
  const probsArr: Record<string, number>[] = PROBS_W > 0
    ? (JSON.parse(readFileSync(join(videosDir, `${v.name}.probs.json`), "utf8")) as Record<string, number>[])
    : [];
  const probsLL = (move: string): number =>
    PROBS_W > 0 ? PROBS_W * Math.log(Math.max(probsArr[t]?.[move[0].toUpperCase()] ?? 0, 0.02)) : 0;

  // 36 候选 → 前态等价类 (U2≡U2') → 逐类打分
  interface Cls { moves: string[]; score: number }
  const classes = new Map<string, Cls>();
  for (const m of MOVES36) {
    const sMid = applyTo(IDENTITY_PERM, invertPerm(physicalPerm(m)));
    const key = permKey(sMid);
    let best = -Infinity;
    for (const [a0, a1] of seeds) {
      const s = evidenceAt(sMid, IDENTITY_PERM, a0, a1);
      if (s > best) best = s;
    }
    const score = best + probsLL(m);
    const cls = classes.get(key);
    if (!cls) classes.set(key, { moves: [m], score });
    else { cls.moves.push(m); cls.score = Math.max(cls.score, score); }
  }
  const ranked = [...classes.entries()].sort((a, b) => b[1].score - a[1].score);
  const gtRank = ranked.findIndex(([k]) => k === gtKey);
  const nChains = v.bounds[t].length;
  const nCells = v.bounds[t].reduce((s, c) => s + c.read.filter(Boolean).length, 0);
  const margin = gtRank === 0
    ? ranked.length > 1 ? ranked[0][1].score - ranked[1][1].score : Infinity
    : ranked[gtRank][1].score - ranked[0][1].score;
  if (gtRank === 0) nTop1++;

  console.log(`\n=== ${v.name}  GT 末步 ${gtLast}  (边界 ${t}: ${nChains} 链 ${nCells} 格, 窗口面 ${winFace[0]}/${winFace[1]}, 种子 ${seeds.length}) ===`);
  if (DIAG) {
    for (const tt of [t - 1, t]) {
      for (const c of v.bounds[tt] ?? []) {
        console.log(`  [诊断] 边界 ${tt} w${c.win} end${c.end} face=${c.face}  read=${c.read.map((x) => x ?? ".").join("")}  gt=${c.gt.join("")}`);
      }
    }
  }
  ranked.slice(0, 6).forEach(([k, c], i) => {
    console.log(`  #${i + 1} ${c.score.toFixed(1).padStart(7)}  ${c.moves.join("≡")}${k === gtKey ? "  ← GT" : ""}`);
  });
  if (gtRank >= 6) console.log(`  ...
  #${gtRank + 1} ${ranked[gtRank][1].score.toFixed(1).padStart(7)}  ${ranked[gtRank][1].moves.join("≡")}  ← GT`);
  summary.push(`${v.name[0]}: ${gtLast} → 排名 ${gtRank + 1}/${ranked.length} (margin ${margin === Infinity ? "∞" : margin.toFixed(1)})`);
}

console.log(`\n====== 汇总 (probs=${PROBS_W}, shift=${SHIFT_PEN}, freewin=${FREE_WIN}) ======`);
for (const s of summary) console.log(`  ${s}`);
console.log(nTop1 === dump.videos.length
  ? `\n✓ ${nTop1}/${dump.videos.length} — 倒数第一步全判对`
  : `\n${nTop1}/${dump.videos.length} 排第 1`);
