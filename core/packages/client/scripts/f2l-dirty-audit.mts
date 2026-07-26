/**
 * f2l 库里「setup + alg 做不完 F2L」的条目审计 —— issue #40 T5 的前置清理。
 *
 * f2l-mirror-probe.mts 只数出 51 条对照组失败,没说是哪些。本脚本逐条列出来,
 * 并试着分类:是少了 AUF、写成了别的 y-view、公式写反了,还是真的错。
 *
 * 跑:NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/f2l-dirty-audit.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const { cube3x3x3 } = await import('cubing/puzzles');
const KP = await cube3x3x3.kpuzzle();

type AlgRow = { alg: string };
type Case = { id?: number; name: string; subgroup: string; setup: string; algs: AlgRow[][] };

const API = process.env.ALG_API ?? 'https://api.cuberoot.me/v1/alg/sets/3x3/f2l';
let data: { cases: Case[] };
try {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
  console.log(`数据源:${API}(实时)`);
} catch (err) {
  data = JSON.parse(readFileSync('scripts/.cache/f2l.json', 'utf8'));
  console.log(`数据源:scripts/.cache/f2l.json(在线拉取失败:${(err as Error).message})`);
}

/** 底两层归位(顶层照旧乱),不允许公式留下整体转体。 */
function f2lDoneFixed(alg: string): boolean {
  let p;
  try { p = KP.defaultPattern().applyAlg(alg); } catch { return false; }
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  for (let i = 4; i < 8; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) return false;
  return true;
}

/**
 * F2L 做完 —— **模整体转体**。公式含净转体(y' / d / u 等)时,收尾时魔方整个转过去了,
 * 底两层仍然是解好的,只是不在原朝向。判定必须把 24 个朝向都试一遍,否则会把
 * 一大批完全正常的公式误判成脏数据(f2l-mirror-probe 的 51 条即由此而来)。
 */
const ORIENT: string[] = [];
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ORIENT.push(`${a} ${b}`.trim());
function f2lDone(alg: string): boolean {
  return ORIENT.some((r) => f2lDoneFixed(`${alg} ${r}`.trim()));
}

/** 哪些块没归位,给人看的。 */
const CORNER_NAME = ['UFR', 'UFL', 'UBL', 'UBR', 'DFR', 'DFL', 'DBL', 'DBR'];
const EDGE_NAME = ['UF', 'UL', 'UB', 'UR', 'DF', 'DL', 'DB', 'DR', 'FR', 'FL', 'BL', 'BR'];
function offPieces(alg: string): string {
  let p;
  try { p = KP.defaultPattern().applyAlg(alg); } catch (err) { return `解析失败: ${(err as Error).message}`; }
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  const bad: string[] = [];
  for (let i = 4; i < 8; i++) {
    if (c.pieces[i] !== i) bad.push(`${CORNER_NAME[i]}←${CORNER_NAME[c.pieces[i]]}`);
    else if (c.orientation[i] !== 0) bad.push(`${CORNER_NAME[i]}扭${c.orientation[i]}`);
  }
  for (let i = 4; i < 12; i++) {
    if (e.pieces[i] !== i) bad.push(`${EDGE_NAME[i]}←${EDGE_NAME[e.pieces[i]]}`);
    else if (e.orientation[i] !== 0) bad.push(`${EDGE_NAME[i]}翻`);
  }
  return bad.join(' ');
}

const AUF = ['', 'U', 'U2', "U'"];
const ROT = ['', 'y', 'y2', "y'"];

/** 试各种补救,返回第一个成立的描述;都不成立返回 null。 */
function diagnose(setup: string, alg: string): string | null {
  for (const post of AUF) if (f2lDone(`${setup} ${alg} ${post}`.trim()) && post) return `公式后补 ${post}`;
  for (const pre of AUF) if (f2lDone(`${setup} ${pre} ${alg}`.trim()) && pre) return `公式前补 ${pre}`;
  for (const r of ROT) {
    if (!r) continue;
    if (f2lDone(`${setup} ${r} ${alg}`.trim())) return `公式属于 ${r} 那个 view(前加 ${r} 才成立)`;
    if (f2lDone(`${r} ${setup} ${alg}`.trim())) return `setup 属于 ${r} 那个 view`;
  }
  for (const r of ROT) for (const pre of AUF) for (const post of AUF) {
    if (!r && !pre && !post) continue;
    if (f2lDone(`${setup} ${r} ${pre} ${alg} ${post}`.trim())) {
      return `需 ${[r && `转体 ${r}`, pre && `前 AUF ${pre}`, post && `后 AUF ${post}`].filter(Boolean).join(' + ')}`;
    }
  }
  // 公式写反了?
  const inv = alg.trim().split(/\s+/).reverse()
    .map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`)).join(' ');
  for (const r of ROT) for (const post of AUF) {
    if (f2lDone(`${setup} ${r} ${inv} ${post}`.trim())) return `公式写反了(取逆后成立${r ? ` + ${r}` : ''})`;
  }
  // setup 本身是不是就已经解好了(空 case / setup 写错)?
  if (f2lDone(setup)) return 'setup 自身就已经是 F2L 完成态(setup 写错)';
  return null;
}

type Bad = { case: string; subgroup: string; setup: string; alg: string; row: number; fix: string | null; off: string };
const bad: Bad[] = [];
let total = 0, rotated = 0;

for (const c of data.cases) {
  const rows = c.algs?.[0] ?? [];
  rows.forEach((row, i) => {
    total++;
    const full = `${c.setup} ${row.alg}`;
    if (f2lDoneFixed(full)) return;            // 完美:解好且朝向不变
    if (f2lDone(full)) { rotated++; return; }  // 解好了,只是公式含净转体 —— 不是脏数据
    bad.push({
      case: c.name, subgroup: c.subgroup, setup: c.setup, alg: row.alg, row: i + 1,
      fix: diagnose(c.setup, row.alg), off: offPieces(full),
    });
  });
}

console.log(`\nf2l:${data.cases.length} 个 case / ${total} 条公式`);
console.log(`  ${total - rotated - bad.length} 条 解好且不留转体`);
console.log(`  ${rotated} 条 解好但公式含净转体(y'/d 开头之类)—— 正常公式,非脏数据`);
console.log(`  ${bad.length} 条 真的做不完 F2L\n`);

// 按诊断分类
const byFix = new Map<string, Bad[]>();
for (const b of bad) {
  const k = b.fix ?? '❌ 怎么补都不成立(真错)';
  const arr = byFix.get(k);
  if (arr) arr.push(b); else byFix.set(k, [b]);
}
const sorted = [...byFix.entries()].sort((a, b2) => b2[1].length - a[1].length);
console.log('按病因分组:');
for (const [fix, list] of sorted) console.log(`  ${String(list.length).padStart(3)} 条  ${fix}`);

console.log('\n逐条:');
for (const [fix, list] of sorted) {
  console.log(`\n── ${fix}(${list.length} 条)`);
  for (const b of list) {
    console.log(`  ${b.subgroup}/${b.case} 第 ${b.row} 条`);
    console.log(`      setup: ${b.setup}`);
    console.log(`      alg  : ${b.alg}`);
    console.log(`      残留 : ${b.off}`);
  }
}

writeFileSync('.tmp/f2l-dirty.json', JSON.stringify(bad, null, 2));
console.log(`\n明细写入 .tmp/f2l-dirty.json(${bad.length} 条)`);
