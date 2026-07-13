/**
 * Phase 4 —— 把站长那张 1LLL 表导进 `alg_cases`。产出一整块 `BEGIN … COMMIT` SQL。
 *
 * **直连 PG,禁走 REST**:写接口每 IP 每分钟限流 30 次,3900 个 case 要跑两小时且会被 429 打断;
 * 而且 POST 只能 append(`position = MAX+1`),新 case 会落到队尾、组序全乱。
 *
 * ══ 盘子(GT,见 migration.md §5)═══════════════════════════════════════════════
 *   pll  21   只换公式 + 补 meta
 *   zbll 472  同上
 *   ell  25   同上(**case 一个不动** —— 站上早就有这个 set)
 *   1lll 3400 → 3397:
 *     · 删 20 个(棱块两翻的 ELL,它们在 `ell` 里已有同态副本)
 *     · 2 个既有重复 case(`1LLL 4 64`、`1LLL 5 22`)**改造**成缺的 `DS-` / `O+`
 *       —— 复用名字,不新建,免得孤儿化用户投稿(虽然实测 1lll/ell 的投稿数是 0)
 *     · 新增 17 个(OLL 20 组里非 ELL 的)
 *   合计 3915 ✓
 *
 * ══ setup 与收尾 AUF ══════════════════════════════════════════════════════════
 *   不变式(先导任务定的,全站消费方都靠它):**`setup + alg` == 目标态**。
 *
 *   setup = ρ · inverse(本行第一条**正确**公式)   ρ = 那条公式的净转体(见 ll_ident)
 *     —— 用「第一条正确的」,不是「第一条」:19 行的 alg[0] 是坏的(见 1lll-sheet-issues.md)。
 *     —— 一行一条正确公式都没有 ⟹ 保留站上原来的 setup,只补 meta。
 *
 *   每条公式(站长的 + 站上原有的)都按新 setup 补 AUF:
 *     ① 原样就还原 → 不动
 *     ② 补一个**收尾** AUF 就还原 → 补上(收尾 AUF 是载荷,前端 displayAlg 显示时才剥)
 *     ③ 还要补**起手** AUF → 与公式自己的起手 U 合并(不是硬加一个,免得写成 `U U2 …`)
 *     ④ 怎么都不还原 → **跳过这条公式**,记进报告。这些是表侧的坏公式,要站长改表。
 *
 * ⚠ **公式本体一个字节不改**(站长 2026-07-13:「公式别乱改」)。只动起手 / 收尾 AUF,
 *   换握记号 `↑↓·` / 标签 / 括号全部原样保留 —— 手别是靠空白定的(FINGERTRICKS §2)。
 *   `R4` / `L4'` / `R3` 是**真实的物理动作**,照留。
 *
 *   node import_1lll.mjs          → .tmp/phase4/import_1lll.sql + report.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { parseAlgCell } from './sheet_notation.mjs';
import { ident, identOfAlg, netRotation, invert } from './ll_ident.mjs';
import { stm, sqtm, gen, deleteAuf, flattenAlg, tokenizeMoves } from '@cuberoot/shared/alg-notation';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const OUT = path.join(ROOT, '.tmp/phase4');

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const ROTS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());
const solves = (alg) => {
  try {
    const p = SOLVED.applyAlg(new Alg(alg));
    return ROTS.some((r) => (r ? p.applyAlg(r) : p).isIdentical(SOLVED));
  } catch { return false; }
};
const AUF = ['', 'U', 'U2', "U'"];
const AUF_AMOUNT = { '': 0, U: 1, U2: 2, "U'": 3 };
const AMOUNT_AUF = ['', 'U', 'U2', "U'"];

// ══ 输入 ══════════════════════════════════════════════════════════════════════
const rows = read('.tmp/phase0/sheet_1lll.json');
const mapping = read('.tmp/phase0/mapping.json');
const site = read('.tmp/phase0/site_cases.json');
const byId = new Map(site.cases.map((c) => [c.id, c]));
const byRef = new Map(site.cases.map((c) => [`${c.set}/${c.name}`, c]));
const rowBySelf = new Map(rows.map((r) => [Math.round(r.Self), r]));

/** `Subset` → 目标 set */
const setOf = (subset) =>
  subset === 'PLL' ? 'pll'
    : subset.startsWith('ZBLL') ? 'zbll'
      : subset.startsWith('ELL') ? 'ell'
        : '1lll';

