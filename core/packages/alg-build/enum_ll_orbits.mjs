/**
 * Phase 0 / A6 —— 独立枚举 LL 态的全部 (前 AUF × 后 AUF) 轨道,做 join 的 ground truth。
 *
 * 定义:
 *   LL 态 = F2L 已还原、只有顶层(4 角 + 4 棱)乱的态。
 *   case  = 态在 S ~ U^p · S · U^q (p,q ∈ {0..3}) 下的轨道。
 *
 * 本文件:
 *   1. 实测顶层槽位下标(不写死)
 *   2. 纯数组穷举 62208 个 LL 态(不 BFS)
 *   3. 自己实现群复合(compose = "先 a 后 b"),并用 cubing.js 交叉验证
 *   4. 算轨道 / 朝向类,落盘 .tmp/phase0/ll_orbits.json
 *
 *   node enum_ll_orbits.mjs [--solve-check N]
 *
 * fingerprint 格式(16 字符,可直接当 orbitKey 用):
 *   cp[0..3] (4 位) + co[0..3] (4 位) + ep[0..3] (4 位) + eo[0..3] (4 位)
 *   下标 = 顶层槽位(见 TOP_CORNERS / TOP_EDGES,实测均为 [0,1,2,3]);
 *   cp/ep 的值 = 该槽里是哪块(顶层块编号 0..3);co ∈ 0..2;eo ∈ 0..1。
 *   orbitKey = 该态 16 个 U^p·X·U^q 像的 fingerprint 的字典序最小者。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { KPattern, KTransformation } from 'cubing/kpuzzle';

const OUT_DIR = 'D:/cube/cuberoot.me/.tmp/phase0';
const report = [];
const log = (...a) => { const s = a.join(' '); report.push(s); console.log(s); };

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

/* ─────────────────── 1. 实测顶层槽位 ─────────────────── */
const uPat = SOLVED.applyMove('U');
const TOP_CORNERS = [], TOP_EDGES = [];
for (let i = 0; i < 8; i++)
  if (uPat.patternData.CORNERS.pieces[i] !== SOLVED.patternData.CORNERS.pieces[i] ||
      uPat.patternData.CORNERS.orientation[i] !== SOLVED.patternData.CORNERS.orientation[i]) TOP_CORNERS.push(i);
for (let i = 0; i < 12; i++)
  if (uPat.patternData.EDGES.pieces[i] !== SOLVED.patternData.EDGES.pieces[i] ||
      uPat.patternData.EDGES.orientation[i] !== SOLVED.patternData.EDGES.orientation[i]) TOP_EDGES.push(i);
log(`[1] 实测顶层 CORNERS 槽位 = [${TOP_CORNERS}], EDGES 槽位 = [${TOP_EDGES}]`);

const uT = kpuzzle.moveToTransformation('U').transformationData;
log(`[1] U 变换: CORNERS.perm=[${uT.CORNERS.permutation}] oriDelta=[${uT.CORNERS.orientationDelta}]`);
log(`[1] U 变换: EDGES.perm=[${uT.EDGES.permutation}] oriDelta=[${uT.EDGES.orientationDelta}]`);

/* ─────────────────── 2. 自己的复合(纯数组) ───────────────────
 * 约定(与 cubing.js 一致,已实测):transformation/pattern 的 p[i] = 槽 i 里是哪块。
 * compose(a, b) = "先做 a 再做 b" ⇒  p[i] = a.p[b.p[i]],  o[i] = a.o[b.p[i]] + b.o[i]  (mod n)
 * 于是 U^p · X · U^q (alg 顺序:先 U^p,再 S,再 U^q) = compose(compose(Up, X), Uq)。
 */
function composeFull(a, b, n, N) {
  const p = new Array(N), o = new Array(N);
  for (let i = 0; i < N; i++) { const j = b.p[i]; p[i] = a.p[j]; o[i] = (a.o[j] + b.o[i]) % n; }
  return { p, o };
}
/** cubing.js 的 transformationData → 我的 {C:{p,o}, E:{p,o}} */
const fromTD = (td) => ({
  C: { p: [...td.CORNERS.permutation], o: [...td.CORNERS.orientationDelta] },
  E: { p: [...td.EDGES.permutation], o: [...td.EDGES.orientationDelta] },
});
const fromPattern = (pat) => ({
  C: { p: [...pat.patternData.CORNERS.pieces], o: [...pat.patternData.CORNERS.orientation] },
  E: { p: [...pat.patternData.EDGES.pieces], o: [...pat.patternData.EDGES.orientation] },
});
const composeState = (a, b) => ({
  C: composeFull(a.C, b.C, 3, 8),
  E: composeFull(a.E, b.E, 2, 12),
});
const eqState = (a, b) =>
  a.C.p.join() === b.C.p.join() && a.C.o.join() === b.C.o.join() &&
  a.E.p.join() === b.E.p.join() && a.E.o.join() === b.E.o.join();

