// NOTE: 模拟引擎 — 从 app.js 1:1 迁移
// 蒙特卡洛估计、几何分布中位数、KDE 采样 + 进步幅度缩放
// 对应原版 app.js#505-795

import { useCalcStore, solveCountForEvent, isMbfForEvent } from '../stores/calc_store';
import { getAverage, clampValue } from '../engine/calc_engine';
import { sampleKDE, getAo100, getWR } from '../engine/wr_data';

// NOTE: 蒙特卡洛估计参数
const SIM_MAX = 1000000;      // 单轮最大模拟次数（fallback 用）
const SIM_ESTIMATE_N = 100000; // 估计 p 的采样量

// NOTE: 选手进步幅度 — 滑杆值 -20~100，代表百分比
// 保持在模块级以供 sampleOneSolve 使用
let playerProgress = [0, 0];

// NOTE: 读写进步幅度
export function getProgress(p: number): number { return playerProgress[p]; }
export function setProgress(p: number, val: number): void { playerProgress[p] = val; }

// NOTE: 计算进度缩放因子
// 正值（进步）：α = 1 − (progress/100) × (1 − T/μ_kde) — 朝 Target 锚定
// 负值（退步）：α = 1 − progress/100 — 直接百分比（-50% → α=1.5，慢 50%）
// 原版 app.js#520-536
export function getScaleFactor(p: number): number {
  const progress = playerProgress[p] / 100;
  if (progress === 0) return 1;

  const state = useCalcStore.getState();

  // NOTE: 负值方向用直接百分比 — 不受 Target 约束
  if (progress < 0) {
    return 1 - progress; // -0.5 → 1.5
  }

  // NOTE: 正值方向保留 Target 锚定公式
  const target = state.getTargetAvg(state.seedOn + p);
  const ao100 = getAo100(state.event);
  if (!ao100 || !target || target <= 0) return 1;
  const mu = ao100[p]; // centiseconds
  if (mu <= 0) return 1;
  return 1 - progress * (1 - target / mu);
}

// NOTE: 更新滑杆 info 标签文本 + 颜色
// 原版 app.js#540-577
export function getProgressInfo(p: number): { text: string; color: string } {
  const pct = playerProgress[p];
  const state = useCalcStore.getState();
  const ao100Arr = getAo100(state.event);

  if (pct === 0) {
    if (ao100Arr) {
      return { text: `0% (${(ao100Arr[p] / 100).toFixed(2)}s)`, color: '' };
    }
    return { text: '0%', color: '' };
  }

  const alpha = getScaleFactor(p);
  if (ao100Arr) {
    const estAvg = ao100Arr[p] * alpha / 100;
    let text: string;
    if (pct > 0) {
      text = `+${pct}% (↓${estAvg.toFixed(2)}s)`;
    } else {
      text = `${pct}% (↑${estAvg.toFixed(2)}s)`;
    }
    const target = state.getTargetAvg(state.seedOn + p);
    let color = '';
    if (pct < 0) {
      color = '#c62828'; // 退步 = 红色
    } else if (target && estAvg * 100 < target) {
      color = '#2e7d32'; // 能赢 = 绿色
    }
    return { text, color };
  }
  return {
    text: (pct > 0 ? '+' : '') + pct + '%',
    color: pct < 0 ? '#c62828' : '',
  };
}

// NOTE: 采样单次成绩 — KDE + log-normal 回退 + 进步缩放
// 原版 app.js#580-606
export function sampleOneSolve(p: number): number {
  const state = useCalcStore.getState();
  const isMbf = isMbfForEvent(state.event);
  let cs = sampleKDE(state.event, p);

  if (cs === null) {
    const ao100 = getAo100(state.event);
    let muLn: number;
    if (ao100) {
      muLn = Math.log(ao100[p] / 100);
    } else {
      const avgWr = getWR(state.event, 'average');
      muLn = avgWr ? Math.log(avgWr / 100) : 1.48;
    }
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    cs = clampValue(Math.round(Math.exp(muLn + 0.12 * z) * 100));
  }

  if (state.event === '333fm') cs = Math.round(cs / 100) * 100;
  if (isMbf) cs = (Math.floor(Math.random() * 50) + 10) * 100;

  // NOTE: 应用进步/退步幅度缩放（非 mbf 时）
  if (!isMbf && playerProgress[p] !== 0) {
    const alpha = getScaleFactor(p);
    cs = clampValue(Math.round(cs * alpha));
  }
  return cs;
}

// NOTE: 模拟一组成绩（n 个 solve），返回 { solves, avg }
// 原版 app.js#608-615
export function simulateOnce(p: number): { solves: number[]; avg: number } {
  const state = useCalcStore.getState();
  const n = solveCountForEvent(state.event);
  const solves = new Array(n);
  for (let i = 0; i < n; i++) solves[i] = sampleOneSolve(p);
  const avg = getAverage(solves, true);
  return { solves, avg };
}

