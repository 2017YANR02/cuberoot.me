/**
 * 审计 `alg_cases.meta` 里那四个**指向别的 case** 的字段:`inv` / `mirror` / `im` / `cp`。
 *
 * ══ 为什么单独审这一层 ════════════════════════════════════════════════════════
 *
 * 站上现有的两道关口都碰不到它:
 *
 *   · 页面上的「校验」按钮(`client/lib/alg_validation_scan.ts`)只跑 `setup + alg → 目标态`,
 *     一条一条验公式。它**从不读 meta**,所以一张 `inv` 指错的 case 照样「全部通过」。
 *   · `docs/1lll-sheet-issues.md` §元数据层验的是这三列**作为置换**自不自洽(是不是对合、
 *     `IM == Inv∘Mirror`)。那是**闭合性**检查 —— 把 A↔B、C↔D 整体换成 A↔D、C↔B 依然
 *     100% 通过,因为它压根没问「B 到底是不是 A 的逆态」。
 *
 * 这里补的就是那一问:**拿魔方状态当判据**。
 *
 *   inv    : state(byNo[m.inv])    == state(c)⁻¹
 *   mirror : state(byNo[m.mirror]) == M 平面镜像(state(c))
 *   im     : state(byNo[m.im])     == 两者的复合
 *   cp/oll : 同一个计算出来的类里,标签必须唯一(`ident()` 的 cp / ori,见 ll_ident.mjs)
 *
 * 判据全部走 `ident()` 的 16 折轨道(case 身份的定义),镜像走站上唯一那份
 * `@cuberoot/shared/alg-mirror` 的 `mirrorMoveString(·, 'M')`,不另写一套规则。
 *
 * ══ 自证(判据本身对不对)══════════════════════════════════════════════════════
 *
 * 报告开头会打三条内部一致性:①每个 setup 的 key 互不相同(3915 个态 3915 个 key);
 * ②按状态算出来的 inv / mirror 各自是**对合**;③`im == inv∘mirror == mirror∘inv`。
 * 这三条不是从站上数据抄的,是从状态独立算的 —— 它们成立才说明判据可信。
 *
 * ⚠ 要 `tsx` 跑,不能裸 `node`:`@cuberoot/shared/alg-mirror` 的 dist 里是无扩展名的相对 import
 *   (server 走 esbuild bundle 所以没事),裸 node 解析不了。
 *
 *   pnpm --filter @cuberoot/alg-build exec tsx verify_meta_pointers.mjs
 *   pnpm --filter @cuberoot/alg-build exec tsx verify_meta_pointers.mjs --with-sql <migration>
 *                                            ↑ 先把一份待上线的 migration 套上去再审(上线前必跑)
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ident, invert } from './ll_ident.mjs';
import { mirrorMoveString } from '@cuberoot/shared/alg-mirror';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, '.tmp/meta-pointers');
const API = process.env.ALG_API ?? 'https://api.cuberoot.me/v1/alg/sets';

/** 四个吃 meta 的 set。`meta.no`(表里的 `Self`)在这四个 set 上是**全局唯一**的,所以要一起拉。 */
const SETS = [['3x3', 'pll'], ['3x3', 'ell'], ['3x3', 'zbll'], ['3x3', '1lll']];

// ══ 拉数据 ════════════════════════════════════════════════════════════════════
const cases = [];
for (const [puzzle, set] of SETS) {
  const r = await fetch(`${API}/${puzzle}/${set}`);
  if (!r.ok) throw new Error(`${puzzle}/${set} 拉不下来:HTTP ${r.status}`);
  const d = await r.json();
  for (const c of d.cases) if (c.meta?.no != null) cases.push({ ...c, set });
}
console.log(`拉到 ${cases.length} 张带 meta 的 case`);

