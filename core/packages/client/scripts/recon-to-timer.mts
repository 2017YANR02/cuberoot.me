/**
 * /recon 的复盘 → /timer 可导入的成绩库(带转动流)。
 *
 * 智能魔方的复盘页只在成绩里带 `moves` 时才有东西可看,而没有智能魔方在手就
 * 造不出这个流。真人复盘是现成的:/recon 存的就是「打乱 + 逐步解法 + 每步用
 * 时」,把它按步铺上时间戳,就是一条形状完全正确的转动流 —— 唯一的假是时间在
 * 每一步内部是均匀分布的(真人不是),TPS 曲线因此偏平,别拿它当性能样本。
 *
 * 用法(在 packages/client 下):
 *   pnpm exec tsx scripts/recon-to-timer.mts 2464 2466 2467 2468 2469 > out.json
 *
 * 产物直接喂 /timer 设置里的「导入」。
 */

// tsx 把 app/ 下的 .ts 当 CJS 编,ESM 具名导入取不到(全落在 default 上),而
// 这两个模块又没有 default 导出 —— 走 createRequire 拿命名空间,和
// scripts/auf-align-f2l.mts 同一个写法。
import { createRequire } from 'node:module';

import type { ParsedMove } from '../app/[lang]/timer/_lib/cube/moves.ts';
import type { CubeFaces } from '../app/[lang]/timer/_lib/cube/state.ts';

const require = createRequire(import.meta.url);
const { parseScramble } = require('../app/[lang]/timer/_lib/cube/moves.ts') as {
  parseScramble: (s: string) => ParsedMove[];
};
const { applyMoves, applyScramble, isSolvedFaces } = require('../app/[lang]/timer/_lib/cube/state.ts') as {
  applyMoves: (f: CubeFaces, n: number, m: ParsedMove[]) => CubeFaces;
  applyScramble: (n: number, s: string) => CubeFaces;
  isSolvedFaces: (f: CubeFaces) => boolean;
};

const API = process.env.RECON_API ?? 'https://api.cuberoot.me';

interface ReconRow {
  id: number;
  event: string;
  rawTime: number;
  value: string;
  solution: string;
  optimalScramble: string;
  person: string;
  comp: string;
  date: string;
  solveNum?: number;
}

/** 解法里的一步:动作 + 标注 + 标注里括号写着的用时(秒,可能没有)。 */
interface Step {
  tokens: string[];
  label: string;
  seconds: number | null;
}

/**
 * `·`(同时转)、`↑↓`、零宽字符等都是排版记号不是动作,和 recon-alg-utils 的
 * COSMETIC_ANNOTATION_CHARS 同一套 —— 这里不 import 是因为那个模块挂在 Next 的
 * `@/` alias 上,脚本走裸 tsx 跑不通。
 */
const COSMETIC = /[.·↑↓⅓⅔​‌‍﻿]/g;

/**
 * 一个空白块里可能粘着好几个记号 —— `D2U'`(两层一起拧)、`R2 D'` 中间被 `↓`
 * 分开、`U2'` 后面直接跟 `R`。解析器只认单个记号,粘着的整块会被**整个丢掉**,
 * 而丢一手就意味着后面的状态全错,复盘页会显示成一把没解开的魔方。所以这里按
 * 记号形状逐个啃出来,而不是按空白切。
 */
const TOKEN_RE = /\d*[UDFBLRMESxyz]w?\d*'?|[udfblr]\d*'?/g;

const OPPOSITE: Record<string, string> = {
  U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F',
};

/**
 * `DU` / `D2U'` 这种对侧两层的合写,方向有两种读法:记号照抄(`DU'` = `D' U'`)
 * 或空间同向(此时对侧面的记号互为逆)。两种都试,以「能还原」为准 —— 见
 * `verify`,它是这个脚本唯一的判据。对侧两层互相对易,先后顺序不影响结果。
 */
function tokenizeChunk(chunk: string, sameDirection: boolean): string[] {
  const parts = chunk.match(TOKEN_RE) ?? [];
  if (!sameDirection || parts.length !== 2) return parts;
  const [a, b] = parts;
  const fa = a[0], fb = b[0];
  if (OPPOSITE[fa] !== fb) return parts;
  if (b.includes('2')) return parts; // 半圈没有方向可翻
  return [a, b.endsWith("'") ? b.slice(0, -1) : b + "'"];
}

/**
 * 把 recon 的 solution 文本切成步。inspection 那行(纯旋转)一并保留。
 *
 * 括号在这套记法里是「这一手同时属于上下两步」的意思(`… (R'` / `R') …`),
 * 同一手写了两遍但只拧一次 —— 所以行尾那个未闭合的括号连同它后面的内容整段
 * 丢掉,留下下一行那份。行内成对的括号是 `(R U R' U')3` 那种重复记号,不动。
 */
