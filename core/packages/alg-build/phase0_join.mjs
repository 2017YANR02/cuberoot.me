/**
 * Phase 0 —— **状态轨道 join**:把站长那张表的 3915 行,和站上 3893 个 LL case 对上。
 * 产出 `.tmp/phase0/mapping.json` + 冲突报告。见 docs/1lll-migration.md §8。
 *
 * case 身份 / 朝向类 / 角置换类的定义与证明:见 ll_ident.mjs。
 *
 * ══ GROUND TRUTH(站长给定,不许偏离)══════════════════════════════════════════
 *   1LLL 3915 = PLL 21 + ZBLL 472 + ELL 25 + 1LLL(不含 ZBLL/EPLL) 3397
 *
 * ══ 四条判据(全部封闭,不靠"看起来像")══════════════════════════════════════
 *   ① 状态轨道       表的公式解的 case ↔ 站的 setup 的 case,16 折 key 相等
 *   ② 朝向类 = OLL   算出的 ori 必须与表里声明的 `OLL` 列一致(同 OLL 才可能是同 case)
 *   ③ 组号           站上 1lll 的组号**就是** OLL 号(OLL sheet 给的字母→号映射)
 *   ④ 角置换类 = CP  算出的 cp 必须与表里声明的 `CP` 列(去掉 OLL 前缀的方向字母)一致
 *
 * ══ 预言 ═════════════════════════════════════════════════════════════════════
 *   站上 3893 个 case → 3891 个态(1LLL 4 63==4 64、5 21==5 22 是既有重复)
 *   ⟹ 表侧对不上 = 3915 − 3891 = **24** = 22(整个 OLL 20 / 字母 X 组)+ 2(被那两对重复挤掉的)
 *   ⟹ 站侧对不上 = **0**(有孤儿 = 表里有公式解错了 case)
 *
 *   node phase0_join.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseAlgCell } from './sheet_notation.mjs';
import { ident, identOfAlg, identOfScramble, invert } from './ll_ident.mjs';

const TMP = '../../../.tmp/phase0';
const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';

/** OLL 字母 → 标准 OLL 号,来自 xlsx 的 `OLL` sheet(A 列字母、B 列 No.)。不是我编的。 */
const OLL_NUM = JSON.parse(readFileSync(`${TMP}/oll_letter_to_number.json`, 'utf-8'));

// ══ 站上 ══════════════════════════════════════════════════════════════════════
const site = [];
for (const s of ['pll', 'zbll', '1lll']) {
  const { cases } = await (await fetch(`${API}/${s}`)).json();
  for (const c of cases) {
    const I = ident(c.setup);
    if (!I) { console.log(`  ⚠ ${s}/${c.name} 的 setup 不是 LL 态`); continue; }
    // 组:pll → 'PLL';zbll → 名字里的组字母;1lll → 名字里的组号(= OLL 号)
    const g = s === 'pll' ? 'PLL'
      : s === 'zbll' ? /^ZBLL (\S+) /.exec(c.name)?.[1]
        : Number(/^1LLL (\d+) /.exec(c.name)?.[1]);
    site.push({ set: s, id: c.id, name: c.name, setup: c.setup, group: g, ...I });
  }
}
const siteByKey = new Map();
for (const c of site) { if (!siteByKey.has(c.key)) siteByKey.set(c.key, []); siteByKey.get(c.key).push(c); }
const siteDups = [...siteByKey.values()].filter(v => v.length > 1);
console.log(`站上:${site.length} 个 case → ${siteByKey.size} 个不同的 LL 态`);
for (const g of siteDups) console.log(`  ★ 站上重复(同一个态):${g.map(c => `${c.set}/${c.name}`).join('  ==  ')}`);