/* ── 交叉验证 A:compose 与 cubing.js 一致(随机 alg,全 8/12 槽) ── */
const MOVES = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'B', "B'", 'B2'];
const randAlg = (n) => Array.from({ length: n }, () => MOVES[(Math.random() * MOVES.length) | 0]).join(' ');
let okCompose = 0, badCompose = 0;
for (let t = 0; t < 200; t++) {
  const s = randAlg(2 + ((Math.random() * 12) | 0));
  const moves = s.split(' ');
  let acc = fromTD(kpuzzle.identityTransformation().transformationData);
  for (const m of moves) acc = composeState(acc, fromTD(kpuzzle.moveToTransformation(m).transformationData));
  const oracle = fromPattern(SOLVED.applyAlg(new Alg(s)));
  eqState(acc, oracle) ? okCompose++ : badCompose++;
}
log(`[3a] compose 交叉验证(200 条随机 alg,逐步复合 vs cubing.js applyAlg): ok=${okCompose} bad=${badCompose}`);

/* ── 交叉验证 B:左乘  leftMul(U, patternOf(S)) == patternOf("U " + S) ── */
const U_FULL = fromTD(kpuzzle.moveToTransformation('U').transformationData);
let okLeft = 0, badLeft = 0;
const leftSamples = [];
for (let t = 0; t < 100; t++) {
  const s = t === 0 ? "R U R' U R U2' R'" : t === 1 ? "R U R' F' R U R' U' R' F R2 U' R'" : randAlg(3 + ((Math.random() * 10) | 0));
  const mine = composeState(U_FULL, fromPattern(SOLVED.applyAlg(new Alg(s))));   // U · X  (左乘)
  const oracle = fromPattern(SOLVED.applyAlg(new Alg('U ' + s)));
  const ok = eqState(mine, oracle);
  ok ? okLeft++ : badLeft++;
  if (t < 2) leftSamples.push(`   S="${s}" → ${ok ? 'OK' : 'MISMATCH'}`);
}
log(`[3b] 左乘验证 leftMul(U, patternOf(S)) == patternOf("U "+S) (100 条,含 Sune / T-perm): ok=${okLeft} bad=${badLeft}`);
leftSamples.forEach((l) => log(l));
// 顺带验证 4×4 全部 (p,q):U^p · X · U^q
let okPQ = 0, badPQ = 0;
const UP = ['', 'U', 'U2', "U'"];
for (let t = 0; t < 20; t++) {
  const s = randAlg(6);
  const X = fromPattern(SOLVED.applyAlg(new Alg(s)));
  for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) {
    let up = fromTD(kpuzzle.identityTransformation().transformationData);
    let uq = up;
    for (let k = 0; k < p; k++) up = composeState(up, U_FULL);
    for (let k = 0; k < q; k++) uq = composeState(uq, U_FULL);
    const mine = composeState(composeState(up, X), uq);
    const oracle = fromPattern(SOLVED.applyAlg(new Alg(`${UP[p]} ${s} ${UP[q]}`)));
    eqState(mine, oracle) ? okPQ++ : badPQ++;
  }
}
log(`[3c] 全 16 个 (p,q) 的 U^p·X·U^q 验证(20 条 alg × 16): ok=${okPQ} bad=${badPQ}`);

/* ─────────────────── 3. 穷举 LL 态(reduced:只存顶层 4+4) ───────────────────
 * reduced 态 = { cp[4], co[4], ep[4], eo[4] },cp/ep 值域 0..3(顶层块编号即槽位编号)。
 * 因为 U 只作用在顶层,且底层恒等,U^p·X·U^q 在 reduced 表示下闭合。
 */
const perms4 = [];
(function permute(arr, cur) {
  if (!arr.length) { perms4.push(cur.slice()); return; }
  for (let i = 0; i < arr.length; i++) permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, arr[i]]);
})([0, 1, 2, 3], []);
const parity = (p) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (p[i] > p[j]) s ^= 1; return s; };

const cOris = [];
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
  const d = (3 - ((a + b + c) % 3)) % 3; cOris.push([a, b, c, d]);
}
const eOris = [];
for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) eOris.push([a, b, c, (a + b + c) % 2]);
log(`[2] 角朝向组合(和≡0 mod 3): ${cOris.length}  棱朝向组合(和≡0 mod 2): ${eOris.length}  4! = ${perms4.length}`);
log(`[2] 算术: 4!·3³·4!·2³ / 2 = ${(24 * 27 * 24 * 8) / 2}`);

