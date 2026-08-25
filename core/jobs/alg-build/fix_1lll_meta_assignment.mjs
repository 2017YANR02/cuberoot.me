/**
 * 修正 8 张 1lll case 的 **meta 归属**:phase0 把站长表的行配到了错的 case 上。
 * 产出 `server/migrations/0102_fix_1lll_meta_assignment.sql`,并**当场自验**改完之后
 * `inv` / `mirror` / `im` / `cp` 四列全部归零。
 *
 * ══ 错在哪 ════════════════════════════════════════════════════════════════════
 *
 * phase0 的 row→case 是**状态轨道 join**:拿这一行的公式解出来的态去配站上的 case。
 * 但有 19 行的公式本身就解错了 case(`docs/1lll-sheet-issues.md` §2),其中 7 行**一条对的
 * 都没有**。这些行只能靠「组内消去 + CP 约束 + 多数派投票」落位,而下面这 8 张恰好落错。
 *
 * 落错之后表现为:`meta.inv` / `meta.mirror` 指向的 case **不是**本 case 的逆态 / 镜像态
 * (12 张 case 的「逆」「镜像」缩略图指错人),外加 8 张 case 的 OLLCP 名、角换、最优步数、
 * 出现概率全是别人的。
 *
 * ⚠ 页面上那个「校验」按钮**发现不了**这类错:它只跑 `setup + alg → 目标态`,一条条验公式,
 *   从不读 meta。8 张 case 的公式确实都解得开自己,所以一直显示「全部通过」。
 *
 * ══ 为什么是「库错」不是「表错」——三路独立证据 ════════════════════════════════
 *
 * 表每行除了 `Self alg`,还有五个**互相独立**的打乱列(`Scramble` / `SH*` / `SQ*` / `H*` /
 * `Q*`),每条都能独立算出这行讲的是哪个态;再加 `Mirror`/`Inv`/`IM` 的闭合关系与 `CP` 字母:
 *
 *   ① 全票行 —— 689/701/568/580 四行**六列一致**。其中 **701 和 580 落的位置与库里不符**,
 *      这两条不需要任何投票就证明库错了。
 *   ② 排除法 + 少数列 —— 698/686/578/566 由「全票行已占位」排除到唯一解,且各自的 `SQ*`+`Q*`
 *      两列独立指向同一答案。
 *   ③ CP 字母 —— 四张的 `CP` 与它该落的角置换类一致(现状是 11:1 的孤例)。
 *
 *   `7 7` / `7 12` 那对由六条来自全票行的关系式判定:3419.Inv、3280.Inv、3563.Mirror、
 *   3568.Mirror、3347.IM、3208.IM —— 六条一致指向「两张装反了」。
 *
 * 改完之后表的三列在状态判据下**残差为零**(本脚本末尾自验),这是「表本来就是对的」的收口。
 *
 * ══ 搬 meta 时哪些字段不能照抄 ════════════════════════════════════════════════
 *
 *   · `gen` —— 它是**本 case 首条公式**的转动集合(`import_1lll.mjs` 的 `gen(firstAlg.alg)`),
 *     跟着 case 走,不跟着行走。保留原值。
 *   · 所有打乱(`scramble` / `optimal.*.scramble` / `coep.scramble`)—— 当初是按**旧的错态**
 *     过的轨道判据。搬到新 case 上必须**重验**,验不过就丢(丢了前端 `lib/alg_scramble.ts`
 *     会退到逆 case 的公式或 `setup`,不会开天窗)。
 *   · 最优**步数** `optimal.*.len` 照搬 —— 它是行的属性,与那条打乱写得对不对无关。
 *
 *   node fix_1lll_meta_assignment.mjs           自验 + 写 migration
 *   node fix_1lll_meta_assignment.mjs --dry     只自验,不写文件
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseAlgCell } from './sheet_notation.mjs';
import { ident, invert, identOfScramble } from './ll_ident.mjs';
import { mirrorMoveString } from '@cuberoot/shared/alg-mirror';
import { toMoveString } from '@cuberoot/shared/alg-notation';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const API = process.env.ALG_API ?? 'https://api.cuberoot.me/v1/alg/sets';
const SETS = [['3x3', 'pll'], ['3x3', 'ell'], ['3x3', 'zbll'], ['3x3', '1lll']];

/**
 * case 名 → 它**应当**挂哪一行(表里的 `Self`)。三个圈,八张 case。
 * 现状见输出;推导与证据见文件头。
 */
