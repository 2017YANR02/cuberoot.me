/**
 * 把 9 个顶层集合的公式收成**规范形**。两件事,一趟做完:
 *
 *  1. **起手转体 y → U**,body 一个字节不改:   `y^k · A`  →  `U^k · A · U^-k`
 *  2. **收尾 AUF 补齐**:让 `setup + alg` 精确还原(库里那批"差一个 U"的公式)
 *
 * 规范形: `U^lead + body + U^trail`
 *   - lead  = 起手 y 的 k(与 body 自己的起手 U 合并)
 *   - trail = **优先**取"能让 setup + alg 精确还原"的那个;取不到就退回"状态保持"的那个
 *   - body  = 中段,一个字节不改
 *
 * trail 这条两段式规则不需要"本集合算不算还原"的知识,一条通吃九个集合:
 *   - pll/zbll/1lll/ell/anti-pll(真·整还原):总能取到"精确还原"的 trail ⟹ 顺手补上缺的 AUF
 *   - oll/coll/cmll/ollcp(只完成本阶段):替代公式压根不整还原,自动退回"状态保持" ⟹ 原样等价
 *
 * 收尾 AUF **存进库**(站长拍板):前端 displayAlg() 显示时才剥掉,所以魔友看到的一个字不变。
 *
 * ⚠ 两道过滤缺一不可 —— 详见 docs/1lll-migration.md §4.3':
 *   1. **显式的 9 个 LL 集合名单**。`sticker.kind === 'face'` 不能用:vls/wv/sv 也是 face,
 *      但它们是最后一槽集合。非 LL 集合的 474 条起手 y 公式,改写成功率 0/474。
 *   2. **逐条实证**。对不上就原样保留,并给出真诊断。
 *
 *   node canonicalize_ll_algs.mjs          # 只出报告
 *   node canonicalize_ll_algs.mjs --sql    # 额外产出 .tmp/canonicalize_ll_algs.sql
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
/** 只有这 9 个。别改成按 sticker.kind 筛。 */
const LL_SETS = ['oll', 'pll', 'coll', 'cmll', 'anti-pll', 'ollcp', 'zbll', '1lll', 'ell'];
/** 这 5 个的目标态是整体还原;另外 4 个只完成本阶段,替代公式本就不整还原。 */
const FULL_SOLVE_SETS = new Set(['pll', 'zbll', '1lll', 'ell', 'anti-pll']);

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const ROTATIONS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) {
  for (const b of ['', 'y', 'y2', "y'"]) ROTATIONS.push(`${a} ${b}`.trim());
}
const Y_OF = { 1: 'y', 2: 'y2', 3: "y'" };

const stateOf = (alg) => SOLVED.applyAlg(new Alg(alg));
/** a 与 b 只差一个整体旋转?返回见证旋转(或 null) */
function rotationBetween(a, b) {
  for (const r of ROTATIONS) if ((r ? a.applyAlg(r) : a).isIdentical(b)) return r || 'identity';
  return null;
}
const isSolved = (p) => rotationBetween(p, SOLVED) !== null;

