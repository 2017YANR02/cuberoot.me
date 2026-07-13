/**
 * 先导任务:把 9 个顶层集合里**起手转体 y 的公式**改写成起手 U,body 一个字节不改。
 *
 *     y^k · A   →   U^k · A · U^-k
 *
 * 依据(docs/1lll-migration.md §4.3'):y = U · Dw',而 Dw 与任何"净元素 = 顶层置换 ∘ y 轴旋转"
 * 的公式可交换,于是 `S·U^k·A·U^-k == (S·y^k·A)·y^-k` —— 改写后到达**完全相同的状态**,
 * 只差一个整体旋转。这条不依赖"本集合算不算还原",所以 OLL/COLL/CMLL/OLLCP 一视同仁。
 *
 * ⚠ 两道过滤缺一不可:
 *   1. **显式的 9 个 LL 集合名单**。`sticker.kind === 'face'` 不能用 —— vls/wv/sv 也是 face,
 *      但它们是最后一槽集合,改写会毁掉公式。非 LL 集合 474 条起手 y 公式改写成功率 0/474。
 *   2. **逐条实证**:改写后的状态必须与原状态只差一个整体旋转。对不上就跳过。
 *      body 带净 x/z 转体的会在这里被挡下(18 条)——「顶层」不再是 U 面,U 转补不回来。
 *
 * 收尾 AUF **存进库**(站长拍板):库里 `setup + alg` 精确还原,前端 displayAlg() 显示时才剥掉。
 *
 * 用法:
 *   node rewrite_leading_y.mjs            # 只出报告,不写 SQL
 *   node rewrite_leading_y.mjs --sql      # 额外产出 .tmp/rewrite_leading_y.sql
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
/** 只有这 9 个。别改成按 sticker.kind 筛。 */
const LL_SETS = ['oll', 'pll', 'coll', 'cmll', 'anti-pll', 'ollcp', 'zbll', '1lll', 'ell'];

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

/** 24 个整体旋转 */
const ROTATIONS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) {
  for (const b of ['', 'y', 'y2', "y'"]) ROTATIONS.push(`${a} ${b}`.trim());
}
const Y_OF = { 1: 'y', 2: 'y2', 3: "y'" };

const stateOf = (alg) => SOLVED.applyAlg(new Alg(alg));
/** a 与 b 只差一个整体旋转?返回见证旋转(或 null) */
function rotationBetween(a, b) {
  for (const r of ROTATIONS) {
    if ((r ? a.applyAlg(r) : a).isIdentical(b)) return r || 'identity';
  }
  return null;
}

