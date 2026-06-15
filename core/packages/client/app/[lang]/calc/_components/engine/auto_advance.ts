// 判断当前 cell/行的输入是否已构成完整成绩 → 自动跳下一格 / 换行.
// H2H 输入网格 (Numpad / cell keyDown) 与 简易版 textarea 共用同一规则,行为完全一致.

/** 自动跳格 / 换行触发条件(纯函数,无副作用). */
export function shouldAutoAdvance(rawVal: string): boolean {
  const val = rawVal.trim();
  // 规则 1: 小数点后已输入 2 位数字(如 "4.42"、"12.35")
  const dotIdx = val.indexOf('.');
  if (dotIdx >= 0) {
    const afterDot = val.substring(dotIdx + 1);
    if (afterDot.length >= 2 && /^\d{2}$/.test(afterDot)) return true;
  }
  // 规则 2: 首位 ≥ 3 的 3 位纯数字(如 "354"→3.54s)
  if (/^\d{3}$/.test(val) && parseInt(val[0], 10) >= 3) return true;
  // 规则 3: 4 位纯数字 1000~5959(如 "1234"→12.34s, "5959"→59.59s)
  if (/^\d{4}$/.test(val)) {
    const num = parseInt(val, 10);
    if (num >= 1000 && num <= 5959) return true;
  }
  // 规则 4: 冒号格式完成 — X:XX.XX(如 "1:23.45")
  if (val.includes(':') && dotIdx >= 0) {
    const afterDot2 = val.substring(dotIdx + 1);
    if (afterDot2.length >= 2 && /^\d{2}$/.test(afterDot2)) return true;
  }
  return false;
}
