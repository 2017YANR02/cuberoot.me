/**
 * Phase 6 的前置判据 —— 表里那几套**替代打乱**到底打出的是不是同一个 case?
 *
 * trainer 要让用户在 `Inv case` / `SH*` / `SQ*` / `H*` / `Q*` / `COEP` 之间选。
 * 前四套是「某度量下最优的打乱」,COEP 是另一种写法。如果它们落在**别的** case 上,
 * trainer 就会给出一个通往别处的打乱,而屏幕上还写着这个 case 的名字 —— 静默教错。
 *
 * 判据 = 16 折轨道(`U^p · S · U^q` 是同一个 case,见 migration.md §3)。
 *
 *   node verify_alt_scrambles.mjs
 */
import { execFileSync } from 'node:child_process';
import { ident } from './ll_ident.mjs';
import { toMoveString } from '@cuberoot/shared/alg-notation';

const psql = (sql) =>
  execFileSync('ssh', ['root@cuberoot',
    `PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db -t -A -c ${JSON.stringify(sql.replace(/\s+/g, ' '))}`],
  { encoding: 'utf8', maxBuffer: 1 << 28 });

const rows = JSON.parse(psql(`
  SELECT json_agg(row_to_json(t)) FROM (
    SELECT set_slug, name, setup, meta FROM alg_cases
    WHERE set_slug IN ('pll','zbll','ell','1lll') AND meta IS NOT NULL) t;`).trim());

const KINDS = [
  ['scramble', (m) => m.scramble],
  ['optimal.stm', (m) => m.optimal?.stm?.scramble],
  ['optimal.sqtm', (m) => m.optimal?.sqtm?.scramble],
  ['optimal.htm', (m) => m.optimal?.htm?.scramble],
  ['optimal.qtm', (m) => m.optimal?.qtm?.scramble],
  ['coep', (m) => m.coep?.scramble],
];

const tally = {};
for (const [kind] of KINDS) tally[kind] = { have: 0, same: 0, other: 0, broken: 0, examples: [] };

for (const r of rows) {
  const trueKey = ident(r.setup)?.key;
  if (!trueKey) { console.log('setup 拿不到轨道身份:', r.set_slug, r.name); continue; }
  for (const [kind, get] of KINDS) {
    const s = get(r.meta);
    if (!s) continue;
    const t = tally[kind];
    t.have++;
    let key;
    try { key = ident(toMoveString(s))?.key; } catch { key = null; }
    if (!key) {
      t.broken++;
      if (t.examples.length < 3) t.examples.push({ 毛病: '不是 LL 态 / 解析不了', name: r.name, s });
      continue;
    }
    if (key === trueKey) t.same++;
    else {
      t.other++;
      if (t.examples.length < 3) t.examples.push({ 毛病: '打的是别的 case', name: r.name, s });
    }
  }
}

console.log(`\n${rows.length} 个带 meta 的 case\n`);
for (const [kind] of KINDS) {
  const t = tally[kind];
  const ok = t.same === t.have;
  console.log(`  ${ok ? '✓' : '✗'} ${kind.padEnd(13)} 有 ${String(t.have).padStart(5)} 条 | 同 case ${String(t.same).padStart(5)} | 别的 case ${t.other} | 坏 ${t.broken}`);
  for (const e of t.examples) console.log(`      ${e.毛病}:${e.name}  ${JSON.stringify(e.s)}`);
}
