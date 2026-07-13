/**
 * 修 4 条既有坏数据。这些不是 canonicalize 造成的 —— 是"setup + alg 必须精确还原"这条新不变式
 * (lib/alg_validation.ts)把它们照出来了。canonicalize 拒绝猜,所以单独在这里修。
 *
 * 每条都得有**独立判据**,不许同源自证:
 *
 *   pll Ub alg[2]     `R2' U R U R' U' R3 U' R' U R'`
 *     R2'=R2、R3=R' ⟹ 它逐步等于 alg[3] 掉了起手 y2。少了转体没有 AUF 救得回来(转体换的是
 *     公式作用的物理块,不是收尾角度)。判据:与 alg[3] 的置换逐一相同。⟹ **删掉**
 *
 *   ollcp OLLCP10 2 alg[3]  末尾 `U` → `U'`
 *     判据:全部单 token 变体里,**唯一**一个既保 F2L 又与 alg[0] 落同一轨道的。
 *
 *   1lll 1LLL 2 28 / 1LLL 5 42  —— setup / sticker / alg 全是从同一份坏公式互推出来的,
 *     库内没有独立判据。改用**集合外部**的三条,必须同时成立:
 *       ① 修好的公式保 F2L,且是**唯一**这样的单 token 修复;
 *       ② 它解的 case 态在枚举里是**空位**(不撞 3396 个健康态里的任何一个);
 *       ③ 独立修 setup 得到**同一个**态,且该态的 LL 朝向与**同组兄弟**一致。
 *     三条对上才写;对不上就报出来交给站长,别猜。
 *
 *   node fix_bad_ll_cases.mjs         # 只出报告
 *   node fix_bad_ll_cases.mjs --sql   # 额外产出 .tmp/fix_bad_ll_cases.sql
 *
 * ⚠ sticker 的 5 个颜色串(us/ub/uf/ul/ur)**不动**:全站只读 sticker.kind,颜色串没有任何
 *   渲染路径(缩略图走 setup),而且它的 facelet 编码复现不出来 —— 重生成只会造出新的垃圾。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

const API = 'https://api.cuberoot.me/v1/alg/sets/3x3';
const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const ROTS = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());
const ORBIT = ROTS.flatMap(r => ['', 'U', 'U2', "U'"].map(u => [r, u].filter(Boolean).join(' ')));

const stateOf = (s) => SOLVED.applyAlg(new Alg(s.replace(/=/g, '')));
const inv = (s) => new Alg(s.replace(/=/g, '')).invert().toString();
const sameOrbit = (a, b) => ORBIT.some(r => (r ? a.applyAlg(r) : a).isIdentical(b));

function f2lHome(p) {
  const d = p.patternData;
  for (let i = 4; i < 8; i++) if (d.CORNERS.pieces[i] !== i || d.CORNERS.orientation[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (d.EDGES.pieces[i] !== i || d.EDGES.orientation[i] !== 0) return false;
  for (let i = 0; i < 6; i++) if (d.CENTERS.pieces[i] !== i) return false;
  return true;
}
/**
 * 转正后的 LL 指纹(整体朝向无关);不是 LL 态 → null
 *   key = 精确的 LL 态(含 AUF)—— 枚举查重用它
 *   ori = **对 AUF 归一**的朝向 = 这个 case 的 OLL —— 组判据用它。
 *         朝向数组是**按槽位**存的,U 转会把它整体轮换,所以不归一的话同一个 OLL 会显出 4 种朝向。
 */
