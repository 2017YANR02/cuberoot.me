/**
 * Phase 2 —— **全量**公式校验(Phase 0 只扫了每行的首条公式)。
 *
 * 判据 = §3 的 16 折轨道 key。公式 `A` 和 `U^a · A · U^b` 解**同一个 case**,所以
 * 「备选公式写在别的 U 朝向下」**不是错误** —— 16 折 key 天然吸收掉。key 不同才是真错位。
 *
 * 每行的**真 case** 锚定在 Phase 0 的结论上(不重新推断,免得两次跑出两个答案):
 *   对上的行  → 站上那个 case 的 `setup` 的 key
 *   新 case   → Phase 0 定的 `setup` 的 key
 *
 * ⚠ **不把 `R3` / `R4` / `L4'` 当脏数据。** 站长 2026-07-13 明确「R4 这些你要保留的」——
 * 它群元素是恒等,但是个真实的物理动作(整层转满一圈),计步照算(见 migration.md §4.5)。
 *
 *   node phase2_validate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { ident, identOfAlg } from './ll_ident.mjs';
import { parseAlgCell } from './sheet_notation.mjs';
import { stm, sqtm } from '@cuberoot/shared/alg-notation';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const rows = read('.tmp/phase0/sheet_1lll.json');
const mapping = read('.tmp/phase0/mapping.json');
const site = read('.tmp/phase0/site_cases.json');

// ---- 每行的真 case key(锚定 Phase 0)----
const siteSetup = new Map();          // "set/name" → setup
for (const c of site.cases) siteSetup.set(`${c.set}/${c.name}`, c.setup);

const trueKey = new Map();            // self → key
const trueCase = new Map();           // self → 人看的 case 名
for (const m of mapping.matched) {
  const s = m.site[0];
  const setup = siteSetup.get(`${s.set}/${s.name}`);
  const id = setup ? ident(setup) : null;
  if (id) { trueKey.set(m.self, id.key); trueCase.set(m.self, `${s.set}/${s.name}`); }
}
for (const n of mapping.newCases) {
  const id = ident(n.setup);
  if (id) { trueKey.set(n.self, id.key); trueCase.set(n.self, `新 case(${n.name})`); }
}

// key → 它是谁的 case(用来回答「这条公式其实属于哪一行」)
const keyOwner = new Map();
for (const [self, k] of trueKey) keyOwner.set(k, self);

console.log(`真 case key:${trueKey.size} / ${rows.length} 行\n`);

// ---- 全量扫描 ----
const broken = [];      // 不保 F2L / 拿不到 key
const misfiled = [];    // 保 F2L,但解的是别的 case
const parseErr = [];
const parseWarn = [];
let total = 0, ok = 0;

for (const row of rows) {
  const key = trueKey.get(row.Self);
  const entries = parseAlgCell(row['Self alg']);
  entries.forEach((e, i) => {
    if (e.error) { parseErr.push({ self: row.Self, name: row.Name, i, alg: e.raw, 毛病: e.error }); return; }
    if (e.warn) parseWarn.push({ self: row.Self, name: row.Name, i, alg: e.raw, 提醒: e.warn });
    total++;
    const id = identOfAlg(e.moves);
    if (!id) {
      broken.push({ self: row.Self, name: row.Name, i, 首条: i === 0, alg: e.text, 毛病: '不保 F2L(不是 LL 公式)' });
      return;
    }
    if (key && id.key !== key) {
      const owner = keyOwner.get(id.key);
      misfiled.push({
        self: row.Self, name: row.Name, i, 首条: i === 0, alg: e.text,
        本行是: trueCase.get(row.Self) ?? '?',
        其实解的是: owner ? `${owner}/${rows.find((r) => r.Self === owner)?.Name}` : '(不在表里的 case)',
        stm: stm(e.text), sqtm: sqtm(e.text),
      });
      return;
    }
    ok++;
  });
}

const bad = [...broken, ...misfiled];
const first = bad.filter((b) => b.首条);
const alt = bad.filter((b) => !b.首条);

console.log(`公式总数        ${total}`);
console.log(`  正确          ${ok}`);
console.log(`  不保 F2L      ${broken.length}`);
console.log(`  解错 case     ${misfiled.length}`);
console.log(`  解析报错      ${parseErr.length}`);
console.log(`  解析警告      ${parseWarn.length}`);
console.log();
console.log(`坏公式合计 ${bad.length} 条,分布在 ${new Set(bad.map((b) => b.self)).size} 行`);
console.log(`  首条公式    ${first.length}   (Phase 0 报的是 19 —— 应当吻合)`);
console.log(`  备选公式    ${alt.length}   ← Phase 0 没扫的部分`);

const out = { 统计: { total, ok, broken: broken.length, misfiled: misfiled.length, parseErr: parseErr.length }, broken, misfiled, parseErr, parseWarn };
fs.mkdirSync(path.join(ROOT, '.tmp/phase1'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.tmp/phase1/phase2_report.json'), JSON.stringify(out, null, 2));
console.log('\n→ .tmp/phase1/phase2_report.json');
