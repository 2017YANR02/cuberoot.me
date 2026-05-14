// 通用清空按钮 ×。所有"输入框 / 选择器右侧"和"独立日期范围旁"的清空按钮都用它。
// 之前散落在 CompPicker / CuberSearchInput / CountryInput / UpcomingCompsPage 等处的 `.xxx-clear` 全部归一。
//
// variant:
//   'inline'    （默认）absolute 浮在 position:relative 父级右侧（input / select 内嵌 ×）
//   'standalone' 流式布局里的独立小圆（带可见底色，适合"日期区间 × 清空"这种场景）
//
// preserveFocus: onMouseDown 时 e.preventDefault()，避免点击 × 抢走输入框焦点（搜索 / 选择型必须开）

import type { JSX } from 'react';

interface ClearButtonProps {
  onClick: () => void;
  /** 中文模式 → "清除"，否则 "Clear"。也可显式传 ariaLabel/title 覆盖 */
  isZh?: boolean;
  variant?: 'inline' | 'standalone';
  preserveFocus?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
}

export function ClearButton({
  onClick,
  isZh,
  variant = 'inline',
  preserveFocus,
  className,
  ariaLabel,
  title,
}: ClearButtonProps): JSX.Element {
  const label = ariaLabel ?? (isZh ? '清除' : 'Clear');
  const cls = [
    'clear-btn',
    variant === 'standalone' ? 'clear-btn--standalone' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
    >
      <svg className="clear-btn-icon" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
