/**
 * Phase 2 的产出:给站长看的问题清单 → `docs/1lll-sheet-issues.md`。
 *
 * 依赖 phase2_validate.mjs 的 `.tmp/phase1/phase2_report.json` 和 `.tmp/phase1/repairs.json`。
 *
 *   node phase2_validate.mjs && node .tmp/_repair.mjs && node phase2_report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseAlgCell } from './sheet_notation.mjs';
import { identOfAlg, ident } from './ll_ident.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const rows = read('.tmp/phase0/sheet_1lll.json');
const mapping = read('.tmp/phase0/mapping.json');
const site = read('.tmp/phase0/site_cases.json');
const repairs = read('.tmp/phase1/repairs.json');
const rep = read('.tmp/phase1/phase2_report.json');

const bySelf = new Map(rows.map((r) => [r.Self, r]));
const setupOf = new Map(site.cases.map((c) => [`${c.set}/${c.name}`, c.setup]));
const trueKey = new Map();
for (const m of mapping.matched) {
  const s = setupOf.get(`${m.site[0].set}/${m.site[0].name}`);
  const id = s && ident(s);
  if (id) trueKey.set(m.self, id.key);
}
for (const n of mapping.newCases) {
  const id = ident(n.setup);
  if (id) trueKey.set(n.self, id.key);
}

/** 这一行还有几条**正确**的公式可以顶上? */
function goodAlgsIn(self) {
  const key = trueKey.get(self);
  const entries = parseAlgCell(bySelf.get(self)['Self alg']);
  return entries.filter((e) => !e.error && identOfAlg(e.moves)?.key === key).length;
}

const L = [];
const p = (s = '') => L.push(s);

p('# 1LLL 表 —— 待站长处理的问题清单');
p();
p('机器扫出来的,**每条都跑过 cubing.js**,不是猜的。判据 = §3 的 16 折轨道');
p('(`U^a · A · U^b` 解同一个 case,所以「备选公式写在别的 U 朝向下」**不算错**)。');
p();
p('> 生成:`core/packages/alg-build/phase2_validate.mjs`。');
p('> 背景和理论见 [`1lll-migration.md`](./1lll-migration.md),进度见 [`1lll-worklog.md`](./1lll-worklog.md)。');
p();
p(`扫了 **${rep.统计.total}** 条公式(3915 行的 \`Self alg\` 全部,含备选),**${rep.统计.ok}** 条正确。`);
p();
p('| | 数量 |');
p('|---|---|');
p(`| 公式不保 F2L(压根不是 LL 公式) | **${rep.broken.length}** |`);
p(`| 公式解的是**别的 case** | **${rep.misfiled.length}** |`);
p('| 括号不配对 | **2** |');
p('| 单元格开头多一个空格(把表自己的 `DELETE_AUF` 挡住了) | **1** |');
p(`| \`Speedcubedb no.\` 脏数据 | **${mapping.sdbBad.length}** |`);
p();
p('---');
p();

// ---- 1. 不保 F2L ----
p('## 1. 公式不保 F2L —— 压根不是 LL 公式');
p();
p('| Self | Name | 第几条 | 公式 | 本行还有几条对的 | 唯一单 token 修复 |');
p('|---|---|---|---|---|---|');
for (const b of rep.broken) {
  const r = repairs.find((x) => x.self === b.self && x.i === b.i);
  const fix = r?.单token修复;
  const fixTxt = fix && typeof fix === 'object' ? `第 ${fix.位置} 步 \`${fix.原}\` → \`${fix.改成}\`` : (fix || '—');
  p(`| ${b.self} | ${b.name} | alg[${b.i}]${b.首条 ? ' **首条**' : ''} | \`${b.alg}\` | ${goodAlgsIn(b.self)} | ${fixTxt} |`);
}
p();