// NOTE: 判断 avg 是否击败 target
// 原版 app.js#619-622
function isBeat(avg: number, target: number, isMbf: boolean): boolean {
  if (avg <= 0 || avg >= 999999) return false;
  return isMbf ? (avg >= target) : (avg <= target);
}

// NOTE: 蒙特卡洛估计 p = P(Ao5 ≤ target)
// 原版 app.js#660-669
function estimateP(p: number, target: number): number {
  const isMbf = isMbfForEvent(useCalcStore.getState().event);
  let hits = 0;
  for (let i = 0; i < SIM_ESTIMATE_N; i++) {
    const result = simulateOnce(p);
    if (isBeat(result.avg, target, isMbf)) hits++;
  }
  return hits / SIM_ESTIMATE_N;
}

// NOTE: 几何分布 Geo(p) 的中位数 = ⌈-ln(2)/ln(1-p)⌉
// 原版 app.js#674-678
function geoMedian(p: number): number {
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  return Math.ceil(-Math.LN2 / Math.log(1 - p));
}

// ── 对外接口 ──

export interface SimResult {
  // 'geo' 模式：几何中位数 + 概率
  // 'winrate' 模式：胜率
  mode: 'geo' | 'winrate';
  countA?: number;     // ×N（geo）或 winRate（winrate）
  countB?: number;
  probA?: number;      // p 概率
  probB?: number;
  winnerA?: boolean;   // A 是否获胜
  winnerB?: boolean;
  error?: string;
}

// NOTE: 单选手模拟 — 估计 p 后用公式算理论中位数
// 原版 app.js#681-721
export function simulateForPlayer(p: number): SimResult {
  const state = useCalcStore.getState();
  const target = state.getTargetAvg(state.seedOn + p);
  if (target <= 0) return { mode: 'geo', error: 'Please set a Target Avg first.' };
  if (!state.playerEnabled[p]) return { mode: 'geo', error: 'Player is not enabled.' };

  // NOTE: 估计达标概率 p̂
  const prob = estimateP(p, target);
  if (prob <= 0) {
    return { mode: 'geo', error: `Target too hard — 0 out of ${SIM_ESTIMATE_N.toLocaleString()} simulations beat the target.` };
  }

  // NOTE: 理论中位数
  const median = geoMedian(prob);

  // NOTE: 生成一组达标的 solves 写入 state
  let result = null;
  for (let i = 0; i < SIM_MAX; i++) {
    result = simulateOnce(p);
    if (isBeat(result.avg, target, isMbfForEvent(state.event))) break;
  }

  if (result) {
    const n = solveCountForEvent(state.event);
    for (let t = 0; t < n; t++) {
      state.updateTime(state.seedOn + p, t, result.solves[t]);
    }
  }

  const out: SimResult = { mode: 'geo' };
  if (p === 0) { out.countA = median; out.probA = prob; }
  else { out.countB = median; out.probB = prob; }
  return out;
}

// NOTE: Race 模式 — 100,000 次正面 Ao5 对决
// 原版 app.js#725-795
export function simulateRace(): SimResult {
  const state = useCalcStore.getState();
  if (!state.playerEnabled[0] || !state.playerEnabled[1]) {
    return { mode: 'winrate', error: 'Both players must be enabled.' };
  }

  const isMbf = isMbfForEvent(state.event);
  let winsA = 0, winsB = 0;
  let lastSolvesA: number[] | null = null;
  let lastSolvesB: number[] | null = null;

  for (let i = 0; i < SIM_ESTIMATE_N; i++) {
    const resA = simulateOnce(0);
    const resB = simulateOnce(1);
    const avgA = resA.avg, avgB = resB.avg;

    const aDnf = avgA >= 999999, bDnf = avgB >= 999999;
    if (aDnf && bDnf) {
      continue; // 双方 DNF → 平局
    } else if (aDnf) {
      winsB++;
    } else if (bDnf) {
      winsA++;
    } else if (isMbf ? (avgA > avgB) : (avgA < avgB)) {
      winsA++;
    } else if (isMbf ? (avgB > avgA) : (avgB < avgA)) {
      winsB++;
    }

    lastSolvesA = resA.solves;
    lastSolvesB = resB.solves;
  }

  // NOTE: 写入最后一轮的 solves
  if (lastSolvesA && lastSolvesB) {
    const n = solveCountForEvent(state.event);
    for (let t = 0; t < n; t++) {
      state.updateTime(state.seedOn + 0, t, lastSolvesA[t]);
      state.updateTime(state.seedOn + 1, t, lastSolvesB[t]);
    }
  }

  const total = winsA + winsB;
  if (total === 0) {
    return { mode: 'winrate', error: 'All 100,000 rounds ended in a draw!' };
  }

  const rateA = winsA / total;
  const rateB = winsB / total;
  const winner = rateA >= rateB ? 0 : 1;

  return {
    mode: 'winrate',
    countA: rateA,
    countB: rateB,
    winnerA: winner === 0,
    winnerB: winner === 1,
  };
}