const states = [];   // 每个 = Uint8Array(16): cp0..3, co0..3, ep0..3, eo0..3
for (const cp of perms4) {
  const pc = parity(cp);
  for (const ep of perms4) {
    if (parity(ep) !== pc) continue;             // 奇偶约束
    for (const co of cOris) for (const eo of eOris) {
      states.push(Uint8Array.from([...cp, ...co, ...ep, ...eo]));
    }
  }
}
log(`[2] 实测构造出的 LL 态总数 = ${states.length}`);

/* reduced 复合:U 在 reduced 上 = perm [1,2,3,0], ori delta 全 0 */
const RU = { p: [1, 2, 3, 0], o: [0, 0, 0, 0] };
const RID = { p: [0, 1, 2, 3], o: [0, 0, 0, 0] };
const RUP = [RID];   // U^0..U^3 的 reduced 变换
for (let k = 1; k < 4; k++) RUP.push(composeFull(RUP[k - 1], RU, 3, 4));   // ori 全 0,mod 无所谓

/** st: Uint8Array(16); 返回 U^p · st · U^q 的 Uint8Array(16) */
function conj(st, p, q) {
  const up = RUP[p], uq = RUP[q];
  const out = new Uint8Array(16);
  // X' = up · st :  cp'[i] = up.p[ st.cp[i] ], co'[i] = up.o[st.cp[i]] + st.co[i]  (up.o = 0)
  const cp1 = new Uint8Array(4), co1 = new Uint8Array(4), ep1 = new Uint8Array(4), eo1 = new Uint8Array(4);
  for (let i = 0; i < 4; i++) { cp1[i] = up.p[st[i]]; co1[i] = st[4 + i]; ep1[i] = up.p[st[8 + i]]; eo1[i] = st[12 + i]; }
  // X'' = X' · uq :  cp''[i] = cp1[ uq.p[i] ], co''[i] = co1[ uq.p[i] ]
  for (let i = 0; i < 4; i++) {
    const j = uq.p[i];
    out[i] = cp1[j]; out[4 + i] = co1[j]; out[8 + i] = ep1[j]; out[12 + i] = eo1[j];
  }
  return out;
}
const fp = (st) => { let s = ''; for (let i = 0; i < 16; i++) s += st[i]; return s; };

/* ── 交叉验证 C:reduced conj 与 cubing.js 的 KPattern/KTransformation 一致(≥100 个态) ── */
function toKPattern(st) {
  const cPieces = [...Array(8).keys()], cOri = new Array(8).fill(0);
  const ePieces = [...Array(12).keys()], eOri = new Array(12).fill(0);
  for (let i = 0; i < 4; i++) {
    cPieces[TOP_CORNERS[i]] = TOP_CORNERS[st[i]];      cOri[TOP_CORNERS[i]] = st[4 + i];
    ePieces[TOP_EDGES[i]] = TOP_EDGES[st[8 + i]];      eOri[TOP_EDGES[i]] = st[12 + i];
  }
  return new KPattern(kpuzzle, {
    EDGES: { pieces: ePieces, orientation: eOri },
    CORNERS: { pieces: cPieces, orientation: cOri },
    CENTERS: { pieces: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0] },
  });
}
function reduceKPattern(pat) {
  const d = pat.patternData, out = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    out[i] = TOP_CORNERS.indexOf(d.CORNERS.pieces[TOP_CORNERS[i]]);   out[4 + i] = d.CORNERS.orientation[TOP_CORNERS[i]];
    out[8 + i] = TOP_EDGES.indexOf(d.EDGES.pieces[TOP_EDGES[i]]);     out[12 + i] = d.EDGES.orientation[TOP_EDGES[i]];
  }
  return out;
}
const uTrans = kpuzzle.moveToTransformation('U');
let okX = 0, badX = 0;
for (let t = 0; t < 150; t++) {
  const st = states[(Math.random() * states.length) | 0];
  const p = (Math.random() * 4) | 0, q = (Math.random() * 4) | 0;
  // cubing.js 侧:X 的 pattern → 转成 transformation → U^p · X · U^q(KTransformation 复合)
  const pat = toKPattern(st);
  let T = new KTransformation(kpuzzle, {
    EDGES: { permutation: pat.patternData.EDGES.pieces, orientationDelta: pat.patternData.EDGES.orientation },
    CORNERS: { permutation: pat.patternData.CORNERS.pieces, orientationDelta: pat.patternData.CORNERS.orientation },
    CENTERS: { permutation: pat.patternData.CENTERS.pieces, orientationDelta: pat.patternData.CENTERS.orientation },
  });
  let L = kpuzzle.identityTransformation();
  for (let k = 0; k < p; k++) L = L.applyTransformation(uTrans);   // U^p
  let R = kpuzzle.identityTransformation();
  for (let k = 0; k < q; k++) R = R.applyTransformation(uTrans);   // U^q
  const oracleT = L.applyTransformation(T).applyTransformation(R); // U^p · X · U^q(alg 顺序)
  const oraclePat = SOLVED.applyTransformation(oracleT);
  const mineFp = fp(conj(st, p, q));
  const oracleFp = fp(reduceKPattern(oraclePat));
  mineFp === oracleFp ? okX++ : badX++;
}
log(`[3d] reduced conj 与 cubing.js KTransformation 复合的 fingerprint 交叉验证(150 个随机态×随机 (p,q)): ok=${okX} bad=${badX}`);

