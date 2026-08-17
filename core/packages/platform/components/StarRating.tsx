"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Props = {
  // 当前分值;可输入模式下传初值,内部用 hover 临时态覆盖显示
  value: number;
  // 传了 onChange 即进入可输入模式(点星打分),否则只读展示
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
  // 可输入模式给每颗星的无障碍标签前缀
  label?: string;
};

// 星级组件:只读展示(不传 onChange)+ 可输入(传 onChange,点星打分,hover 预览)。
// 半星只在只读模式下按比例填充,输入模式取整星。
export function StarRating({
  value,
  onChange,
  size = 18,
  className = "",
  label = "评分",
}: Props) {
  const interactive = typeof onChange === "function";
  const [hover, setHover] = useState(0);
  const display = interactive && hover > 0 ? hover : value;

  if (!interactive) {
    return (
      <span
        className={"inline-flex items-center gap-0.5 " + className}
        role="img"
        aria-label={`${label} ${Math.round(value * 10) / 10} 分(满分 5）`}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, display - (i - 1)));
          return (
            <span
              key={i}
              className="relative inline-block leading-none"
              style={{ width: size, height: size }}
            >
              <Star size={size} className="absolute inset-0 text-line" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  size={size}
                  className="text-amber-500"
                  fill="currentColor"
                />
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span className={"inline-flex items-center gap-1 " + className}>
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= display;
        return (
          <button
            key={i}
            type="button"
            aria-label={`${label} ${i} 星`}
            aria-pressed={i <= value}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(i)}
            className="cursor-pointer rounded p-0.5 leading-none outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Star
              size={size}
              className={active ? "text-amber-500" : "text-line"}
              fill={active ? "currentColor" : "none"}
            />
          </button>
        );
      })}
    </span>
  );
}