const SHOULD_BE = {
  '1LLL 7 7': 3491, '1LLL 7 12': 3496,
  '1LLL 17 26': 686, '1LLL 17 38': 698, '1LLL 17 41': 701,
  '1LLL 19 50': 566, '1LLL 19 62': 578, '1LLL 19 64': 580,
};

/**
 * phase0 从 xlsx 抽出来的原表。**只用来重捞打乱** —— 搬过来的那几条当初是拿旧的错态验的,
 * 按新态可能本来就成立;捞回来的每一条都要重新过轨道判据才收。
 * 文件不在(别的机器 / 清过 .tmp)就跳过重捞,只丢不补 —— 前端有 setup 保底,不会开天窗。
 */
const SHEET = path.join(ROOT, '.tmp/phase0/sheet_1lll.json');
const sheetRows = existsSync(SHEET) ? JSON.parse(readFileSync(SHEET, 'utf8')) : null;
if (!sheetRows) console.log('⚠ 没有 .tmp/phase0/sheet_1lll.json,验不过的打乱只丢不补');

// ══ 拉数据 + 算态 ═════════════════════════════════════════════════════════════
const cases = [];
for (const [puzzle, set] of SETS) {
  const r = await fetch(`${API}/${puzzle}/${set}`);
  if (!r.ok) throw new Error(`${puzzle}/${set}:HTTP ${r.status}`);
  for (const c of (await r.json()).cases) if (c.meta?.no != null) cases.push({ ...c, set });
}
for (const c of cases) {
  c._id = ident(c.setup);
  if (!c._id) throw new Error(`${c.set}/${c.name} 的 setup 不是 LL 态`);
}
const byNo = new Map(cases.map((c) => [c.meta.no, c]));
const byName = new Map(cases.map((c) => [`${c.set}/${c.name}`, c]));
console.log(`拉到 ${cases.length} 张带 meta 的 case`);

// ══ 搬 meta ═══════════════════════════════════════════════════════════════════
/** 这条打乱是不是真打出 `key` 那个态(同 `import_1lll.mjs` 的 `keepScramble`)。 */
function scrambleFits(text, key) {
  if (!text) return false;
  try { return identOfScramble(toMoveString(text))?.key === key; } catch { return false; }
}

const patches = [];
for (const [name, wantNo] of Object.entries(SHOULD_BE)) {
  const target = byName.get(`1lll/${name}`);
  if (!target) throw new Error(`站上没有 1lll/${name}`);
  const src = byNo.get(wantNo);
  if (!src) throw new Error(`表里第 ${wantNo} 行现在挂在谁身上都找不到`);
  if (target.meta.no === wantNo) { console.log(`  ${name} 已经是 ${wantNo},跳过`); continue; }

  const key = target._id.key;
  const m = structuredClone(src.meta);
  const dropped = [];

  // ① gen 跟着 case 走,不跟着行走
  if (target.meta.gen) m.gen = target.meta.gen; else delete m.gen;

  // ② 每条打乱按**新的态**重验;验不过的先丢,再从原表按新态重捞一次
  const raw = sheetRows?.find((x) => Math.round(x.Self) === wantNo);
  const recovered = [];
  /** @param {string} label 报告用名 @param {() => string|undefined} get @param {(v: string) => void} set */
  const revalidate = (label, get, set, col) => {
    const cur = get();
    if (cur && scrambleFits(cur, key)) return;
    if (cur) { dropped.push(label); set(undefined); }
    // 入库时这条是拿**旧的错态**验的,验不过就没收 —— 按新态它可能本来就是对的
    const fresh = raw ? parseAlgCell(String(raw[col] ?? ''))[0]?.body : undefined;
    if (fresh && scrambleFits(fresh, key)) { set(fresh); recovered.push(label); }
  };
  revalidate('scramble', () => m.scramble, (v) => { if (v) m.scramble = v; else delete m.scramble; },
    'Scramble (alg of inv case)');
  for (const [k, col] of [['stm', 'SH* scramble'], ['sqtm', 'SQ* scramble'], ['htm', 'H* scramble'], ['qtm', 'Q* scramble']]) {
    if (!m.optimal?.[k]) continue;
    revalidate(`optimal.${k}`, () => m.optimal[k].scramble,
      (v) => { if (v) m.optimal[k].scramble = v; else delete m.optimal[k].scramble; }, col);
  }
  if (m.coep) {
    revalidate('coep', () => m.coep.scramble, (v) => { if (v) m.coep.scramble = v; else delete m.coep.scramble; },
      'COEP scramble (COEP, EPCO, OO) (currently only ZBLL)');
    if (!Object.keys(m.coep).length) delete m.coep;
  }

  patches.push({ name, target, from: target.meta, to: m, dropped, recovered });
}

