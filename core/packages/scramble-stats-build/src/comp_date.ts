// competitions.tsv 的 start/end 日期 → 紧凑展示串。
// 同年同月 → start~dd;同年跨月 → start~mm-dd;跨年 → start~end;空/NULL → ''。
// build.ts(示例 comp meta)/ build_recent_scrambles.ts(近期打乱)/ build_wca_cross.ts 共用,纯函数无状态。
export function dateDisplay(start: string, end: string): string {
  if (!start || start === 'NULL') return '';
  if (!end || end === 'NULL' || end === start) return start;
  const [sy, sm] = start.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${start}~${ed}`;
  if (sy === ey) return `${start}~${em}-${ed}`;
  return `${start}~${end}`;
}