// ══ 公式的 AUF 修正 ═══════════════════════════════════════════════════════════

/**
 * 把公式调成「`setup + alg` 恰好还原」。**只动起手 / 收尾 AUF,本体一个字节不改。**
 * @returns {{text: string, lead: number, trail: number} | null} —— null = 怎么都不还原
 */
function fitToSetup(text, moves, setup) {
  for (let p = 0; p < 4; p++) {
    for (let q = 0; q < 4; q++) {
      const probe = `${setup} ${AMOUNT_AUF[p]} ${moves} ${AMOUNT_AUF[q]}`;
      if (!solves(probe)) continue;
      if (p === 0 && q === 0) return { text, lead: 0, trail: 0 };
      // 起手 AUF:与公式自己的起手 U 合并,不是硬加一个(否则写成 `U U2 …`)
      let out = text;
      if (p > 0) {
        const body = deleteAuf(text);
        const had = body === text ? 0 : leadAmountOf(text);
        const merged = (had + p) % 4;
        out = merged === 0 ? body : `${AMOUNT_AUF[merged]} ${body}`;
      }
      if (q > 0) out = `${out} ${AMOUNT_AUF[q]}`;
      return { text: out, lead: p, trail: q };
    }
  }
  return null;
}

/** 公式起手那个 U 的量(没有就 0)。 */
function leadAmountOf(text) {
  const m = tokenizeMoves(text.trimStart()).moves[0];
  if (!m || m.family !== 'U' || m.layer) return 0;
  return ((m.amount % 4) + 4) % 4;
}

/** 去重键:剥净装饰 + 展开括号 + 归一化写法(`R2'`→`R2`、`Rw`→`r`)。**不按魔方状态去重。** */
function dedupKey(text) {
  return tokenizeMoves(flattenAlg(text)).moves
    .map((m) => {
      const fam = m.family.length === 2 && m.family[1] === 'w' ? m.family[0].toLowerCase() : m.family;
      const a = ((m.amount % 4) + 4) % 4;
      return `${m.layer ?? ''}${fam}${a === 3 ? "'" : a === 2 ? '2' : a === 0 ? '4' : ''}`;
    })
    .join(' ');
}

// ══ 逐行组装 ══════════════════════════════════════════════════════════════════
const plan = [];               // { action, siteCase?, row, setup, algs, meta }
const skipped = [];            // 怎么都不还原的公式(表侧坏数据)
const kept = { fit0: 0, fitTrail: 0, fitLead: 0 };
/** 站上原有的 speedcubedb 公式的去向 —— dropped 是**净丢数据**,必须数出来 */
const sdb = { kept: 0, deduped: 0, dropped: [], unparsable: 0 };

/** 站上这一行对应的 case(matched 里可能有 2 个:1lll + ell 同态重复,或 1lll 内部重复) */
const siteOf = new Map();      // self → [siteCase…]
for (const m of mapping.matched) siteOf.set(m.self, m.site.map((s) => byRef.get(`${s.set}/${s.name}`)).filter(Boolean));

/** 要从 1lll 删掉的(棱块两翻的 ELL —— `ell` 里已有同态副本) */
const dropFrom1lll = [];
/** 被改造的既有重复 case:`1LLL 4 64` → DS-,`1LLL 5 22` → O+ */
const repurpose = new Map();   // self(新 case) → siteCase

// 先把 1lll 内部那两对重复的「第二个」腾出来
const freeSlots = [];
for (const [a, b] of mapping.siteDups) {
  if (!a.startsWith('1lll/') || !b.startsWith('1lll/')) continue;
  freeSlots.push(byRef.get(b));
}
// 缺的 DS-(OLL 4)/ O+(OLL 5)按组号认领对应的空位
for (const nc of mapping.newCases) {
  if (nc.oll !== 'DS-' && nc.oll !== 'O+') continue;
  const want = nc.oll === 'DS-' ? 4 : 5;
  const slot = freeSlots.find((c) => Number(/^1LLL (\d+) /.exec(c.name)?.[1]) === want);
  if (!slot) throw new Error(`${nc.oll} 找不到可复用的重复 case 空位`);
  repurpose.set(nc.self, slot);
  freeSlots.splice(freeSlots.indexOf(slot), 1);
}
if (freeSlots.length) throw new Error(`还有 ${freeSlots.length} 个重复 case 没人认领`);

