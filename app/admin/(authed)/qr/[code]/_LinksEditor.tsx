"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Menu, Plus, Trash2 } from "lucide-react";
import type { QrLink } from "@/lib/db/qr";
import { linksToText } from "@/lib/qr/links";

// 链接列表所见即所得编辑器:每行按落地页按钮的真实样式渲染(第一条蓝色主按钮,其余白底描边),
// 标签 / 备注 / 链接直接在按钮上改;排序走 iOS 式三横抓手拖动(pointer events,触屏可用)。
// 换位用 FLIP 动画(记录旧位 → transform 反推 → 下一帧过渡)使行平滑滑动。
// 提交仍走隐藏 input(name=links)序列化成「标签 | 链接 | 备注」文本,server action 不变。

type Row = QrLink & { _id: number };
let uidSeq = 0;
const uid = () => (uidSeq += 1);

export function LinksEditor({
  name,
  defaultLinks,
}: {
  name: string;
  defaultLinks: QrLink[];
}) {
  const [links, setLinks] = useState<Row[]>(() =>
    defaultLinks.map((l) => ({ ...l, _id: uid() })),
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Map<number, number>>(new Map());
  // 拖动会话:被拖行 id / 起始指针 y / 起始 offsetTop / 当前期望 top(跟手位置)/ 当前序号
  const dragRef = useRef<{
    id: number;
    startY: number;
    startTop: number;
    desiredTop: number;
    idx: number;
  } | null>(null);

  const dragEl = () =>
    dragRef.current
      ? listRef.current?.querySelector<HTMLElement>(
          `[data-id="${dragRef.current.id}"]`,
        ) ?? null
      : null;

  // FLIP:渲染后比对各行 offsetTop。被挤开的行从旧位平滑过渡;
  // 被拖行不做过渡,直接钉回跟手位置(reorder 改变它的 offsetTop 时视觉无跳变)。
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("[data-id]").forEach((r) => {
      const id = Number(r.dataset.id);
      const top = r.offsetTop;
      const prev = posRef.current.get(id);
      const d = dragRef.current;
      if (d && id === d.id) {
        r.style.transition = "none";
        r.style.transform = `translateY(${d.desiredTop - top}px) scale(1.02)`;
      } else if (prev != null && prev !== top) {
        r.style.transition = "none";
        r.style.transform = `translateY(${prev - top}px)`;
        requestAnimationFrame(() => {
          r.style.transition = "transform 180ms ease";
          r.style.transform = "";
        });
      }
      posRef.current.set(id, top);
    });
  });

  const patch = (i: number, p: Partial<QrLink>) =>
    setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const removeAt = (i: number) => setLinks((ls) => ls.filter((_, j) => j !== i));
  const add = () => setLinks((ls) => [...ls, { label: "", href: "/", _id: uid() }]);

  // 拖动期间在 window 上挂原生 move/up 监听(结束即摘),不依赖合成事件与 pointer capture
  const startDrag = (e: React.PointerEvent, i: number, id: number) => {
    e.preventDefault();
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-row]");
    if (!row) return;
    dragRef.current = {
      id,
      startY: e.clientY,
      startTop: row.offsetTop,
      desiredTop: row.offsetTop,
      idx: i,
    };
    row.style.zIndex = "10";
    row.style.transition = "transform 120ms ease";
    row.style.transform = "scale(1.02)";
    setDragIdx(i);

    // 跟手:直接写被拖行 transform(不经 React,零延迟);跨过其他行中线即换序
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      const el = dragEl();
      if (!d || !el || !listRef.current) return;
      d.desiredTop = d.startTop + (ev.clientY - d.startY);
      el.style.transition = "none";
      el.style.transform = `translateY(${d.desiredTop - el.offsetTop}px) scale(1.02)`;

      const center = d.desiredTop + el.offsetHeight / 2;
      const rows = [
        ...listRef.current.querySelectorAll<HTMLElement>("[data-row]"),
      ];
      // 目标序号 = 中心点压过了多少个其他行的中线
      let target = 0;
      for (const r of rows) {
        if (Number(r.dataset.id) === d.id) continue;
        if (center > r.offsetTop + r.offsetHeight / 2) target += 1;
      }
      if (target !== d.idx) {
        d.idx = target;
        setLinks((ls) => {
          const from = ls.findIndex((l) => l._id === d.id);
          const next = [...ls];
          const [item] = next.splice(from, 1);
          next.splice(target, 0, item);
          return next;
        });
        setDragIdx(target);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const el = dragEl();
      if (el) {
        el.style.transition = "transform 180ms ease";
        el.style.transform = "";
        el.style.zIndex = "";
      }
      dragRef.current = null;
      setDragIdx(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={linksToText(links)} readOnly />

      <div ref={listRef} className="grid gap-2">
        {links.map((l, i) => {
          const primary = i === 0;
          const dragging = dragIdx === i;
          const external = /^https?:\/\//i.test(l.href);
          const Icon = external ? ArrowUpRight : ArrowRight;
          const ctlCls = primary
            ? "text-white/70 hover:text-white"
            : "text-ink-3 hover:text-brand";
          return (
            <div
              key={l._id}
              data-row
              data-id={l._id}
              className={
                "rounded-md px-4 py-3 transition-shadow " +
                (primary
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink-2") +
                (dragging ? " ring-2 ring-brand/60 shadow-lg" : "")
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={l.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    placeholder="按钮文字"
                    className={
                      "w-full bg-transparent text-[14px] font-medium leading-5 outline-none " +
                      (primary
                        ? "text-white placeholder:text-white/50"
                        : "text-ink-2 placeholder:text-ink-3/60")
                    }
                  />
                  <input
                    value={l.note ?? ""}
                    onChange={(e) =>
                      patch(i, { note: e.target.value || undefined })
                    }
                    placeholder="备注小字,可空"
                    className={
                      "w-full bg-transparent text-[12px] leading-4 outline-none " +
                      (primary
                        ? "text-white/80 placeholder:text-white/40"
                        : "text-ink-3 placeholder:text-ink-3/50")
                    }
                  />
                </div>
                <Icon size={16} className="shrink-0 opacity-80" />
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    title="删除此链接"
                    className={ctlCls}
                  >
                    <Trash2 size={14} />
                  </button>
                  <span
                    role="button"
                    aria-label="按住拖动排序"
                    title="按住拖动排序"
                    onPointerDown={(e) => startDrag(e, i, l._id)}
                    className={
                      "touch-none select-none " +
                      ctlCls +
                      (dragging ? " cursor-grabbing" : " cursor-grab")
                    }
                  >
                    <Menu size={16} />
                  </span>
                </span>
              </div>
              <input
                value={l.href}
                onChange={(e) => patch(i, { href: e.target.value })}
                placeholder="/courses 或 https://…"
                className={
                  "mt-1.5 w-full rounded bg-transparent font-mono text-[12px] outline-none " +
                  (primary
                    ? "text-white/70 placeholder:text-white/40"
                    : "text-ink-3 placeholder:text-ink-3/50")
                }
              />
            </div>
          );
        })}
      </div>

      {links.length === 0 ? (
        <p className="text-[12px] text-ink-3">
          暂无链接,落地页将用默认(立即体验 / 进入社群)。
        </p>
      ) : null}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-line px-4 py-2.5 text-[13px] text-ink-3 transition hover:border-brand/40 hover:text-brand"
      >
        <Plus size={14} /> 添加链接
      </button>
      <p className="text-[12px] text-ink-3">
        样式即扫码后落地页的按钮:第一条是蓝色主按钮;按住三横图标拖动排序,顺序就是展示顺序。
      </p>
    </div>
  );
}