// ══ 表 ════════════════════════════════════════════════════════════════════════
const rows = JSON.parse(readFileSync(`${TMP}/sheet_1lll.json`, 'utf-8'));
const parseErrors = [], parseWarns = [];
const sheet = [];
for (const r of rows) {
  const self = Math.round(r['Self']);
  const entries = parseAlgCell(r['Self alg']);
  for (const e of entries) {
    if (e.error) parseErrors.push({ self, name: r['Name'], raw: e.raw, error: e.error });
    if (e.warn) parseWarns.push({ self, name: r['Name'], raw: e.raw, warn: e.warn });
  }
  const algs = entries.filter(e => e.moves).map(e => ({ raw: e.raw, tags: e.tags, equiv: e.equiv, ...(identOfAlg(e.moves) ?? {}) }));
  const scrE = parseAlgCell(r['Scramble (alg of inv case)']).find(e => e.moves);
  const scr = scrE ? { raw: scrE.raw, ...(identOfScramble(scrE.moves) ?? {}) } : null;

  const oll = String(r['OLL']);
  const cpv = String(r['CP'] ?? '');
  sheet.push({
    self, name: r['Name'], subset: String(r['Subset']), oll,
    dir: cpv.startsWith(oll) ? cpv.slice(oll.length) : cpv,   // CP 列 = OLL 前缀 + 方向字母
    sdb: r['Speedcubedb no.'] ?? null,
    algs, scr,
    key: algs[0]?.key ?? null, ori: algs[0]?.ori ?? null, cp: algs[0]?.cp ?? null,
  });
}
console.log(`\n表:${rows.length} 行;公式 parse 失败 ${parseErrors.length},括号 typo 宽容修复 ${parseWarns.length}`);
for (const e of [...parseErrors, ...parseWarns]) console.log(`  ${String(e.self).padStart(4)} ${String(e.name).padEnd(8)} ${e.error ?? e.warn}\n       ‹${e.raw}›`);

// ══ 学映射:OLL 字母 → 站上的组(多数派;并与 OLL sheet 的号交叉验证)═══════════
const groupVote = new Map();   // OLL 字母 → Map(站上组 → 计数)
for (const s of sheet) {
  const hit = siteByKey.get(s.key);
  if (!hit) continue;
  if (!groupVote.has(s.oll)) groupVote.set(s.oll, new Map());
  const m = groupVote.get(s.oll);
  for (const c of hit) m.set(c.group, (m.get(c.group) ?? 0) + 1);
}
const OLL2GROUP = new Map();
for (const [oll, m] of groupVote) OLL2GROUP.set(oll, [...m].sort((a, b) => b[1] - a[1])[0][0]);
// 判据 ③:1lll 的组号必须 == OLL sheet 给的 OLL 号
const numBad = [];
for (const [oll, g] of OLL2GROUP) {
  if (typeof g !== 'number') continue;
  if (g !== OLL_NUM[oll]) numBad.push({ oll, 站上组: g, 'OLL sheet 的号': OLL_NUM[oll] });
}
console.log(`\n判据 ③ —— 站上 1lll 的组号 == OLL 字母对应的号:`
  + `${numBad.length === 0 ? `全部一致 ✓(${[...OLL2GROUP].filter(([, g]) => typeof g === 'number').length} 个组)` : `✗ ${numBad.length} 个不符`}`);
if (numBad.length) console.table(numBad);
console.log(`  OCLL(ZBLL 地盘)的字母 → 站上组:`
  + [...OLL2GROUP].filter(([, g]) => typeof g === 'string' && g !== 'PLL').map(([o, g]) => `${o}→${g}`).join('  '));

const siteByGroup = new Map();
for (const c of site) { if (!siteByGroup.has(c.group)) siteByGroup.set(c.group, []); siteByGroup.get(c.group).push(c); }

// ══ 学映射:(OLL 字母, CP 方向) → 角置换类 ═══════════════════════════════════
// 只用"公式落在本组且独占"的可信行来学。
const trusted = sheet.filter(s => {
  const hit = siteByKey.get(s.key);
  return hit && hit.every(c => c.group === OLL2GROUP.get(s.oll)) && sheet.filter(x => x.key === s.key).length === 1;
});
const cpVote = new Map();   // `${oll}|${dir}` → Map(cp → 计数)
for (const s of trusted) {
  const k = `${s.oll}|${s.dir}`;
  if (!cpVote.has(k)) cpVote.set(k, new Map());
  const m = cpVote.get(k);
  m.set(s.cp, (m.get(s.cp) ?? 0) + 1);
}
const CP_OF = new Map();
let cpAmbig = 0;
for (const [k, m] of cpVote) { CP_OF.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0]); if (m.size > 1) cpAmbig++; }
console.log(`\n判据 ④ —— (OLL, CP 方向) → 角置换类:学到 ${CP_OF.size} 组`
  + `,${cpAmbig === 0 ? '每组内部完全一致 ✓' : `${cpAmbig} 组内部不一致 ⚠`}`);