for (const row of rows) {
  const self = Math.round(row.Self);
  const targetSet = setOf(String(row.Subset));
  const sites = siteOf.get(self) ?? [];
  const isNew = !sites.length;

  // 这一行落在哪个 case 上
  let target;
  if (isNew) {
    target = repurpose.get(self) ?? null;      // null = 全新 INSERT
  } else {
    target = sites.find((c) => c.set === targetSet) ?? sites[0];
    // ELL 行:1lll 里的那个同态副本要删掉(ell 里已有)。
    // ⚠ 但**别删要改造的那两个** —— `1LLL 4 64` / `1LLL 5 22` 也是 sites 里的第二个,
    //   它们不是多余副本,而是要拿去装缺的 DS- / O+ 的空位。
    const reused = new Set(repurpose.values());
    for (const c of sites) if (c !== target && c.set === '1lll' && !reused.has(c)) dropFrom1lll.push(c);
  }

  // ── setup:第一条**解对了本行 case** 的公式的逆(带净转体)
  //
  // ⚠ 判据必须是**本行的真 case key**,不能是「这条公式解得开它自己的逆」——
  //    setup = inverse(A) 时 `setup + A` 恒还原,那个判断是空的,永远选中 alg[0]。
  //    19 行的 alg[0] 是坏的,照那样取 setup 会把整行的正确公式全判死
  //    (实测:PLL-U+ 的 10 条正确公式一条不剩)。
  // ⚠ 新 case 一律走 mapping.newCases 的 setup —— **被改造的那两个也是新 case**。
  //    它们 `target` 指向的是要被顶掉的重复 slot,那个 slot 的 setup 是**错的态**(重复的那个),
  //    拿它当真 case 会把整行公式全判死(实测:DS-R5 / O+D9 一条公式都存不进来)。
  const trueSetup = mapping.newCases.find((n) => n.self === self)?.setup ?? target?.setup;
  if (!trueSetup) throw new Error(`${self}/${row.Name} 没有真 case`);
  const trueKey = ident(trueSetup)?.key;
  if (!trueKey) throw new Error(`${self}/${row.Name} 的真 case 拿不到 key`);

  const entries = parseAlgCell(row['Self alg']).filter((e) => e.moves);
  let setup = null;
  for (const e of entries) {
    if (identOfAlg(e.moves)?.key !== trueKey) continue;
    const rho = netRotation(e.moves);
    setup = (rho ? `${rho} ${invert(e.moves)}` : invert(e.moves)).trim();
    break;
  }
  // 一行一条正确公式都没有 ⟹ 保留站上原来的 setup(站上的公式还得靠它)
  if (!setup) setup = trueSetup;

  // ── 公式:站长的在前,站上原有的(speedcubedb)在后,去重
  const algs = [];
  const seen = new Set();
  for (const e of entries) {
    // `body` 不是 `text`:标签 `[oh]` 另存 tags,留在公式里既冗余又会炸 cubing.js,
    // 还会让起手 AUF 补到标签前面(见 sheet_notation 的 @returns)。
    const fit = fitToSetup(e.body, e.moves, setup);
    if (!fit) { skipped.push({ self, name: row.Name, alg: e.text, 毛病: '按本行 setup 怎么补 AUF 都不还原' }); continue; }
    const k = dedupKey(fit.text);
    if (seen.has(k)) continue;
    seen.add(k);
    kept[fit.lead ? 'fitLead' : fit.trail ? 'fitTrail' : 'fit0']++;
    algs.push({
      alg: fit.text,
      ...(e.tags.length ? { tags: e.tags } : {}),
      source: 'cuberoot',
      stm: stm(fit.text), sqtm: sqtm(fit.text),
    });
  }
  // 站上原有的(speedcubedb)。setup 换了,它们也要重新对 AUF。
  // ⚠ 被改造的那两个 case 是**换了个态**,原来的公式解的是别的 case —— 一条都不能留。
  const isRepurposed = repurpose.has(self);
  for (const old of (isRepurposed ? [] : target?.algs?.[0] ?? [])) {
    const parsed = parseAlgCell(old.alg)[0];
    if (!parsed?.moves) { sdb.unparsable++; continue; }
    const fit = fitToSetup(parsed.body, parsed.moves, setup);
    if (!fit) { sdb.dropped.push({ self, name: row.Name, set: targetSet, alg: old.alg }); continue; }
    const k = dedupKey(fit.text);
    if (seen.has(k)) { sdb.deduped++; continue; }
    seen.add(k);
    sdb.kept++;
    algs.push({ ...old, alg: fit.text, source: 'speedcubedb', stm: stm(fit.text), sqtm: sqtm(fit.text) });
  }
  if (!algs.length) throw new Error(`${self}/${row.Name} 一条公式都没有`);

  plan.push({
    action: isNew && !repurpose.has(self) ? 'insert' : 'update',
    self, targetSet, target, setup, algs,
    meta: buildMeta(row, algs[0]),
    name: row.Name,
  });
}

