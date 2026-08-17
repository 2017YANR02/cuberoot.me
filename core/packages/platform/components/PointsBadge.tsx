import { Sparkles } from "lucide-react";

type Size = "sm" | "md" | "lg";

// 各尺寸的内边距 / 字号 / 图标尺寸,统一在此调,避免散落 magic number。
const SIZES: Record<
  Size,
  { wrap: string; icon: number; gap: string }
> = {
  sm: { wrap: "px-2 py-0.5 text-[12px]", icon: 13, gap: "gap-1" },
  md: { wrap: "px-2.5 py-1 text-[13px]", icon: 15, gap: "gap-1.5" },
  lg: { wrap: "px-3 py-1.5 text-[15px]", icon: 18, gap: "gap-1.5" },
};

// 千分位分隔,避免大数字糊成一团(如 12,800)。
function formatPoints(n: number): string {
  return Math.trunc(n).toLocaleString("en-US");
}

// 积分余额徽章:Sparkles 图标 + 数字。balance 由调用方查 getBalance(userId) 传入。
// 纯展示组件,不含数据查询,供个人中心 / header / 卡片复用。
export function PointsBadge({
  balance,
  size = "md",
  label,
  className = "",
}: {
  balance: number;
  size?: Size;
  label?: string; // 可选后缀,如 "积分";不传只显示数字
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={
        "inline-flex items-center rounded-full bg-brand-soft font-semibold text-brand-dark tabular-nums " +
        s.wrap +
        " " +
        s.gap +
        (className ? " " + className : "")
      }
      title={label ? `${formatPoints(balance)} ${label}` : undefined}
    >
      <Sparkles size={s.icon} className="shrink-0" aria-hidden />
      <span>{formatPoints(balance)}</span>
      {label ? (
        <span className="font-medium opacity-80">{label}</span>
      ) : null}
    </span>
  );
}

export default PointsBadge;
