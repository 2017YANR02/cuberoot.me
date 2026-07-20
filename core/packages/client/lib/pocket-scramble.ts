/**
 * WCA 二阶打乱生成器 —— 忠实移植 TNoodle 的 TwoByTwoCubePuzzle / TwoByTwoSolver
 * (tnoodle-lib/scrambles/.../TwoByTwoSolver.java,GPL,© WCA)。
 *
 * WCA 官方做法:取一个均匀随机状态,枚举其**恰好 11 步**的全部解(仅剪「剩余步数不够解」+
 * 「连续同面」),在这些等价打乱里挑 computeCost(手感代价)最小的一条输出。所以赛场二阶打乱
 * 恒 11 步、且被握位模型优化过 —— cubing.js 那条(WASM twips + U/F/L/R,会吐 L)并非 WCA 行为。
 *
 * 状态模型与 lib/cube222-metric 一致(固定 DBL 角,U/R/F 九招);代价与 lib/pocket-cost 同源
 * (这里对解序用上游递归 computeCost,与 pocketCost 差一个恒定常数,不影响 argmin)。
 */
import { POCKET_COSTS } from './pocket-cost';

const N_PERM = 5040;
const N_ORIENT = 729;
const N_MOVES = 9;
const SCRAMBLE_LEN = 11; // TWO_BY_TWO_MIN_SCRAMBLE_LENGTH

// 招式模型(moveToString 序 0..8);与 cube222-metric 的 HTM 一致。打乱 = 解序取逆,故只用 INV_NAME。
const INV_NAME = ["U'", 'U2', 'U', "R'", 'R2', 'R', "F'", 'F2', 'F']; // inverseMoveToString

type Perm = { p: number[]; o: number[] };
const U: Perm = { p: [3, 0, 1, 2, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] };
const R: Perm = { p: [4, 1, 2, 0, 7, 5, 6, 3], o: [2, 0, 0, 1, 1, 0, 0, 2] };
const F: Perm = { p: [1, 5, 2, 3, 0, 4, 6, 7], o: [1, 2, 0, 0, 2, 1, 0, 0] };
const compose = (a: Perm, b: Perm): Perm => {
  const p = new Array(8), o = new Array(8);
  for (let i = 0; i < 8; i++) { p[i] = a.p[b.p[i]]; o[i] = (a.o[b.p[i]] + b.o[i]) % 3; }
  return { p, o };
};
const powMove = (m: Perm, n: number): Perm => { let r: Perm = { p: [0, 1, 2, 3, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] }; for (let k = 0; k < n; k++) r = compose(r, m); return r; };
const ELEMS: Perm[] = [powMove(U, 1), powMove(U, 2), powMove(U, 3), powMove(R, 1), powMove(R, 2), powMove(R, 3), powMove(F, 1), powMove(F, 2), powMove(F, 3)];

const FREE = [0, 1, 2, 3, 4, 5, 7];
const PMAP = new Int8Array(8); { let k = 0; for (const p of FREE) PMAP[p] = k++; }
const FACT = [1, 1, 2, 6, 24, 120, 720];
const permRank = (cp: Int8Array): number => {
  const a = new Int8Array(7);
  for (let i = 0; i < 7; i++) a[i] = PMAP[cp[FREE[i]]];
  let r = 0;
  for (let i = 0; i < 7; i++) { let s = a[i]; for (let j = 0; j < i; j++) if (a[j] < a[i]) s--; r += s * FACT[6 - i]; }
  return r;
};
const oriRank = (co: Int8Array): number => { let r = 0; for (let i = 0; i < 6; i++) r = r * 3 + co[FREE[i]]; return r; };
const unrankPerm = (r: number): Int8Array => {
  const cp = new Int8Array(8); cp[6] = 6;
  const av = [0, 1, 2, 3, 4, 5, 6];
  for (let i = 0; i < 7; i++) { const f = FACT[6 - i]; const s = Math.floor(r / f); r %= f; cp[FREE[i]] = FREE[av[s]]; av.splice(s, 1); }
  return cp;
};
const unrankOri = (r: number): Int8Array => {
  const co = new Int8Array(8); let sum = 0;
  for (let i = 5; i >= 0; i--) { const t = r % 3; r = (r - t) / 3; co[FREE[i]] = t; sum += t; }
  co[7] = (3 - (sum % 3)) % 3;
  return co;
};
const applyMove = (cp: Int8Array, co: Int8Array, m: Perm): [Int8Array, Int8Array] => {
  const ncp = new Int8Array(8), nco = new Int8Array(8);
  for (let i = 0; i < 8; i++) { ncp[i] = cp[m.p[i]]; nco[i] = (co[m.p[i]] + m.o[i]) % 3; }
  return [ncp, nco];
};

