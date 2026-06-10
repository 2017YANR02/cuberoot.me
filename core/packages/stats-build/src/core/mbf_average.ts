// 333mbf 非官方 Mo3 平均(WCA 不追踪)。WCA 编码 0DDTTTTTMM:DD/TTTTT/MM 三段
// 各取 3 次均值(四舍五入)再拼回同一编码。与 client-next/lib/mbf-average.ts 保持一致。

export function mbfMo3(v1: number, v2: number, v3: number): number {
  const vals = [v1, v2, v3];
  const dd = Math.round(vals.reduce((s, v) => s + Math.floor(v / 10_000_000), 0) / 3);
  const ttttt = Math.round(vals.reduce((s, v) => s + Math.floor(v / 100) % 100_000, 0) / 3);
  const mm = Math.round(vals.reduce((s, v) => s + v % 100, 0) / 3);
  return dd * 10_000_000 + ttttt * 100 + mm;
}

// 恰好 3 次有效尝试且全部成功(>0)→ Mo3;有 DNF/DNS(<0)→ -1;不足 3 次 → 0。
export function computeMbfMo3(attempts: number[]): number {
  const vals = attempts.filter(v => v !== 0);
  if (vals.length !== 3) return 0;
  if (vals.some(v => v < 0)) return -1;
  return mbfMo3(vals[0], vals[1], vals[2]);
}