/** AlgCaseMeta —— shape 见 shared/src/alg.ts */
function buildMeta(row, firstAlg) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);
  const str = (v) => { const s = String(v ?? '').trim(); return s || undefined; };
  const scr = parseAlgCell(row['Scramble (alg of inv case)'])[0];
  const optimal = {};
  for (const [k, lenCol, scrCol] of [
    ['stm', 'SH*', 'SH* scramble'], ['sqtm', 'SQ*', 'SQ* scramble'],
    ['htm', 'H*', 'H* scramble'], ['qtm', 'Q*', 'Q* scramble'],
  ]) {
    const len = num(row[lenCol]);
    if (len === undefined) continue;
    const s = parseAlgCell(row[scrCol])[0];
    optimal[k] = { len, ...(s?.body ? { scramble: s.body } : {}) };
  }
  const coepAlg = parseAlgCell(row['COEP alg (COEP, EPCO, OO) (currently only ZBLL)'])[0];
  const coepScr = parseAlgCell(row['COEP scramble (COEP, EPCO, OO) (currently only ZBLL)'])[0];
  const sym = {
    cn: str(row['C_n (symmetry type)']),
    selfMirror: row['Self-Mirror'] ? true : undefined,
    selfInv: row['Self-Inv'] ? true : undefined,
    any: row['Any sym'] ? true : undefined,
    full: row['Full sym'] ? true : undefined,
    anti: row['Anti-sym'] ? true : undefined,
  };
  const meta = {
    no: Math.round(row.Self),
    ollcp: String(row.Name),
    subset: String(row.Subset),
    oll: String(row.OLL),
    cp: String(row.CP ?? ''),
    scramble: scr?.body,
    gen: gen(firstAlg.alg) || undefined,
    type: str(row.Type),
    mirror: num(row.Mirror), inv: num(row.Inv), im: num(row.IM),
    ...(Object.keys(optimal).length ? { optimal } : {}),
    ...(coepAlg?.text || coepScr?.text
      ? { coep: { ...(coepAlg?.body ? { alg: coepAlg.body } : {}), ...(coepScr?.body ? { scramble: coepScr.body } : {}) } }
      : {}),
    ...(Object.values(sym).some((v) => v !== undefined) ? { sym: Object.fromEntries(Object.entries(sym).filter(([, v]) => v !== undefined)) } : {}),
    sdbNo: str(row['Speedcubedb no.']),
    docNo: str(row['doc No.']),
    oldNo: str(row['Old No.']),
  };
  return Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined));
}

// ══ 新 case 的名字与位置 ══════════════════════════════════════════════════════
// 17 个新 case 全在 OLL 20 组 —— 站上 1lll 压根没有第 20 组,所以整组新起 `1LLL 20 1..17`。
const inserts = plan.filter((p) => p.action === 'insert');
inserts.forEach((p, i) => { p.newName = `1LLL 20 ${i + 1}`; p.subgroup = '20'; });

// 1lll 的 position 全量重排:按 (组号, 组内序) 排,新的第 20 组自然落在 19 和 28 之间。
const drop = new Set(dropFrom1lll.map((c) => c.id));
const lll = [
  ...site.cases.filter((c) => c.set === '1lll' && !drop.has(c.id)).map((c) => {
    const m = /^1LLL (\d+) (\d+)$/.exec(c.name);
    const p = plan.find((x) => x.target?.id === c.id);
    return { id: c.id, g: Number(m?.[1] ?? 99), n: Number(m?.[2] ?? 0), plan: p };
  }),
  ...inserts.map((p, i) => ({ id: null, g: 20, n: i + 1, plan: p })),
].sort((a, b) => a.g - b.g || a.n - b.n);