// ── 移动表 + 剪枝表(模块加载时一次性建;~5040+729 项,毫秒级)──
const permMove = new Int16Array(N_PERM * N_MOVES);
const oriMove = new Int16Array(N_ORIENT * N_MOVES);
const prunPerm = new Uint8Array(N_PERM).fill(255);
const prunOrient = new Uint8Array(N_ORIENT).fill(255);
let inited = false;
function init(): void {
  if (inited) return;
  for (let p = 0; p < N_PERM; p++) {
    const cp = unrankPerm(p), co = new Int8Array(8);
    for (let m = 0; m < N_MOVES; m++) permMove[p * N_MOVES + m] = permRank(applyMove(cp, co, ELEMS[m])[0]);
  }
  for (let o = 0; o < N_ORIENT; o++) {
    const cp = Int8Array.from([0, 1, 2, 3, 4, 5, 6, 7]), co = unrankOri(o);
    for (let m = 0; m < N_MOVES; m++) oriMove[o * N_MOVES + m] = oriRank(applyMove(cp, co, ELEMS[m])[1]);
  }
  // BFS 剪枝表(perm / orient 各自独立坐标)
  const bfs = (dist: Uint8Array, size: number, move: Int16Array): void => {
    dist[0] = 0;
    for (let len = 0, done = 1; done < size; len++) {
      for (let s = 0; s < size; s++) if (dist[s] === len) for (let m = 0; m < N_MOVES; m++) { const ns = move[s * N_MOVES + m]; if (dist[ns] === 255) { dist[ns] = len + 1; done++; } }
    }
  };
  bfs(prunPerm, N_PERM, permMove);
  bfs(prunOrient, N_ORIENT, oriMove);
  inited = true;
}

// 解序(code 0..8)执行其逆(= 打乱)的手感代价。等价于 TwoByTwoSolver.computeCost,但用 3 握位
// 前向 DP(O(len))替掉上游 O(2^len) 递归 —— 每态要给上百条 11 步解打分,递归会是热点。上游按
// index=len..0 顺序处理、grip 从 0 起手(phantom 的 +U3 是常数,对 argmin 无影响,这里略去)。
const C = POCKET_COSTS;
const INF = Infinity;
const dpA = new Float64Array(3);
const dpB = new Float64Array(3);
/** 从 grip 执行 case=code 的 (代价, 目标grip) 候选;与 TwoByTwoSolver.computeCost 各 case 一致。 */
function stepCost(dp: Float64Array, nd: Float64Array, code: number): void {
  nd[0] = INF; nd[1] = INF; nd[2] = INF;
  for (let gi = 0; gi < 3; gi++) {
    const base = dp[gi];
    if (base === INF) continue;
    const grip = gi - 1;
    const relax = (cost: number, ng: number): void => { const v = base + cost; const k = ng + 1; if (v < nd[k]) nd[k] = v; };
    switch (code) {
      case 0: relax(C.U3, grip); break;
      case 1: relax(C.U2, grip); break;
      case 2:
        if (grip === 0) relax(C.U, 0);
        else if (grip === -1) { relax(C.regrip + C.U, 0); relax(C.Ulow, -1); }
        else relax(C.regrip + C.U, 0);
        break;
      case 3: if (grip > -1) relax(C.R3, grip - 1); else relax(C.regrip + C.R3, -1); break;
      case 4: if (grip !== 0) relax(C.R2, -grip); else { relax(C.regrip + C.R2, -1); relax(C.regrip + C.R2, 1); } break;
      case 5: if (grip < 1) relax(C.R, grip + 1); else relax(C.regrip + C.R, 1); break;
      case 6: if (grip !== 0) relax(C.F3, grip); else { relax(C.regrip + C.F3, -1); relax(C.regrip + C.F3, 1); } break;
      case 7: if (grip === -1) relax(C.F2, -1); else relax(C.regrip + C.F2, -1); break;
      case 8: if (grip === -1) relax(C.F, -1); else relax(C.regrip + C.F, -1); break;
    }
  }
}
function computeCost(sol: ArrayLike<number>, len: number): number {
  // grip 从 0 起手;上游 index=len..0 顺序 = 这里 i=len-1..0。双缓冲避免每次分配。
  let cur = dpA, nxt = dpB;
  cur[0] = INF; cur[1] = 0; cur[2] = INF;
  for (let i = len - 1; i >= 0; i--) { stepCost(cur, nxt, sol[i]); const tmp = cur; cur = nxt; nxt = tmp; }
  return Math.min(cur[0], cur[1], cur[2]);
}

