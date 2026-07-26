/**
 * 单槽 alg set 的「setup + alg 到底做没做完」审计 —— issue #40 T5 的前置核查。
 *
 * ## 为什么要有这个脚本
 *
 * `f2l-mirror-probe.mts` 早先自造了一个判据(要求收尾时魔方朝向不变),报出 f2l 库
 * 「51 条做不完 F2L」。**那是假警报**:F2L 公式带 `y'` / `d` 开头是家常便饭(转个方
 * 换槽拧),做完后魔方整个偏过去了,底两层照样解好。站内判据 `lib/alg_goals.ts` 的
 * `reachesGoal` 本来就模 24 个整体转体。
 *
 * 所以本脚本**一行判据都不自己写**,直接调 `goalOf` + `reachesGoal` —— 与站上
 * 「校验全库」按钮同一份口径。谁再想核对某个 set 干不干净,跑这个,别另起炉灶。
 *
 * ## 跑
 *
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *     pnpm --filter @cuberoot/client exec tsx scripts/slot-set-audit.mts
 *   … scripts/slot-set-audit.mts --set=zbls --verbose
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { goalOf, reachesGoal } = require('../lib/alg_goals.ts') as typeof import('../lib/alg_goals.ts');
const { normalizeAlg } = require('../lib/alg_normalize.ts') as typeof import('../lib/alg_normalize.ts');

const { cube3x3x3 } = await import('cubing/puzzles');
const { Alg } = await import('cubing/alg');
const KP = await cube3x3x3.kpuzzle();

/** §5.7 的候选清单:凡「有且仅有一个 F2L 槽」的 set。 */
const SLOT_SETS = ['f2l', 'adv-f2l', 'zbls', 'wv', 'cls', 'vls', 'sbls', 'sv'];

const argv = process.argv.slice(2);
const only = argv.find((a) => a.startsWith('--set='))?.slice(6);
const verbose = argv.includes('--verbose');
const sets = only ? [only] : SLOT_SETS;

type AlgRow = { alg: string };
type Case = { name: string; subgroup?: string; setup: string; sticker: { kind: string }; algs: AlgRow[][] };

/**
 * 第 ori 个朝向该用哪个 setup —— 与 `lib/alg_validation.ts` 的 `setupForCase` 同一约定:
 * setup 只描述第 0 个槽,第 k 个 = `y^-k · S · y^k`。setup 为空时退化成「首条公式取逆」。
 */
function setupForCase(caseSetup: string, firstAlg: string | undefined, ori: number): string {
  let base = caseSetup?.trim() ?? '';
  if (!base && firstAlg) {
    try { base = new Alg(normalizeAlg('3x3', firstAlg)).invert().toString(); } catch { return ''; }
  }
  if (!base || ori === 0) return base;
  const pre = ['', "y'", 'y2', 'y'][ori % 4];
  const post = ['', 'y', 'y2', "y'"][ori % 4];
  return `${pre} ${base} ${post}`.trim();
}

type Bad = { set: string; case: string; subgroup: string; ori: number; row: number; setup: string; alg: string; reason: string };
const bad: Bad[] = [];
const summary: string[] = [];

for (const set of sets) {
  let data: { cases: Case[] };
  try {
    const res = await fetch(`https://api.cuberoot.me/v1/alg/sets/3x3/${set}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    summary.push(`${set.padEnd(8)} 拉取失败:${(err as Error).message}`);
    continue;
  }

  let checked = 0, ok = 0, skipped = 0;
  const setBad: Bad[] = [];

  for (const c of data.cases) {
    const goal = goalOf('3x3', set, c.sticker?.kind as never);
    for (let oi = 0; oi < c.algs.length; oi++) {
      const setup = setupForCase(c.setup, c.algs[0]?.[0]?.alg, oi);
      for (let ai = 0; ai < c.algs[oi].length; ai++) {
        const raw = c.algs[oi][ai]?.alg ?? '';
        if (!raw.trim()) continue;
        if (goal === 'skip') { skipped++; continue; }
        checked++;
        let good = false, reason = '';
        try {
          const full = `${setup ? `${normalizeAlg('3x3', setup)} ` : ''}${normalizeAlg('3x3', raw)}`;
          good = reachesGoal(KP.defaultPattern().applyAlg(full), KP, '3x3', goal);
          if (!good) reason = `未达成目标态(${goal})`;
        } catch (err) {
          reason = `解析失败:${(err as Error).message}`;
        }
        if (good) ok++;
        else setBad.push({ set, case: c.name, subgroup: c.subgroup ?? '-', ori: oi, row: ai + 1, setup, alg: raw, reason });
      }
    }
  }

  bad.push(...setBad);
  summary.push(
    `${set.padEnd(8)} ${String(data.cases.length).padStart(4)} case  ` +
    `${String(checked).padStart(5)} 条受检  ${String(ok).padStart(5)} 条通过  ` +
    `${setBad.length ? `❌ ${setBad.length} 条不过` : '✅ 0 条不过'}` +
    `${skipped ? `  (${skipped} 条判据为 skip,未检)` : ''}`,
  );
  if (verbose && setBad.length) {
    for (const b of setBad.slice(0, 40)) {
      summary.push(`         ${b.subgroup}/${b.case} 朝向${b.ori} 第${b.row}条 — ${b.reason}`);
      summary.push(`           setup: ${b.setup}`);
      summary.push(`           alg  : ${b.alg}`);
    }
    if (setBad.length > 40) summary.push(`         …… 还有 ${setBad.length - 40} 条,见 .tmp/slot-set-audit.json`);
  }
}

console.log('判据 = lib/alg_goals.ts 的 goalOf + reachesGoal(与站上「校验全库」同一份,已模 24 转体)\n');
summary.forEach((s) => console.log(s));
console.log(`\n合计 ${bad.length} 条不过。`);

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/slot-set-audit.json', JSON.stringify(bad, null, 2));
console.log('明细:.tmp/slot-set-audit.json');