// ══ 逐组做二部匹配 ════════════════════════════════════════════════════════════
const assign = new Map();      // self → site case
const newCases = [];           // 站上没有的
const problems = [];           // 需要人定夺的
const badAlgs = [];            // 公式解错了 case 的行

for (const [oll, rowsG] of groupBy(sheet, s => s.oll)) {
  const g = OLL2GROUP.get(oll);
  const cases = (g === undefined ? [] : siteByGroup.get(g) ?? []);
  // 站上没有这个组(= OLL 20 / 字母 X)⟹ 整组都是新 case
  if (!cases.length) { newCases.push(...rowsG); continue; }

  const avail = new Map();     // key → [case…](站上重复的两个 case 共用一个 key)
  for (const c of cases) { if (!avail.has(c.key)) avail.set(c.key, []); avail.get(c.key).push(c); }

  const pending = [...rowsG];
  // 每行的候选 = 自己的公式(含备选)+ Scramble 列,∩ 本组还没被占的 key
  const candsOf = (s) => [...new Set([...s.algs.map(a => a.key), s.scr?.key].filter(Boolean))].filter(k => avail.has(k));

  // 迭代消去:候选唯一 → 定;某个 key 只有一行想要 → 定
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const s of [...pending]) {
      const cs = candsOf(s);
      if (cs.length !== 1) continue;
      take(s, cs[0]); moved = true;
    }
    // key 侧唯一
    const want = new Map();
    for (const s of pending) for (const k of candsOf(s)) { if (!want.has(k)) want.set(k, []); want.get(k).push(s); }
    for (const [k, ss] of want) {
      if (ss.length === 1 && pending.includes(ss[0])) { take(ss[0], k); moved = true; }
    }
    if (!moved) break;
  }
  // 剩下的用 CP 约束 + 强制消去
  for (let pass = 0; pass < 8 && pending.length; pass++) {
    let moved = false;
    for (const s of [...pending]) {
      const want = CP_OF.get(`${s.oll}|${s.dir}`);
      const fits = [...avail.keys()].filter(k => avail.get(k)[0].cp === want);
      if (fits.length === 1) { take(s, fits[0]); moved = true; }
    }
    if (!moved) break;
  }
  // 还剩一小撮 ⟹ 按「行内公式多数派 + Scramble 列」投票,穷举最优匹配。
  // (PLL-U+ 就靠这条:它 alg[0] 解 Ua,但另外 9 条公式 + Scramble 全指向 Ub —— 9:1,alg[0] 是坏的。)
  if (pending.length && pending.length === avail.size && pending.length <= 6) {
    const keys = [...avail.keys()];
    const score = (s, k) => s.algs.filter(a => a.key === k).length + (s.scr?.key === k ? 1 : 0);
    let best = null, bestScore = -1;
    for (const perm of permutations(keys)) {
      const t = pending.reduce((a, s, i) => a + score(s, perm[i]), 0);
      if (t > bestScore) { bestScore = t; best = perm; }
    }
    // 平票 = 定不了,别猜
    const tie = [...permutations(keys)].filter(p => pending.reduce((a, s, i) => a + score(s, p[i]), 0) === bestScore).length > 1;
    if (!tie && bestScore > 0) {
      const order = [...pending];
      order.forEach((s, i) => take(s, best[i]));
    }
  }
  if (pending.length === 1 && avail.size === 1) take(pending[0], [...avail.keys()][0]);

  // 组内剩余:站上少的 → 新 case;定不了的 → 报给人
  if (pending.length) {
    if (avail.size === 0) { newCases.push(...pending); }
    else {
      problems.push({
        oll, 组: String(g),
        定不了的行: pending.map(s => `${s.self}/${s.name}(CP=${s.dir})`),
        '剩下的站上 case': [...avail.values()].flat().map(c => c.name),
      });
    }
  }

  function take(s, k) {
    const cs = avail.get(k);
    assign.set(s.self, cs);
    avail.delete(k);
    pending.splice(pending.indexOf(s), 1);
    // alg[0] 没解出本行的真 case ⟹ 它是条坏公式。分两类,别混为一谈。
    if (s.key !== k) {
      const solves = s.key ? (siteByKey.get(s.key) ?? []).map(c => `${c.set}/${c.name}`).join() : null;
      badAlgs.push({
        self: s.self, name: s.name, oll: s.oll, subset: s.subset,
        真case: cs.map(c => `${c.set}/${c.name}`).join(),
        毛病: s.key === null ? '★ 公式不保 F2L(压根不是 LL 公式)'
          : solves ? `解的是别的 case:${solves}`
            : '解的是一个站上没有的 LL 态',
        坏公式: s.algs[0]?.raw,
        其余公式一致: s.algs.length > 1 ? `${s.algs.filter(a => a.key === k).length}/${s.algs.length - 1} 条指向真 case` : '(只有这一条)',
      });
    }
  }
}

