/**
 * canonicalize_ll_algs.mjs 的本地 dry run:把生产 alg_cases 现状灌进本地 pg13,套用生成的 SQL,
 * 再把结果**读回来**用 cubing.js 逐条验。
 *
 * 验四条(不是"SQL 语法能过"):
 *   A. 魔友看到的一个字没变 —— displayAlg(新) 剥掉起手 U 后 == displayAlg(旧) 剥掉起手 y 后
 *   B. 每条改过的公式,要么**精确还原**,要么**状态与原公式一致**(只差一个整体旋转)
 *   C. 真·整还原的 5 个集合(pll/zbll/1lll/ell/anti-pll):改完之后**每一条**都精确还原
 *      —— 这正是 lib/alg_validation.ts 强制的不变式
 *   D. 没有一条公式的**起手**还留着 y(那 18 条明确跳过的除外)
 *
 * 前置:docker pg13(:5433, db cuberoot_db)。只碰临时表 alg_cases_dryrun,不动真表。
 *
 *   node canonicalize_ll_algs.mjs --sql && node dryrun_ll_algs.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
const LL_SETS = ['oll', 'pll', 'coll', 'cmll', 'anti-pll', 'ollcp', 'zbll', '1lll', 'ell'];
/** 目标态 = 整体还原的那 5 个(其余 4 个只完成本阶段,替代公式本就不整还原) */
const FULL_SOLVE_SETS = new Set(['pll', 'zbll', '1lll', 'ell', 'anti-pll']);
const TABLE = 'alg_cases_dryrun';
const TMP = '../../../.tmp';

