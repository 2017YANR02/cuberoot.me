'use client';

// 通用单行堆叠比例条:每段 flexGrow ∝ weight,着色 + 居中标签(段太窄自动隐藏标签,仅留 tooltip)。
// 抽自 /scramble/gen 的十字分布条(原 .gen-cx-bar/.gen-cx-seg),改中性类名供跨页复用
//(/scramble/gen 十字分析 + /wca/results 姓名分布国家占比)。
import type { ReactNode, KeyboardEvent } from 'react';
import './StackedBar.css';

export interface StackedSeg {
  key: string | number;
  /** 段宽权重(原始计数 / 数值,非百分比);全段求和或显式 total 作分母。 */
  weight: number;
  /** 背景色,任意 CSS 颜色(含 var() / color-mix())。 */
  color: string;
  /** 段内标签:仅当该段占比 ≥ minLabelFrac 时显示。 */
  label?: ReactNode;
  /** hover tooltip。 */
  title?: string;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export default function StackedBar({
  segments,
  total,
  minLabelFrac = 0.08,
  className = '',
  ariaLabel,
}: {
  segments: StackedSeg[];
  /** 标签阈值的分母;缺省 = 各段 weight 之和。 */
  total?: number;
  minLabelFrac?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const sum = total ?? segments.reduce((s, x) => s + x.weight, 0);
  return (
    <div className={`cr-stackbar ${className}`.trim()} role="img" aria-label={ariaLabel}>
      {segments.map((sg) => {
        const frac = sum > 0 ? sg.weight / sum : 0;
        const showLabel = frac >= minLabelFrac && sg.label != null;
        const cls = `cr-stackbar-seg${sg.dim ? ' is-dim' : ''}${sg.selected ? ' is-sel' : ''}${sg.onClick ? ' is-clickable' : ''}`;
        const style = { flexGrow: sg.weight, background: sg.color };
        const inner = showLabel ? <span className="cr-stackbar-label">{sg.label}</span> : null;
        if (sg.onClick) {
          const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sg.onClick!(); }
          };
          return (
            <span key={sg.key} className={cls} style={style} title={sg.title}
              role="button" tabIndex={0} onClick={sg.onClick} onKeyDown={onKey}>
              {inner}
            </span>
          );
        }
        return (
          <span key={sg.key} className={cls} style={style} title={sg.title}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