/* ── 可解性抽查:用 cubing.js 求解器解 N 个构造出来的态 ── */
const solveN = (() => { const i = process.argv.indexOf('--solve-check'); return i > 0 ? +process.argv[i + 1] : 5; })();
let solveOk = 0, solveFail = 0, solveNote = '';
try {
  const { experimentalSolve3x3x3IgnoringCenters } = await import('cubing/search');
  for (let t = 0; t < solveN; t++) {
    const st = states[(Math.random() * states.length) | 0];
    const pat = toKPattern(st);
    const sol = await experimentalSolve3x3x3IgnoringCenters(pat);
    const after = pat.applyAlg(sol);
    const d = after.patternData;
    let solved = true;
    for (let i = 0; i < 8; i++) if (d.CORNERS.pieces[i] !== i || d.CORNERS.orientation[i] !== 0) solved = false;
    for (let i = 0; i < 12; i++) if (d.EDGES.pieces[i] !== i || d.EDGES.orientation[i] !== 0) solved = false;
    solved ? solveOk++ : solveFail++;
  }
} catch (e) {
  solveNote = `求解器不可用/异常: ${e?.message ?? e}`;
}
log(`[3e] 可解性抽查(cubing.js experimentalSolve3x3x3IgnoringCenters,${solveN} 个随机态): solved=${solveOk} fail=${solveFail} ${solveNote}`);

/* ─────────────────── 4. 轨道 ─────────────────── */
const orbitOf = new Map();          // fingerprint → orbitKey
const orbits = new Map();           // orbitKey → { size, members:Set }
for (const st of states) {
  const imgs = [];
  for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) imgs.push(fp(conj(st, p, q)));
  const key = imgs.reduce((a, b) => (b < a ? b : a));
  const self = fp(st);
  orbitOf.set(self, key);
  if (!orbits.has(key)) orbits.set(key, new Set(imgs));
}
log(`[4] 总态数 = ${states.length}  总轨道数 = ${orbits.size}`);

const sizeHist = new Map();
let sizeSum = 0;
for (const [, mem] of orbits) { sizeHist.set(mem.size, (sizeHist.get(mem.size) ?? 0) + 1); sizeSum += mem.size; }
log(`[4] 轨道大小直方图(size → 轨道数): ${[...sizeHist].sort((a, b) => b[0] - a[0]).map(([s, n]) => `${s}→${n}`).join('  ')}`);
log(`[4] Σ 轨道大小 = ${sizeSum}(应 = ${states.length},${sizeSum === states.length ? 'OK' : 'MISMATCH'})`);
// 每个态都被覆盖?
let coverOk = true;
for (const st of states) if (!orbitOf.has(fp(st))) coverOk = false;
log(`[4] 每个态都能查到 orbitKey: ${coverOk}`);

/* ─────────────────── 5. 朝向类(OLL 类) ───────────────────
 * ori 签名 = (co[0..3], eo[0..3]) 按槽位存。
 * 前 AUF(左乘 U^p)不改 ori-by-slot(下面实测),后 AUF(右乘 U^q)轮换它 ⇒ 对 4 个 AUF 归一。
 */
let preAufKeepsOri = true;
for (let t = 0; t < 500; t++) {
  const st = states[(Math.random() * states.length) | 0];
  for (let p = 1; p < 4; p++) {
    const c = conj(st, p, 0);
    for (let i = 0; i < 4; i++) if (c[4 + i] !== st[4 + i] || c[12 + i] !== st[12 + i]) preAufKeepsOri = false;
  }
}
log(`[5] 实测:前 AUF(左乘 U^p)不改「按槽位的朝向数组」= ${preAufKeepsOri}(所以朝向类只需对后 AUF 的 4 个轮换归一)`);