// ---- 2. 解错 case ----
p('## 2. 公式解的是别的 case');
p();
p('⚠ **9 条是「正确地镜像了一条本身就错位的公式」** —— 镜像生成器没问题,喂给它的源行错了。');
p('`3419/O-U8` 和 `3347/O+U9` 互为**逐字正确**的镜像,却双双错位:错发生在**被镜像之前**。');
p();
p('| Self | Name | 第几条 | 本行应当是 | 这条其实解的是 | 公式 | 本行还有几条对的 |');
p('|---|---|---|---|---|---|---|');
for (const b of rep.misfiled) {
  p(`| ${b.self} | ${b.name} | alg[${b.i}]${b.首条 ? ' **首条**' : ''} | ${b.本行是} | **${b.其实解的是}** | \`${b.alg}\` | ${goodAlgsIn(b.self)} |`);
}
p();

// ---- 3. 括号 ----
p('## 3. 括号不配对');
p();
p('两行都**不带重复指数**,丢掉括号照常解析,不影响 case 身份 —— 但表该修。');
p();
p('| Self | Name | 毛病 | 公式 |');
p('|---|---|---|---|');
for (const w of rep.parseWarn) {
  p(`| ${w.self} | ${w.name} | ${w.提醒.split('——')[0].trim()} | \`${w.alg}\` |`);
}
p();

// ---- 4. 开头的空格 ----
p('## 4. `71 / TLA` —— 单元格开头多了一个空格');
p();
p('```');
p(`" ${String(bySelf.get(71)['Self alg']).split('\n')[0].trim()}"`);
p('  ↑ 这里');
p('```');
p();
p('表的 `DELETE_AUF` 是 `TRIM(REGEXREPLACE(alg, "^U2\'?|^U\'|^U", ""))` —— **正则跑在 `TRIM` 之前**,');
p('`^U\'` 被那个空格挡住没匹配上,起手 AUF 没被剥掉。所以这一行的 `SH` / `SQ` 是 **16 / 20**,');
p(`真值是 **15 / 19**。公式本身没问题,删掉那个空格即可。`);
p();

// ---- 5. Speedcubedb no. ----
p('## 5. `Speedcubedb no.` 脏数据');
p();
p('该列非空 **472** 行(= ZBLL 总数 472,与表的 `Stat` sheet 一致)。');
p('状态轨道 join **反而把这些纠正了** —— 报出来供你回填。');
p();
p('| Self | Name | 表里填的 | 实际(按状态定的) |');
p('|---|---|---|---|');
for (const s of mapping.sdbBad) {
  p(`| ${s.self ?? s.Self ?? '?'} | ${s.name ?? s.Name ?? '?'} | \`${s.sdb ?? s.填的 ?? '(空)'}\` | ${s.site ?? s.实际 ?? '?'} |`);
}
p();

// ---- 6. 不是问题 ----
p('## 6. 这些**不是**问题(免得来回改)');
p();
p('- **`R4` / `L4\'` / `R3`** —— 群元素是恒等 / 是 `R\'`,但它们是**真实的物理动作**,');
p('  对指法、手部动画、TPS 都算数。计步照写照算(`L4\'` = 1 STM / 4 SQTM)。**保留。**');
p('- **备选公式写在别的 U 朝向下** —— `U^a · A · U^b` 解同一个 case,16 折轨道天然吸收。');
p('- **42 对镜像只差一个起手 AUF** —— 前 AUF 在轨道内,同 case,合法。');
p('- **署名 `(by CubeRoot 251029)` / `(wyh)`** —— 导入时直接丢弃(你 2026-07-13 拍的板)。');
p();
p('---');
p();
p('## 元数据层:干净得出奇');
p();
p('`Mirror` / `Inv` / `IM` 三个编号列是**完美的群作用**:');
p();
p('| | |');
p('|---|---|');
p('| Mirror 是对合 | 3915 / 3915 |');
p('| Inv 是对合 | 3915 / 3915 |');
p('| `IM == Inv∘Mirror == Mirror∘Inv` | 3915 / 3915,零不一致 |');
p();
p('剔掉上面那些坏公式之后,INV / MIRROR / IM 三个关系的**残差为零**。');

fs.writeFileSync(path.join(ROOT, 'docs/1lll-sheet-issues.md'), L.join('\n') + '\n');
console.log('→ docs/1lll-sheet-issues.md');
