// 单次成绩展示:有罚时(penalty>0)则在最终成绩值右上角补「+」记号 —— 每 2 秒罚时一个 +
// (+2 → "+",+4 → "++",+6 → "+++",以此类推)。成绩值本身已含罚时(value = 含罚最终值),直接展示。
// format 由调用方传(选手页 formatWcaResult / comp 页 formatLive)。

export function SolveValue({ value, penalty, format, note }: {
  value: number;
  penalty?: number;
  format: (v: number) => string;
  note?: string | null;   // 罚时原因 → 挂在 + 记号的 title 上(悬停可见,不增宽度)
}) {
  const pen = penalty ?? 0;
  if (pen > 0 && value > 0) {
    const plus = '+'.repeat(Math.max(1, Math.round(pen / 200))); // 每 2s(200cs)一个 +
    const pen2 = Math.round(pen / 100);
    const title = note ? `+${pen2} 罚时 · ${note}` : `+${pen2} 罚时`;
    return (
      <>
        {format(value)}
        <sup className="wp-att-pen" title={title}>{plus}</sup>
      </>
    );
  }
  return <>{format(value)}</>;
}
