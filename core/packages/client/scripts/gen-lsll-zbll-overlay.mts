/*
 * gen-lsll-zbll-overlay — 把站内 ZBLL 库(3x3/zbll 472 案 + 3x3/pll 21 案)映射到
 * LSLL canonical key,产出 `lib/lsll/zbll_algs.json`:{ [base36Key]: [{ set, name, subgroup, slug, algCount }] }。
 *
 * 用途:LSLL 三类(两步路线 = ZBLS case × ZBLL case)的**后半段**要能点进公式库。
 * 与 `gen-lsll-zbls-overlay.mts` 是一对:那边管前半段(ZBLS),这边管后半段(ZBLL)。
 *
 * 为什么两个 set:站内把「顶层角已朝正」那 21 个 ZBLL case 放在 pll 集里(ZBLL 的 OCLL=solved 组),
 * zbll 集只收另外 472 个。472 + 21 = 493 = 通行的 ZBLL case 数;再加全解态 = 494(见 /math/lsll §3)。
 *
 * 复用**真实** LSLL 模型(lib/lsll/model.ts、cube333.ts)算 key,零漂移。setup 里的上游记号
 * (连写、[..]、↑↓、=、*)先过 @cuberoot/shared 的 toMoveString,宽层/转体交给 cubing.js;
 * 带净转体的 setup(`x … x'`、`… d …`)用 24 朝向搜索找回中心归位的那一个。
 *
 * Run: NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/gen-lsll-zbll-overlay.mts
 *      (Node ≥23 的原生 .ts 剥离会抢在 tsx 的 loader 前面,导致 extensionless import 解析失败。)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { AlgCase } from '@cuberoot/shared';

// tsx 的 CJS interop 下,本地 .ts 模块的命名 ESM 导入会失败 —— 走 createRequire(同 zbls 那支)。
const require = createRequire(import.meta.url);
const { toMoveString } = require('@cuberoot/shared/alg-notation') as typeof import('@cuberoot/shared/alg-notation');
const { solvedCube, extractLsll, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX } = require('../lib/lsll/cube333.ts') as typeof import('../lib/lsll/cube333.ts');
const { canonicalKey, keyToString } = require('../lib/lsll/model.ts') as typeof import('../lib/lsll/model.ts');
const { buildCaseSlugMap } = require('../lib/alg_case_link.ts') as typeof import('../lib/alg_case_link.ts');
type Cube333 = import('../lib/lsll/cube333.ts').Cube333;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'lib', 'lsll', 'zbll_algs.json');
const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
const SETS = ['zbll', 'pll'] as const;

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

// 全体转体像:找到中心归位的那一个朝向(setup 可能带净转体)。
const ROTS: string[] = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push((a + ' ' + b).trim());

/** cubing.js patternData → 我的 Cube333(kociemba 序)。 */
function toCube333(d: any): Cube333 {
  const cube = solvedCube();
  for (let i = 0; i < 8; i++) {
    cube.cp[i] = CUBING_CORNER_INDEX.indexOf(d.CORNERS.pieces[CUBING_CORNER_INDEX[i]] as never);
    cube.co[i] = d.CORNERS.orientation[CUBING_CORNER_INDEX[i]];
  }
  for (let i = 0; i < 12; i++) {
    cube.ep[i] = CUBING_EDGE_INDEX.indexOf(d.EDGES.pieces[CUBING_EDGE_INDEX[i]] as never);
    cube.eo[i] = d.EDGES.orientation[CUBING_EDGE_INDEX[i]];
  }
  return cube;
}

/** setup → LSLL canonical key(base36),或 null(记号坏 / 不是 LSLL 态)。 */
function keyOfSetup(setup: string): string | null {
  let moves: string;
  try { moves = toMoveString(setup || ''); } catch { return null; }
  let p;
  try { p = solved.applyAlg(new Alg(moves)); } catch { return null; }
  for (const r of ROTS) {
    const q = r ? p.applyAlg(new Alg(r)) : p;
    const d = q.patternData;
    if (!d.CENTERS.pieces.every((v: number, i: number) => v === i)) continue;
    const got = extractLsll(toCube333(d));
    if ('broken' in got) return null; // 中心归位的朝向唯一,这一支不成 LSLL 就是真不成
    return keyToString(canonicalKey(got.state));
  }
  return null;
}

interface ZbllRef { set: string; name: string; subgroup: string; slug: string; algCount: number }
const overlay: Record<string, ZbllRef[]> = {};
let total = 0, mapped = 0;
const misses: string[] = [];

for (const set of SETS) {
  const db: { cases: AlgCase[] } = await (await fetch(`${API}/${set}?fresh=${Date.now()}`)).json();
  const slugMap = buildCaseSlugMap(db.cases, set);
  total += db.cases.length;
  for (const c of db.cases) {
    const key = keyOfSetup(c.setup || '');
    if (!key) { misses.push(`${set} | ${c.subgroup ?? ''} | ${c.name} | ${c.setup}`); continue; }
    mapped++;
    const algCount = Array.isArray(c.algs) && Array.isArray(c.algs[0]) ? c.algs[0].length : 0;
    (overlay[key] ??= []).push({
      set,
      name: c.name,
      subgroup: c.subgroup ?? '',
      slug: (c.id != null && slugMap.byId.get(c.id)) || '',
      algCount,
    });
  }
  console.log(`${set}: ${db.cases.length} cases`);
}

for (const k of Object.keys(overlay)) overlay[k].sort((a, b) => (a.set + a.subgroup + a.name).localeCompare(b.set + b.subgroup + b.name));
const sorted = Object.fromEntries(Object.keys(overlay).sort().map((k) => [k, overlay[k]]));

fs.writeFileSync(OUT, JSON.stringify(sorted, null, 0) + '\n');
console.log(`cases ${total} | mapped ${mapped} | distinct LSLL keys ${Object.keys(sorted).length} | misses ${misses.length}`);
for (const m of misses) console.log('  MISS', m);
const multi = Object.entries(sorted).filter(([, v]) => v.length > 1);
console.log(`keys with >1 case: ${multi.length}`);
for (const [k, v] of multi) console.log('  ', k, '<-', v.map((x) => `${x.set} ${x.subgroup} ${x.name}`).join(' ;; '));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
