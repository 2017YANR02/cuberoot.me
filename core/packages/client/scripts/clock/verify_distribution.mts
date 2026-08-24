/*
 * verify_distribution — 独立核验魔表(Rubik's Clock)的 God's algorithm 距离分布。
 *
 * 分布表本身取自 Jaap Scherphuis(https://www.jaapsch.net/puzzles/clock.htm),全空间
 * 12^14 = 1,283,918,464,548,864 个状态。**本脚本不引用任何现成求解器**,只用本仓库自己的
 * 招式模型(@cuberoot/puzzle-solvers/clock,语义锚在 tnoodle ClockPuzzle.java)去核验它。
 *
 * 三层证据,强度递减:
 *
 *   1) 恒等式    表格逐档求和必须 === 12^14。能抓出誊抄错(实测抓到过:从截图读的 d=4 与
 *                d=11 各错一位,和差 7)。
 *   2) 精确枚举  d ≤ maxDepth 各档的状态数,由 30 种 move type 全组合枚举 + 去重独立算出,
 *                逐档与表格 `===` 对账。默认 3(约 550 万个元组,秒级);`--depth 4` 会枚举
 *                4.01 亿个元组(约 3.3 GB 内存、数分钟),复现 317,141,342 那一档。
 *   3) 抽样      用本仓库的最优求解器解 N 个均匀随机状态,直方图与表格的理论占比比对
 *                (卡方 + 各档相对偏差),并核对均值 9.4337、上限 12。
 *
 * 全表(尤其 d ≥ 5 的那 1.28e15 个状态)**无法在本机重算** —— 那是 Kogler / Rokicki 量级的
 * 全空间 BFS。第 2 层只对低档给出严格证明,第 3 层给出对高档的统计证据。别把它写成"已证明"。
 *
 * Run: pnpm --filter @cuberoot/client verify:clock-distribution -- [--depth 3|4] [--samples 20000]
 */
import {
  CLOCK_TYPE_MASKS, clockMoveDelta, randomClockState, solveClock,
} from '@cuberoot/puzzle-solvers/clock';

/** Jaap 的 God 表:JAAP[d] = 最优步数恰为 d 的状态数。 */
const JAAP: readonly bigint[] = [
  1n, 330n, 51651n, 4947912n, 317141342n, 14054473232n, 428862722294n,
  8621633953202n, 101600180118726n, 528107928328516n, 613251601892918n,
  31893880879492n, 39248n,
];
const TOTAL = 12n ** 14n;

/** 14 个自由坐标:正面 9 盘 + 反面 5 个自有盘(反面 4 个角盘 = −正面角盘,不独立)。 */
const COORDS14 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 10, 14, 12, 16];

const arg = (name: string, dflt: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};
const MAX_DEPTH = Math.min(4, Math.max(1, arg('depth', 3)));
const SAMPLES = arg('samples', 20000);

const fmt = (n: bigint | number) => n.toLocaleString('en-US');
const ok = (b: boolean) => (b ? '✓' : '✗ MISMATCH');

// ─── 1) 恒等式 ───────────────────────────────────────────────────────────────
console.log('== 1) 表格自洽 ==');
const sum = JAAP.reduce((a, b) => a + b, 0n);
console.log(`  Σ JAAP[d] = ${fmt(sum)}`);
console.log(`  12^14     = ${fmt(TOTAL)}   ${ok(sum === TOTAL)}`);
if (sum !== TOTAL) process.exit(1);

// ─── 2) 精确枚举 ─────────────────────────────────────────────────────────────
console.log(`\n== 2) d ≤ ${MAX_DEPTH} 精确枚举(本仓库招式模型,与表格无关) ==`);

/** vec[type][amount] = 该招式在 14 个自由坐标上的增量。type 0..14 正面,15..29 反面。 */
const vec: number[][][] = [];
for (let t = 0; t < 30; t++) {
  const side = (t < 15 ? 0 : 1) as 0 | 1;
  const mask = CLOCK_TYPE_MASKS[t % 15];
  const byAmount: number[][] = [];
  for (let a = 0; a < 12; a++) {
    const d = clockMoveDelta(side, mask, a);
    byAmount.push(COORDS14.map((i) => d[i]));
  }
  vec.push(byAmount);
}

/** 14 位 12 进制打包成一个精确整数(12^14 < 2^53,double 无损)。 */
const encode = (v: readonly number[]): number => {
  let k = 0;
  for (let i = 0; i < 14; i++) k = k * 12 + v[i];
  return k;
};
const add = (a: readonly number[], b: readonly number[]): number[] => {
  const o = new Array<number>(14);
  for (let i = 0; i < 14; i++) { const s = a[i] + b[i]; o[i] = s >= 12 ? s - 12 : s; }
  return o;
};

const C = (n: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return Math.round(r); };
let capacity = 1;
for (let d = 1; d <= MAX_DEPTH; d++) capacity += C(30, d) * 11 ** d;
console.log(`  元组总数 ${fmt(capacity)}(需约 ${(capacity * 8 / 2 ** 30).toFixed(2)} GB)`);

