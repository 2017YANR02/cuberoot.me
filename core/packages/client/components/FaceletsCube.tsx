'use client';

/**
 * FaceletsCube — 由 54 位 fd 串(visualcube facelet 顺序,字符 u r f d l b o n t)
 * 本地渲染任意 3x3 贴纸状态。与 <VisualCube>(alg/setup 驱动、走服务端点)互补:
 * 状态没有对应 alg 时(如 LSLL 的 58 万 case)用这个。
 */
import { useMemo } from 'react';
import { renderCubeSVG } from '@cuberoot/visualcube';

export function FaceletsCube({ fd, size = 88, alt = 'Cube state', view, fill = false }: {
  fd: string;
  size?: number;
  alt?: string;
  /** plan 或 csTimer 风格的 qCube / qLast / q2Look 平面投影;省略 = 立体图。 */
  view?: 'iso' | 'plan' | 'qcube' | 'qlast' | 'q2look';
  /**
   * 撑满外层盒子的高度,而不是钉死 `size` px。给尺寸由 CSS 令牌决定的位置用
   * (如 /timer 时间下方那块,高度是 `--cube-h`)。`size` 仍然决定 svg 的 width /
   * height 属性,但 svg 带 viewBox,所以调用方补一条 `svg { height:100%; width:auto }`
   * 就能等比缩放 —— 这条规则归调用方,因为只有它知道自己要定高还是定宽。
   */
  fill?: boolean;
}) {
  const svg = useMemo(
    () => renderCubeSVG({
      width: size, height: size, cubeSize: 3, facelets: fd.split(''),
      ...(view === 'plan' || view === 'qcube' || view === 'qlast' || view === 'q2look' ? { view } : {}),
    }),
    [fd, size, view],
  );
  return (
    <span
      role="img"
      // puzzle-art:柔和度的统一钩子(见 globals.css),贴纸色不走 token,靠它跟。
      className="puzzle-art"
      aria-label={alt}
      style={fill
        ? { display: 'block', height: '100%' }
        : { display: 'inline-flex', width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
