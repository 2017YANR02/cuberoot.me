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

/**
 * 去掉末尾「未进行的把」(value===0)。WCA 成绩按 value1..value5 全列存,Bo3 / Bo1 / Mo3
 * (多盲 / 旧多盲 / 三四五盲 / 最少步 / 六七阶)及未过晋级线的轮次,尾部补 0 占位。显示时砍掉这些
 * 0,使把数反映真实尝试次数(3 把项目显示 1-3 而非 1-5),且 length≠5 时 isAo5Bracketed 不再误括号。
 * DNF/DNS(-1/-2)是真把,保留。
 */
export function trimEmptyAttempts(attempts: number[]): number[] {
  let end = attempts.length;
  while (end > 0 && attempts[end - 1] === 0) end--;
  return end === attempts.length ? attempts : attempts.slice(0, end);
}