function parseSolution(solution: string, sameDirection: boolean): Step[] {
  const steps: Step[] = [];
  for (const raw of solution.split(/\r?\n/)) {
    const line = raw.replace(COSMETIC, ' ').trim();
    if (!line) continue;
    const idx = line.indexOf('//');
    let code = (idx >= 0 ? line.slice(0, idx) : line).trim();
    const label = idx >= 0 ? line.slice(idx + 2).trim() : '';
    const opens = (code.match(/\(/g) ?? []).length;
    const closes = (code.match(/\)/g) ?? []).length;
    if (opens > closes) code = code.slice(0, code.lastIndexOf('(')).trim();
    // 下一行开头那个 `R')` 是同一手的另一半,上一行已经把它丢掉了,这里留着,
    // 只把括号本身去掉。
    if (closes > opens) code = code.replace(')', ' ').trim();
    if (!code) continue;
    const tokens = code.split(/\s+/).filter(Boolean)
      .flatMap(t => tokenizeChunk(t, sameDirection));
    // 标注末尾的 `(2.30)` / `(0.320+0.800)` 是这一步的用时,加起来。
    const timeMatch = /\(([\d.+\s]+)\)\s*$/.exec(label);
    const seconds = timeMatch
      ? timeMatch[1].split('+').map(s => parseFloat(s.trim())).filter(n => Number.isFinite(n))
        .reduce((a, b) => a + b, 0)
      : null;
    steps.push({ tokens, label, seconds });
  }
  return steps;
}

/** 打乱 + 全部记号 → 必须还原。这是这个脚本唯一的正确性判据。 */
function verify(scramble: string, steps: Step[]): boolean {
  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
  } catch {
    return false;
  }
  for (const step of steps) {
    for (const t of step.tokens) {
      const parsed = parseScramble(t);
      if (parsed.length === 0) return false; // 认不出的记号 = 静默错状态,不放过
      state = applyMoves(state, 3, parsed);
    }
  }
  return isSolvedFaces(state);
}

/**
 * 给每个记号铺时间戳。有括号用时的步按自己的用时铺,其余步按记号数分摊剩下的
 * 时间。
 *
 * inspection 那一步(标注含 insp)保留,时间戳钉在 0:它全是整体旋转,不是转动
 * —— 但它决定了后面所有面记号处在哪个朝向里,丢掉的话打乱和动作流对不上,分段
 * 器一路走到最后都读不出十字。真机不上报旋转,这是这份 fixture 和硬件的唯一形
 * 状差异;分段器本来就容忍旋转记号(见 stage_segments.ts 头注),读得下去。
 */
function timestamp(steps: Step[], totalMs: number): Array<{ m: string; ts: number }> {
  const insp = steps.filter(s => /insp/i.test(s.label)).flatMap(s => s.tokens);
  const body = steps.filter(s => !/insp/i.test(s.label));
  const knownMs = body.reduce((n, s) => n + (s.seconds ?? 0) * 1000, 0);
  const freeTokens = body.filter(s => s.seconds === null).reduce((n, s) => n + s.tokens.length, 0);
  const perFree = freeTokens > 0 ? Math.max(0, totalMs - knownMs) / freeTokens : 0;

  const out: Array<{ m: string; ts: number }> = insp.map(m => ({ m, ts: 0 }));
  let t = 0;
  for (const step of body) {
    const stepMs = step.seconds !== null ? step.seconds * 1000 : perFree * step.tokens.length;
    const per = step.tokens.length > 0 ? stepMs / step.tokens.length : 0;
    for (const m of step.tokens) {
      t += per;
      out.push({ m, ts: Math.round(t) });
    }
  }
  return out;
}

async function fetchRecon(id: string): Promise<ReconRow> {
  const res = await fetch(`${API}/v1/recon/${id}`);
  if (!res.ok) throw new Error(`recon ${id}: HTTP ${res.status}`);
  return res.json() as Promise<ReconRow>;
}

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('用法: pnpm exec tsx scripts/recon-to-timer.mts <reconId>...');
  process.exit(1);
}

const solves: unknown[] = [];
for (const id of ids) {
  const r = await fetchRecon(id);
  // 两种 compound 解释都试,以「能还原」为准;都不行就报出来,不静默产垃圾。
  let steps = parseSolution(r.solution, false);
  if (!verify(r.optimalScramble, steps)) {
    steps = parseSolution(r.solution, true);
    if (!verify(r.optimalScramble, steps)) {
      console.error(`× recon ${id}: 打乱 + 解法解不开,跳过`);
      continue;
    }
  }
  const totalMs = Math.round(r.rawTime * 1000);
  const moves = timestamp(steps, totalMs);
  const ts = Date.parse(`${r.date}T12:00:00Z`) + (r.solveNum ?? 0) * 60_000;
  solves.push({
    id: `recon${r.id}`,
    timeMs: totalMs,
    penalty: 'ok',
    scramble: r.optimalScramble,
    event: '333',
    ts,
    comment: `/recon/${r.id} — ${r.person} @ ${r.comp}`,
    moves,
    device: { model: 'gan-v4', name: `recon ${r.id} (fixture)` },
  });
  console.error(`√ recon ${r.id}: ${moves.length} 手 / ${(totalMs / 1000).toFixed(2)}s`);
}

const sid = 'srecondemo';
process.stdout.write(JSON.stringify({
  version: 3,
  sessions: [{ id: sid, name: 'recon 复盘', createdTs: Date.now() }],
  activeSessionId: sid,
  dataBySession: { [sid]: { 333: solves.sort((a, b) => (a as { ts: number }).ts - (b as { ts: number }).ts) } },
}, null, 2));
