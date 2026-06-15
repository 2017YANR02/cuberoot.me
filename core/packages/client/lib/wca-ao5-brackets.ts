/**
 * Ao5 (5 次的平均) 中,某次 attempt 是否应被括号包裹 (= 去尾的最好 + 最差/DNF).
 * - attempts.length !== 5 → 永远 false (Bo3 / Bo1 / HTH 都不去尾)
 * - 全无效 → false
 * - 有 DNF/DNS (-1 / -2) → 它就是 "worst"; 另一边取剩余有效里的最小
 * - 全有效 → 最大 + 最小
 *
 * 与 WCA 显示约定一致;persons 表 + comp 表共用. attempts 数组按比赛实际顺序传入.
 */
export function isAo5Bracketed(attempts: number[], idx: number): boolean {
  if (attempts.length !== 5) return false;
  const valid = attempts.map((v, i) => ({ v, i })).filter(({ v }) => v > 0);
  if (valid.length === 0) return false;
  const fail = attempts.findIndex((v) => v === -1 || v === -2);
  const worstIdx = fail >= 0
    ? fail
    : attempts.indexOf(Math.max(...valid.map((x) => x.v)));
  const bestIdx = attempts.indexOf(Math.min(...valid.map((x) => x.v)));
  return idx === worstIdx || idx === bestIdx;
}
