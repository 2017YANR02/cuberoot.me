// 333mbf 非官方 Mo3 平均(WCA 不追踪此指标)。
// WCA 编码 0DDTTTTTMM:拆 DD(99 减点数)、TTTTT(秒)、MM(失败数)三段,
// 各取 3 次均值(四舍五入)再拼回同一编码,可直接喂 formatWcaResult('333mbf', ...)。
// 算法与 packages/stats-build/src/statistics/mbf_average.ts 的 mbfMo3 保持一致。

export const MBLD_AVG_EVENTS = new Set(['333mbf', '333mbo']);
export function isMbldEvent(eventId: string): boolean { return MBLD_AVG_EVENTS.has(eventId); }

function mbfMo3Raw(v1: number, v2: number, v3: number): number {
  const vals = [v1, v2, v3];
  const dd = Math.round(vals.reduce((s, v) => s + Math.floor(v / 10_000_000), 0) / 3);
  const ttttt = Math.round(vals.reduce((s, v) => s + Math.floor(v / 100) % 100_000, 0) / 3);
  const mm = Math.round(vals.reduce((s, v) => s + v % 100, 0) / 3);
  return dd * 10_000_000 + ttttt * 100 + mm;
}

// 从一轮 attempts 算 Mo3:恰好 3 次有效尝试且全部成功(>0)→ Mo3;
// 3 次里有 DNF/DNS(<0)→ 平均 DNF(-1);不足 3 次(0=空/未打)→ 0(无平均,展示层留空)。
export function computeMbfMo3(attempts: number[]): number {
  const vals = attempts.filter(v => v !== 0);
  if (vals.length !== 3) return 0;
  if (vals.some(v => v < 0)) return -1;
  return mbfMo3Raw(vals[0], vals[1], vals[2]);
}
