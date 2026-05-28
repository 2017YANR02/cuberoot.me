"use client";

import { useRef, useState, type ReactNode } from "react";

// 轻量 tooltip:desktop hover、移动端点一下显示。
// 用 position:fixed + getBoundingClientRect 定位,escape 表格 overflow 容器不被裁剪。
// 上方空间不足(<96px)时自动翻到下方,避免贴顶被切。
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
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(
    null,
  );

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.top > 96;
    setPos({ x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => setPos(null);

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
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: pos.above ? "translate(-50%,-100%)" : "translate(-50%,0)",
          }}
          className="pointer-events-none z-50 w-max max-w-[min(260px,calc(100vw-24px))] rounded-md bg-ink px-2.5 py-1.5 text-left text-[12px] font-normal leading-snug text-white shadow-lg"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