function groupBy(arr, f) {
  const m = new Map();
  for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function* permutations(a) {
  if (a.length <= 1) { yield [...a]; return; }
  for (let i = 0; i < a.length; i++) {
    const rest = [...a.slice(0, i), ...a.slice(i + 1)];
    for (const p of permutations(rest)) yield [a[i], ...p];
  }
}

// ══ 结果 ══════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(78));
console.log(`JOIN:表 ${sheet.length} 行 ↔ 站 ${site.length} 个 case`);
console.log(`  对上:${assign.size} 行`);
console.log(`  站上没有(新 case):${newCases.length} 行   ← 预言 24`);
console.log(`  定不了、要人定夺:${problems.length} 组`);
const claimed = new Set([...assign.values()].flat().map(c => c.id));
console.log(`  站上被认领的 case:${claimed.size} / ${site.length}   ← 应当全部认领`);
for (const c of site) if (!claimed.has(c.id)) console.log(`    ✗ 无人认领:${c.set}/${c.name} (id=${c.id})`);

const byOll = {};
for (const s of newCases) byOll[s.oll] = (byOll[s.oll] ?? 0) + 1;
console.log(`\n★ 站上缺的 ${newCases.length} 个 case,按 OLL 分:`, JSON.stringify(byOll));
console.log(`   其中 Subset:`, JSON.stringify(Object.fromEntries([...groupBy(newCases, s => s.subset)].map(([k, v]) => [k, v.length]))));

console.log(`\n★ 表侧坏公式(首条公式解的 case ≠ 本行的真 case):${badAlgs.length} 行`);
console.table(badAlgs.map(b => ({ Self: b.self, Name: b.name, OLL: b.oll, 真case: b.真case, 毛病: b.毛病 })));
// ── 给站长的可动手修复建议 ────────────────────────────────────────────────────
// 纪律同 fix_bad_ll_cases.mjs:只报**唯一**的单 token 修复,不唯一就说不唯一,绝不挑一个。
const FAMILIES = ['U', 'D', 'L', 'R', 'F', 'B', 'u', 'd', 'l', 'r', 'f', 'b', 'M', 'E', 'S', 'x', 'y', 'z'];
function* oneTokenEdits(moves) {
  const toks = moves.trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const m = /^([A-Za-z])(\d*)('?)$/.exec(toks[i]);
    if (m && FAMILIES.includes(m[1])) {
      for (const suf of ['', '2', "'"]) {
        const v = `${m[1]}${suf}`;
        if (v === toks[i]) continue;
        const t = [...toks]; t[i] = v;
        yield { how: `第 ${i + 1} 步 ${toks[i]} → ${v}`, moves: t.join(' ') };
      }
    }
    yield { how: `删掉第 ${i + 1} 步 ${toks[i]}`, moves: toks.filter((_, j) => j !== i).join(' ') };
  }
}
console.log('\n  逐条:坏公式原文 + 修复建议');
for (const b of badAlgs) {
  const s = sheet.find(x => x.self === b.self);
  const trueKey = (assign.get(b.self) ?? [])[0]?.key;
  const parsed = parseAlgCell(b.坏公式)[0];
  const fixes = parsed?.moves
    ? [...oneTokenEdits(parsed.moves)].filter(e => identOfAlg(e.moves)?.key === trueKey)
    : [];
  const alt = s.algs.slice(1).filter(a => a.key === trueKey).length;
  // 这条坏公式解的那个 case,真正的主人是哪一行?—— 一句话讲完故事
  const owner = s.key ? [...assign].find(([, cs]) => cs.some(c => c.key === s.key)) : null;
  const ownerRow = owner ? sheet.find(x => x.self === owner[0]) : null;
  console.log(`    ${String(b.self).padStart(4)} ${String(b.name).padEnd(8)} ${b.坏公式}`);
  console.log(`         ${b.毛病}`
    + (ownerRow && ownerRow.self !== b.self ? `  ←  那个 case 的主人是 ${ownerRow.self}/${ownerRow.name}` : ''));
  console.log(`         修复:${fixes.length === 1 ? `✓ 唯一单 token 修复 —— ${fixes[0].how}  →  ${fixes[0].moves}`
    : fixes.length === 0 ? '✗ 没有单 token 修复(整条填错行,要重写)'
      : `✗ 单 token 修复不唯一(${fixes.length} 个),不猜`}`
    + (alt ? `;本行另有 ${alt} 条公式解的是真 case(可直接提前)` : ''));
  b.修复 = fixes.length === 1 ? fixes[0] : null;
  b.本行其余可用公式 = alt;
  b.公式其实属于 = ownerRow && ownerRow.self !== b.self ? `${ownerRow.self}/${ownerRow.name}` : null;
}

if (problems.length) { console.log('\n✗ 定不了(交给站长):'); console.log(JSON.stringify(problems, null, 2)); }

// ══ 判据 ② 全量:朝向类 vs 声明的 OLL ═════════════════════════════════════════
const oriVote = groupBy(sheet.filter(s => s.ori), s => s.oll);
let oriBad = 0;
for (const [oll, rs] of oriVote) {
  const m = new Map();
  for (const s of rs) m.set(s.ori, (m.get(s.ori) ?? 0) + 1);
  const top = [...m].sort((a, b) => b[1] - a[1])[0][0];
  oriBad += rs.filter(s => s.ori !== top).length;
}
console.log(`\n判据 ② —— 朝向类 vs 声明的 OLL:${oriBad} 行的公式朝向与本组多数派不符`
  + `(应当 == 坏公式行数 ${badAlgs.length} 里跨 OLL 的那些)`);

// ══ 判据 sdb:472 行 ZBLL,表里 "U03" ↔ 站上 "ZBLL U 3" ══════════════════════
let sdbOk = 0; const sdbBad = [];
for (const s of sheet) {
  if (!s.sdb) continue;
  const m = /^([A-Za-z+-]+?)0*(\d+)$/.exec(String(s.sdb));
  const cs = assign.get(s.self) ?? [];
  const want = m ? `ZBLL ${OLL2GROUP.get(s.oll)} ${Number(m[2])}` : null;
  if (want && cs.some(c => c.name === want)) sdbOk++;
  else sdbBad.push({ self: s.self, name: s.name, sdb: s.sdb, 期望: want ?? '(sdb 值残缺)', 实际: cs.map(c => c.name).join() });
}
console.log(`\n判据 sdb —— Speedcubedb no. 对账:${sdbOk} / ${sheet.filter(s => s.sdb).length} 一致`
  + (sdbBad.length ? ` ✗ ${sdbBad.length} 条不符(表侧该列本就有脏数据)` : ' ✓'));
if (sdbBad.length) console.table(sdbBad.slice(0, 20));

// ══ 落盘 ══════════════════════════════════════════════════════════════════════
writeFileSync(`${TMP}/mapping.json`, JSON.stringify({
  groundTruth: { '1LLL': 3915, PLL: 21, ZBLL: 472, ELL: 25, '1LLL_excl': 3397 },
  stats: { sheetRows: sheet.length, siteCases: site.length, matched: assign.size, newCases: newCases.length, badAlgs: badAlgs.length, unresolved: problems.length },
  matched: [...assign].map(([self, cs]) => {
    const s = sheet.find(x => x.self === self);
    return { self, name: s.name, subset: s.subset, oll: s.oll, cp: s.dir, sdb: s.sdb, site: cs.map(c => ({ set: c.set, id: c.id, name: c.name })) };
  }),
  newCases: newCases.map(s => ({ self: s.self, name: s.name, subset: s.subset, oll: s.oll, cp: s.dir, alg: s.algs[0]?.raw, setup: s.algs[0] ? invert(parseAlgCell(s.algs[0].raw)[0].moves) : null })),
  badAlgs, unresolved: problems, siteDups: siteDups.map(g => g.map(c => `${c.set}/${c.name}`)),
  parseErrors, parseWarns, sdbBad,
}, null, 2), 'utf-8');
console.log(`\nmapping → .tmp/phase0/mapping.json`);
