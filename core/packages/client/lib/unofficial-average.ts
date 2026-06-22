// 非官方平均(cstimer 式 AoN):给 WCA 不记录平均的轮次(head-to-head 决赛、Bo-N 等)算一个参考平均。
// 规则同 cstimer:按从快到慢排序,去掉最快 / 最慢各 ceil(N×5%) 个,其余取算术平均(N=5 时即去掉一快一慢
// = WCA Ao5 口径)。DNF(-1)/ DNS(-2)记为 +∞ 计入 N;若去尾后仍含失败次 → 整体 DNF。
// 占位次(0,该 solve 不存在)剔除不计。返回 centiseconds(失败 = -1);有效次数 < min(默认 5)→ null。

export interface UnofficialAvg {
  /** 平均值,单位 centiseconds;-1 = DNF */
  value: number;
  /** 参与计算的解数(含失败次,不含占位 0) */
  n: number;
  /** 每端去掉的个数 */
  trim: number;
}

export function unofficialAoN(attempts: number[], opts: { min?: number } = {}): UnofficialAvg | null {
  const min = opts.min ?? 5;
  // 0 = 该次不存在(占位)→ 剔除;-1 DNF / -2 DNS = 失败 → 计入但视为 +∞
  const xs = (attempts ?? []).filter((t) => t !== 0 && t != null);
  const n = xs.length;
  if (n < min) return null;
  const vals = xs.map((t) => (t > 0 ? t : Infinity)).sort((a, b) => a - b);
  const trim = Math.ceil(n * 0.05);
  const kept = vals.slice(trim, n - trim);
  if (kept.length === 0) return null;
  if (kept.some((v) => !Number.isFinite(v))) return { value: -1, n, trim };
  const sum = kept.reduce((a, b) => a + b, 0);
  return { value: Math.round(sum / kept.length), n, trim };
}