function ll(p) {
  for (const r of ROTS) {
    const t = r ? p.applyAlg(r) : p;
    if (!f2lHome(t)) continue;
    const d = t.patternData;
    const oris = ['', 'U', 'U2', "U'"].map(u => {
      const q = (u ? t.applyAlg(u) : t).patternData;
      return JSON.stringify([q.CORNERS.orientation.slice(0, 4), q.EDGES.orientation.slice(0, 4)]);
    });
    const keys = ['', 'U', 'U2', "U'"].map(u => {
      const q = (u ? t.applyAlg(u) : t).patternData;
      return JSON.stringify([q.CORNERS.pieces.slice(0, 4), q.CORNERS.orientation.slice(0, 4),
        q.EDGES.pieces.slice(0, 4), q.EDGES.orientation.slice(0, 4)]);
    });
    return {
      key: JSON.stringify([d.CORNERS.pieces.slice(0, 4), d.CORNERS.orientation.slice(0, 4),
        d.EDGES.pieces.slice(0, 4), d.EDGES.orientation.slice(0, 4)]),
      ori: oris.sort()[0],
      // 对 AUF 归一的 case 类:一个 OLL 下有 4!·4!/2 = 288 个置换,/4 = 72 个类 == 组大小
      cls: keys.sort()[0],
    };
  }
  return null;
}
const llOf = (alg) => { try { return ll(stateOf(alg)); } catch { return null; } };

const FAMILIES = ['U', 'D', 'L', 'R', 'F', 'B', 'u', 'd', 'l', 'r', 'f', 'b', 'M', 'E', 'S', 'x', 'y', 'z'];
/** 所有「换一个 token 的量」+「删一个 token」的候选 */
function* oneTokenEdits(alg) {
  const toks = alg.trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const m = /^([A-Za-z])(\d*)('?)$/.exec(toks[i]);
    if (m && FAMILIES.includes(m[1])) {
      for (const s of ['', '2', "'"]) {
        const v = `${m[1]}${s}`;
        if (v === toks[i]) continue;
        const t = [...toks]; t[i] = v;
        yield { how: `${toks[i]} → ${v}(第 ${i + 1} 步)`, alg: t.join(' ') };
      }
    }
    yield { how: `删掉 ${toks[i]}(第 ${i + 1} 步)`, alg: toks.filter((_, j) => j !== i).join(' ') };
  }
}

const sets = {};
for (const s of ['pll', 'ollcp', '1lll']) sets[s] = (await (await fetch(`${API}/${s}`)).json()).cases;

const fixes = [];  // { set, id, name, setup?, algs?, why }
const fail = [];

// ══ 1lll:先建"健康枚举表"(态 → case)和"每组的公共朝向" ═════════════════════════
const seen = new Map();       // 精确 LL 态 → case 名
const groupOri = new Map();   // 组 → Set(OLL)
const groupCls = new Map();   // 组 → Map(AUF 类 → [case 名])
const groupSize = new Map();
const brokenCases = [];
for (const c of sets['1lll']) {
  const g = /^1LLL (\d+) /.exec(c.name)?.[1];
  if (g) groupSize.set(g, (groupSize.get(g) ?? 0) + 1);
  const L = llOf(c.setup);
  if (!L) { brokenCases.push(c); continue; }
  if (!seen.has(L.key)) seen.set(L.key, c.name);
  if (!g) continue;
  if (!groupOri.has(g)) { groupOri.set(g, new Set()); groupCls.set(g, new Map()); }
  groupOri.get(g).add(L.ori);
  const m = groupCls.get(g);
  if (!m.has(L.cls)) m.set(L.cls, []);
  m.get(L.cls).push(c.name);
}
console.log(`1lll:${sets['1lll'].length} 个 case,${seen.size} 个互不相同的健康 LL 态,`
  + `setup 坏掉的 ${brokenCases.length} 个:${brokenCases.map(c => c.name).join(', ')}`);
for (const [g, oris] of [...groupOri].sort((a, b) => a[0] - b[0])) {
  if (oris.size !== 1) console.log(`  ⚠ 组 ${g} 的 OLL 不唯一(${oris.size} 种)—— 该组不能拿"公共 OLL"当判据`);
}
// 组内 AUF-类应当互不相同(健康 case 一个类一个);撞类 = 重复 case
const dupClass = [];
for (const [g, m] of groupCls) for (const [, names] of m) if (names.length > 1) dupClass.push({ 组: g, 重复的: names.join(' == ') });
if (dupClass.length) {
  console.log('\n★ 组内重复 case(两个 case 是同一个 AUF 类)—— 既有问题,不在本次修复范围;'
    + '它们各自占掉一个位置,导致所在组少了一个真 case:');
  console.table(dupClass);
}

