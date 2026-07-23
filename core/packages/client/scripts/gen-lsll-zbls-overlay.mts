/*
 * gen-lsll-zbls-overlay — 把 zbls 公式集(3x3/zbls,305 案)映射到 LSLL canonical key,
 * 产出 `lib/lsll/zbls_algs.json`:{ [base36Key]: [{ name, subgroup, slug, algCount }] }。
 *
 * 用途:LSLL case 页(/alg/lsll/case?k=)对最常见那批 case 交叉链接到已建好的 zbls 库案例
 * (那里有正确的图 + 精选公式 + 训练器)——单一数据源不复制公式,只做指向。
 *
 * 复用**真实** LSLL 模型(lib/lsll/model.ts、cube333.ts)算 key,零漂移;zbls setup 的上游
 * 记号(连写 MR、[..]、↑↓、=、*)先过 @cuberoot/shared 的 toMoveString,再喂 cubing.js。
 * − 组案例(槽在 FL/BL/BR)按 y 共轭(重着色)归 FR 框架,与 zbls_docx 审计同一套 PRE/POST。
 *
 * Run: pnpm --filter @cuberoot/client exec tsx scripts/gen-lsll-zbls-overlay.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { AlgCase } from '@cuberoot/shared';

// tsx 的 CJS interop 下,本地 .ts 模块的**命名 ESM 导入会失败**(见 build_puzzle_metrics.mts 头注);
// 走 createRequire 拿 CJS 导出对象(所有命名导出都是它的属性),运行/类型两头都干净。
const require = createRequire(import.meta.url);
const { toMoveString } = require('@cuberoot/shared/alg-notation') as typeof import('@cuberoot/shared/alg-notation');
const { solvedCube, extractLsll, CUBING_CORNER_INDEX, CUBING_EDGE_INDEX } = require('../lib/lsll/cube333.ts') as typeof import('../lib/lsll/cube333.ts');
const { canonicalKey, keyToString } = require('../lib/lsll/model.ts') as typeof import('../lib/lsll/model.ts');
const { buildCaseSlugMap } = require('../lib/alg_case_link.ts') as typeof import('../lib/alg_case_link.ts');
type Cube333 = import('../lib/lsll/cube333.ts').Cube333;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'lib', 'lsll', 'zbls_algs.json');
const API = 'https://api.cuberoot.me/v1/alg/sets/3x3/zbls';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

// 全体转体像:找到中心归位的那一个朝向。
const ROTS: string[] = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push((a + ' ' + b).trim());
// − 组:y 共轭(重着色)把槽转回 FR。
const PRE = ['', "y'", 'y2', 'y'], POST = ['', 'y', 'y2', "y'"];

/** cubing.js FR-框架 patternData → 我的 Cube333(kociemba 序)。 */
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

/** zbls setup → LSLL canonical key(base36),或 null(记号/框架不成 LSLL)。 */
function keyOfSetup(setup: string): string | null {
  let moves: string;
  try { moves = toMoveString(setup || ''); } catch { return null; }
  for (let k = 0; k < 4; k++) {
    let p;
    try { p = solved.applyAlg(new Alg(`${PRE[k]} ${moves} ${POST[k]}`.trim())); } catch { return null; }
    for (const r of ROTS) {
      const q = r ? p.applyAlg(new Alg(r)) : p;
      const d = q.patternData;
      if (!d.CENTERS.pieces.every((v: number, i: number) => v === i)) continue;
      const got = extractLsll(toCube333(d));
      if ('broken' in got) continue;
      return keyToString(canonicalKey(got.state));
    }
  }
  return null;
}

const db: { cases: AlgCase[] } = await (await fetch(`${API}?fresh=${Date.now()}`)).json();
const slugMap = buildCaseSlugMap(db.cases, 'zbls');

const overlay: Record<string, { name: string; subgroup: string; slug: string; algCount: number }[]> = {};
let mapped = 0;
const misses: string[] = [];
for (const c of db.cases) {
  const key = keyOfSetup(c.setup || '');
  if (!key) { misses.push(`${c.subgroup} | ${c.name} | ${c.setup}`); continue; }
  mapped++;
  const algCount = Array.isArray(c.algs) ? c.algs.reduce((n, ori) => n + (Array.isArray(ori) ? ori.length : 0), 0) : 0;
  (overlay[key] ??= []).push({
    name: c.name, subgroup: c.subgroup ?? '',
    slug: (c.id != null && slugMap.byId.get(c.id)) || '',
    algCount,
  });
}
// 稳定排序:同 key 下按 subgroup+name。
for (const k of Object.keys(overlay)) overlay[k].sort((a, b) => (a.subgroup + a.name).localeCompare(b.subgroup + b.name));
const sorted = Object.fromEntries(Object.keys(overlay).sort().map((k) => [k, overlay[k]]));

fs.writeFileSync(OUT, JSON.stringify(sorted, null, 0) + '\n');
console.log(`cases ${db.cases.length} | mapped ${mapped} | distinct LSLL keys ${Object.keys(sorted).length} | misses ${misses.length}`);
for (const m of misses) console.log('  MISS', m);
const multi = Object.entries(sorted).filter(([, v]) => v.length > 1);
console.log(`keys with >1 zbls case: ${multi.length}`);
for (const [k, v] of multi) console.log('  ', k, '<-', v.map((x) => x.subgroup + ' ' + x.name).join(' ;; '));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
