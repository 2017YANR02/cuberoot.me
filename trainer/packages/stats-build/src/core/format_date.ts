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