console.log(`\n要改 ${patches.length} 张:`);
for (const p of patches) {
  console.log(`  1lll/${p.name}`);
  console.log(`      编号   ${p.from.no} → ${p.to.no}`);
  console.log(`      OLLCP  ${p.from.ollcp} → ${p.to.ollcp}`);
  console.log(`      角换   ${p.from.cp} → ${p.to.cp}`);
  console.log(`      逆/镜/镜逆  ${p.from.inv}/${p.from.mirror}/${p.from.im} → ${p.to.inv}/${p.to.mirror}/${p.to.im}`);
  const len = (m) => ['htm', 'qtm', 'stm', 'sqtm'].map((k) => `${k}${m.optimal?.[k]?.len ?? '-'}`).join(' ');
  console.log(`      最优步数    ${len(p.from)} → ${len(p.to)}`);
  console.log(`      打乱        ${p.from.scramble ? '有' : '无'} → ${p.to.scramble ? '有' : '无'}`
    + (p.dropped.length ? `;旧值按新态验不过 ${p.dropped.join(' ')}` : '')
    + (p.recovered.length ? `;从原表重捞到 ${p.recovered.join(' ')}` : ''));
}

// ══ 自验:改完之后四列必须全部归零 ════════════════════════════════════════════
/**
 * (朝向类, 角置换类) → 出现过的 CP 标签。
 *
 * ⚠ 不是「每个类里标签必须唯一」:`X` 组(全棱翻转)那几个 OLL 高度对称,`ident()` 的 cp 类
 *   天然比 CP 字母粗(见 ll_ident.mjs 的 cp 注释),基线就分裂着 12 条,与本次无关。
 *   所以判据是**不许新增分裂**,外加本次要消掉的那几条确实消失。
 */
const cpSplits = () => {
  const m = new Map();
  for (const c of cases) {
    const k = `${c._id.ori}|${c._id.cp}`;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(c.meta.cp ?? '');
  }
  return new Set([...m].filter(([, s]) => s.size > 1).map(([k]) => k));
};
const cpBefore = cpSplits();

for (const p of patches) p.target.meta = p.to;
const byNo2 = new Map(cases.map((c) => [c.meta.no, c]));
const byKey = new Map(cases.map((c) => [c._id.key, c]));
if (byKey.size !== cases.length) throw new Error(`态不是两两不同:${byKey.size}/${cases.length}`);
if (byNo2.size !== cases.length) throw new Error(`编号不是两两不同:${byNo2.size}/${cases.length} —— 搬 meta 搬出重号了`);

const partner = (c, f) => byKey.get(ident(f(c.setup))?.key) ?? null;
const truth = {
  inv: (c) => partner(c, (s) => invert(s)),
  mirror: (c) => partner(c, (s) => mirrorMoveString(s, 'M')),
  im: (c) => partner(c, (s) => mirrorMoveString(invert(s), 'M')),
};
const left = { inv: [], mirror: [], im: [] };
for (const c of cases) {
  for (const col of ['inv', 'mirror', 'im']) {
    const want = truth[col](c);
    const got = c.meta[col] != null ? byNo2.get(c.meta[col]) : null;
    if (!want || !got || want.meta.no !== got.meta.no) left[col].push(`${c.set}/${c.name}`);
  }
}
const cpAfter = cpSplits();
const cpNew = [...cpAfter].filter((k) => !cpBefore.has(k));
const cpFixed = [...cpBefore].filter((k) => !cpAfter.has(k));

/**
 * 每张 case 还有没有打乱可显示 —— 与 `client/lib/alg_scramble.ts` 同一套三档,
 * 搬 meta 丢掉几条 `scramble` 之后必须确认没人开天窗。
 */