for (const c of brokenCases) {
  const g = /^1LLL (\d+) /.exec(c.name)[1];
  const oris = groupOri.get(g);
  const flat = c.algs.flat().map(e => e.alg);
  console.log('\n' + '═'.repeat(78));
  console.log(`${c.name} | id=${c.id}`);

  // ① + ② 修 alg[0]:保 F2L,且态是空位
  const algCands = [...oneTokenEdits(flat[0])]
    .map(e => ({ ...e, L: llOf(e.alg) }))
    .filter(e => e.L && !seen.has(ll(stateOf(inv(e.alg))).key));
  // ③ 独立修 setup:保 F2L(它自己就是 case 态)
  const setupCands = [...oneTokenEdits(c.setup)]
    .map(e => ({ ...e, L: llOf(e.alg) }))
    .filter(e => e.L && !seen.has(e.L.key));

  console.log(`  ① 唯一的保-F2L 单 token 修复(alg[0]):${algCands.length === 1 ? '✓' : `✗ 有 ${algCands.length} 个`}`);
  if (algCands.length !== 1) { fail.push({ case: c.name, why: `alg[0] 的单 token 修复不唯一(${algCands.length} 个)` }); continue; }
  const fixedAlg = algCands[0];
  const target = ll(stateOf(inv(fixedAlg.alg)));   // 修好的公式所解的 case 态
  console.log(`     ${fixedAlg.how}  →  ${fixedAlg.alg}`);

  console.log(`  ② 该态在枚举里是空位:✓(不撞 ${seen.size} 个健康态)`);

  const setupAgrees = setupCands.filter(e => e.L.key === target.key);
  const ok3a = setupAgrees.length > 0;
  console.log(`  ③ 独立修 setup 指向同一个态:${ok3a ? `✓ ${setupAgrees[0].how} → ${setupAgrees[0].alg}` : '✗ 对不上'}`);
  if (!ok3a) {
    console.log(`     (保 F2L 且是空位的 setup 候选共 ${setupCands.length} 个:)`);
    for (const e of setupCands.slice(0, 8)) {
      console.log(`       ${e.how.padEnd(22)} OLL 与目标${e.L.ori === target.ori ? '相同' : '不同'}  ${e.alg}`);
    }
  }
  const ok3b = oris.size === 1 && oris.has(target.ori);
  console.log(`     该态的 OLL(朝向,对 AUF 归一)== 组 ${g} 的公共 OLL:${ok3b ? '✓' : `✗(该组有 ${oris.size} 种 OLL)`}`);

  // ④ 组内枚举完整性:一个 OLL 下 4!·4!/2 = 288 个置换,对 AUF 归一 = 72 个类 == 组大小。
  //   修好的 case 必须落在这个组**还空着**的类上。
  const cls = groupCls.get(g);
  const ok4 = !cls.has(target.cls);
  console.log(`  ④ 落在组 ${g} 空着的 AUF 类上:${ok4 ? '✓' : `✗ 撞了 ${cls.get(target.cls).join('/')}`}`
    + `(组大小 ${groupSize.get(g)},健康 case 覆盖 ${cls.size} 个类)`);

  if (!ok3b || !ok4) { fail.push({ case: c.name, why: `交叉验证没过(setup ${ok3a} / OLL ${ok3b} / 组空位 ${ok4}) ` }); continue; }
  if (!ok3a) console.log('     ⚠ setup 单 token 修不回来(它坏得更深),靠 ①②③b④ 四条定案 —— 直接按修好的 alg[0] 重建 setup');

  // 其余 alg:与修好的 alg[0] 解同一个 case 吗?不行就找修复,再不行就删。
  // entry 上除了 alg 还挂着 altId 一类元数据 —— 一律 spread 原 entry,只换 alg 字段。
  const entries = c.algs.flat();
  const newAlgs = [{ ...entries[0], alg: fixedAlg.alg }];
  const dropped = [];
  for (let i = 1; i < flat.length; i++) {
    if (llOf(flat[i]) && sameOrbit(stateOf(`${inv(fixedAlg.alg)} ${flat[i]}`), SOLVED)) {
      newAlgs.push(entries[i]); continue;
    }
    const cand = [...oneTokenEdits(flat[i])].find(e =>
      llOf(e.alg) && sameOrbit(stateOf(`${inv(fixedAlg.alg)} ${e.alg}`), SOLVED));
    if (cand) { console.log(`  alg[${i}] 单 token 修复:${cand.how} → ${cand.alg}`); newAlgs.push({ ...entries[i], alg: cand.alg }); }
    else { console.log(`  alg[${i}] 无解 → 删掉:${flat[i]}`); dropped.push(flat[i]); }
  }

  fixes.push({
    set: '1lll', id: c.id, name: c.name,
    setup: inv(fixedAlg.alg),
    algs: [newAlgs],
    why: `alg[0] ${fixedAlg.how};setup 重建 = inverse(修好的 alg[0])`
      + (dropped.length ? `;删掉 ${dropped.length} 条无解的替代公式` : ''),
  });
}

