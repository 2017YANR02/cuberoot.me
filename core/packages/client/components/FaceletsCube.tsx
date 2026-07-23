'use client';

/**
 * FaceletsCube — 由 54 位 fd 串(visualcube facelet 顺序,字符 u r f d l b o n t)
 * 本地渲染任意 3x3 贴纸状态。与 <VisualCube>(alg/setup 驱动、走服务端点)互补:
 * 状态没有对应 alg 时(如 LSLL 的 58 万 case)用这个。
 */
import { useMemo } from 'react';
import { renderCubeSVG } from '@cuberoot/visualcube';

export function FaceletsCube({ fd, size = 88, alt = 'Cube state' }: {
  fd: string;
  size?: number;
  alt?: string;
}) {
  const svg = useMemo(
    () => renderCubeSVG({ width: size, height: size, cubeSize: 3, facelets: fd.split('') }),
    [fd, size],
  );
  return (
    <span
      role="img"
      aria-label={alt}
      style={{ display: 'inline-flex', width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
