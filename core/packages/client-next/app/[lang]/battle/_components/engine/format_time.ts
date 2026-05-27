/**
 * 时间格式化工具
 * 1:1 翻译自 battle.js formatTime()（行 1696~1714）和 formatTimePlain()（行 2151~2165）
 */

/**
 * 将毫秒格式化为 M:SS.mmm 或 SS.mmm（含 HTML span 标签，用于计时器显示）
 * 例如: 65432 → "1<span class="colon">:</span>05.432"，7890 → "7.890"
 * NOTE: p（精确度）由外部传入而非读取全局 state（解耦）
 */
export function formatTime(ms: number, precision: number): string {
  if (ms <= 0) return precision > 0 ? `0.${'0'.repeat(precision)}` : '0';

  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;

  // NOTE: 根据精确度截取小数部分
  const millisStr = millis.toString().padStart(3, '0').slice(0, precision);
  const frac = precision > 0 ? `.${millisStr}` : '';

  if (minutes > 0) {
    return `${minutes}<span class="colon">:</span>${seconds.toString().padStart(2, '0')}${frac}`;
  }
  return `${seconds}${frac}`;
}

/**
 * NOTE: 纯文本时间格式化（不含 HTML span，用于统计显示）
 * 1:1 翻译自 battle.js formatTimePlain()（行 2151~2165）
 */
export function formatTimePlain(ms: number, precision: number): string {
  if (ms <= 0) return precision > 0 ? `0.${'0'.repeat(precision)}` : '0';
  if (ms === Infinity) return 'DNF';

  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const millisStr = millis.toString().padStart(3, '0').slice(0, precision);
  const frac = precision > 0 ? `.${millisStr}` : '';

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}${frac}`;
  }
  return `${seconds}${frac}`;
}
