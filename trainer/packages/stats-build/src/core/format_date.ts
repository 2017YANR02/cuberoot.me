// NOTE: 共享日期格式化工具——统一输出 YYYY-MM-DD 格式
// 修复 String(Date对象).slice(0,10) 导致的 "Sat Mar 07" bug

/**
 * 将任意日期值格式化为 YYYY-MM-DD
 * NOTE: MySQL 返回的 start_date 可能是 Date 对象或字符串
 * String(Date) 会产生 "Sat Mar 07 2026..."，直接 .slice(0,10) 会截成 "Sat Mar 07"
 * 此函数统一处理所有情况
 */
export function formatDate(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d || '');
  // NOTE: 已是 ISO 格式（YYYY-MM-DD），直接截取
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // NOTE: 非 ISO 格式（如 "Sat Mar 07 2026"），尝试解析后转换
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

// NOTE: 将任意日期值转为时间戳（ms）——兼容 Date 对象和 ISO 字符串
function toMs(d: unknown): number {
  if (d instanceof Date) return d.getTime();
  return new Date(formatDate(d)).getTime();
}

/**
 * 计算纪录保持天数
 * @param currDate 当前纪录日期（Date 对象或字符串）
 * @param nextDate 下一条纪录日期，null 表示当前仍是最新 WR（用 Date.now()）
 */
export function calcDays(currDate: unknown, nextDate: unknown | null): string {
  const curr = toMs(currDate);
  const next = nextDate != null ? toMs(nextDate) : Date.now();
  return String(Math.round((next - curr) / 86400000));
}

/**
 * WR 历史过滤：按日期正序排序，保留使 metric 创新低（<=）的记录
 * @param items 待过滤的记录数组
 * @param getDate 从记录中提取日期的函数
 * @param getMetric 从记录中提取指标值的函数（越小越好）
 * @param tieBreak 同日期时二次排序方向：'desc'（默认）= metric 大的先扫描（确保不遗漏）
 */
export function filterWrHistory<T>(
  items: T[],
  getDate: (item: T) => unknown,
  getMetric: (item: T) => number,
  options: { tieBreak?: 'asc' | 'desc'; strict?: boolean } = {},
): T[] {
  const { tieBreak = 'desc', strict = false } = options;
  const sorted = [...items].sort((a, b) => {
    const da = formatDate(getDate(a));
    const db = formatDate(getDate(b));
    const cmp = da.localeCompare(db);
    if (cmp !== 0) return cmp;
    return tieBreak === 'desc'
      ? getMetric(b) - getMetric(a)
      : getMetric(a) - getMetric(b);
  });

  let minSoFar = Infinity;
  return sorted.filter(item => {
    const m = getMetric(item);
    const passes = strict ? m < minSoFar : m <= minSoFar;
    if (passes) {
      minSoFar = m;
      return true;
    }
    return false;
  });
}
