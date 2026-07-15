// 一次性实证:三个「固定 *」子问题是不是全空间的等变商(纤维恒定)?
// 整除性只是必要条件,这里直接暴力枚举全部 3,674,160 个状态验充分性:
//   1. 每个子状态的原像个数是否**全部相等**(纤维恒定)
//   2. 子问题直方图 × 纤维 是否**逐格等于**全空间直方图(即百分比逐格相同 —— 这是要印到 UI 上的那句话)
// 模型与 scripts/build_2x2_essential.mjs 完全一致(URF=0..DRB=7,DBL=6 固定,只转 U/R/F)。
const N = 3674160;

const ID = { p: [0, 1, 2, 3, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] };
function P(a, b) {
  const p = new Array(8), o = new Array(8);
  for (let i = 0; i < 8; i++) { p[i] = a.p[b.p[i]]; o[i] = (a.o[b.p[i]] + b.o[i]) % 3; }
  return { p, o };
}
function pw(m, n) { let r = ID; for (let i = 0; i < n; i++) r = P(r, m); return r; }
const MOVES = {
  U: { p: [3, 0, 1, 2, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] },
  R: { p: [4, 1, 2, 0, 7, 5, 6, 3], o: [2, 0, 0, 1, 1, 0, 0, 2] },
  F: { p: [1, 5, 2, 3, 0, 4, 6, 7], o: [1, 2, 0, 0, 2, 1, 0, 0] },
};
const MOVE_ELEMS = [pw(MOVES.U, 1), pw(MOVES.U, 2), pw(MOVES.U, 3),
                    pw(MOVES.R, 1), pw(MOVES.R, 2), pw(MOVES.R, 3),
                    pw(MOVES.F, 1), pw(MOVES.F, 2), pw(MOVES.F, 3)];

const FREE = [0, 1, 2, 3, 4, 5, 7];
const FACT = [1, 1, 2, 6, 24, 120, 720];
const INVP = [0, 1, 2, 3, 4, 5, 7];
function decode(idx) {
  const pr = Math.floor(idx / 729); let orr = idx % 729;
  const co = new Array(8).fill(0);
  for (let i = 5; i >= 0; i--) { co[FREE[i]] = orr % 3; orr = Math.floor(orr / 3); }
  let s = 0; for (let i = 0; i < 6; i++) s += co[FREE[i]]; co[FREE[6]] = ((3 - (s % 3)) % 3); co[6] = 0;
  let r = pr; const digits = new Array(7);
  for (let i = 0; i < 7; i++) { const f = FACT[6 - i]; digits[i] = Math.floor(r / f); r %= f; }
  const avail = [0, 1, 2, 3, 4, 5, 6]; const a = new Array(7);
  for (let i = 0; i < 7; i++) { a[i] = avail[digits[i]]; avail.splice(digits[i], 1); }
  const cp = new Array(8); cp[6] = 6;
  for (let i = 0; i < 7; i++) cp[FREE[i]] = INVP[a[i]];
  return { p: cp, o: co };
}

// ---- 子问题 BFS(与 build_2x2_essential.mjs 的 fixedBFS 逐行同构)----
const HTM_INV = MOVE_ELEMS.map(m => { const iv = new Int8Array(8); for (let i = 0; i < 8; i++) iv[m.p[i]] = i; return iv; });
function fixedBFS(tracked, ordered) {
  const keyOf = (st) => { const arr = st.map(x => x[0] * 3 + x[1]); if (ordered) return arr.join(','); return arr.sort((a, b) => a - b).join(','); };
  const startSt = tracked.map(p => [p, 0]);
  const dist = new Map(); dist.set(keyOf(startSt), 0);
  let fr = [startSt], d = 0; const h = { 0: 1 };
  while (fr.length) {
    const nx = [];
    for (const st of fr) for (let m = 0; m < 9; m++) {
      const iv = HTM_INV[m], mo = MOVE_ELEMS[m].o;
      const nst = st.map(([s, o]) => { const t = iv[s]; return [t, (o + mo[t]) % 3]; });
      const k = keyOf(nst);
      if (!dist.has(k)) { dist.set(k, d + 1); h[d + 1] = (h[d + 1] || 0) + 1; nx.push(nst); }
    }
    fr = nx; d++;
  }
  return { h, dist, total: dist.size };
}