// ══ SQL ═══════════════════════════════════════════════════════════════════════
const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => `${q(JSON.stringify(o))}::jsonb`;

const sql = ['BEGIN;', ''];
sql.push('-- ① 更新已有 case 的 setup / algs / meta');
for (const p of plan) {
  if (p.action !== 'update') continue;
  sql.push(`UPDATE alg_cases SET setup = ${q(p.setup)}, algs = ${j([p.algs])}, meta = ${j(p.meta)}`
    + (repurpose.has(p.self) ? `, subgroup = ${q(String(Number(/^1LLL (\d+) /.exec(p.target.name)[1])).padStart(2, '0'))}` : '')
    + ` WHERE id = ${p.target.id};`);
}
sql.push('', `-- ② 删掉 1lll 里那 ${dropFrom1lll.length} 个棱块两翻的 ELL(\`ell\` set 里已有同态副本;实测 1lll/ell 的用户投稿数为 0)`);
for (const c of dropFrom1lll) sql.push(`DELETE FROM alg_cases WHERE id = ${c.id};  -- ${c.name}`);

sql.push('', `-- ③ 新增 ${inserts.length} 个 case(OLL 20 组里非 ELL 的)`);
const STICKER = { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' };
for (const p of inserts) {
  sql.push(`INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs, meta)`
    + ` VALUES ('3x3', '1lll', -1, ${q(p.newName)}, ${q(p.subgroup)}, ${q(p.setup)}, ${j(STICKER)}, ${j([p.algs])}, ${j(p.meta)});`);
}

sql.push('', '-- ④ 1lll 的 position 全量重排(新的第 20 组落在 19 和 28 之间)');
lll.forEach((c, i) => {
  const where = c.id !== null ? `id = ${c.id}` : `puzzle = '3x3' AND set_slug = '1lll' AND name = ${q(c.plan.newName)}`;
  sql.push(`UPDATE alg_cases SET position = ${i} WHERE ${where};`);
});
sql.push('', 'COMMIT;');

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'import_1lll.sql'), sql.join('\n') + '\n', 'utf8');

// ══ 报告 ══════════════════════════════════════════════════════════════════════
const counts = { pll: 0, zbll: 0, ell: 0, '1lll': 0 };
for (const p of plan) counts[p.targetSet]++;
console.log('每个 set 的 case 数(应当 = GT):');
console.log(`  pll  ${counts.pll}   (GT 21)`);
console.log(`  zbll ${counts.zbll}  (GT 472)`);
console.log(`  ell  ${counts.ell}   (GT 25)`);
console.log(`  1lll ${counts['1lll']} (GT 3397)`);
console.log(`  合计 ${plan.length} (GT 3915)`);
console.log(`\n1lll 重排后的 case 数:${lll.length}`);
console.log(`\n站长的公式(${kept.fit0 + kept.fitTrail + kept.fitLead + skipped.length} 条):`);
console.log(`  原样就还原      ${kept.fit0}`);
console.log(`  补收尾 AUF      ${kept.fitTrail}`);
console.log(`  补起手 AUF      ${kept.fitLead}`);
console.log(`  跳过(表侧坏的) ${skipped.length}`);
console.log(`\n站上原有的 speedcubedb 公式:`);
console.log(`  留用            ${sdb.kept}`);
console.log(`  与站长的重复    ${sdb.deduped}`);
console.log(`  丢弃(新 setup 下不成立) ${sdb.dropped.length}`);
console.log(`  解析不了        ${sdb.unparsable}`);
console.log(`\n动作:${plan.filter(p => p.action === 'update').length} UPDATE / ${inserts.length} INSERT / ${dropFrom1lll.length} DELETE`);
console.log(`SQL:${sql.length} 行 → .tmp/phase4/import_1lll.sql`);

writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({
  counts, kept, skipped,
  sdb: { kept: sdb.kept, deduped: sdb.deduped, unparsable: sdb.unparsable, dropped: sdb.dropped },
  plan: plan.map((p) => ({ self: p.self, name: p.name, set: p.targetSet, action: p.action, id: p.target?.id ?? null, algs: p.algs.length })),
}, null, 2));