// ══ --with-sql:先把一份待上线的 migration 套上去,再审 ═══════════════════════
// 审的是 **SQL 文本本身**(连引号转义一起),不是生成它的那个内存对象 —— 迁移上线前
// 该验的就是这份文件。只认 `UPDATE alg_cases SET meta = '…'::jsonb WHERE … name = '…'`。
const sqlArg = process.argv[process.argv.indexOf('--with-sql') + 1];
if (process.argv.includes('--with-sql')) {
  const text = readFileSync(sqlArg, 'utf8');
  const re = /UPDATE alg_cases SET meta = '((?:[^']|'')*)'::jsonb WHERE puzzle = '([^']*)' AND set_slug = '([^']*)' AND name = '((?:[^']|'')*)';/g;
  const byName = new Map(cases.map((c) => [`${c.set}/${c.name}`, c]));
  let n = 0;
  for (const [, json, , setSlug, rawName] of text.matchAll(re)) {
    const name = rawName.replace(/''/g, "'");
    const c = byName.get(`${setSlug}/${name}`);
    if (!c) throw new Error(`SQL 里的 ${setSlug}/${name} 站上没有`);
    c.meta = JSON.parse(json.replace(/''/g, "'"));
    n++;
  }
  console.log(`套用 ${path.basename(sqlArg)}:${n} 条 UPDATE`);
  if (!n) throw new Error('一条都没解析出来 —— SQL 形状与预期不符,别当作「审过了」');
}

// ══ 每张 case 的状态身份 ══════════════════════════════════════════════════════
const byNo = new Map();
const byKey = new Map();
const dupKeys = [];
for (const c of cases) {
  const id = ident(c.setup);
  if (!id) throw new Error(`${c.set}/${c.name} 的 setup 不是 LL 态:${c.setup}`);
  c._id = id;
  byNo.set(c.meta.no, c);
  if (byKey.has(id.key)) dupKeys.push([byKey.get(id.key), c]);
  else byKey.set(id.key, c);
}

/** 这张 case 的态经过 `f`(作用在 setup 串上)之后,落到哪张 case。 */
const partnerBy = (c, f) => byKey.get(ident(f(c.setup))?.key) ?? null;

const trueInv = new Map();     // no → case
const trueMirror = new Map();
const trueIm = new Map();
for (const c of cases) {
  trueInv.set(c.meta.no, partnerBy(c, (s) => invert(s)));
  trueMirror.set(c.meta.no, partnerBy(c, (s) => mirrorMoveString(s, 'M')));
  trueIm.set(c.meta.no, partnerBy(c, (s) => mirrorMoveString(invert(s), 'M')));
}

// ══ 自证:判据本身站不站得住 ══════════════════════════════════════════════════
const selfCheck = {
  'key 互不相同': dupKeys.length === 0 ? `${byKey.size}/${cases.length}` : `❌ ${dupKeys.length} 组撞了`,
  'inv 是对合': `${cases.filter((c) => trueInv.get(trueInv.get(c.meta.no)?.meta.no)?.meta.no === c.meta.no).length}/${cases.length}`,
  'mirror 是对合': `${cases.filter((c) => trueMirror.get(trueMirror.get(c.meta.no)?.meta.no)?.meta.no === c.meta.no).length}/${cases.length}`,
  'im == inv∘mirror': `${cases.filter((c) => trueIm.get(c.meta.no)?.meta.no === trueMirror.get(trueInv.get(c.meta.no)?.meta.no)?.meta.no).length}/${cases.length}`,
  'im == mirror∘inv': `${cases.filter((c) => trueIm.get(c.meta.no)?.meta.no === trueInv.get(trueMirror.get(c.meta.no)?.meta.no)?.meta.no).length}/${cases.length}`,
};
console.log('\n判据自证(全部应当 = 总数):');
for (const [k, v] of Object.entries(selfCheck)) console.log(`  ${k.padEnd(20)} ${v}`);
if (dupKeys.length) {
  console.log('  撞 key 的:');
  for (const [a, b] of dupKeys.slice(0, 10)) console.log(`    ${a.set}/${a.name}(${a.meta.no}) == ${b.set}/${b.name}(${b.meta.no})`);
}

// ══ 三个指针列 ════════════════════════════════════════════════════════════════
const ref = (c) => (c ? `${c.name}(${c.meta.no})` : '—');
const bad = { inv: [], mirror: [], im: [] };
for (const c of cases) {
  for (const [col, truth] of [['inv', trueInv], ['mirror', trueMirror], ['im', trueIm]]) {
    const want = truth.get(c.meta.no);
    const got = c.meta[col] != null ? byNo.get(c.meta[col]) : null;
    if (want && got && want.meta.no === got.meta.no) continue;
    bad[col].push({
      set: c.set, name: c.name, no: c.meta.no, ollcp: c.meta.ollcp,
      表里填的: c.meta[col] ?? null, 表里填的是: ref(got),
      按状态应当是: want?.meta.no ?? null, 按状态应当是谁: ref(want),
    });
  }
}

// ══ 标签列:同一个计算类里标签必须唯一 ════════════════════════════════════════
/** @returns {{列: string, 类: string, 主流标签: string, 少数派: object[]}[]} */
function labelOutliers(field, classOf) {
  const groups = new Map();
  for (const c of cases) {
    const k = classOf(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const out = [];
  for (const [k, list] of groups) {
    const tally = new Map();
    for (const c of list) tally.set(c.meta[field] ?? '', (tally.get(c.meta[field] ?? '') ?? 0) + 1);
    if (tally.size <= 1) continue;
    const [top] = [...tally].sort((a, b) => b[1] - a[1]);
    out.push({
      列: field, 类: k.slice(0, 24), 主流标签: `${top[0]} ×${top[1]}`,
      少数派: list.filter((c) => (c.meta[field] ?? '') !== top[0])
        .map((c) => ({ set: c.set, name: c.name, no: c.meta.no, 标签: c.meta[field], 该是: top[0] })),
    });
  }
  return out;
}
// ⚠ CP **相对 OLL** 定义(见 ll_ident.mjs 的 cp 注释)—— 只按 cp 类分组会把 58 个 OLL 混在
//   一起,6 个巨桶里人人都是「少数派」。判据是 (朝向类, 角置换类) 这一对。
const cpOutliers = labelOutliers('cp', (c) => `${c._id.ori}|${c._id.cp}`);
const ollOutliers = labelOutliers('oll', (c) => c._id.ori);

// ══ 报告 ══════════════════════════════════════════════════════════════════════
console.log('\n指针列(按魔方状态判):');
for (const col of ['inv', 'mirror', 'im']) {
  console.log(`  ${col.padEnd(7)} 对不上 ${bad[col].length} / ${cases.length}`);
}
console.log(`  cp      标签与状态类不符 ${cpOutliers.reduce((n, g) => n + g.少数派.length, 0)}`);
console.log(`  oll     标签与状态类不符 ${ollOutliers.reduce((n, g) => n + g.少数派.length, 0)}`);

for (const col of ['inv', 'mirror', 'im']) {
  if (!bad[col].length) continue;
  console.log(`\n── ${col} 对不上的 ${bad[col].length} 条 ──`);
  for (const b of bad[col]) {
    console.log(`  ${b.set}/${b.name} (${b.ollcp ?? ''} no=${b.no})  表里→ ${b.表里填的是}   状态→ ${b.按状态应当是谁}`);
  }
}
for (const g of [...cpOutliers, ...ollOutliers]) {
  console.log(`\n── ${g.列} 类 ${g.类}… 主流 ${g.主流标签},少数派 ${g.少数派.length} ──`);
  for (const o of g.少数派) console.log(`  ${o.set}/${o.name} (no=${o.no}) 标着 ${o.标签},同类其余都是 ${o.该是}`);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({
  总数: cases.length, selfCheck, bad, cpOutliers, ollOutliers,
}, null, 2), 'utf8');
console.log(`\n→ ${path.relative(ROOT, path.join(OUT, 'report.json'))}`);

// 这里**故意不产修正 SQL**。报出来的残差有两种病因,修法相反:
//   · 指针填错了      → 改 `meta.inv` / `mirror` / `im`
//   · meta 整块挂错了 case → 改归属,指针一个字不动(2026-08-04 那次就是)
// 分辨方法:成对成对地互为对方的值 ⟹ 是归属错了。选错修法会把对的数据改坏,
// 所以判完再动手,别让脚本替你选。归属那种的范本:`fix_1lll_meta_assignment.mjs`。