// QTM 代价:半转(U2/R2/F2 = code 1/4/7)计 2,四分之一转计 1。
const QCOST = [1, 2, 1, 1, 2, 1, 1, 2, 1];
function qtmOf(sol: ArrayLike<number>, len: number): number { let q = 0; for (let i = 0; i < len; i++) q += QCOST[sol[i]]; return q; }

const bestSol = new Int8Array(SCRAMBLE_LEN);
const curSol = new Int8Array(SCRAMBLE_LEN);
let bestCost = Infinity;
let bestQtm = Infinity;
let tieByQtm = false; // true = 先按 QTM 最小(Q|H)再按握位代价;false = 只按握位代价(WCA 口径)

/**
 * DFS:从 (perm,orient) 用恰好 length 步到还原态,对每个解按当前口径取最优。
 * WCA 口径(tieByQtm=false):所有 length 步解里握位代价最小(= TNoodle generateExactly)。
 * 最优口径(tieByQtm=true):length=最优长度时,先 QTM 最小(Q|H),再握位代价最小。
 */
function search(perm: number, orient: number, depth: number, length: number, lastMove: number): void {
  if (length === 0) {
    if (perm === 0 && orient === 0) {
      const cost = computeCost(curSol, depth);
      const better = tieByQtm
        ? (() => { const q = qtmOf(curSol, depth); return q < bestQtm || (q === bestQtm && cost < bestCost) ? q : -1; })()
        : (cost < bestCost ? 0 : -1);
      if (better !== -1) { bestCost = cost; if (tieByQtm) bestQtm = better; bestSol.set(curSol); }
    }
    return;
  }
  if (prunPerm[perm] > length || prunOrient[orient] > length) return;
  for (let m = 0; m < N_MOVES; m++) {
    if ((m / 3 | 0) === (lastMove / 3 | 0)) continue; // 同面跳过
    curSol[depth] = m;
    search(permMove[perm * N_MOVES + m], oriMove[orient * N_MOVES + m], depth + 1, length - 1, m);
  }
}

/** 早退 IDA:该状态是否存在恰好 length 步的解(不枚举全部,找到即返回)。 */
function solvableIn(perm: number, orient: number, length: number, lastMove: number): boolean {
  if (length === 0) return perm === 0 && orient === 0;
  if (prunPerm[perm] > length || prunOrient[orient] > length) return false;
  for (let m = 0; m < N_MOVES; m++) {
    if ((m / 3 | 0) === (lastMove / 3 | 0)) continue;
    if (solvableIn(permMove[perm * N_MOVES + m], oriMove[orient * N_MOVES + m], length - 1, m)) return true;
  }
  return false;
}

/** 该状态的 HTM 最优长度(从剪枝下界起逐层试第一条解)。 */
function optimalLen(perm: number, orient: number): number {
  let len = Math.max(prunPerm[perm], prunOrient[orient]); // 有效下界
  while (!solvableIn(perm, orient, len, 42)) len++;
  return len;
}

/** 把解序(code)转成打乱串(逆序 + 逐招取逆)。 */
function solutionToScramble(sol: Int8Array, len: number): string {
  const out: string[] = [];
  for (let i = len - 1; i >= 0; i--) out.push(INV_NAME[sol[i]]);
  return out.join(' ');
}

function randState(rng: () => number): [number, number] {
  return [Math.floor(rng() * N_PERM), Math.floor(rng() * N_ORIENT)];
}

/**
 * WCA 规范二阶打乱:恰好 11 步、只含 U/R/F、握位代价最小(TNoodle generateExactly 口径)。
 * @param rng 0..1 随机源(默认 Math.random),便于测试可复现。
 */
export function wcaPocketScramble(rng: () => number = Math.random): string {
  init();
  const [perm, orient] = randState(rng);
  bestCost = Infinity; bestQtm = Infinity; tieByQtm = false;
  search(perm, orient, 0, SCRAMBLE_LEN, 42); // lastMove=42:首步不受同面约束
  return solutionToScramble(bestSol, SCRAMBLE_LEN);
}

/**
 * 最优二阶打乱:HTM 最短长度,同长解里先取 QTM 最小(Q|H),再取握位代价最小(TNoodle)。
 * 比 WCA 的 11 步短(均 ~8.8 步),记号同样只含 U/R/F。
 */
export function optimalPocketScramble(rng: () => number = Math.random): string {
  init();
  const [perm, orient] = randState(rng);
  const len = optimalLen(perm, orient);
  if (len === 0) return optimalPocketScramble(rng); // 还原态极罕见,重抽
  bestCost = Infinity; bestQtm = Infinity; tieByQtm = true;
  search(perm, orient, 0, len, 42);
  return solutionToScramble(bestSol, len);
}