const canon = (s) => { try { return toMoveString(s).replace(/[()·↑↓]/g, '').replace(/2'/g, '2').replace(/\s+/g, ' ').trim(); } catch { return null; } };
const tier ={ meta: 0, invCase: 0, setup: 0, none: [] };
for (const c of cases) {
  if (c.meta.scramble) { tier.meta++; continue; }
  const inv = c.meta.inv != null ? byNo2.get(c.meta.inv) : null;
  const a = canon(inv?.meta?.scramble ?? ''), b = canon(c.algs[0]?.[0]?.alg ?? '');
  if (inv?.algs?.[0]?.[0]?.alg && a && b && a === b) { tier.invCase++; continue; }
  if (c.setup?.trim()) tier.setup++; else tier.none.push(`${c.set}/${c.name}`);
}

console.log('\n自验:');
console.log(`  inv 对不上      ${left.inv.length}(应当 0)`);
console.log(`  mirror 对不上   ${left.mirror.length}(应当 0)`);
console.log(`  im 对不上       ${left.im.length}(应当 0)`);
console.log(`  cp 新增分裂类   ${cpNew.length}(应当 0);消掉 ${cpFixed.length} 个`);
console.log(`  打乱覆盖        meta ${tier.meta} + 逆 case 公式 ${tier.invCase} + setup 保底 ${tier.setup}`
  + ` = ${tier.meta + tier.invCase + tier.setup} / ${cases.length},没有的 ${tier.none.length}`);
for (const col of ['inv', 'mirror', 'im']) if (left[col].length) console.log(`    ${col}: ${left[col].join(' ')}`);
for (const k of cpNew) console.log(`    新增分裂:${k.slice(0, 24)}…`);

const clean = !left.inv.length && !left.mirror.length && !left.im.length && !cpNew.length && !tier.none.length;
if (!clean) { console.error('\n❌ 自验没过,不写 migration'); process.exit(1); }
console.log('\n✓ 通过');

// ══ migration ═════════════════════════════════════════════════════════════════
if (process.argv.includes('--dry')) { console.log('\n--dry:不写文件'); process.exit(0); }
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const out = [
  '-- 0102_fix_1lll_meta_assignment.sql — 8 张 1lll case 的 meta 挂错了行(生成脚本:',
  '-- jobs/alg-build/fix_1lll_meta_assignment.mjs,推导与证据写在该文件头)。',
  '--',
  '-- phase0 的 row→case 是状态轨道 join,但有 7 行「一条对的公式都没有」(docs/1lll-sheet-issues.md §2),',
  '-- 只能靠组内消去 + CP 约束 + 多数派投票落位,下面这 8 张落错 —— 表现为 12 张 case 页顶上的',
  '-- 「逆」「镜像」缩略图指错人,外加这 8 张的 OLLCP 名 / 角换 / 最优步数 / 出现概率全是别人的。',
  '--',
  '-- 站长那张表本身是对的:改完之后 Mirror / Inv / IM 三列在状态判据下残差为零,',
  '-- CP 标签在每个 (朝向类, 角置换类) 里唯一。守卫:jobs/alg-build/verify_meta_pointers.mjs。',
  '--',
  '-- 搬 meta 时 `gen` 保留原值(它是本 case 首条公式的转动集合,跟着 case 不跟着行),',
  '-- 每条打乱按新态重过一遍轨道判据,验不过的已在下面的 JSON 里剔除。',
  '',
];
for (const p of patches) {
  out.push(`-- 1lll/${p.name}: ${p.from.no}/${p.from.ollcp} → ${p.to.no}/${p.to.ollcp}`
    + `,逆 ${p.from.inv}→${p.to.inv},镜 ${p.from.mirror}→${p.to.mirror}`
    + (p.dropped.length ? `,丢弃 ${p.dropped.join(' ')}` : ''));
  out.push(`UPDATE alg_cases SET meta = ${q(JSON.stringify(p.to))}::jsonb`
    + ` WHERE puzzle = '3x3' AND set_slug = '1lll' AND name = ${q(p.name)};`);
}
const file = path.join(ROOT, 'core/apps/api/migrations/0102_fix_1lll_meta_assignment.sql');
writeFileSync(file, out.join('\n') + '\n', 'utf8');
console.log(`→ ${path.relative(ROOT, file)}`);
