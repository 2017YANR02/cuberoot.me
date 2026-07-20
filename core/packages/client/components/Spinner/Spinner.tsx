'use client';

/**
 * Spinner — iOS 风格的转圈(activity indicator):12 根辐条依次渐隐,而不是整体旋转
 * 的圆弧。全站唯一的加载指示器实现。
 *
 * 此前 22 个 CSS 文件各自写了一份 `@keyframes *-spin`(都是 `rotate(360deg)`)去转
 * lucide 的 `<Loader2>`,共 58 处调用 —— 同一个轮子造了 22 遍,时长还从 0.7s 到 1s
 * 各不相同。这里收成一处。
 *
 * 颜色走 `currentColor`,放进什么上下文就继承什么颜色,不需要各页再传 token。尺寸由
 * `size`(px)驱动,辐条几何全用百分比,所以任意尺寸都等比。
 *
 * 无障碍:默认 `aria-hidden`(转圈通常挨着「加载中…」这类文字,读屏读文字即可)。若它
 * 是唯一的加载提示,传 `label` —— 会变成 `role="status"` 并把 label 念出来。
 *
 * `prefers-reduced-motion` 下不做动画,改为静态的均匀淡辐条(仍是「忙」的视觉,但不闪)。
 */
import './spinner.css';

const SPOKES = 12;

export interface SpinnerProps {
  /** 边长(px),默认 16。辐条按比例缩放。 */
  size?: number;
  /** 附加 class(定位/间距用;颜色请靠 currentColor 继承)。 */
  className?: string;
  /** 有它 = 这是唯一的加载提示,读屏要念;省略 = 装饰性,旁边有文字。 */
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      className={className ? `spinner ${className}` : 'spinner'}
      style={{ '--spinner-size': `${size}px` } as React.CSSProperties}
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {Array.from({ length: SPOKES }, (_, i) => (
        <span key={i} className="spinner-spoke" style={{ '--spinner-i': i } as React.CSSProperties} />
      ))}
    </span>
  );
}

export default Spinner;
