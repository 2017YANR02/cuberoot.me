/**
 * Phase 4 验收 —— **从库里读回来验**,不验 SQL 生成器的内存对象。
 *
 * 生成器自证是空的:同一份 buggy 逻辑既造 SQL 又造断言,永远绿。所以这里走完整回路:
 * 生产 dump → 本机 pg13 → 迁移 0069 → import_1lll.sql → **psql 读回** → cubing.js 判。
 *
 * 判据(全站消费方都靠它,见 migration.md §4.3):
 *   ① `setup + alg` 还原(允许整体转体)—— **每一条公式**,不抽样
 *   ② 4 个 set 的 case 数 = GT(21 / 472 / 25 / 3397)
 *   ③ 3915 个 case 的 16 折轨道身份**两两不同**(没有重复 case)
 *   ④ 1lll 的 position 连续 0..3396(前端按它排组)
 *   ⑤ meta.no 与表的 Self 一一对应;meta 里的 optimal 步数 ≥ 首条公式的实际步数
 *
 *   node phase4_verify.mjs [dbname]      默认 alg_dry
 */
import { execFileSync } from 'node:child_process';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { ident } from './ll_ident.mjs';
import { stm, sqtm, toMoveString } from '@cuberoot/shared/alg-notation';

const DB = process.argv[2] ?? 'alg_dry';
const SETS = { pll: 21, zbll: 472, ell: 25, '1lll': 3397 };

/** `node phase4_verify.mjs prod` → 直接读生产库(灌完之后必跑,dry run 绿不代表生产绿)。 */
const psql = DB === 'prod'
  ? (sql) => execFileSync('ssh', ['root@cuberoot',
      // 压成一行:JSON.stringify 会把换行转义成字面 `\n`,远端 shell 原样传给 psql → 语法错
      `PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db -t -A -c ${JSON.stringify(sql.replace(/\s+/g, ' '))}`],
    { encoding: 'utf8', maxBuffer: 1 << 28 })
  : (sql) => execFileSync('docker', ['exec', '-e', 'PGPASSWORD=dev', 'pg13', 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 1 << 28 });

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const ROTS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());
const solves = (alg) => {
  const p = SOLVED.applyAlg(new Alg(alg));
  return ROTS.some((r) => (r ? p.applyAlg(r) : p).isIdentical(SOLVED));
};

const rows = JSON.parse(
  psql(`SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, set_slug, name, position, subgroup, setup, algs, meta
          FROM alg_cases WHERE set_slug IN ('pll','zbll','ell','1lll') ORDER BY set_slug, position) t;`).trim(),
);

const bad = [];
const fail = (kind, r, extra) => bad.push({ kind, id: r.id, set: r.set_slug, name: r.name, ...extra });

// ── ① 每条公式都要还原 ────────────────────────────────────────────────────────
let nAlgs = 0;
for (const r of rows) {
  if (!r.setup) { fail('没有 setup', r, {}); continue; }
  for (const ori of r.algs ?? []) {
    for (const a of ori ?? []) {
      nAlgs++;
      // 入库文本带换握记号 / 标签 / 括号 / **连写**(`MR` = M+R)—— 喂 cubing.js 前按 token 重拼。
      // 直接 new Alg(原文) 会把 `MR` 当成一个叫 MR 的 family 静默吃掉。
      let moves;
      try { moves = toMoveString(a.alg); } catch (e) { fail('公式解析炸了', r, { alg: a.alg, e: String(e) }); continue; }
      let ok = false;
      try { ok = solves(`${r.setup} ${moves}`); } catch (e) { fail('cubing.js 炸了', r, { alg: a.alg, e: String(e) }); continue; }
      if (!ok) fail('setup + alg 不还原', r, { setup: r.setup, alg: a.alg });
      if (a.stm !== undefined && a.stm !== stm(a.alg)) fail('stm 对不上', r, { alg: a.alg, 库里: a.stm, 算出: stm(a.alg) });
      if (a.sqtm !== undefined && a.sqtm !== sqtm(a.alg)) fail('sqtm 对不上', r, { alg: a.alg, 库里: a.sqtm, 算出: sqtm(a.alg) });
    }
  }
  if (!(r.algs?.[0]?.length)) fail('一条公式都没有', r, {});
}

// ── ② case 数 ────────────────────────────────────────────────────────────────
const counts = {};
for (const r of rows) counts[r.set_slug] = (counts[r.set_slug] ?? 0) + 1;

// ── ③ 轨道身份两两不同 ───────────────────────────────────────────────────────
const seen = new Map();
for (const r of rows) {
  const k = ident(r.setup)?.key;
  if (!k) { fail('setup 拿不到轨道身份', r, { setup: r.setup }); continue; }
  if (seen.has(k)) fail('与另一个 case 是同一个态', r, { 撞上: seen.get(k) });
  else seen.set(k, `${r.set_slug}/${r.name}`);
}

// ── ④ position ───────────────────────────────────────────────────────────────
const lll = rows.filter((r) => r.set_slug === '1lll').map((r) => r.position).sort((a, b) => a - b);
const posOk = lll.every((p, i) => p === i);

// ── ⑤ meta ───────────────────────────────────────────────────────────────────
const nos = new Set();
for (const r of rows) {
  const m = r.meta;
  if (!m) { fail('没有 meta', r, {}); continue; }
  if (typeof m.no !== 'number') { fail('meta.no 缺失', r, {}); continue; }
  if (nos.has(m.no)) fail('meta.no 重号', r, { no: m.no });
  nos.add(m.no);
  if (!m.ollcp) fail('meta.ollcp 缺失', r, {});
  // 最优步数不可能比某条实际公式还长
  const best = Math.min(...(r.algs[0] ?? []).map((a) => stm(a.alg)));
  if (m.optimal?.stm?.len > best) fail('meta.optimal.stm 比实际公式还长', r, { optimal: m.optimal.stm.len, 实际: best });
}

// ── 报告 ─────────────────────────────────────────────────────────────────────
const line = (ok, s) => console.log(`  ${ok ? '✓' : '✗'} ${s}`);
console.log(`\n从 pg13/${DB} 读回 ${rows.length} 个 case、${nAlgs} 条公式\n`);
line(bad.filter((b) => b.kind.includes('还原') || b.kind.includes('炸')).length === 0,
  `每条公式都满足 setup + alg == 还原(${nAlgs} 条)`);
for (const [s, gt] of Object.entries(SETS)) line(counts[s] === gt, `${s} = ${counts[s] ?? 0}(GT ${gt})`);
line(rows.length === 3915, `合计 ${rows.length}(GT 3915)`);
line(seen.size === rows.length, `${seen.size} 个互不相同的态(应当 = case 数)`);
line(posOk, `1lll position 连续 0..${lll.length - 1}`);
line(nos.size === rows.length, `meta.no 3915 个不重号`);
line(bad.filter((b) => b.kind.includes('stm') || b.kind.includes('sqtm')).length === 0, 'stm / sqtm 与公式一致');

if (bad.length) {
  console.log(`\n✗ ${bad.length} 处不合格:`);
  const by = {};
  for (const b of bad) (by[b.kind] ??= []).push(b);
  for (const [k, v] of Object.entries(by)) {
    console.log(`\n  ${k}(${v.length}):`);
    for (const b of v.slice(0, 8)) console.log('   ', JSON.stringify(b));
    if (v.length > 8) console.log(`    … 还有 ${v.length - 8} 条`);
  }
  process.exit(1);
}
console.log('\n全绿。');