function oriClassKey(st) {
  let best = null;
  for (let q = 0; q < 4; q++) {
    const uq = RUP[q].p;
    let s = '';
    for (let i = 0; i < 4; i++) s += st[4 + uq[i]];
    for (let i = 0; i < 4; i++) s += st[12 + uq[i]];
    if (best === null || s < best) best = s;
  }
  return best;
}
const oriClassOfOrbit = new Map();   // orbitKey → oriClass
const classOrbits = new Map();       // oriClass → orbitKey[]
let oriConsistent = true;
for (const [key, mem] of orbits) {
  const keys = new Set([...mem].map((f) => oriClassKey(Uint8Array.from(f.split('').map(Number)))));
  if (keys.size !== 1) oriConsistent = false;
  const oc = [...keys][0];
  oriClassOfOrbit.set(key, oc);
  if (!classOrbits.has(oc)) classOrbits.set(oc, []);
  classOrbits.get(oc).push(key);
}
log(`[5] 轨道内所有态的朝向类一致: ${oriConsistent}`);
log(`[5] 朝向类总数 = ${classOrbits.size}`);

const perClassHist = new Map();
for (const [, list] of classOrbits) perClassHist.set(list.length, (perClassHist.get(list.length) ?? 0) + 1);
log(`[5] 每个朝向类里的轨道数直方图(轨道数 → 有几个朝向类): ${[...perClassHist].sort((a, b) => b[0] - a[0]).map(([n, c]) => `${n}→${c}`).join('  ')}`);
const small = [...classOrbits].filter(([, l]) => l.length < 40).map(([oc, l]) => `${oc}(co=${oc.slice(0, 4)},eo=${oc.slice(4)})→${l.length} 轨道`);
log(`[5] <40 轨道的朝向类: ${small.join(' | ')}`);
const forty = [...classOrbits].filter(([, l]) => l.length === 40).map(([oc]) => `${oc}`);
log(`[5] =40 轨道的朝向类(${forty.length} 个): ${forty.join(' ')}`);

/* ─────────────────── 6. 落盘 ─────────────────── */
mkdirSync(OUT_DIR, { recursive: true });
const classIds = new Map();
[...classOrbits.keys()].sort().forEach((oc, i) => classIds.set(oc, i));
const orbitsOut = {};
for (const [key, mem] of orbits) {
  const st = Uint8Array.from(key.split('').map(Number));
  orbitsOut[key] = {
    size: mem.size,
    oriClass: classIds.get(oriClassOfOrbit.get(key)),
    repPattern: { cp: [...st.slice(0, 4)], co: [...st.slice(4, 8)], ep: [...st.slice(8, 12)], eo: [...st.slice(12, 16)] },
  };
}
const oriClassesOut = {};
for (const [oc, list] of classOrbits) {
  oriClassesOut[classIds.get(oc)] = { oriKey: oc, co: oc.slice(0, 4).split('').map(Number), eo: oc.slice(4).split('').map(Number), orbitCount: list.length };
}
const doc = {
  meta: {
    generatedBy: 'core/packages/alg-build/enum_ll_orbits.mjs',
    generatedAt: new Date().toISOString(),
    topCornerSlots: TOP_CORNERS,
    topEdgeSlots: TOP_EDGES,
    fingerprint: 'cp[0..3] co[0..3] ep[0..3] eo[0..3] — 16 位数字串;下标=顶层槽位;cp/ep 值=顶层块号 0..3',
    orbitKey: '该态 16 个 U^p·X·U^q 像的 fingerprint 的字典序最小者',
    oriClassKey: '(co,eo) 按槽位取,对 4 个后 AUF 轮换归一后的字典序最小串(8 位)',
    totalStates: states.length,
    totalOrbits: orbits.size,
    totalOriClasses: classOrbits.size,
    orbitSizeHistogram: Object.fromEntries([...sizeHist].sort((a, b) => b[0] - a[0])),
    orbitsPerOriClassHistogram: Object.fromEntries([...perClassHist].sort((a, b) => b[0] - a[0])),
  },
  oriClasses: oriClassesOut,
  orbits: orbitsOut,
};
writeFileSync(`${OUT_DIR}/ll_orbits.json`, JSON.stringify(doc, null, 1));
writeFileSync(`${OUT_DIR}/A6_report.txt`, report.join('\n') + '\n');
log(`[6] 已写 ${OUT_DIR}/ll_orbits.json (${orbits.size} 轨道, ${classOrbits.size} 朝向类)`);