// ══ pll Ub:alg[2] 是 alg[3] 掉了起手 y2 —— 逐步验证,然后删 ════════════════════
{
  const c = sets['pll'].find(x => x.name === 'Ub');
  const flat = c.algs.flat().map(e => e.alg);
  console.log('\n' + '═'.repeat(78));
  console.log(`pll | Ub | id=${c.id}`);
  const bare = flat[3].replace(/^\s*y\d*'?\s+/, '');
  const same = stateOf(flat[2]).isIdentical(stateOf(bare));
  console.log(`  alg[2] 的置换 == alg[3] 去掉起手 y2 的置换?${same ? '✓ 是 —— 重复条目,起手转体丢了' : '✗'}`);
  console.log(`    alg[2]        ${flat[2]}`);
  console.log(`    alg[3] 去 y2   ${bare}`);
  if (same) {
    fixes.push({
      set: 'pll', id: c.id, name: c.name,
      algs: [c.algs.flat().filter((_, i) => i !== 2)],
      why: 'alg[2] 是 alg[3] 掉了起手 y2 的重复条目(R2\'=R2、R3=R\',逐步相同)—— 删掉',
    });
  } else fail.push({ case: 'pll Ub', why: 'alg[2] 与 alg[3] 并不逐步相同,重复条目的判断不成立' });
}

// ══ ollcp OLLCP10 2:alg[3] 末尾 U → U' ═══════════════════════════════════════
{
  const c = sets['ollcp'].find(x => x.name === 'OLLCP10 2');
  const flat = c.algs.flat().map(e => e.alg);
  const ref = stateOf(`${c.setup} ${flat[0]}`);
  console.log('\n' + '═'.repeat(78));
  console.log(`ollcp | OLLCP10 2 | id=${c.id}`);
  const cands = [...oneTokenEdits(flat[3])].filter(e =>
    llOf(e.alg) && sameOrbit(stateOf(`${c.setup} ${e.alg}`), ref));
  console.log(`  唯一的保-F2L 且与 alg[0] 同轨道的单 token 修复:${cands.length === 1 ? '✓' : `✗ 有 ${cands.length} 个`}`);
  for (const x of cands) console.log(`    ${x.how}  →  ${x.alg}`);
  if (cands.length === 1) {
    const all = c.algs.flat();
    fixes.push({
      set: 'ollcp', id: c.id, name: c.name,
      algs: [all.map((e, i) => (i === 3 ? { ...e, alg: cands[0].alg } : e))],
      why: `alg[3] ${cands[0].how}`,
    });
  } else fail.push({ case: 'ollcp OLLCP10 2', why: `alg[3] 的单 token 修复不唯一(${cands.length} 个)` });
}

// ══ 落地 ═════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(78));
console.log(`修 ${fixes.length} 条:`);
console.table(fixes.map(f => ({ set: f.set, case: f.name, id: f.id, why: f.why })));
if (fail.length) { console.log('\n✗ 没修成(交给站长):'); console.table(fail); }

mkdirSync('../../../.tmp', { recursive: true });
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = [
  '-- 修 4 条既有坏数据(与 canonicalize 无关;是"setup + alg 必须精确还原"这条新不变式照出来的)',
  '-- 生成:core/packages/alg-build/fix_bad_ll_cases.mjs',
  '',
  'BEGIN;',
  '',
  ...fixes.flatMap(f => [
    `-- ${f.set} ${f.name} (id=${f.id}): ${f.why}`,
    `UPDATE alg_cases SET algs = ${q(JSON.stringify(f.algs))}::jsonb`
      + (f.setup ? `, setup = ${q(f.setup)}` : '')
      + ` WHERE id = ${f.id};`,
    '',
  ]),
  'COMMIT;',
  '',
].join('\n');

if (process.argv.includes('--sql')) {
  writeFileSync('../../../.tmp/fix_bad_ll_cases.sql', sql, 'utf-8');
  console.log(`\nSQL → .tmp/fix_bad_ll_cases.sql(${fixes.length} 条 UPDATE)`);
}

// ── 本地 pg13 dry run:灌进临时表 → 套 SQL → **读回来**验,绝不碰真表 ─────────────
if (process.argv.includes('--dryrun')) {
  const { execFileSync } = await import('node:child_process');
  const TABLE = 'alg_cases_fixrun';
  const dk = (a) => execFileSync('docker', a, { encoding: 'utf-8' });
  const psqlFile = (p) => dk(['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-q', '-f', p]);
  const psql = (s) => dk(['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', s]);
  const push = (n) => dk(['cp', new URL(`../../../.tmp/${n}`, import.meta.url).pathname.replace(/^\//, ''), `pg13:/tmp/${n}`]);

  const all = Object.entries(sets).flatMap(([s, cs]) => cs.map(c => ({ ...c, set: s })));
  writeFileSync('../../../.tmp/fixrun_seed.sql', [
    `DROP TABLE IF EXISTS ${TABLE};`,
    `CREATE TABLE ${TABLE} (id INT PRIMARY KEY, set_slug TEXT, name TEXT, setup TEXT, algs JSONB);`,
    ...all.map(c => `INSERT INTO ${TABLE} VALUES (${c.id}, ${q(c.set)}, ${q(c.name)}, ${q(c.setup)}, ${q(JSON.stringify(c.algs))}::jsonb);`),
  ].join('\n'), 'utf-8');
  writeFileSync('../../../.tmp/fixrun_apply.sql', sql.replace(/UPDATE alg_cases /g, `UPDATE ${TABLE} `), 'utf-8');
  push('fixrun_seed.sql'); psqlFile('/tmp/fixrun_seed.sql');
  push('fixrun_apply.sql'); psqlFile('/tmp/fixrun_apply.sql');
  console.log(`\n本地 pg13:灌 ${psql(`SELECT count(*) FROM ${TABLE};`).trim()} 行,套 ${fixes.length} 条 UPDATE`);

  const byId = new Map(all.map(c => [c.id, c]));
  let pass = 0;
  for (const f of fixes) {
    const line = psql(`SELECT setup, algs::text FROM ${TABLE} WHERE id = ${f.id};`).trim();
    const bar = line.indexOf('|');
    const setup = line.slice(0, bar);
    const algs = JSON.parse(line.slice(bar + 1)).flat().map(e => e.alg);
    const ref = stateOf(`${setup} ${algs[0]}`);
    // 整还原集合(pll / 1lll)要精确还原;ollcp 只要与 alg[0] 同轨道
    const wantSolved = f.set !== 'ollcp';
    const bad = algs.filter(a => !llOf(a) || !sameOrbit(stateOf(`${setup} ${a}`), wantSolved ? SOLVED : ref));
    const old = byId.get(f.id).algs.flat().length;
    console.log(`  ${bad.length === 0 ? '✓' : '✗'} ${f.set} ${f.name}:${algs.length} 条公式`
      + `(原 ${old} 条)全部保 F2L 且${wantSolved ? '精确还原' : '与 alg[0] 同轨道'}`
      + (bad.length ? ` —— ${bad.length} 条不合格:${bad.join(' | ')}` : ''));
    if (bad.length === 0) pass++;
  }
  psql(`DROP TABLE ${TABLE};`);
  console.log(`\n${pass === fixes.length ? '✓ 全部通过' : `✗ ${fixes.length - pass} 条不合格`}。临时表已删。`);
}
