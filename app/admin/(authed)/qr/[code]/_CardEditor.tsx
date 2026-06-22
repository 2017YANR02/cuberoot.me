"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { CardCustomText, CardEl, CardLayout, CardTextStyles, QrCode, QrType, TextStyle } from "@/lib/db/qr";
import { QrCardUnit, FRONT_ARTS } from "@/components/QrCard";
import { FileUpload } from "@/components/FileUpload";
import { algToText, CARD_FONTS, DEFAULT_BRAND, parseAlg } from "@/lib/qr/cardText";

type ElStyle = TextStyle & { hidden?: boolean };
// 可改样式 / 可删除的文字元素
const TEXT_ELS: CardEl[] = ["quote", "brand", "backText", "term", "alg"];

// 所见即所得卡片编辑器(简易 PS):卡上所有元素([data-el])可直接拖动移位,
// 带磁吸对齐(面板中线 / 默认位 / 其他元素中心,洋红参考线提示,Alt 暂时关闭,可整体开关)。
// 元素热区按实际渲染框实测贴合;位移 <4px 视为点击,打开对应编辑面板。
// 偏移(mm)存 layout 字段,DOM 卡与矢量印刷母版同步;隐藏 input 随「保存」提交。

type Region = "art" | "backArt" | "quote" | "brand" | "back" | "alg" | "qr";

const EL_LABEL: Record<CardEl, string> = {
  quote: "正面语录",
  brand: "品牌名",
  backText: "背面文案",
  term: "术语角标",
  qr: "二维码",
  alg: "精选公式",
  front: "正面背景图",
  back: "背面背景图",
};

// 元素点击(非拖动)打开的编辑面板;brand 只可移动无面板
const EL_PANEL: Record<CardEl, Region | null> = {
  quote: "quote",
  brand: "brand",
  backText: "back",
  term: "back",
  qr: "qr",
  alg: "alg",
  front: "art",
  back: "backArt",
};

const ALL_ELS: CardEl[] = ["quote", "brand", "backText", "term", "qr", "alg"];
const PANEL_MM = 20; // 单面板固定宽 20mm,px↔mm 换算基准
const SNAP_MM = 0.6; // 磁吸阈值

const INPUT_CLS =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand";

type Box = { left: number; top: number; w: number; h: number };

// 手势目标:背景图(正/背面)/ 内置元素(二维码等)/ 自建文本框
type GTarget =
  | { kind: "art"; lkey: "front" | "back" }
  | { kind: "el"; key: CardEl }
  | { kind: "ct"; id: string };
// 单指拖动器:move 跟手、end 收尾、tap 点击(无拖动)打开面板
type Dragger = {
  move: (cx: number, cy: number, alt: boolean) => void;
  end: () => void;
  tap: () => void;
};
const gKey = (t: GTarget) =>
  t.kind === "art" ? `art:${t.lkey}` : t.kind === "ct" ? `ct:${t.id}` : `el:${t.key}`;
// 可缩放目标:正/背面背景图 + 二维码 + 自建文本框(双指捏合 / 滚轮缩放)
const gScalable = (t: GTarget) => t.kind === "art" || (t.kind === "el" ? t.key === "qr" : t.kind === "ct");

// 正面 / 背面背景图编辑面板(图库选择 + 上传 + 下载 + 完整显示开关 + 缩放 + 构图提示),两面共用。
// value="" = 无图(正面则为自动轮换);showControls 控制是否显示构图区(正面始终显示,背面有图才显示)。
function ArtPanel({
  value,
  onSelect,
  offLabel,
  offHint,
  uploadLabel,
  downloadLabel,
  downloadable,
  showControls,
  pngBusy,
  onDownload,
  contain,
  onToggleContain,
  scalePct,
  minPct,
  hasOffset,
  onScale,
  onResetOffset,
  dragHint,
  footer,
}: {
  value: string;
  onSelect: (src: string) => void;
  offLabel: string;
  offHint: string;
  uploadLabel: string;
  downloadLabel: string;
  downloadable: boolean;
  showControls: boolean;
  pngBusy: boolean;
  onDownload: () => void;
  contain: boolean;
  onToggleContain: (checked: boolean) => void;
  scalePct: number;
  minPct: number;
  hasOffset: boolean;
  onScale: (pct: number) => void;
  onResetOffset: () => void;
  dragHint: string;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={
            "flex w-[72px] items-center justify-center rounded-md border px-1 text-center text-[11px] leading-tight aspect-[1/2] transition " +
            (value === ""
              ? "border-brand ring-2 ring-brand/30 text-brand"
              : "border-line bg-white text-ink-3 hover:border-brand/40")
          }
        >
          {offLabel}
        </button>
        {FRONT_ARTS.map((o) => (
          <button
            key={o.src}
            type="button"
            onClick={() => onSelect(o.src)}
            className={
              "w-[72px] overflow-hidden rounded-md border bg-white transition " +
              (value === o.src
                ? "border-brand ring-2 ring-brand/30"
                : "border-line hover:border-brand/40")
            }
          >
            {/* 按真实比例完整显示(深色补边),别像 cover 那样裁出假比例误导 */}
            <img src={o.src} alt={o.label} className="block aspect-[1/2] w-full object-contain bg-[#11111A]" />
            <span className="block py-0.5 text-center text-[11px] text-ink-2">{o.label}</span>
          </button>
        ))}
        {value && !FRONT_ARTS.some((o) => o.src === value) ? (
          <span className="w-[72px] overflow-hidden rounded-md border border-brand ring-2 ring-brand/30 bg-white">
            <img src={value} alt="自己上传的图" className="block aspect-[1/2] w-full object-contain bg-[#11111A]" />
            <span className="block py-0.5 text-center text-[11px] text-ink-2">自己上传</span>
          </span>
        ) : null}
      </div>
      <span className="text-[12px] text-ink-3">{offHint}</span>
      <div className="grid grid-cols-2 gap-2">
        <FileUpload accept="image/*" label={uploadLabel} onUploaded={onSelect} />
        {downloadable ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={pngBusy}
            title="下载当前背景图的 PNG 原图,全分辨率无损,可在其他软件二次编辑"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition disabled:opacity-60"
          >
            <Download size={14} /> {pngBusy ? "导出中…" : downloadLabel}
          </button>
        ) : null}
      </div>
      {showControls ? (
        <>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2">
            <input
              type="checkbox"
              checked={contain}
              // 默认勾选=完整显示;勾选时顺带清掉残留平移/缩放,保证一点不裁。取消=铺满整面(超出裁掉)
              onChange={(e) => onToggleContain(e.target.checked)}
              className="accent-brand"
            />
            完整显示整张图,一点不裁
          </label>
          <span className="text-[12px] text-ink-3">
            勾选后整张图缩到能完全装进卡面,四边都保住(预留 1mm,印厂裁歪也碰不到图);图和卡片比例不一致时,空出来的地方是底色。不勾则铺满整面,超出部分裁掉。
          </span>
          <div className="flex items-center gap-2.5 text-[12px] text-ink-2">
            <span className="shrink-0">缩放</span>
            <input
              type="range"
              min={minPct}
              max={300}
              step={1}
              value={scalePct}
              onChange={(e) => onScale(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <span className="w-10 shrink-0 text-right font-mono">{scalePct}%</span>
            {hasOffset ? (
              <button
                type="button"
                onClick={onResetOffset}
                className="shrink-0 text-brand hover:underline"
              >
                复位
              </button>
            ) : null}
          </div>
          <span className="text-[12px] text-ink-3">{dragHint}</span>
        </>
      ) : null}
      {footer}
    </>
  );
}

// 高度随内容自适应的文本域:输入 / 换行即按 scrollHeight 撑高,不出滚动条。
// 走 INPUT_CLS 统一样式,minHeight 兜底初始高度。
function AutoTextarea({
  value,
  onChange,
  placeholder,
  autoFocus,
  minHeight = 52,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto"; // 先收起再量,缩短内容时也能回缩
    const cs = window.getComputedStyle(el);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    el.style.height = Math.max(minHeight, el.scrollHeight + border) + "px";
  }, [value, minHeight]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      rows={1}
      className={INPUT_CLS}
      style={{ minHeight, resize: "none", overflow: "hidden" }}
    />
  );
}