// ---- 全空间投影:对每个完整状态求其子状态 key ----
// g.p[slot] = 该槽位上的角块;故角块 p 所在槽位 s 满足 g.p[s] === p,其朝向 = g.o[s]。
function projKey(g, tracked, ordered) {
  const arr = [];
  for (const piece of tracked) {
    let s = -1;
    for (let i = 0; i < 8; i++) if (g.p[i] === piece) { s = i; break; }
    arr.push(s * 3 + g.o[s]);
  }
  if (!ordered) arr.sort((a, b) => a - b);
  return arr.join(',');
}

const GROUPS = [
  { name: 'Fixed 2 corners (固定 两角块)', tracked: [1, 2], ordered: true },
  { name: 'Fixed FF (固定底面)', tracked: [4, 5, 7], ordered: false },
  { name: 'Fixed FL (固定首层)', tracked: [4, 5, 7], ordered: true },
];

let allOk = true;
for (const G of GROUPS) {
  const sub = fixedBFS(G.tracked, G.ordered);
  const fiber = new Map();      // 子状态 key -> 原像个数
  const fullHist = {};          // 全空间上该子目标距离的直方图
  for (let idx = 0; idx < N; idx++) {
    const g = decode(idx);
    const k = projKey(g, G.tracked, G.ordered);
    fiber.set(k, (fiber.get(k) || 0) + 1);
    const d = sub.dist.get(k);
    if (d === undefined) { console.log(`FAIL ${G.name}: 状态 ${idx} 投影出的子状态不在 BFS 可达集里`); allOk = false; break; }
    fullHist[d] = (fullHist[d] || 0) + 1;
  }

  const sizes = [...fiber.values()];
  const min = Math.min(...sizes), max = Math.max(...sizes);
  const constFiber = min === max;
  const expect = N / sub.total;
  const keyCountOk = fiber.size === sub.total;

  console.log(`\n=== ${G.name} ===`);
  console.log(`  子状态数        : BFS ${sub.total} / 投影所见 ${fiber.size}  ${keyCountOk ? 'OK' : 'DIFF'}`);
  console.log(`  纤维大小        : min ${min} max ${max}  ${constFiber ? 'OK 恒定' : 'DIFF 不恒定!'}`);
  console.log(`  纤维 == N/|Y|   : ${min} vs ${expect}  ${min === expect ? 'OK' : 'DIFF'}`);

  // 逐格核对:子问题直方图 × 纤维 === 全空间直方图,且百分比逐格相同
  let gridOk = true;
  const ms = [...new Set([...Object.keys(sub.h), ...Object.keys(fullHist)])].map(Number).sort((a, b) => a - b);
  for (const m of ms) {
    const subC = sub.h[m] || 0, fullC = fullHist[m] || 0;
    if (subC * min !== fullC) { gridOk = false; console.log(`  DIFF m=${m}: 子 ${subC} × ${min} = ${subC * min} ≠ 全 ${fullC}`); }
  }
  console.log(`  子直方图×纤维 == 全空间直方图 (逐格)  ${gridOk ? 'OK' : 'DIFF'}`);
  const pctSame = ms.every(m => Math.abs((sub.h[m] || 0) / sub.total - (fullHist[m] || 0) / N) < 1e-15);
  console.log(`  百分比逐格相同  ${pctSame ? 'OK' : 'DIFF'}`);

  if (!(keyCountOk && constFiber && min === expect && gridOk && pctSame)) allOk = false;
}
console.log(`\n${allOk ? 'ALL OK — 三个子问题均为等变商,纤维恒定,可安全在 UI 上印纤维常数' : 'FAILED — 不可印'}`);
