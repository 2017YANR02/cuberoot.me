// 单次成绩展示:有罚时(penalty>0)则拆成 base + 小角标(如 1.00⁺²),否则原样。
// 成绩值本身正确,base = 显示值 − 罚时;format 由调用方传(选手页 formatWcaResult / comp 页 formatLive)。

export function SolveValue({ value, penalty, format }: {
  value: number;
  penalty?: number;
  format: (v: number) => string;
}) {
  if (penalty && penalty > 0 && value > 0) {
    const base = Math.max(0, value - penalty); // 罚时 ≥ 成绩值时夹到 0,避免渲染负数底
    return (
      <>
        {format(base)}
        <sup className="wp-att-pen" title={`+${Math.round(penalty / 100)} 罚时`}>+{Math.round(penalty / 100)}</sup>
      </>
    );
  }
  return <>{format(value)}</>;
}
