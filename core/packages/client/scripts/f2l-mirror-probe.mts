/**
 * F2L / 单槽公式集的镜像结构探针。issue #40 T5 的地基验证。
 *
 * 要验三件事(全部实证,不靠推理):
 *   1. 同字母 +/− 是否真的互为左右镜像(issue 的断言)。
 *   2. S(前后镜)= M(左右镜) ∘ y² —— 若成立,镜像家族就只是**一对** case,
 *      「前后镜像情况」不过是同一伙伴的另一个 y-view,不是第三个 case。
 *   3. 镜像重写表本身对不对:setup 与 alg 一起镜像后,仍然能把魔方解开。
 *
 * 跑:node --experimental-strip-types scripts/f2l-mirror-probe.mts
 */
import { readFileSync } from 'node:fs';

const { cube3x3x3 } = await import('cubing/puzzles');
const KP = await cube3x3x3.kpuzzle();

// ── move 重写表 ──
// 左右镜(关于 M 平面):R↔L,其余面留在原地;反射改手性 ⇒ 所有转向取反。
const LR: Record<string, string> = { R: 'L', L: 'R', U: 'U', D: 'D', F: 'F', B: 'B', M: 'M', E: 'E', S: 'S', x: 'x', y: 'y', z: 'z' };
// 前后镜(关于 S 平面):F↔B,其余面原地;同样转向取反。
const FB: Record<string, string> = { F: 'B', B: 'F', U: 'U', D: 'D', R: 'R', L: 'L', M: 'M', E: 'E', S: 'S', x: 'x', y: 'y', z: 'z' };
// y²:纯旋转,不是镜像 ⇒ 转向不变。F↔B 且 R↔L。
const Y2: Record<string, string> = { F: 'B', B: 'F', R: 'L', L: 'R', U: 'U', D: 'D', M: 'M', E: 'E', S: 'S', x: 'x', y: 'y', z: 'z' };

// slice 的转向要不要跟着翻,看它的轴与这次变换的关系:
//   轴与镜面法向平行(LR 的 M、FB 的 S)→ 轴自己也被翻了一次,与手性那次抵消 ⇒ 不加 prime
//   y² 不是镜像、面层不翻;但它把 x 轴与 z 轴同时反向 ⇒ M 与 S 反而要翻
const LR_KEEP = new Set(['M']);
const FB_KEEP = new Set(['S']);
const Y2_FLIP = new Set(['M', 'S']);

const TOK = /^([A-Za-z])(w?)(\d*)('?)$/;

function rewrite(alg: string, map: Record<string, string>, flipDefault: boolean, except: Set<string>): string {
  return alg.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const t = tok.replace(/[()]/g, '');
    if (!t) return '';
    const m = TOK.exec(t);
    if (!m) throw new Error(`无法解析 token: ${tok}`);
    const [, face, wide, num, prime] = m;
    const lower = face === face.toLowerCase() && /[rludfb]/.test(face);
    const key = face.toUpperCase();
    const mapped = map[key] ?? map[face];
    if (!mapped) throw new Error(`无映射: ${face}`);
    const out = lower ? mapped.toLowerCase() : mapped;
    const n = num === '' ? 1 : +num;
    // 半圈自逆,取反没意义;其余按 flip 决定是否翻转方向
    const flip = except.has(key) ? !flipDefault : flipDefault;
    const inverted = n === 2 ? '' : (flip ? (prime ? '' : "'") : prime);
    return `${out}${wide}${n === 1 ? '' : n}${inverted}`;
  }).filter(Boolean).join(' ');
}

const mirrorLR = (a: string) => rewrite(a, LR, true, LR_KEEP);
const mirrorFB = (a: string) => rewrite(a, FB, true, FB_KEEP);
const rotY2 = (a: string) => rewrite(a, Y2, false, Y2_FLIP);

// ── 状态指纹(忽略中心块,便于比 y-view) ──
function fingerprint(alg: string): string {
  const p = KP.defaultPattern().applyAlg(alg);
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  return `${c.pieces.join(',')}|${c.orientation.join(',')}|${e.pieces.join(',')}|${e.orientation.join(',')}`;
}

/** case 的 4 个 y-view 指纹(F2L 的 oriNames 就是这 4 个)。 */
function viewPrints(setup: string): string[] {
  return [0, 1, 2, 3].map((k) => fingerprint(`${'y '.repeat(k)}${setup}${' y'.repeat((4 - k) % 4)}`));
}

// ── 数据 ──
const f2l = JSON.parse(readFileSync('scripts/.cache/f2l.json', 'utf8')) as {
  cases: { name: string; subgroup: string; setup: string; algs: { alg: string }[][] }[];
};

console.log(`f2l: ${f2l.cases.length} 个 case\n`);

// 建 view 指纹 → case 名 的索引
const byPrint = new Map<string, { name: string; view: number }>();
for (const c of f2l.cases) {
  viewPrints(c.setup).forEach((fp, view) => {
    if (!byPrint.has(fp)) byPrint.set(fp, { name: c.name, view });
  });
}

