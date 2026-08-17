"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// 轻量 tooltip:desktop hover、移动端点一下显示。
// 用 position:fixed + getBoundingClientRect 定位,escape 表格 overflow 容器不被裁剪。
// 上方空间不足(<96px)时自动翻到下方,避免贴顶被切。
// 居中后量一次实际宽度,贴近左/右视口边时整体平移夹回,避免文字溢出被切。
export function Tooltip({
  content,
  children,
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(
    null,
  );
  const [dx, setDx] = useState(0);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.top > 96;
    setDx(0);
    setPos({ x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => setPos(null);

  // 量 tooltip 实际位置,溢出视口则水平平移夹回(留 8px 边距)。
  useLayoutEffect(() => {
    if (!pos) return;
    const t = tipRef.current?.getBoundingClientRect();
    if (!t) return;
    const m = 8;
    let shift = 0;
    if (t.left < m) shift = m - t.left;
    else if (t.right > window.innerWidth - m) shift = window.innerWidth - m - t.right;
    if (shift !== 0) setDx((d) => d + shift);
  }, [pos]);

  return (
    <span
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={show}
      className={"inline-flex cursor-help outline-none " + className}
    >
      {children}
      {pos ? (
        <span
          ref={tipRef}
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.x + dx,
            top: pos.y,
            transform: pos.above ? "translate(-50%,-100%)" : "translate(-50%,0)",
          }}
          className="pointer-events-none z-50 w-max max-w-[min(260px,calc(100vw-24px))] whitespace-normal break-words rounded-md bg-ink px-2.5 py-1.5 text-left text-[12px] font-normal leading-snug text-white shadow-lg"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
