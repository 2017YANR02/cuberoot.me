/**
 * 先导任务的本地 dry run:把生产的 alg_cases 现状灌进本地 pg13,套用改写 SQL,
 * 再把结果**读回来**用 cubing.js 逐条验状态。
 *
 * 验的不是"SQL 语法能过",是"改完之后每一条公式还是原来那条公式":
 *   setup + 新公式  ==  setup + 旧公式   (只差一个整体旋转)
 * 以及 —— 前端显示层剥掉收尾 AUF 之后,body 一个字节没变。
 *
 * 前置:docker pg13(:5433, db cuberoot_db)。只碰一张临时表 alg_cases_dryrun,不动真表。
 *
 *   node dryrun_leading_y.mjs
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
const LL_SETS = ['oll', 'pll', 'coll', 'cmll', 'anti-pll', 'ollcp', 'zbll', '1lll', 'ell'];
const TABLE = 'alg_cases_dryrun';
const TMP = '../../../.tmp';

const psql = (sql) =>
  execFileSync('docker', ['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', sql], { encoding: 'utf-8' });
const psqlFile = (path) =>
  execFileSync('docker', ['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-q', '-f', path], { encoding: 'utf-8' });

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const ROTATIONS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTATIONS.push(`${a} ${b}`.trim());
const stateOf = (alg) => SOLVED.applyAlg(new Alg(alg));
const sameUpToRotation = (a, b) => ROTATIONS.some(r => (r ? a.applyAlg(r) : a).isIdentical(b));

/** 与前端 lib/alg_display.ts 的 displayAlg 同一条规则 —— 剥掉收尾 AUF */
const displayAlg = (alg) => alg.replace(/[\s(]*\bU(?:2'?|'|)(?![\w'])\s*\)?\s*$/, '').trimEnd() || alg;
/**
 * 剥掉起手的**整串** y/U,拿到 body —— 用来核对 body 一个字节没变。
 * 必须剥整串:body 自己以 U 开头时(5 条),`y U R' …` 会被合并成 `U2 R' …`,
 * 只剥一个 token 就变成拿 `U R' …` 跟 `R' …` 比,假阳性。
 */
const stripLead = (alg) => alg.replace(/^(?:\s*[yU]\d*'?(?=\s|$))+\s*/, '');

// ── 1. 抓生产现状
const before = new Map(); // id → { set, name, setup, algs }
for (const set of LL_SETS) {
  const { cases } = await (await fetch(`${API}/${set}`)).json();
  for (const c of cases) before.set(c.id, { set, name: c.name, setup: c.setup, algs: c.algs });
}
console.log(`生产现状:${before.size} 个 case`);

// ── 2. 灌进本地临时表
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const seed = [
  `DROP TABLE IF EXISTS ${TABLE};`,
  `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, set_slug TEXT, name TEXT, setup TEXT, algs JSONB);`,
  ...[...before].map(([id, c]) =>
    `INSERT INTO ${TABLE} VALUES (${id}, ${q(c.set)}, ${q(c.name)}, ${q(c.setup)}, ${q(JSON.stringify(c.algs))}::jsonb);`),
].join('\n');
mkdirSync(TMP, { recursive: true });
writeFileSync(`${TMP}/dryrun_seed.sql`, seed, 'utf-8');
execFileSync('docker', ['cp', new URL(`${TMP}/dryrun_seed.sql`, import.meta.url).pathname.replace(/^\//, ''), 'pg13:/tmp/dryrun_seed.sql']);
psqlFile('/tmp/dryrun_seed.sql');
console.log(`灌入本地 pg13:${psql(`SELECT count(*) FROM ${TABLE};`).trim()} 行`);

// ── 3. 套用改写 SQL(把表名换掉,别碰真表)
psqlFile('/tmp/rewrite_dryrun.sql');
console.log(`UPDATE 影响:${psql(`SELECT count(*) FROM ${TABLE} c WHERE c.algs::text ~ '"alg": "U';`).trim()} 个 case 至少有一条 U 起手公式`);

// ── 4. 读回来逐条验
const rows = psql(`SELECT id, algs::text FROM ${TABLE} ORDER BY id;`).trim().split('\n');
let checked = 0, stateOk = 0, bodyOk = 0;
const bad = [];
for (const line of rows) {
  const bar = line.indexOf('|'); // psql -A 的字段分隔符是 |
  const id = Number(line.slice(0, bar));
  const after = JSON.parse(line.slice(bar + 1));
  const orig = before.get(id);
  const oldFlat = orig.algs.flat();
  const newFlat = after.flat();
  if (oldFlat.length !== newFlat.length) { bad.push({ id, why: 'alg 条数变了' }); continue; }

  for (let i = 0; i < oldFlat.length; i++) {
    const oldA = oldFlat[i].alg, newA = newFlat[i].alg;
    if (oldA === newA) continue; // 没改的(含 18 条跳过的)
    checked++;
    // (a) 状态不变:setup + 新 == setup + 旧,只差一个整体旋转
    try {
      if (sameUpToRotation(stateOf(`${orig.setup} ${newA}`), stateOf(`${orig.setup} ${oldA}`))) stateOk++;
      else bad.push({ id, case: orig.name, why: '状态变了!', old: oldA, new: newA });
    } catch { bad.push({ id, case: orig.name, why: '解析失败', old: oldA, new: newA }); }
    // (b) body 一个字节没变(剥掉起手 y/U 和收尾 AUF 之后)
    if (stripLead(displayAlg(newA)) === stripLead(displayAlg(oldA))) bodyOk++;
    else bad.push({ id, case: orig.name, why: 'body 变了!', oldBody: stripLead(displayAlg(oldA)), newBody: stripLead(displayAlg(newA)) });
  }
}
console.log(`\n改写的公式:${checked} 条`);
console.log(`  状态与原公式一致(差一个整体旋转):${stateOk} / ${checked}`);
console.log(`  body 一个字节没变              :${bodyOk} / ${checked}`);
if (bad.length) { console.log(`\n✗ ${bad.length} 条不合格:`); console.table(bad.slice(0, 20)); }
else console.log('\n✓ 全部通过。');
psql(`DROP TABLE ${TABLE};`);
console.log('临时表已删。');