/** 底下两层 + 中心块都归位?(判"这是不是一条真 LL 公式"的核心) */
function f2lHome(p) {
  const d = p.patternData;
  for (let i = 4; i < 8; i++) if (d.CORNERS.pieces[i] !== i || d.CORNERS.orientation[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (d.EDGES.pieces[i] !== i || d.EDGES.orientation[i] !== 0) return false;
  for (let i = 0; i < 6; i++) if (d.CENTERS.pieces[i] !== i) return false;
  return true;
}
/** 公式的净元素扣掉整体旋转后只剩顶层置换?返回那个净旋转(或 null = 它压根不是 LL 公式) */
function netRotationOf(alg) {
  let p;
  try { p = stateOf(alg); } catch { return null; }
  for (const r of ROTATIONS) {
    if (f2lHome(r ? p.applyAlg(r) : p)) return r || 'none';
  }
  return null;
}
const solvesUpToRotation = (alg) => {
  try { return rotationBetween(stateOf(alg), SOLVED) !== null; } catch { return false; }
};

/** 跳过一条公式时,说清楚**到底**为什么 —— 别发一句罐头原因。 */
function diagnose(setup, alg) {
  const net = netRotationOf(alg);
  if (net === null) {
    // 净元素动了 F2L ⟹ 这就不是一条 LL 公式。要么公式坏,要么 setup 跟着一起坏。
    const setupIsLL = netRotationOf(new Alg(setup).invert().toString()) !== null;
    return solvesUpToRotation(`${setup} ${alg}`)
      ? `★ 数据 bug:公式不保 F2L${setupIsLL ? '' : ',且 setup 自己也不保 F2L(坏公式反推出的坏 setup,互相自洽把错误藏住了)'}`
      : '★ 数据 bug:公式不保 F2L,而且 setup + alg 根本不还原';
  }
  if (/[xz]/.test(net)) return `合法 LL 公式,但净旋转 ${net} 带 x/z 轴 —— "顶层"不再是 U 面,U 转补不回来。保留原样`;
  return `见证旋转对不上理论预言(净旋转 ${net})`;
}

// ── 记号:`y` `y2` `y'` `y3` `U2'` … 通用 <family><amount><prime>
const LEADING_Y = /^\s*y(\d*)('?)(?=\s|$)/;
const LEADING_U = /^U(\d*)('?)(?=\s|$)/;
const TRAILING_U = /(?:^|\s)U(\d*)('?)$/;

const amountOf = (digits, prime) => (((digits ? Number(digits) : 1) * (prime ? -1 : 1)) % 4 + 4) % 4;
/** 0 → ''(不写),1 → 'U',2 → 'U2',3 → "U'" */
const fmtU = (amount) => ['', 'U', 'U2', "U'"][((amount % 4) + 4) % 4];

/**
 * 改写一条公式。返回 { alg, k, leadSeam, trailSeam } 或 null(没有起手 y)。
 * body 的中段**一个字节不改**;只有两端与 U 相邻的接缝会合并(U + U' 不可能留在库里)。
 */
function rewrite(alg) {
  const m = LEADING_Y.exec(alg);
  if (!m) return null;
  const k = amountOf(m[1], m[2]);
  if (k === 0) return null; // y4 之类,理论上不存在
  let body = alg.slice(m[0].length).trim();

  // 接缝 1:body 自己以 U 开头 → 与 U^k 合并
  let lead = k;
  const lm = LEADING_U.exec(body);
  if (lm) {
    lead += amountOf(lm[1], lm[2]);
    body = body.slice(lm[0].length).trim();
  }
  // 接缝 2:body 自己以 U 结尾 → 与收尾的 U^-k 合并
  let trail = -k;
  const tm = TRAILING_U.exec(body);
  if (tm) {
    trail += amountOf(tm[1], tm[2]);
    body = body.slice(0, body.length - tm[0].length).trim();
  }

  const out = [fmtU(lead), body, fmtU(trail)].filter(Boolean).join(' ');
  return { alg: out, k, leadSeam: !!lm, trailSeam: !!tm };
}

// ── 跑
const report = { rewritten: [], skipped: [], perSet: [] };
const sqlUpdates = [];

for (const set of LL_SETS) {
  const res = await fetch(`${API}/${set}`);
  if (!res.ok) throw new Error(`${set}: HTTP ${res.status}`);
  const { cases } = await res.json();
  const row = { set, cases: cases.length, algs: 0, leadY: 0, rewritten: 0, skipped: 0, seams: 0 };

  for (const c of cases) {
    let changed = false;
    const newAlgs = c.algs.map(group => group.map(entry => {
      row.algs++;
      const r = rewrite(entry.alg ?? '');
      if (!r) return entry;
      row.leadY++;

      // 实证:改写后的状态必须与原状态只差一个整体旋转,且该旋转应当正是 y^k。
      let witness = null;
      try {
        const before = stateOf(`${c.setup} ${entry.alg}`);
        const after = stateOf(`${c.setup} ${r.alg}`);
        witness = rotationBetween(after, before);
      } catch { /* 解析不了 */ }

      // 理论预言:见证旋转恰好是 y^k。对不上就别赌,原样保留并说清原因。
      if (witness !== Y_OF[r.k]) {
        row.skipped++;
        report.skipped.push({ set, case: c.name, id: c.id, alg: entry.alg, reason: diagnose(c.setup, entry.alg) });
        return entry;
      }

      row.rewritten++;
      if (r.leadSeam || r.trailSeam) row.seams++;
      report.rewritten.push({ set, case: c.name, id: c.id, from: entry.alg, to: r.alg, k: r.k });
      changed = true;
      return { ...entry, alg: r.alg };
    }));

    if (changed) {
      const json = JSON.stringify(newAlgs).replace(/'/g, "''");
      sqlUpdates.push(`UPDATE alg_cases SET algs = '${json}'::jsonb WHERE id = ${c.id};`);
    }
  }
  report.perSet.push(row);
}

console.table(report.perSet);
const total = report.perSet.reduce((a, r) => {
  for (const k of ['cases', 'algs', 'leadY', 'rewritten', 'skipped', 'seams']) a[k] = (a[k] || 0) + r[k];
  return a;
}, {});
console.log('TOTAL:', total);
console.log(`\nSQL: ${sqlUpdates.length} 条 UPDATE(每个受影响的 case 一条,整块换 algs jsonb)`);

if (report.skipped.length) {
  console.log(`\n跳过 ${report.skipped.length} 条:`);
  console.table(report.skipped.map(s => ({ set: s.set, case: s.case, alg: s.alg, reason: s.reason })));
}

mkdirSync('../../../.tmp', { recursive: true });
writeFileSync('../../../.tmp/rewrite_leading_y_report.json', JSON.stringify(report, null, 2), 'utf-8');
console.log('\n完整变更报告 → .tmp/rewrite_leading_y_report.json');

if (process.argv.includes('--sql')) {
  const sql = [
    '-- 先导任务:9 个顶层集合的起手 y → U(body 不变,收尾 AUF 入库)',
    '-- 生成:core/packages/alg-build/rewrite_leading_y.mjs',
    `-- 改写 ${total.rewritten} 条公式,跳过 ${total.skipped} 条,涉及 ${sqlUpdates.length} 个 case`,
    '',
    'BEGIN;',
    '',
    ...sqlUpdates,
    '',
    'COMMIT;',
    '',
  ].join('\n');
  writeFileSync('../../../.tmp/rewrite_leading_y.sql', sql, 'utf-8');
  console.log(`SQL → .tmp/rewrite_leading_y.sql (${sql.length} bytes)`);
}