// ── 验证 1 + 2:镜像落到谁身上 ──
const VIEW_NAME = ['FR', 'FL', 'BL', 'BR'];
let pairOk = 0, pairBad = 0;
const rows: string[] = [];
for (const c of f2l.cases) {
  let lr: string, fb: string, y2: string;
  try {
    lr = mirrorLR(c.setup); fb = mirrorFB(c.setup); y2 = rotY2(c.setup);
  } catch (err) { rows.push(`${c.name}: 重写失败 ${(err as Error).message}`); pairBad++; continue; }
  const hitLR = byPrint.get(fingerprint(lr));
  const hitFB = byPrint.get(fingerprint(fb));
  const hitY2 = byPrint.get(fingerprint(y2));
  // issue 的断言:同字母 +/− 互为镜像
  const expected = c.name.endsWith('+') ? c.name.replace(/\+$/, '-')
    : c.name.endsWith('-') ? c.name.replace(/-$/, '+') : c.name;
  const ok = hitLR?.name === expected;
  ok ? pairOk++ : pairBad++;
  rows.push(`${ok ? ' ' : '✗'} ${c.name.padEnd(4)} LR→${(hitLR ? `${hitLR.name}/${VIEW_NAME[hitLR.view]}` : '???').padEnd(8)}`
    + ` FB→${(hitFB ? `${hitFB.name}/${VIEW_NAME[hitFB.view]}` : '???').padEnd(8)}`
    + ` y²→${(hitY2 ? `${hitY2.name}/${VIEW_NAME[hitY2.view]}` : '???').padEnd(8)}`
    + ` ${ok ? '' : `(期望 LR→${expected})`}`);
}
rows.forEach((r) => console.log(r));
console.log(`\n「同字母 +/− 互为左右镜像」:${pairOk} 条成立,${pairBad} 条不成立`);

// ── 验证 2 的直接形式:S ?= M ∘ y² ──
let sEqMy2 = 0, sNe = 0;
for (const c of f2l.cases) {
  try {
    const a = fingerprint(mirrorFB(c.setup));
    const b = fingerprint(rotY2(mirrorLR(c.setup)));
    a === b ? sEqMy2++ : sNe++;
  } catch { sNe++; }
}
console.log(`S = M ∘ y²(前后镜 = 左右镜再转半圈):成立 ${sEqMy2},不成立 ${sNe}`);

// ── 验证 3:setup 与 alg 一起镜像后仍然能解 ──
// F2L case 解完 = 底两层还原(顶层照旧是乱的),不能用整方 isSolved 判。
function f2lDone(alg: string): boolean {
  const p = KP.defaultPattern().applyAlg(alg);
  const c = p.patternData.CORNERS, e = p.patternData.EDGES;
  for (let i = 4; i < 8; i++) if (c.pieces[i] !== i || c.orientation[i] !== 0) return false;   // D 层 4 角
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) return false;  // D 层 + E 层 8 棱
  return true;
}

let algOk = 0, algBad = 0, baseBad = 0;
const algFail: string[] = [];
for (const c of f2l.cases) {
  for (const row of c.algs?.[0] ?? []) {
    // 对照组:原始 setup+alg 本来就该做完 F2L
    let base: boolean;
    try { base = f2lDone(`${c.setup} ${row.alg}`); } catch { base = false; }
    if (!base) { baseBad++; continue; }  // 库里本来就不成立的条目不算镜像的账
    for (const [label, f] of [['LR', mirrorLR], ['FB', mirrorFB], ['y2', rotY2]] as const) {
      let ok: boolean;
      try { ok = f2lDone(`${f(c.setup)} ${f(row.alg)}`); } catch { ok = false; }
      ok ? algOk++ : algBad++;
      if (!ok && algFail.length < 8) algFail.push(`${c.name} [${label}] "${row.alg}"`);
    }
  }
}
console.log(`\n对照组:原始 setup+alg 做完 F2L —— 不成立 ${baseBad} 条(已排除,不计入下行)`);
console.log(`镜像重写后仍做完 F2L:${algOk} 条通过,${algBad} 条失败`);
if (algFail.length) { console.log('  失败样本:'); algFail.forEach((f) => console.log('    ' + f)); }

// ── 含 F / B 层的分布(决定哪些公式能无脑补 3 个镜像) ──
let noFB = 0, hasF = 0, hasB = 0;
for (const c of f2l.cases) for (const row of c.algs?.[0] ?? []) {
  const t = row.alg;
  const f = /[fF]/.test(t.replace(/[^A-Za-z]/g, '')), b = /[bB]/.test(t.replace(/[^A-Za-z]/g, ''));
  if (b) hasB++; else if (f) hasF++; else noFB++;
}
console.log(`\n公式分布:不含 F/B(可补 3 个镜像)${noFB} 条;含 F 不含 B(只补左右镜)${hasF} 条;含 B(可补 3 个)${hasB} 条`);
