'use client';

/**
 * 懒挂载容器:children 接近视口后才挂载,默认保持;动画可选离屏卸载。
 *
 * 用途:把「分布」区放到求解区下方同一滚动页时,分布里多数非 3x3 项目仍是**浏览器现场
 * 求解采样**(尚未迁到预生成静态 JSON)—— 若首屏就 eager 渲染,每次进页都会现场跑求解,
 * 正是要消除的卡顿。用 IntersectionObserver 把分布压在折叠线以下、滚到才挂,首屏永远秒开。
 *
 * SSR/SSG:服务端与首帧都渲染占位(min-height 撑住),不依赖 window;mount 后才接 IO。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function LazyVisible({
  children,
  rootMargin = '300px',
  minHeight = 320,
  className,
  unwrapWhenVisible = false,
  unmountWhenHidden = false,
}: {
  children: ReactNode;
  /** 提前量:容器距视口多远就预挂(默认提前 300px,滚到时已就绪) */
  rootMargin?: string;
  /** 未挂载时占位最小高度,避免滚动跳动 */
  minHeight?: number;
  className?: string;
  /** 挂载后移除占位 wrapper,供依赖既有顶层 margin / selector 的内容使用。 */
  unwrapWhenVisible?: boolean;
  /** 离屏卸载动画等持续占用资源的内容;此时保留 wrapper 供持续观察。 */
  unmountWhenHidden?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 老浏览器无 IntersectionObserver:直接挂载(失去懒加载但功能不丢)。
    if (typeof IntersectionObserver === 'undefined') { setShow(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (unmountWhenHidden) {
          setShow(visible);
        } else if (visible) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, unmountWhenHidden]);

  if (show && unwrapWhenVisible && !unmountWhenHidden) return children;

  return (
    <div ref={ref} className={className} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}