const docker = (args) => execFileSync('docker', args, { encoding: 'utf-8' });
const psql = (sql) => docker(['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', sql]);
const psqlFile = (p) => docker(['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-q', '-f', p]);
const intoContainer = (name) => docker(['cp', new URL(`${TMP}/${name}`, import.meta.url).pathname.replace(/^\//, ''), `pg13:/tmp/${name}`]);

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const ROTATIONS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTATIONS.push(`${a} ${b}`.trim());
const stateOf = (alg) => SOLVED.applyAlg(new Alg(alg));
const sameUpToRotation = (a, b) => ROTATIONS.some(r => (r ? a.applyAlg(r) : a).isIdentical(b));

/** 与前端 lib/alg_display.ts 的 displayAlg 同一条规则 —— 剥掉收尾 AUF */
const displayAlg = (alg) => alg.replace(/[\s(]*\bU(?:2'?|'|)(?![\w'])\s*\)?\s*$/, '').trimEnd() || alg;
/**
 * 剥掉起手的**整串** y/U 拿到 body。必须剥整串:body 自己以 U 开头时,
 * `y U R' …` 会被合并成 `U2 R' …`,只剥一个 token 就成了拿 `U R' …` 跟 `R' …` 比,假阳性。
 */
const stripLead = (alg) => alg.replace(/^(?:\s*[yU]\d*'?(?=\s|$))+\s*/, '');

// ── 1. 抓生产现状
const before = new Map();
for (const set of LL_SETS) {
  const { cases } = await (await fetch(`${API}/${set}`)).json();
  for (const c of cases) before.set(c.id, { set, name: c.name, setup: c.setup, algs: c.algs });
}
console.log(`生产现状:${before.size} 个 case`);

// ── 2. 灌进本地临时表
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
mkdirSync(TMP, { recursive: true });
writeFileSync(`${TMP}/dryrun_seed.sql`, [
  `DROP TABLE IF EXISTS ${TABLE};`,
  `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, set_slug TEXT, name TEXT, setup TEXT, algs JSONB);`,
  ...[...before].map(([id, c]) =>
    `INSERT INTO ${TABLE} VALUES (${id}, ${q(c.set)}, ${q(c.name)}, ${q(c.setup)}, ${q(JSON.stringify(c.algs))}::jsonb);`),
].join('\n'), 'utf-8');
intoContainer('dryrun_seed.sql');
psqlFile('/tmp/dryrun_seed.sql');
console.log(`灌入本地 pg13:${psql(`SELECT count(*) FROM ${TABLE};`).trim()} 行`);

// ── 3. 套用 SQL(换成临时表名,绝不碰真表)
const applySql = readFileSync(`${TMP}/canonicalize_ll_algs.sql`, 'utf-8').replace(/UPDATE alg_cases /g, `UPDATE ${TABLE} `);
writeFileSync(`${TMP}/dryrun_apply.sql`, applySql, 'utf-8');
intoContainer('dryrun_apply.sql');
psqlFile('/tmp/dryrun_apply.sql');
console.log(`套用 SQL:${(applySql.match(/^UPDATE/gm) || []).length} 条 UPDATE`);

// ── 4. 读回来逐条验
const rows = psql(`SELECT id, algs::text FROM ${TABLE} ORDER BY id;`).trim().split('\n');
const stats = { changed: 0, bodyOk: 0, solvesOrPreserves: 0, fullSolveTotal: 0, fullSolveOk: 0, leadingY: 0 };
const bad = [];
for (const line of rows) {
  const bar = line.indexOf('|'); // psql -A 的字段分隔符是 |
  const id = Number(line.slice(0, bar));
  const after = JSON.parse(line.slice(bar + 1));
  const orig = before.get(id);
  const oldFlat = orig.algs.flat(), newFlat = after.flat();
  if (oldFlat.length !== newFlat.length) { bad.push({ id, why: 'alg 条数变了' }); continue; }

  for (let i = 0; i < oldFlat.length; i++) {
    const oldA = oldFlat[i].alg, newA = newFlat[i].alg;
    const skipped = oldA === newA && /^\s*y/.test(oldA); // 那 18 条

    // D. 起手不许再有 y
    if (/^\s*y/.test(newA) && !skipped) {
      stats.leadingY++;
      bad.push({ id, case: orig.name, why: '起手还留着 y', new: newA });
    }

    let solved = false;
    try { solved = sameUpToRotation(stateOf(`${orig.setup} ${newA}`), SOLVED); } catch { /* 解析失败 */ }

    // C. 整还原集合里,每一条都必须精确还原
    if (FULL_SOLVE_SETS.has(orig.set) && !skipped) {
      stats.fullSolveTotal++;
      if (solved) stats.fullSolveOk++;
      else bad.push({ id, case: orig.name, why: '整还原集合里居然不还原', old: oldA, new: newA });
    }

    if (oldA === newA) continue;
    stats.changed++;

    // A. 魔友看到的一个字没变
    if (stripLead(displayAlg(newA)) === stripLead(displayAlg(oldA))) stats.bodyOk++;
    else bad.push({ id, case: orig.name, why: 'body 变了!', oldBody: stripLead(displayAlg(oldA)), newBody: stripLead(displayAlg(newA)) });

    // B. 要么还原,要么状态与原公式一致
    let preserves = false;
    try { preserves = sameUpToRotation(stateOf(`${orig.setup} ${newA}`), stateOf(`${orig.setup} ${oldA}`)); } catch { /* skip */ }
    if (solved || preserves) stats.solvesOrPreserves++;
    else bad.push({ id, case: orig.name, why: '既不还原也没保持原状态!', old: oldA, new: newA });
  }
}
console.log(`\n改过的公式:${stats.changed} 条`);
console.log(`  A. 魔友看到的一个字没变         :${stats.bodyOk} / ${stats.changed}`);
console.log(`  B. 精确还原 或 状态与原公式一致 :${stats.solvesOrPreserves} / ${stats.changed}`);
console.log(`  C. 5 个整还原集合全部精确还原   :${stats.fullSolveOk} / ${stats.fullSolveTotal}`);
console.log(`  D. 起手还留着 y 的             :${stats.leadingY}(应为 0)`);
if (bad.length) { console.log(`\n✗ ${bad.length} 条不合格:`); console.table(bad.slice(0, 20)); }
else console.log('\n✓ 全部通过。');
psql(`DROP TABLE ${TABLE};`);
console.log('临时表已删。');