/** 底下两层 + 中心块都归位?(判"这是不是一条真 LL 公式") */
function f2lHome(p) {
  const d = p.patternData;
  for (let i = 4; i < 8; i++) if (d.CORNERS.pieces[i] !== i || d.CORNERS.orientation[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (d.EDGES.pieces[i] !== i || d.EDGES.orientation[i] !== 0) return false;
  for (let i = 0; i < 6; i++) if (d.CENTERS.pieces[i] !== i) return false;
  return true;
}
/** 公式净元素扣掉整体旋转后只剩顶层置换?返回那个净旋转(或 null = 压根不是 LL 公式) */
function netRotationOf(alg) {
  let p;
  try { p = stateOf(alg); } catch { return null; }
  for (const r of ROTATIONS) if (f2lHome(r ? p.applyAlg(r) : p)) return r || 'none';
  return null;
}

/** 跳过一条公式时,说清楚**到底**为什么 —— 别发一句罐头原因。 */
function diagnose(setup, alg) {
  const net = netRotationOf(alg);
  if (net === null) {
    const setupIsLL = netRotationOf(new Alg(setup).invert().toString()) !== null;
    let solves = false;
    try { solves = isSolved(stateOf(`${setup} ${alg}`)); } catch { /* 解析失败 */ }
    return solves
      ? `★ 数据 bug:公式不保 F2L${setupIsLL ? '' : ',且 setup 自己也不保 F2L(坏公式反推出的坏 setup,互相自洽把错误藏住了)'}`
      : '★ 数据 bug:公式不保 F2L,而且 setup + alg 根本不还原';
  }
  if (/[xz]/.test(net)) return `合法 LL 公式,但净旋转 ${net} 带 x/z 轴 ——「顶层」不再是 U 面,U 转补不回来。保留原样`;
  return `见证旋转对不上理论预言(净旋转 ${net})`;
}

// ── 记号:`y` `y2` `y'` `y3` `U2'` … 通用 <family><amount><prime>
const LEADING_Y = /^\s*y(\d*)('?)(?=\s|$)/;
const LEADING_U = /^U(\d*)('?)(?=\s|$)/;
const TRAILING_U = /(?:^|\s)U(\d*)('?)$/;

const amountOf = (digits, prime) => (((digits ? Number(digits) : 1) * (prime ? -1 : 1)) % 4 + 4) % 4;
/** 0 → ''(不写),1 → 'U',2 → 'U2',3 → "U'" */
const fmtU = (n) => ['', 'U', 'U2', "U'"][((n % 4) + 4) % 4];

/** 拆成 { k, lead, body, trail } —— body 是中段,一个字节不改 */
function split(alg) {
  const m = LEADING_Y.exec(alg);
  const k = m ? amountOf(m[1], m[2]) : 0;
  let body = m ? alg.slice(m[0].length).trim() : alg.trim();

  let lead = k;
  const lm = LEADING_U.exec(body);
  if (lm) { lead += amountOf(lm[1], lm[2]); body = body.slice(lm[0].length).trim(); }

  let trail = 0;
  const tm = TRAILING_U.exec(body);
  if (tm) { trail = amountOf(tm[1], tm[2]); body = body.slice(0, body.length - tm[0].length).trim(); }

  return { k, lead, body, trail, hadLeadY: !!m };
}
const assemble = (lead, body, trail) => [fmtU(lead), body, fmtU(trail)].filter(Boolean).join(' ');

const report = { changed: [], skipped: [], stillBroken: [], perSet: [] };
const sqlUpdates = [];

for (const set of LL_SETS) {
  const res = await fetch(`${API}/${set}`);
  if (!res.ok) throw new Error(`${set}: HTTP ${res.status}`);
  const { cases } = await res.json();
  const row = { set, cases: cases.length, algs: 0, 'y→U': 0, '补收尾AUF': 0, '跳过': 0, '无需改': 0 };

  for (const c of cases) {
    let touched = false;
    const newAlgs = c.algs.map(group => group.map(entry => {
      row.algs++;
      const old = entry.alg ?? '';
      const s = split(old);

      let before;
      try { before = stateOf(`${c.setup} ${old}`); } catch {
        row['跳过']++;
        report.skipped.push({ set, case: c.name, id: c.id, alg: old, reason: '公式或 setup 解析失败' });
        return entry;
      }

      // 状态保持的 trail(理论值);优先找能让它精确还原的那个
      const preserving = s.trail - s.k;
      let chosen = null;
      for (let b = 0; b < 4; b++) {
        const cand = assemble(s.lead, s.body, preserving + b);
        try { if (isSolved(stateOf(`${c.setup} ${cand}`))) { chosen = preserving + b; break; } } catch { /* skip */ }
      }
      if (chosen === null) {
        // 退回状态保持:与原公式只差一个整体旋转,且起手带 y 时该旋转必须正是 y^k(理论预言)
        const cand = assemble(s.lead, s.body, preserving);
        let witness = null;
        try { witness = rotationBetween(stateOf(`${c.setup} ${cand}`), before); } catch { /* skip */ }
        if (witness === (s.hadLeadY ? Y_OF[s.k] : 'identity')) chosen = preserving;
      }

      if (chosen === null) {
        row['跳过']++;
        report.skipped.push({ set, case: c.name, id: c.id, alg: old, reason: diagnose(c.setup, old) });
        return entry;
      }

      // 真·整还原的 5 个集合里,规范化之后仍然不还原的 —— 那就是坏数据,不是我们能修的。
      // 别默默放过去。(补收尾 AUF 能救的已经在上面救了;救不了的才落到这里。)
      if (FULL_SOLVE_SETS.has(set)) {
        const cand = assemble(s.lead, s.body, chosen);
        let ok = false;
        try { ok = isSolved(stateOf(`${c.setup} ${cand}`)); } catch { /* skip */ }
        if (!ok) report.stillBroken.push({ set, case: c.name, id: c.id, alg: old, reason: diagnose(c.setup, old) });
      }

      const next = assemble(s.lead, s.body, chosen);
      if (next === old) { row['无需改']++; return entry; }

      if (s.hadLeadY) row['y→U']++; else row['补收尾AUF']++;
      report.changed.push({ set, case: c.name, id: c.id, from: old, to: next });
      touched = true;
      return { ...entry, alg: next };
    }));

    if (touched) {
      const json = JSON.stringify(newAlgs).replace(/'/g, "''");
      sqlUpdates.push(`UPDATE alg_cases SET algs = '${json}'::jsonb WHERE id = ${c.id};`);
    }
  }
  report.perSet.push(row);
}

console.table(report.perSet);
const total = report.perSet.reduce((a, r) => {
  for (const k of Object.keys(r)) if (k !== 'set') a[k] = (a[k] || 0) + r[k];
  return a;
}, {});
console.log('TOTAL:', total);
console.log(`\nSQL: ${sqlUpdates.length} 条 UPDATE(每个受影响的 case 一条,整块换 algs jsonb)`);

if (report.skipped.length) {
  console.log(`\n跳过 ${report.skipped.length} 条:`);
  console.table(report.skipped.map(s => ({ set: s.set, case: s.case, alg: s.alg, reason: s.reason })));
}

if (report.stillBroken.length) {
  console.log(`\n★ 整还原集合里,规范化之后**仍然不还原**的 ${report.stillBroken.length} 条 —— 坏数据,得人工定夺:`);
  console.table(report.stillBroken.map(s => ({ set: s.set, case: s.case, id: s.id, alg: s.alg })));
}

mkdirSync('../../../.tmp', { recursive: true });
writeFileSync('../../../.tmp/canonicalize_ll_algs_report.json', JSON.stringify(report, null, 2), 'utf-8');
console.log('\n完整变更报告 → .tmp/canonicalize_ll_algs_report.json');

if (process.argv.includes('--sql')) {
  const sql = [
    '-- 9 个顶层集合的公式规范化:起手 y → U(body 不变)+ 补齐收尾 AUF',
    '-- 生成:core/packages/alg-build/canonicalize_ll_algs.mjs',
    `-- 改 ${report.changed.length} 条公式(y→U ${total['y→U']},补收尾 AUF ${total['补收尾AUF']}),`
      + `跳过 ${total['跳过']} 条,涉及 ${sqlUpdates.length} 个 case`,
    '',
    'BEGIN;',
    '',
    ...sqlUpdates,
    '',
    'COMMIT;',
    '',
  ].join('\n');
  writeFileSync('../../../.tmp/canonicalize_ll_algs.sql', sql, 'utf-8');
  console.log(`SQL → .tmp/canonicalize_ll_algs.sql (${sql.length} bytes)`);
}