const keys = new Float64Array(capacity);
let n = 0;
keys[n++] = 0;
const cut: number[] = [1];
const t0 = Date.now();
for (let t1 = 0; t1 < 30; t1++) {
  for (let a1 = 1; a1 < 12; a1++) keys[n++] = encode(vec[t1][a1]);
}
cut.push(n);
if (MAX_DEPTH >= 2) {
  for (let t1 = 0; t1 < 30; t1++) for (let a1 = 1; a1 < 12; a1++) {
    const v1 = vec[t1][a1];
    for (let t2 = t1 + 1; t2 < 30; t2++) for (let a2 = 1; a2 < 12; a2++) keys[n++] = encode(add(v1, vec[t2][a2]));
  }
  cut.push(n);
}
if (MAX_DEPTH >= 3) {
  for (let t1 = 0; t1 < 30; t1++) for (let a1 = 1; a1 < 12; a1++) {
    const v1 = vec[t1][a1];
    for (let t2 = t1 + 1; t2 < 30; t2++) for (let a2 = 1; a2 < 12; a2++) {
      const v2 = add(v1, vec[t2][a2]);
      for (let t3 = t2 + 1; t3 < 30; t3++) for (let a3 = 1; a3 < 12; a3++) keys[n++] = encode(add(v2, vec[t3][a3]));
    }
  }
  cut.push(n);
}
if (MAX_DEPTH >= 4) {
  for (let t1 = 0; t1 < 30; t1++) for (let a1 = 1; a1 < 12; a1++) {
    const v1 = vec[t1][a1];
    for (let t2 = t1 + 1; t2 < 30; t2++) for (let a2 = 1; a2 < 12; a2++) {
      const v2 = add(v1, vec[t2][a2]);
      for (let t3 = t2 + 1; t3 < 30; t3++) for (let a3 = 1; a3 < 12; a3++) {
        const v3 = add(v2, vec[t3][a3]);
        for (let t4 = t3 + 1; t4 < 30; t4++) for (let a4 = 1; a4 < 12; a4++) keys[n++] = encode(add(v3, vec[t4][a4]));
      }
    }
  }
  cut.push(n);
}
console.log(`  枚举完成 ${fmt(n)} 个元组,用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

let allMatch = true;
let prevDistinct = 0n;
for (let d = 0; d <= MAX_DEPTH; d++) {
  // subarray 是**视图**不是拷贝(`--depth 4` 下 slice 会再要一份 3.2 GB,本机 4.9 GB 空闲装不下)。
  // 就地排序前缀是安全的:各档前缀彼此嵌套,排序只在前缀内部换位,下一个更长前缀的元素集合
  // 作为多重集不变 —— 我们只数各前缀里的相异值,顺序无所谓。
  const slice = keys.subarray(0, cut[d]);
  slice.sort();
  let distinct = 0;
  for (let i = 0; i < slice.length; i++) if (i === 0 || slice[i] !== slice[i - 1]) distinct++;
  const exact = BigInt(distinct) - prevDistinct;
  prevDistinct = BigInt(distinct);
  const good = exact === JAAP[d];
  allMatch &&= good;
  console.log(`  d=${d}: 枚举 ${fmt(exact).padStart(13)}   表格 ${fmt(JAAP[d]).padStart(13)}   ${ok(good)}`);
}

// ─── 3) 抽样 ─────────────────────────────────────────────────────────────────
console.log(`\n== 3) ${fmt(SAMPLES)} 个均匀随机状态的最优步数抽样 ==`);
const hist = new Array<number>(13).fill(0);
let moveSum = 0;
const t1 = Date.now();
for (let i = 0; i < SAMPLES; i++) {
  const len = solveClock(randomClockState()).length;
  hist[len]++;
  moveSum += len;
}
const ms = Date.now() - t1;
const expectedP = JAAP.map((c) => Number(c) / Number(TOTAL));
let chi2 = 0;
console.log('   d    抽样      占比        理论占比     偏差');
for (let d = 0; d <= 12; d++) {
  const e = expectedP[d] * SAMPLES;
  if (e > 0) chi2 += ((hist[d] - e) ** 2) / e;
  if (hist[d] === 0 && e < 0.5) continue;
  const p = hist[d] / SAMPLES;
  const dev = e > 0 ? `${(((p * SAMPLES) - e) / Math.sqrt(e)).toFixed(2)}σ` : '—';
  console.log(`  ${String(d).padStart(2)}  ${String(hist[d]).padStart(7)}  ${(p * 100).toFixed(4).padStart(8)}%  ${(expectedP[d] * 100).toFixed(4).padStart(9)}%  ${dev.padStart(8)}`);
}
const mean = moveSum / SAMPLES;
const theoreticalMean = Number(JAAP.reduce((a, c, d) => a + c * BigInt(d), 0n)) / Number(TOTAL);
console.log(`\n  均值 ${mean.toFixed(4)}  理论 ${theoreticalMean.toFixed(4)}  (Jaap 页面写 9.4337)`);
console.log(`  上限 ${Math.max(...hist.map((c, d) => (c ? d : 0)))}  (God's number = 12)`);
console.log(`  χ² = ${chi2.toFixed(2)}  自由度 ≈ ${hist.filter((c) => c > 0).length - 1}`);
console.log(`  求解速度 ${(SAMPLES / (ms / 1000)).toFixed(0)} 个/秒 (${(ms / SAMPLES).toFixed(2)} ms/个)`);

console.log(`\n结论:d ≤ ${MAX_DEPTH} 各档为**精确证明**${allMatch ? '(全部吻合)' : '(有不吻合!)'};`
  + ` d > ${MAX_DEPTH} 各档为抽样统计证据,全表 1.28e15 个状态无法在本机重算。`);
if (!allMatch) process.exit(1);
