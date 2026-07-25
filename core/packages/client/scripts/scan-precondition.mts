/**
 * 全库扫描:setup 本身是不是合法的 case 状态。issue #40。
 *
 * 与站上现有的「校验」互补 —— 那个问「setup + alg 能不能到目标态」,这个问
 * 「setup 画出来的图对不对」。一条 setup 把别的槽也搅了、只要 alg 顺手修回来,
 * 现有校验照样全绿(实例:zbls A+/D 的 `M' U M U2 R' F R` 会把 DFL 角与 FL 棱带乱)。
 *
 * 跑:node --experimental-strip-types scripts/scan-precondition.mts [set...]
 *     缓存放 scripts/.cache/<set>.json,没有就现拉。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const { SET_PRECONDITION, preconditionOf, checkPrecondition } = await import('../lib/alg_precondition.ts');
const { normalizeAlg } = await import('../lib/alg_normalize.ts');
// 24 朝向(6 个 U 面朝向 × 4 个 y),与 alg_goals 的 CUBE_ORIENTATIONS 同构;
// 这里内联而不 import,绕开 tsx 对该模块 IIFE 导出的静态分析问题。
const CUBE_ORIENTATIONS: string[] = ['', 'x', 'x2', "x'", 'z', "z'"]
  .flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => [a, b].filter(Boolean).join(' ')));
if (new Set(CUBE_ORIENTATIONS).size !== 24) throw new Error('朝向表不是 24 个,容忍会失效');

const { cube3x3x3 } = await import('cubing/puzzles');
const KP = await cube3x3x3.kpuzzle();

const SETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(SET_PRECONDITION).filter((k) => k.startsWith('3x3/')).map((k) => k.split('/')[1]);

mkdirSync('scripts/.cache', { recursive: true });

async function load(set: string) {
  const path = `scripts/.cache/${set}.json`;
  if (!existsSync(path)) {
    const res = await fetch(`https://api.cuberoot.me/v1/alg/sets/3x3/${set}`);
    if (!res.ok) throw new Error(`拉取 ${set} 失败:${res.status}`);
    writeFileSync(path, await res.text());
  }
  return JSON.parse(readFileSync(path, 'utf8')) as {
    cases: { name: string; subgroup: string; setup: string; algs: { alg: string }[][] }[];
  };
}

let grandBad = 0, grandTotal = 0;
const report: string[] = [];

for (const set of SETS) {
  process.stdout.write(`扫描 3x3/${set} … `);
  let data: Awaited<ReturnType<typeof load>>;
  try { data = await load(set); } catch (err) { console.log(`跳过(${(err as Error).message})`); continue; }
  const pre = preconditionOf('3x3', set);
  const bad: string[] = [];
  for (const c of data.cases) {
    grandTotal++;
    // setup 空的 case 用「首条公式取逆」当 setup(与 setupForCase 同约定)
    let text = c.setup?.trim() ?? '';
    if (!text) {
      const first = c.algs?.[0]?.[0]?.alg;
      if (!first) continue;
      try {
        const { Alg } = await import('cubing/alg');
        text = new Alg(first).invert().toString();
      } catch { continue; }
    }
    let base;
    try { base = KP.defaultPattern().applyAlg(normalizeAlg('3x3', text)); }
    catch (err) { bad.push(`${c.subgroup || '-'}/${c.name}  setup 解析失败:${(err as Error).message}`); grandBad++; continue; }
    let ok = false, reason = '';
    for (const rot of CUBE_ORIENTATIONS) {
      const r = checkPrecondition(rot ? base.applyAlg(rot) : base, pre, '3x3');
      if (r.ok) { ok = true; break; }
      reason ||= r.reason ?? '';
    }
    if (!ok) { bad.push(`${(c.subgroup || '-').padEnd(14)}${c.name.padEnd(10)} "${c.setup}"  ← ${reason}`); grandBad++; }
  }
  console.log(`${data.cases.length} 个 case,前提不合法 ${bad.length} 个`);
  if (bad.length) {
    report.push(`\n## 3x3/${set}(前提 = ${pre})—— ${bad.length} / ${data.cases.length} 不合法`);
    report.push(...bad.map((b) => '  ' + b));
  }
}

console.log(report.join('\n'));
console.log(`\n合计:${grandBad} / ${grandTotal} 个 case 的 setup 不是合法 case 状态`);