// 单个文字元素的样式控制:字体 / 颜色 / 字号 / 描边 + 删除(隐藏)/ 恢复。built-in 文字与自建文本框共用。
function TextStyleControls({
  label = "文字样式",
  style,
  onChange,
  onToggleHidden,
}: {
  label?: string;
  style: ElStyle | undefined;
  onChange: (patch: Partial<ElStyle>) => void;
  onToggleHidden?: () => void;
}) {
  const hidden = !!style?.hidden;
  const sizePct = Math.round((style?.size ?? 1) * 100);
  const strokeW = style?.strokeW ?? 0;
  return (
    <div className="grid gap-2 rounded-md border border-line bg-white/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-2">{label}</span>
        {onToggleHidden ? (
          <button
            type="button"
            onClick={onToggleHidden}
            className={"text-[12px] hover:underline " + (hidden ? "text-brand" : "text-red-500")}
          >
            {hidden ? "恢复显示" : "删除此文字"}
          </button>
        ) : null}
      </div>
      {hidden ? (
        <span className="text-[12px] text-ink-3">已删除,不会印在卡上。点「恢复显示」找回。</span>
      ) : (
        <>
          <label className="flex items-center gap-2 text-[12px] text-ink-2">
            <span className="w-9 shrink-0 text-ink-3">字体</span>
            <select
              value={style?.font ?? ""}
              onChange={(e) => onChange({ font: e.target.value })}
              className="flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
            >
              <option value="">默认</option>
              {CARD_FONTS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 text-[12px] text-ink-2">
            <span className="w-9 shrink-0 text-ink-3">颜色</span>
            <input
              type="color"
              value={style?.color ?? "#ffffff"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-line bg-white p-0.5"
            />
            {style?.color ? (
              <button type="button" onClick={() => onChange({ color: "" })} className="text-brand hover:underline">
                默认色
              </button>
            ) : (
              <span className="text-ink-3">未改(用默认色)</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-ink-2">
            <span className="w-9 shrink-0 text-ink-3">字号</span>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={sizePct}
              onChange={(e) => onChange({ size: Number(e.target.value) / 100 })}
              className="w-full accent-brand"
            />
            <span className="w-9 shrink-0 text-right font-mono">{sizePct}%</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-ink-2">
            <span className="w-9 shrink-0 text-ink-3">描边</span>
            <input
              type="color"
              value={style?.stroke ?? "#000000"}
              onChange={(e) => onChange({ stroke: e.target.value, strokeW: strokeW || 0.15 })}
              className="h-7 w-10 cursor-pointer rounded border border-line bg-white p-0.5"
            />
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={Math.round(strokeW * 100)}
              onChange={(e) => onChange({ strokeW: Number(e.target.value) / 100 })}
              className="w-full accent-brand"
            />
            <span className="w-12 shrink-0 text-right font-mono">{strokeW.toFixed(2)}mm</span>
          </div>
          <span className="text-[12px] text-ink-3">
            描边粗细拖到 0 = 不描边。文字压在图片上看不清时,描个边(常配白色)就清楚了。
          </span>
        </>
      )}
    </div>
  );
}

export function CardEditor({
  entry,
  svg,
  formId,
  landingUrl,
}: {
  entry: QrCode;
  svg: string;
  formId: string;
  landingUrl: string;
}) {
  const [s, setS] = useState({
    type: entry.type as QrType,
    target: entry.target,
    title: entry.title ?? "",
    term: entry.term ?? "",
    intro: entry.intro ?? "",
    quote: entry.quote ?? "",
    brand: entry.brand ?? "",
    art: entry.frontArt ?? "",
    backArt: entry.backArt ?? "",
    algRaw: algToText(entry.alg),
    layout: (entry.layout ?? {}) as CardLayout,
    textStyles: (entry.textStyles ?? {}) as CardTextStyles,
    customTexts: (entry.customTexts ?? []) as CardCustomText[],
  });
  const [active, setActive] = useState<Region | null>(null);
  // 选中的自建文本框 id(与 active 互斥:选内置元素清 ct,选文本框清 active)
  const [activeCt, setActiveCt] = useState<string | null>(null);
  // 背面图存在性的实时快照(滚轮缩放 handler 在 [] effect 里,靠 ref 读最新值)
  const backArtRef = useRef("");
  backArtRef.current = s.backArt;
  const [snapOn, setSnapOn] = useState(true);
  // 拖动中的对齐参考线(相对卡片容器 px)
  const [guides, setGuides] = useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] });
  const wrapRef = useRef<HTMLDivElement>(null);
  // 各元素实测框(相对卡片容器 px),热区据此贴合渲染;key 为 CardEl 或 "ct:<id>"(自建文本框)
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  // 进行中的指针手势(单指拖动 / 双指捏合):指针表 + 当前拖动器 + 捏合状态
  const gestureRef = useRef<null | {
    target: GTarget;
    pointers: Map<number, { x: number; y: number }>;
    dragger: Dragger | null;
    startX: number;
    startY: number;
    moved: boolean;
    scaled: boolean;
    pinch: { startDist: number; startScale: number; apply: (sc: number) => void } | null;
  }>(null);

  // 悬停背景图滚轮缩放(native 非 passive 监听才能 preventDefault 拦住页面滚动);
  // 挂在整卡容器上、按坐标判定在哪个面板内,盖在语录/品牌/文案热区上时也能缩放。
  // 正面始终可缩;背面仅在设了背景图时拦滚动并缩放(无图不打断页面滚动)。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const inPanel = (sel: string, e: WheelEvent) => {
      const panel = wrap.querySelector<HTMLElement>(sel);
      if (!panel) return false;
      const r = panel.getBoundingClientRect();
      return !(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
    };
    const overEl = (sel: string, e: WheelEvent) => {
      const el = wrap.querySelector<HTMLElement>(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return !(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
    };
    const onWheel = (e: WheelEvent) => {
      // 先判二维码(小、在最上层):悬停其上滚轮缩放二维码
      if (overEl('[data-el="qr"]', e)) {
        e.preventDefault();
        setS((p) => {
          const cur = p.layout.qr ?? { x: 0, y: 0 };
          const next =
            Math.round(Math.max(0.01, Math.min(1.5, (cur.s ?? 1) * Math.exp(-e.deltaY * 0.002))) * 100) / 100;
          const layout = { ...p.layout };
          if (cur.x === 0 && cur.y === 0 && next === 1) delete layout.qr;
          else layout.qr = { x: cur.x, y: cur.y, ...(next === 1 ? {} : { s: next }) };
          return { ...p, layout };
        });
        return;
      }
      const lkey: "front" | "back" | null = inPanel('[data-panel="front"]', e)
        ? "front"
        : inPanel('[data-panel="back"]', e)
          ? "back"
          : null;
      if (!lkey) return;
      if (lkey === "back" && !backArtRef.current) return; // 背面无图,不拦页面滚动
      e.preventDefault();
      setS((p) => {
        const cur = { x: 0, y: 0, s: 1, ...p.layout[lkey] };
        const floor = cur.fit === "cover" ? 1 : 0.5; // cover 不能缩到露底
        const next =
          Math.round(Math.max(floor, Math.min(3, cur.s * Math.exp(-e.deltaY * 0.002))) * 100) / 100;
        const layout = { ...p.layout };
        if (cur.x === 0 && cur.y === 0 && next === 1 && !cur.fit) delete layout[lkey];
        else layout[lkey] = { ...cur, s: next };
        return { ...p, layout };
      });
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  // 统一指针手势:单指拖动 / 双指捏合缩放(移动端手势,与桌面滚轮 / 滑块共存)。
  // 全局监听只读 gestureRef + 已存的 dragger/pinch 闭包,避免随渲染换引用。
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || !g.pointers.has(ev.pointerId)) return;
      g.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (g.pinch && g.pointers.size >= 2) {
        const pts = [...g.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        g.pinch.apply(g.pinch.startScale * (dist / g.pinch.startDist));
        g.scaled = true;
        return;
      }
      if (g.dragger) {
        if (Math.abs(ev.clientX - g.startX) + Math.abs(ev.clientY - g.startY) > 4) g.moved = true;
        if (g.moved) g.dragger.move(ev.clientX, ev.clientY, ev.altKey);
      }
    };
    const onUp = (ev: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      g.pointers.delete(ev.pointerId);
      if (g.pointers.size === 0) {
        const d = g.dragger;
        const tapped = !g.moved && !g.scaled;
        gestureRef.current = null;
        d?.end();
        if (tapped) d?.tap();
      } else if (g.pinch && g.pointers.size < 2) {
        // 捏合后还剩一指:结束本次手势的后续动作,避免突然跳变
        g.pinch = null;
        g.dragger = null;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    const sync = (e: Event) => {
      const t = e.target as (HTMLInputElement | HTMLSelectElement) | null;
      if (!t?.name) return;
      if (t.name === "type")
        setS((p) => ({ ...p, type: t.value === "landing" ? "landing" : "redirect" }));
      if (t.name === "target") setS((p) => ({ ...p, target: t.value }));
    };
    document.addEventListener("change", sync);
    document.addEventListener("input", sync);
    return () => {
      document.removeEventListener("change", sync);
      document.removeEventListener("input", sync);
    };
  }, []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const next: Record<string, Box> = {};
    wrap.querySelectorAll<HTMLElement>("[data-el]").forEach((el) => {
      const key = el.dataset.el;
      if (!key) return;
      const r = el.getBoundingClientRect();
      next[key] = { left: r.left - wr.left, top: r.top - wr.top, w: r.width, h: r.height };
    });
    setBoxes((prev) => {
      const keys = new Set([...Object.keys(next), ...Object.keys(prev)]);
      let changed = false;
      for (const k of keys) {
        const a = prev[k];
        const b = next[k];
        if (!a || !b) {
          changed = true;
          break;
        }
        if (
          Math.abs(a.left - b.left) > 0.5 ||
          Math.abs(a.top - b.top) > 0.5 ||
          Math.abs(a.w - b.w) > 0.5 ||
          Math.abs(a.h - b.h) > 0.5
        ) {
          changed = true;
          break;
        }
      }
      return changed ? next : prev;
    });
  });

  const set = (k: keyof typeof s) => (v: string) => setS((p) => ({ ...p, [k]: v }));
  const setOffset = (key: CardEl, off: { x: number; y: number } | null) =>
    setS((p) => {
      const layout = { ...p.layout };
      // 拖动只改位移,保留已有缩放 s(二维码可缩放,别被拖动清掉);off=null 整体复位
      if (off) {
        const prevS = p.layout[key]?.s;
        layout[key] = prevS !== undefined ? { ...off, s: prevS } : off;
      } else delete layout[key];
      return { ...p, layout };
    });
  // 二维码缩放 s:保留位移 x/y;回到 ×1 且无位移就删键
  const setQrScale = (sc: number) =>
    setS((p) => {
      const prev = p.layout.qr ?? { x: 0, y: 0 };
      const next: { x: number; y: number; s?: number } = { x: prev.x, y: prev.y };
      if (sc !== 1) next.s = sc;
      const layout = { ...p.layout };
      if (next.x === 0 && next.y === 0 && next.s === undefined) delete layout.qr;
      else layout.qr = next;
      return { ...p, layout };
    });
  const qrScalePct = Math.round((s.layout.qr?.s ?? 1) * 100);
  // 文字样式增量合并:清掉空值(空字体/空色/×1 字号/0 描边/false 隐藏),全空则删键
  const setTextStyle = (key: CardEl, patch: Partial<ElStyle>) =>
    setS((p) => {
      const cur: ElStyle = { ...p.textStyles[key], ...patch };
      const clean: ElStyle = {};
      if (cur.font) clean.font = cur.font;
      if (cur.color) clean.color = cur.color;
      if (cur.size && cur.size !== 1) clean.size = cur.size;
      if (cur.stroke && cur.strokeW) {
        clean.stroke = cur.stroke;
        clean.strokeW = cur.strokeW;
      }
      if (cur.hidden) clean.hidden = true;
      const next = { ...p.textStyles };
      if (Object.keys(clean).length) next[key] = clean;
      else delete next[key];
      return { ...p, textStyles: next };
    });
  const toggleHidden = (key: CardEl) =>
    setTextStyle(key, { hidden: !s.textStyles[key]?.hidden });
  const hiddenTextEls = TEXT_ELS.filter((k) => s.textStyles[k]?.hidden);

  // ── 自建文本框 ──
  const addCustomText = (side: "front" | "back") => {
    const id = "t" + Math.random().toString(36).slice(2, 9);
    setS((p) => ({
      ...p,
      customTexts: [...p.customTexts, { id, side, text: "新文字", x: 0, y: 0 }],
    }));
    setActive(null);
    setActiveCt(id);
  };
  const updateCustomText = (id: string, patch: Partial<CardCustomText>) =>
    setS((p) => ({
      ...p,
      customTexts: p.customTexts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  const setCtStyle = (id: string, patch: Partial<TextStyle>) =>
    setS((p) => ({
      ...p,
      customTexts: p.customTexts.map((c) => {
        if (c.id !== id) return c;
        const st: TextStyle = { ...c.style, ...patch };
        if (!st.font) delete st.font;
        if (!st.color) delete st.color;
        if (!st.stroke || !st.strokeW) {
          delete st.stroke;
          delete st.strokeW;
        }
        return { ...c, style: Object.keys(st).length ? st : undefined };
      }),
    }));
  const removeCustomText = (id: string) => {
    setS((p) => ({ ...p, customTexts: p.customTexts.filter((c) => c.id !== id) }));
    setActiveCt((a) => (a === id ? null : a));
  };
  const activeCustom = s.customTexts.find((c) => c.id === activeCt) ?? null;
  // 背景图平移/缩放/完整显示(layout.front 或 layout.back):增量合并,回默认(0,0,×1,铺满)就删键
  const setArt =
    (lkey: "front" | "back") =>
    (patch: Partial<{ x: number; y: number; s: number; fit?: "cover" }>) =>
      setS((p) => {
        const next = { x: 0, y: 0, s: 1, ...p.layout[lkey], ...patch };
        if (next.fit === "cover") next.s = Math.max(1, next.s); // cover 缩放只放大,保证铺满不露底
        const layout = { ...p.layout };
        if (next.x === 0 && next.y === 0 && next.s === 1 && !next.fit) delete layout[lkey];
        else layout[lkey] = next;
        return { ...p, layout };
      });
  const setFront = setArt("front");
  const setBack = setArt("back");

  // 捏合 / 滚轮缩放落地:背景图按 cover/contain 钳缩放,二维码钳 0.01~1.5,自建文本框走字号 0.3~3
  const applyPinch = (target: GTarget, raw: number) => {
    if (target.kind === "art") {
      const cover = s.layout[target.lkey]?.fit === "cover";
      const sc = Math.round(Math.max(cover ? 1 : 0.5, Math.min(3, raw)) * 100) / 100;
      setArt(target.lkey)({ s: sc });
    } else if (target.kind === "el" && target.key === "qr") {
      setQrScale(Math.round(Math.max(0.01, Math.min(1.5, raw)) * 100) / 100);
    } else if (target.kind === "ct") {
      setCtStyle(target.id, { size: Math.round(Math.max(0.3, Math.min(3, raw)) * 100) / 100 });
    }
  };
  const currentScale = (target: GTarget): number =>
    target.kind === "art"
      ? s.layout[target.lkey]?.s ?? 1
      : target.kind === "ct"
        ? s.customTexts.find((c) => c.id === target.id)?.style?.size ?? 1
        : target.key === "qr"
          ? s.layout.qr?.s ?? 1
          : 1;

  // 通用单指拖动器:跟手换算 mm,磁吸到 面板中线 / 默认位 / 同面板其他元素中心。
  // free=true(二维码)可跨整卡移动并吸附两面中线;否则限本面板。off0 + write 由调用方按存储位置接入。
  const makeBoxDragger = (
    opts: {
      selKey: string;
      off0: { x: number; y: number };
      free: boolean;
      write: (o: { x: number; y: number }) => void;
      onTap: () => void;
    },
    sx: number,
    sy: number,
  ): Dragger | null => {
    const { selKey, off0, free, write, onTap } = opts;
    const wrap = wrapRef.current;
    const el = wrap?.querySelector<HTMLElement>(`[data-el="${selKey}"]`);
    const panel = el?.closest<HTMLElement>("[data-panel]");
    if (!wrap || !el || !panel) return null;
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const pxPerMm = pr.width / PANEL_MM;
    const baseL = er.left - off0.x * pxPerMm;
    const baseT = er.top - off0.y * pxPerMm;
    const bcx = baseL + er.width / 2;
    const bcy = baseT + er.height / 2;
    const bounds = free ? wr : pr;
    const targetsX = [pr.left + pr.width / 2, bcx];
    const targetsY = [pr.top + pr.height / 2, bcy];
    if (free) {
      wrap.querySelectorAll<HTMLElement>("[data-panel]").forEach((pn) => {
        const r = pn.getBoundingClientRect();
        targetsX.push(r.left + r.width / 2);
      });
    }
    wrap.querySelectorAll<HTMLElement>("[data-el]").forEach((other) => {
      if (other === el || other.closest("[data-panel]") !== panel) return;
      const r = other.getBoundingClientRect();
      targetsX.push(r.left + r.width / 2);
      targetsY.push(r.top + r.height / 2);
    });
    const mg = 0.3 * pxPerMm;
    const minX = (bounds.left + mg - baseL) / pxPerMm;
    const maxX = (bounds.right - mg - (baseL + er.width)) / pxPerMm;
    const minY = (bounds.top + mg - baseT) / pxPerMm;
    const maxY = (bounds.bottom - mg - (baseT + er.height)) / pxPerMm;
    const snapPx = SNAP_MM * pxPerMm;
    return {
      move(cx, cy, alt) {
        let ox = Math.min(maxX, Math.max(minX, off0.x + (cx - sx) / pxPerMm));
        let oy = Math.min(maxY, Math.max(minY, off0.y + (cy - sy) / pxPerMm));
        const xs: number[] = [];
        const ys: number[] = [];
        if (snapOn && !alt) {
          const ccx = bcx + ox * pxPerMm;
          const ccy = bcy + oy * pxPerMm;
          for (const tx of targetsX) {
            if (Math.abs(ccx - tx) < snapPx) { ox = (tx - bcx) / pxPerMm; xs.push(tx - wr.left); break; }
          }
          for (const ty of targetsY) {
            if (Math.abs(ccy - ty) < snapPx) { oy = (ty - bcy) / pxPerMm; ys.push(ty - wr.top); break; }
          }
        }
        setGuides({ xs, ys });
        write({ x: Math.round(ox * 20) / 20, y: Math.round(oy * 20) / 20 });
      },
      end() { setGuides({ xs: [], ys: [] }); },
      tap: onTap,
    };
  };

  const makeElDragger = (key: CardEl, sx: number, sy: number): Dragger | null =>
    makeBoxDragger(
      {
        selKey: key,
        off0: s.layout[key] ?? { x: 0, y: 0 },
        // 所有内置元素都可跨折线拖到对面(原仅二维码可),边界放到整卡
        free: true,
        write: (o) => setOffset(key, o),
        onTap: () => {
          const pnl = EL_PANEL[key];
          if (pnl) {
            setActiveCt(null);
            setActive((a) => (a === pnl ? null : pnl));
          }
        },
      },
      sx,
      sy,
    );

  // 自建文本框拖动:可跨折线拖到对面(side 字段不变,靠位移跨面),点击选中打开其编辑面板
  const makeCtDragger = (id: string, sx: number, sy: number): Dragger | null => {
    const ct = s.customTexts.find((c) => c.id === id);
    if (!ct) return null;
    return makeBoxDragger(
      {
        selKey: `ct:${id}`,
        off0: { x: ct.x, y: ct.y },
        free: true,
        write: (o) => updateCustomText(id, o),
        onTap: () => {
          setActive(null);
          setActiveCt((a) => (a === id ? null : id));
        },
      },
      sx,
      sy,
    );
  };

  // 单指拖动器(背景图):平移构图,磁吸回默认位;背面无图只点击打开面板(不平移)
  const makeArtDragger = (lkey: "front" | "back", sx: number, sy: number): Dragger | null => {
    const sel = lkey === "front" ? '[data-panel="front"]' : '[data-panel="back"]';
    const panel = wrapRef.current?.querySelector<HTMLElement>(sel);
    if (!panel) return null;
    const pxPerMm = panel.getBoundingClientRect().width / PANEL_MM;
    const f0 = { x: 0, y: 0, ...s.layout[lkey] };
    const hasArt = lkey === "front" ? true : !!s.backArt;
    const setFn = lkey === "front" ? setFront : setBack;
    const region: Region = lkey === "front" ? "art" : "backArt";
    return {
      move(cx, cy, alt) {
        if (!hasArt) return;
        let ox = Math.max(-20, Math.min(20, f0.x + (cx - sx) / pxPerMm));
        let oy = Math.max(-20, Math.min(20, f0.y + (cy - sy) / pxPerMm));
        if (snapOn && !alt) {
          if (Math.abs(ox) < SNAP_MM) ox = 0;
          if (Math.abs(oy) < SNAP_MM) oy = 0;
        }
        setFn({ x: Math.round(ox * 20) / 20, y: Math.round(oy * 20) / 20 });
      },
      end() {},
      tap() {
        setActiveCt(null);
        setActive((a) => (a === region ? null : region));
      },
    };
  };

  // 统一手势入口(各热区 onPointerDown 调):第 1 指起拖动,第 2 指(可缩放目标)起捏合缩放
  const startGesture = (e: React.PointerEvent, target: GTarget) => {
    e.preventDefault();
    let g = gestureRef.current;
    if (g && gKey(g.target) !== gKey(target)) return; // 另一目标手势进行中,忽略
    if (!g) {
      g = {
        target,
        pointers: new Map(),
        dragger: null,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        scaled: false,
        pinch: null,
      };
      gestureRef.current = g;
    }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // 背面无背景图时不进缩放(避免存下看不见的缩放)
    const canScale =
      gScalable(target) && (target.kind !== "art" || target.lkey === "front" || !!s.backArt);
    if (g.pointers.size === 2 && canScale) {
      const pts = [...g.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      g.pinch = { startDist: dist, startScale: currentScale(target), apply: (sc) => applyPinch(target, sc) };
      g.dragger = null; // 捏合时挂起拖动
    } else if (g.pointers.size === 1) {
      g.startX = e.clientX;
      g.startY = e.clientY;
      g.dragger =
        target.kind === "art"
          ? makeArtDragger(target.lkey, e.clientX, e.clientY)
          : target.kind === "ct"
            ? makeCtDragger(target.id, e.clientX, e.clientY)
            : makeElDragger(target.key, e.clientX, e.clientY);
    }
  };

  // 把指定背景图(全分辨率)转 PNG 下载:canvas 画原图再导出,像素与原图一致、无损。
  // 同源(/card、/uploads)不会污染 canvas;外链转换失败则退回直接打开原图。
  const [pngBusy, setPngBusy] = useState(false);
  const downloadPng = async (rawSrc: string) => {
    if (pngBusy) return;
    const src = rawSrc || FRONT_ARTS[0].src;
    const base = (src.split("/").pop() || "card-art").replace(/\.[^.]+$/, "");
    setPngBusy(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("toBlob null");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank", "noopener");
    } finally {
      setPngBusy(false);
    }
  };

  const merged: QrCode = {
    ...entry,
    type: s.type,
    target: s.target.trim() || "/",
    title: s.title.trim() || null,
    term: s.term.trim() || null,
    intro: s.intro.trim() || null,
    quote: s.quote.trim() || null,
    brand: s.brand.trim() || null,
    frontArt: s.art.trim() || null,
    backArt: s.backArt.trim() || null,
    alg: parseAlg(s.algRaw),
    layout: s.layout,
    textStyles: s.textStyles,
    customTexts: s.customTexts,
  };
  const hasOffsets = Object.keys(s.layout).length > 0;
  // 背景图缩放:cover 钳到 ≥100%(滑块与渲染一致,WYSIWYG),contain 可缩到 50%
  const frontIsCover = s.layout.front?.fit === "cover";
  const frontScalePct = Math.round(
    Math.max(frontIsCover ? 1 : 0.5, s.layout.front?.s ?? 1) * 100,
  );
  const backIsCover = s.layout.back?.fit === "cover";
  const backScalePct = Math.round(
    Math.max(backIsCover ? 1 : 0.5, s.layout.back?.s ?? 1) * 100,
  );

  return (
    <div>
      {/* 提交值(挂到左侧表单,随保存一起走) */}
      <input type="hidden" name="title" value={s.title} form={formId} readOnly />
      <input type="hidden" name="term" value={s.term} form={formId} readOnly />
      <input type="hidden" name="intro" value={s.intro} form={formId} readOnly />
      <input type="hidden" name="quote" value={s.quote} form={formId} readOnly />
      <input type="hidden" name="brand" value={s.brand} form={formId} readOnly />
      <input type="hidden" name="frontArt" value={s.art} form={formId} readOnly />
      <input type="hidden" name="backArt" value={s.backArt} form={formId} readOnly />
      <input type="hidden" name="alg" value={s.algRaw} form={formId} readOnly />
      <input
        type="hidden"
        name="layout"
        value={JSON.stringify(s.layout)}
        form={formId}
        readOnly
      />
      <input
        type="hidden"
        name="textStyles"
        value={JSON.stringify(s.textStyles)}
        form={formId}
        readOnly
      />
      <input
        type="hidden"
        name="customTexts"
        value={JSON.stringify(s.customTexts)}
        form={formId}
        readOnly
      />

      {/* 左:卡片预览(点元素拖动构图);右:被选元素的编辑面板 */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      {/* px/py 给四角裁切线留出成品边外的空间,免被 overflow 裁掉 */}
      <div className="overflow-x-auto px-12 py-12">
        <div
          ref={wrapRef}
          className="relative mx-auto w-fit [--s:2.2] sm:[--s:2.8] xl:[--s:3.4]"
        >
          <QrCardUnit entry={merged} svg={svg} cropMarks />
          {/* 正面背景图:正面板底层热区(元素热区叠在其上),拖动平移构图,点击打开图库面板 */}
          <span
            role="button"
            title="拖动调整构图,点击编辑:正面背景图"
            aria-label="正面背景图"
            onPointerDown={(e) => startGesture(e, { kind: "art", lkey: "front" })}
            className={
              "absolute touch-none select-none rounded-md transition " +
              (active === "art"
                ? "ring-2 ring-brand bg-brand/10 cursor-grab"
                : "cursor-grab hover:ring-2 hover:ring-brand/50 hover:bg-brand/5")
            }
            style={{ left: 0, top: 0, width: "50%", height: "100%", zIndex: 5 }}
          />
          {/* 背面背景图:背面板底层热区(文案/二维码热区叠在其上),点击打开图库面板,设了图可拖动平移 */}
          <span
            role="button"
            title={s.backArt ? "拖动调整构图,点击编辑:背面背景图" : "点击设置:背面背景图"}
            aria-label="背面背景图"
            onPointerDown={(e) => startGesture(e, { kind: "art", lkey: "back" })}
            className={
              "absolute touch-none select-none rounded-md transition " +
              (active === "backArt"
                ? "ring-2 ring-brand bg-brand/10 cursor-grab"
                : "cursor-pointer hover:ring-2 hover:ring-brand/50 hover:bg-brand/5")
            }
            style={{ left: "50%", top: 0, width: "50%", height: "100%", zIndex: 5 }}
          />
          {/* 内置元素热区:实测贴合,可拖动移位;点击打开对应面板 */}
          {ALL_ELS.map((key) => {
            const b = boxes[key];
            if (!b) return null;
            return (
              <span
                key={key}
                role="button"
                aria-label={EL_LABEL[key]}
                title={`拖动移动:${EL_LABEL[key]}`}
                onPointerDown={(e) => startGesture(e, { kind: "el", key })}
                className={
                  "absolute touch-none select-none rounded transition " +
                  (EL_PANEL[key] && active === EL_PANEL[key]
                    ? "ring-2 ring-brand bg-brand/10 cursor-grab"
                    : "cursor-grab hover:ring-2 hover:ring-brand/50 hover:bg-brand/5")
                }
                style={{ left: b.left, top: b.top, width: b.w, height: b.h, zIndex: 6 }}
              />
            );
          })}
          {/* 自建文本框热区:可拖动,点击选中编辑 */}
          {s.customTexts.map((ct) => {
            const b = boxes[`ct:${ct.id}`];
            if (!b) return null;
            return (
              <span
                key={ct.id}
                role="button"
                aria-label={`自建文字:${ct.text.slice(0, 6)}`}
                title="拖动移动 / 点击编辑此文本框"
                onPointerDown={(e) => startGesture(e, { kind: "ct", id: ct.id })}
                className={
                  "absolute touch-none select-none rounded transition " +
                  (activeCt === ct.id
                    ? "ring-2 ring-brand bg-brand/10 cursor-grab"
                    : "cursor-grab hover:ring-2 hover:ring-brand/50 hover:bg-brand/5")
                }
                style={{ left: b.left, top: b.top, width: b.w, height: b.h, zIndex: 6 }}
              />
            );
          })}
          {/* 磁吸参考线(洋红,PS 风) */}
          {guides.xs.map((x) => (
            <span
              key={`gx${x}`}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: x, top: 0, width: 1, height: "100%", background: "#FF2D92", zIndex: 7 }}
            />
          ))}
          {guides.ys.map((y) => (
            <span
              key={`gy${y}`}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: 0, top: y, width: "100%", height: 1, background: "#FF2D92", zIndex: 7 }}
            />
          ))}
        </div>
      </div>

      <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span>点元素编辑,按住拖动移位;改完点右上角「保存」生效。</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={snapOn}
            onChange={(e) => setSnapOn(e.target.checked)}
            className="accent-brand"
          />
          磁吸对齐(按住 Alt 暂时关闭)
        </label>
        {hasOffsets ? (
          <button
            type="button"
            onClick={() => setS((p) => ({ ...p, layout: {} }))}
            className="text-brand hover:underline"
          >
            重置全部位置
          </button>
        ) : null}
        {hiddenTextEls.length ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>已删文字:</span>
            {hiddenTextEls.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleHidden(k)}
                className="rounded-full border border-line px-2 py-0.5 text-brand hover:border-brand/40"
              >
                + {EL_LABEL[k]}
              </button>
            ))}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span>加文字:</span>
          <button
            type="button"
            onClick={() => addCustomText("front")}
            className="rounded-full border border-line px-2 py-0.5 text-brand hover:border-brand/40"
          >
            + 正面
          </button>
          <button
            type="button"
            onClick={() => addCustomText("back")}
            className="rounded-full border border-line px-2 py-0.5 text-brand hover:border-brand/40"
          >
            + 背面
          </button>
        </span>
      </div>

      {activeCt && activeCustom ? (
        <div className="mt-3 rounded-md border border-line bg-bg-soft p-3 grid gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">文本框</span>
            <button
              type="button"
              onClick={() => setActiveCt(null)}
              className="text-[12px] text-ink-3 hover:text-brand"
            >
              收起
            </button>
          </div>
          <AutoTextarea
            value={activeCustom.text}
            onChange={(v) => updateCustomText(activeCt, { text: v })}
            placeholder="输入文字,可多行"
            autoFocus
          />
          <div className="flex items-center gap-2 text-[12px] text-ink-2">
            <span className="text-ink-3">所在面</span>
            <div className="inline-flex overflow-hidden rounded-md border border-line">
              {(["front", "back"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => updateCustomText(activeCt, { side })}
                  className={
                    "px-3 py-1 transition " +
                    (activeCustom.side === side
                      ? "bg-brand text-white"
                      : "bg-white text-ink-2 hover:text-brand")
                  }
                >
                  {side === "front" ? "正面" : "背面"}
                </button>
              ))}
            </div>
          </div>
          <TextStyleControls
            style={activeCustom.style}
            onChange={(p) => setCtStyle(activeCt, p)}
          />
          <button
            type="button"
            onClick={() => removeCustomText(activeCt)}
            className="justify-self-start text-[12px] text-red-500 hover:underline"
          >
            删除此文本框
          </button>
        </div>
      ) : active ? (
        <div className="mt-3 rounded-md border border-line bg-bg-soft p-3 grid gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">
              {active === "art"
                ? "正面背景图"
                : active === "backArt"
                  ? "背面背景图"
                  : active === "quote"
                    ? "正面语录"
                    : active === "brand"
                      ? "品牌名"
                      : active === "back"
                        ? "背面文案(标题 / 简介 / 角标)"
                        : active === "alg"
                          ? "背面精选公式"
                          : "二维码"}
            </span>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-[12px] text-ink-3 hover:text-brand"
            >
              收起
            </button>
          </div>

          {active === "art" ? (
            <ArtPanel
              value={s.art}
              onSelect={(src) => set("art")(src)}
              offLabel="自动轮换"
              offHint="自动轮换:不固定用图,批量打印时按卡片顺序轮流分配图库的图;在意印出来是哪张就选定一张。"
              uploadLabel="上传自己的正面图"
              downloadLabel="下载正面图 PNG"
              downloadable
              showControls
              pngBusy={pngBusy}
              onDownload={() => downloadPng(s.art)}
              contain={s.layout.front?.fit !== "cover"}
              onToggleContain={(checked) =>
                setFront(checked ? { fit: undefined, x: 0, y: 0, s: 1 } : { fit: "cover" })
              }
              scalePct={frontScalePct}
              minPct={frontIsCover ? 100 : 50}
              hasOffset={!!s.layout.front}
              onScale={(pct) => setFront({ s: pct / 100 })}
              onResetOffset={() => setOffset("front", null)}
              dragHint="直接拖卡面上的图挪构图,手机两指捏合 / 鼠标滚轮可缩放;铺满模式只能放大(裁掉更多边缘),要看更全整张图就勾上面的「完整显示」。预览即裁切后成品,出血里多印的部分会被裁掉。"
              footer={
                <span className="mt-1 block border-t border-line pt-3 text-[12px] leading-relaxed text-ink-3">
                  想生成 / 换一张正面图?到下方「用 AI 生成新背景图」按维度拼提示词,生图后用上面的「上传自己的正面图」传回来。
                </span>
              }
            />
          ) : null}

          {active === "backArt" ? (
            <ArtPanel
              value={s.backArt}
              onSelect={(src) => set("backArt")(src)}
              offLabel="无背景图"
              offHint="背面默认是浅色魔方底纹 + 公式。选一张图或上传自己的图作背景;文字压在图上看不清,就点对应文字给它描个边。二维码自带白底不受影响。"
              uploadLabel="上传背面背景图"
              downloadLabel="下载背面图 PNG"
              downloadable={!!s.backArt}
              showControls={!!s.backArt}
              pngBusy={pngBusy}
              onDownload={() => downloadPng(s.backArt)}
              contain={s.layout.back?.fit !== "cover"}
              onToggleContain={(checked) =>
                setBack(checked ? { fit: undefined, x: 0, y: 0, s: 1 } : { fit: "cover" })
              }
              scalePct={backScalePct}
              minPct={backIsCover ? 100 : 50}
              hasOffset={!!s.layout.back}
              onScale={(pct) => setBack({ s: pct / 100 })}
              onResetOffset={() => setOffset("back", null)}
              dragHint="直接拖背面卡上的图挪构图,手机两指捏合 / 鼠标滚轮可缩放;预览即裁切后成品,出血里多印的部分会被裁掉。"
              footer={
                <span className="mt-1 block border-t border-line pt-3 text-[12px] leading-relaxed text-ink-3">
                  想生成 / 换一张背面图?到下方「用 AI 生成新背景图」按维度拼提示词,生图后用上面的「上传背面背景图」传回来。
                </span>
              }
            />
          ) : null}

          {active === "quote" ? (
            <>
              <AutoTextarea
                value={s.quote}
                onChange={set("quote")}
                placeholder={"慢就是快\n一次打乱 一次成长"}
                minHeight={64}
                autoFocus
              />
              <span className="text-[12px] text-ink-3">
                第一行大字,其余行小字;留空用默认语录轮换。
              </span>
              <TextStyleControls
                style={s.textStyles.quote}
                onChange={(p) => setTextStyle("quote", p)}
                onToggleHidden={() => toggleHidden("quote")}
              />
            </>
          ) : null}

          {active === "brand" ? (
            <>
              <input
                value={s.brand}
                onChange={(e) => set("brand")(e.target.value)}
                placeholder={DEFAULT_BRAND + "(留空用此默认)"}
                className={INPUT_CLS}
                autoFocus
              />
              <span className="text-[12px] text-ink-3">
                正面底部那行社群名,改成你自己的;留空就用默认「{DEFAULT_BRAND}」。
              </span>
              <TextStyleControls
                style={s.textStyles.brand}
                onChange={(p) => setTextStyle("brand", p)}
                onToggleHidden={() => toggleHidden("brand")}
              />
            </>
          ) : null}

          {active === "back" ? (
            <>
              <AutoTextarea
                value={s.title}
                onChange={set("title")}
                placeholder={"标题,可换行(回车分多行)\n留空用默认,也是落地页大标题"}
                autoFocus
              />
              <AutoTextarea
                value={s.intro}
                onChange={set("intro")}
                placeholder="简介,留空不显示(也是落地页副标题)"
              />
              <TextStyleControls
                label="标题 / 简介样式"
                style={s.textStyles.backText}
                onChange={(p) => setTextStyle("backText", p)}
                onToggleHidden={() => toggleHidden("backText")}
              />
              <input
                value={s.term}
                onChange={(e) => set("term")(e.target.value)}
                placeholder="魔方术语角标,如 CFOP / OLL / F2L"
                className={INPUT_CLS}
              />
              <TextStyleControls
                label="角标样式"
                style={s.textStyles.term}
                onChange={(p) => setTextStyle("term", p)}
                onToggleHidden={() => toggleHidden("term")}
              />
            </>
          ) : null}

          {active === "alg" ? (
            <>
              <input
                value={s.algRaw}
                onChange={(e) => set("algRaw")(e.target.value)}
                placeholder="OLL 33 | R U R' U' R' F R F' | /zh/alg/3x3/oll"
                className={INPUT_CLS + " font-mono"}
                autoFocus
              />
              <span className="text-[12px] leading-relaxed text-ink-3">
                格式:<span className="font-mono">名称 | 记法 | 链接</span>
                (后两段可省)。小魔方案例图按记法<span className="text-ink-2">自动生成</span>
                ,不用传图;名称含 OLL / PLL 顶视、F2L 立体;链接是角标跳转页。
              </span>
              <TextStyleControls
                label="记法样式"
                style={s.textStyles.alg}
                onChange={(p) => setTextStyle("alg", p)}
                onToggleHidden={() => toggleHidden("alg")}
              />
            </>
          ) : null}

          {active === "qr" ? (
            <>
              <div className="flex items-center gap-2.5 text-[12px] text-ink-2">
                <span className="shrink-0">尺寸</span>
                <input
                  type="range"
                  min={1}
                  max={150}
                  step={1}
                  value={qrScalePct}
                  onChange={(e) => setQrScale(Number(e.target.value) / 100)}
                  className="w-full accent-brand"
                />
                <span className="w-10 shrink-0 text-right font-mono">{qrScalePct}%</span>
                {s.layout.qr?.s ? (
                  <button
                    type="button"
                    onClick={() => setQrScale(1)}
                    className="shrink-0 text-brand hover:underline"
                  >
                    复位
                  </button>
                ) : null}
              </div>
              <span className="text-[12px] text-ink-3">
                调二维码大小,可一直缩到很小(自己把握,印太小会扫不出来)。手机两指在码上捏合 / 桌面滚轮也能缩放。直接拖动二维码可自由挪位置,能跨折线移到正面。
              </span>
              <div className="break-all rounded-md bg-white px-3 py-2 text-[12px] text-ink-2 font-mono">
                {landingUrl}
              </div>
              <span className="text-[12px] leading-relaxed text-ink-3">
                二维码由 code(
                <span className="font-mono">{entry.code}</span>
                )唯一决定,印出去后永久有效,不可修改。要改扫码去向,编辑右侧「目标路径」(跳转码)或「链接列表」(聚合码)即可,码不用重印。
              </span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/api/qr/${entry.code}/svg`}
                  download={`qr-${entry.code}.svg`}
                  title="仅二维码方块,用于嵌入海报 / 网页 / 其他物料"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
                >
                  下载二维码
                </a>
                <a
                  href={`/qr/${entry.code}?stay=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
                >
                  预览落地
                </a>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-line bg-bg-soft/50 p-4 text-[12px] leading-relaxed text-ink-3">
          点左侧卡面上的元素(正面图 / 背面图 / 语录 / 二维码 / 背面文案)在此编辑;上方「加文字」可往正反面加新文本框,选中后可改内容 / 字体 / 颜色 / 字号 / 描边 / 删除。
        </div>
      )}
      {/* 保存按钮已统一到页面右上角(form={formId} 跨 DOM 提交),此处不再放 */}
      </div>
      </div>
    </div>
  );
}
