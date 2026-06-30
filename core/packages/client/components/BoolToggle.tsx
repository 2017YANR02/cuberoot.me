'use client';

// 全站统一的「布尔开关」:左边一个 iOS 风滑钮(PillToggle 的无文字 switch),右边文字标签。
// 用于「开/关单个东西」的场景(显示废止项 / 只看未登领奖台 / 开启动画…)。文字也可点。
// 二选一(A/B 两态各有含义,如 选手/成绩、截至/当期)请用 PillToggle 的 onLabel/offLabel
// 文字内嵌形态,默认态置绿;不要用本组件。复选框(☑)一律换成本组件。
import type { ReactNode } from 'react';
import PillToggle from './PillToggle/PillToggle';
import './BoolToggle.css';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
  /** 无障碍名:label 非纯文本时显式传。 */
  ariaLabel?: string;
}

export default function BoolToggle({ value, onChange, label, disabled, className, ariaLabel }: Props) {
  return (
    <span className={`bool-toggle${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
      <PillToggle
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      />
      {/* 文字也可点切换;键盘 / 读屏走 switch 本体,故 tabIndex=-1 + aria-hidden 避免双控件。 */}
      <button
        type="button"
        className="bool-toggle-label"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onClick={() => { if (!disabled) onChange(!value); }}
      >
        {label}
      </button>
    </span>
  );
}
