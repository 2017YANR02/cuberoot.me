"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { CardEl, CardLayout, QrCode, QrType } from "@/lib/db/qr";
import { QrCardUnit, FRONT_ARTS } from "@/components/QrCard";
import { FileUpload } from "@/components/FileUpload";
import { algToText, parseAlg } from "@/lib/qr/cardText";

// 所见即所得卡片编辑器(简易 PS):卡上所有元素([data-el])可直接拖动移位,
// 带磁吸对齐(面板中线 / 默认位 / 其他元素中心,洋红参考线提示,Alt 暂时关闭,可整体开关)。
// 元素热区按实际渲染框实测贴合;位移 <4px 视为点击,打开对应编辑面板。
// 偏移(mm)存 layout 字段,DOM 卡与矢量印刷母版同步;隐藏 input 随「保存」提交。

type Region = "art" | "quote" | "back" | "alg" | "qr";

const EL_LABEL: Record<CardEl, string> = {
  quote: "正面语录",
  brand: "品牌名",
  backText: "背面文案",
  term: "术语角标",
  qr: "二维码",
  alg: "精选公式",
  front: "正面背景图",
};

// 元素点击(非拖动)打开的编辑面板;brand 只可移动无面板
const EL_PANEL: Record<CardEl, Region | null> = {
  quote: "quote",
  brand: null,
  backText: "back",
  term: "back",
  qr: "qr",
  alg: "alg",
  front: "art",
};

const ALL_ELS: CardEl[] = ["quote", "brand", "backText", "term", "qr", "alg"];
const PANEL_MM = 20; // 单面板固定宽 20mm,px↔mm 换算基准
const SNAP_MM = 0.6; // 磁吸阈值

const INPUT_CLS =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand";

type Box = { left: number; top: number; w: number; h: number };

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
    art: entry.frontArt ?? "",
    algRaw: algToText(entry.alg),
    layout: (entry.layout ?? {}) as CardLayout,
  });
  const [active, setActive] = useState<Region | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  // 拖动中的对齐参考线(相对卡片容器 px)
  const [guides, setGuides] = useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] });
  const wrapRef = useRef<HTMLDivElement>(null);
  // 各元素实测框(相对卡片容器 px),热区据此贴合渲染
  const [boxes, setBoxes] = useState<Partial<Record<CardEl, Box>>>({});

  // 悬停正面图滚轮缩放(native 非 passive 监听才能 preventDefault 拦住页面滚动);
  // 挂在整卡容器上、按坐标判定在正面板内,盖在语录/品牌热区上时也能缩放
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      const panel = wrap.querySelector<HTMLElement>('[data-panel="front"]');
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        return;
      e.preventDefault();
      setS((p) => {
        const cur = { x: 0, y: 0, s: 1, ...p.layout.front };
        const floor = cur.fit === "cover" ? 1 : 0.5; // cover 不能缩到露底
        const next =
          Math.round(Math.max(floor, Math.min(3, cur.s * Math.exp(-e.deltaY * 0.002))) * 100) / 100;
        const layout = { ...p.layout };
        if (cur.x === 0 && cur.y === 0 && next === 1 && !cur.fit) delete layout.front;
        else layout.front = { ...cur, s: next };
        return { ...p, layout };
      });
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
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
    const next: Partial<Record<CardEl, Box>> = {};
    wrap.querySelectorAll<HTMLElement>("[data-el]").forEach((el) => {
      const key = el.dataset.el as CardEl;
      const r = el.getBoundingClientRect();
      next[key] = { left: r.left - wr.left, top: r.top - wr.top, w: r.width, h: r.height };
    });
    setBoxes((prev) => {
      const keys = ALL_ELS.filter((k) => next[k] || prev[k]);
      const changed = keys.some((k) => {
        const a = prev[k];
        const b = next[k];
        if (!a || !b) return true;
        return (
          Math.abs(a.left - b.left) > 0.5 ||
          Math.abs(a.top - b.top) > 0.5 ||
          Math.abs(a.w - b.w) > 0.5 ||
          Math.abs(a.h - b.h) > 0.5
        );
      });
      return changed ? next : prev;
    });
  });

  const set = (k: keyof typeof s) => (v: string) => setS((p) => ({ ...p, [k]: v }));
  const setOffset = (key: CardEl, off: { x: number; y: number } | null) =>
    setS((p) => {
      const layout = { ...p.layout };
      if (off) layout[key] = off;
      else delete layout[key];
      return { ...p, layout };
    });
  // 正面图平移/缩放/完整显示(layout.front):增量合并,回到默认(0,0,×1,铺满)就删键
  const setFront = (patch: Partial<{ x: number; y: number; s: number; fit?: "cover" }>) =>
    setS((p) => {
      const next = { x: 0, y: 0, s: 1, ...p.layout.front, ...patch };
      if (next.fit === "cover") next.s = Math.max(1, next.s); // cover 缩放只放大,保证铺满不露底
      const layout = { ...p.layout };
      if (next.x === 0 && next.y === 0 && next.s === 1 && !next.fit) delete layout.front;
      else layout.front = next;
      return { ...p, layout };
    });

  // 拖动元素:跟手换算 mm,磁吸到 面板中线 / 默认位 / 同面板其他元素中心;位移 <4px 视为点击
  const startElDrag = (e: React.PointerEvent, key: CardEl) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    const el = wrap?.querySelector<HTMLElement>(`[data-el="${key}"]`);
    const panel = el?.closest<HTMLElement>("[data-panel]");
    if (!wrap || !el || !panel) return;
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const pxPerMm = pr.width / PANEL_MM;
    const off0 = s.layout[key] ?? { x: 0, y: 0 };
    // 基准框(去掉当前偏移)与中心
    const baseL = er.left - off0.x * pxPerMm;
    const baseT = er.top - off0.y * pxPerMm;
    const bcx = baseL + er.width / 2;
    const bcy = baseT + er.height / 2;
    // 磁吸目标(viewport px):面板中线 + 默认位 + 同面板其他元素中心
    const targetsX = [pr.left + pr.width / 2, bcx];
    const targetsY = [pr.top + pr.height / 2, bcy];
    wrap.querySelectorAll<HTMLElement>("[data-el]").forEach((other) => {
      if (other === el || other.closest("[data-panel]") !== panel) return;
      const r = other.getBoundingClientRect();
      targetsX.push(r.left + r.width / 2);
      targetsY.push(r.top + r.height / 2);
    });
    // 边界(留 0.3mm)
    const mg = 0.3 * pxPerMm;
    const minX = (pr.left + mg - baseL) / pxPerMm;
    const maxX = (pr.right - mg - (baseL + er.width)) / pxPerMm;
    const minY = (pr.top + mg - baseT) / pxPerMm;
    const maxY = (pr.bottom - mg - (baseT + er.height)) / pxPerMm;
    const startX = e.clientX;
    const startY = e.clientY;
    const snapPx = SNAP_MM * pxPerMm;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true;
      if (!moved) return;
      let ox = Math.min(maxX, Math.max(minX, off0.x + (ev.clientX - startX) / pxPerMm));
      let oy = Math.min(maxY, Math.max(minY, off0.y + (ev.clientY - startY) / pxPerMm));
      const xs: number[] = [];
      const ys: number[] = [];
      if (snapOn && !ev.altKey) {
        const cx = bcx + ox * pxPerMm;
        const cy = bcy + oy * pxPerMm;
        for (const tx of targetsX) {
          if (Math.abs(cx - tx) < snapPx) {
            ox = (tx - bcx) / pxPerMm;
            xs.push(tx - wr.left);
            break;
          }
        }
        for (const ty of targetsY) {
          if (Math.abs(cy - ty) < snapPx) {
            oy = (ty - bcy) / pxPerMm;
            ys.push(ty - wr.top);
            break;
          }
        }
      }
      setGuides({ xs, ys });
      setOffset(key, { x: Math.round(ox * 20) / 20, y: Math.round(oy * 20) / 20 });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setGuides({ xs: [], ys: [] });
      if (!moved) {
        const panel = EL_PANEL[key];
        if (panel) setActive((a) => (a === panel ? null : panel));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // 拖动正面背景图:平移构图(mm 存 layout.front),磁吸回默认位;位移 <4px 视为点击打开图库面板
  const startArtDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const panel = wrapRef.current?.querySelector<HTMLElement>('[data-panel="front"]');
    if (!panel) return;
    const pxPerMm = panel.getBoundingClientRect().width / PANEL_MM;
    const f0 = { x: 0, y: 0, ...s.layout.front };
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true;
      if (!moved) return;
      let ox = Math.max(-20, Math.min(20, f0.x + (ev.clientX - startX) / pxPerMm));
      let oy = Math.max(-20, Math.min(20, f0.y + (ev.clientY - startY) / pxPerMm));
      if (snapOn && !ev.altKey) {
        if (Math.abs(ox) < SNAP_MM) ox = 0;
        if (Math.abs(oy) < SNAP_MM) oy = 0;
      }
      setFront({ x: Math.round(ox * 20) / 20, y: Math.round(oy * 20) / 20 });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!moved) setActive((a) => (a === "art" ? null : "art"));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // 把当前正面图(全分辨率)转 PNG 下载:canvas 画原图再导出,像素与原图一致、无损。
  // 同源(/card、/uploads)不会污染 canvas;外链转换失败则退回直接打开原图。
  const [pngBusy, setPngBusy] = useState(false);
  const downloadArtPng = async () => {
    if (pngBusy) return;
    const src = s.art || FRONT_ARTS[0].src;
    const base = (src.split("/").pop() || "front-art").replace(/\.[^.]+$/, "");
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
    frontArt: s.art.trim() || null,
    alg: parseAlg(s.algRaw),
    layout: s.layout,
  };
  const hasOffsets = Object.keys(s.layout).length > 0;
  // 正面图缩放:cover 钳到 ≥100%(滑块与渲染一致,WYSIWYG),contain 可缩到 50%
  const frontIsCover = s.layout.front?.fit === "cover";
  const frontScalePct = Math.round(
    Math.max(frontIsCover ? 1 : 0.5, s.layout.front?.s ?? 1) * 100,
  );

  return (
    <div>
      {/* 提交值(挂到左侧表单,随保存一起走) */}
      <input type="hidden" name="title" value={s.title} form={formId} readOnly />
      <input type="hidden" name="term" value={s.term} form={formId} readOnly />
      <input type="hidden" name="intro" value={s.intro} form={formId} readOnly />
      <input type="hidden" name="quote" value={s.quote} form={formId} readOnly />
      <input type="hidden" name="frontArt" value={s.art} form={formId} readOnly />
      <input type="hidden" name="alg" value={s.algRaw} form={formId} readOnly />
      <input
        type="hidden"
        name="layout"
        value={JSON.stringify(s.layout)}
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
          {/* 正面背景图:整个正面板的底层热区(元素热区叠在其上),拖动平移构图,点击打开图库面板 */}
          <span
            role="button"
            title="拖动调整构图,点击编辑:正面背景图"
            aria-label="正面背景图"
            onPointerDown={startArtDrag}
            className={
              "absolute touch-none select-none rounded-md transition " +
              (active === "art"
                ? "ring-2 ring-brand bg-brand/10 cursor-grab"
                : "cursor-grab hover:ring-2 hover:ring-brand/50 hover:bg-brand/5")
            }
            style={{ left: 0, top: 0, width: "50%", height: "100%" }}
          />
          {/* 元素热区:实测贴合,可拖动移位;点击打开对应面板 */}
          {ALL_ELS.map((key) => {
            const b = boxes[key];
            if (!b) return null;
            return (
              <span
                key={key}
                role="button"
                aria-label={EL_LABEL[key]}
                title={`拖动移动:${EL_LABEL[key]}`}
                onPointerDown={(e) => startElDrag(e, key)}
                className={
                  "absolute touch-none select-none rounded transition " +
                  (EL_PANEL[key] && active === EL_PANEL[key]
                    ? "ring-2 ring-brand bg-brand/10 cursor-grab"
                    : "cursor-grab hover:ring-2 hover:ring-brand/50 hover:bg-brand/5")
                }
                style={{ left: b.left, top: b.top, width: b.w, height: b.h }}
              />
            );
          })}
          {/* 磁吸参考线(洋红,PS 风) */}
          {guides.xs.map((x) => (
            <span
              key={`gx${x}`}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: x, top: 0, width: 1, height: "100%", background: "#FF2D92" }}
            />
          ))}
          {guides.ys.map((y) => (
            <span
              key={`gy${y}`}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: 0, top: y, width: "100%", height: 1, background: "#FF2D92" }}
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
      </div>

      {active ? (
        <div className="mt-3 rounded-md border border-line bg-bg-soft p-3 grid gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">
              {active === "art"
                ? "正面背景图"
                : active === "quote"
                  ? "正面语录"
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
            <>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => set("art")("")}
                className={
                  "flex w-[72px] items-center justify-center rounded-md border text-[11px] aspect-[1/2] transition " +
                  (s.art === ""
                    ? "border-brand ring-2 ring-brand/30 text-brand"
                    : "border-line bg-white text-ink-3 hover:border-brand/40")
                }
              >
                自动轮换
              </button>
              {FRONT_ARTS.map((o) => (
                <button
                  key={o.src}
                  type="button"
                  onClick={() => set("art")(o.src)}
                  className={
                    "w-[72px] overflow-hidden rounded-md border bg-white transition " +
                    (s.art === o.src
                      ? "border-brand ring-2 ring-brand/30"
                      : "border-line hover:border-brand/40")
                  }
                >
                  {/* 按真实比例完整显示(深色补边),别像 cover 那样裁出假比例误导 */}
                  <img src={o.src} alt={o.label} className="block aspect-[1/2] w-full object-contain bg-[#11111A]" />
                  <span className="block py-0.5 text-center text-[11px] text-ink-2">
                    {o.label}
                  </span>
                </button>
              ))}
              {s.art && !FRONT_ARTS.some((o) => o.src === s.art) ? (
                <span className="w-[72px] overflow-hidden rounded-md border border-brand ring-2 ring-brand/30 bg-white">
                  <img src={s.art} alt="自己上传的图" className="block aspect-[1/2] w-full object-contain bg-[#11111A]" />
                  <span className="block py-0.5 text-center text-[11px] text-ink-2">
                    自己上传
                  </span>
                </span>
              ) : null}
            </div>
            <span className="text-[12px] text-ink-3">
              自动轮换:不固定用图,批量打印时按卡片顺序轮流分配图库的图;在意印出来是哪张就选定一张。
            </span>
            <div className="grid grid-cols-2 gap-2">
              <FileUpload
                accept="image/*"
                label="上传自己的正面图"
                onUploaded={(url) => set("art")(url)}
              />
              {/* 下载当前正面图原图为 PNG(全分辨率、无损;自动轮换时下当前展示的第一张) */}
              <button
                type="button"
                onClick={downloadArtPng}
                disabled={pngBusy}
                title="下载当前正面图的 PNG 原图,全分辨率无损,可在其他软件二次编辑"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition disabled:opacity-60"
              >
                <Download size={14} /> {pngBusy ? "导出中…" : "下载正面图 PNG"}
              </button>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2">
              <input
                type="checkbox"
                checked={s.layout.front?.fit !== "cover"}
                onChange={(e) =>
                  // 默认勾选=完整显示;勾选时顺带清掉残留平移/缩放,保证一点不裁。
                  // 取消勾选=铺满整面(超出裁掉)
                  setFront(
                    e.target.checked
                      ? { fit: undefined, x: 0, y: 0, s: 1 }
                      : { fit: "cover" },
                  )
                }
                className="accent-brand"
              />
              完整显示整张图,一点不裁
            </label>
            <span className="text-[12px] text-ink-3">
              勾选后整张图缩到能完全装进卡面,四边都保住(预留 1mm,印厂裁歪也碰不到图);图和卡片比例不一致时,空出来的地方是深色底。不勾则铺满整面,超出部分裁掉。
            </span>
            <div className="flex items-center gap-2.5 text-[12px] text-ink-2">
              <span className="shrink-0">缩放</span>
              <input
                type="range"
                min={frontIsCover ? 100 : 50}
                max={300}
                step={1}
                value={frontScalePct}
                onChange={(e) => setFront({ s: Number(e.target.value) / 100 })}
                className="w-full accent-brand"
              />
              <span className="w-10 shrink-0 text-right font-mono">
                {frontScalePct}%
              </span>
              {s.layout.front ? (
                <button
                  type="button"
                  onClick={() => setOffset("front", null)}
                  className="shrink-0 text-brand hover:underline"
                >
                  复位
                </button>
              ) : null}
            </div>
            <span className="text-[12px] text-ink-3">
              直接拖卡面上的图挪构图,鼠标悬在图上滚滚轮也能缩放;铺满模式只能放大(裁掉更多边缘),要看更全整张图就勾上面的「完整显示」。预览即裁切后成品,出血里多印的部分会被裁掉。
            </span>
            </>
          ) : null}

          {active === "quote" ? (
            <>
              <textarea
                value={s.quote}
                onChange={(e) => set("quote")(e.target.value)}
                placeholder={"慢就是快\n一次打乱 一次成长"}
                className={INPUT_CLS + " min-h-[64px]"}
                autoFocus
              />
              <span className="text-[12px] text-ink-3">
                第一行大字,其余行小字;留空用默认语录轮换。
              </span>
            </>
          ) : null}

          {active === "back" ? (
            <>
              <input
                value={s.title}
                onChange={(e) => set("title")(e.target.value)}
                placeholder="标题,留空用默认(也是落地页大标题)"
                className={INPUT_CLS}
                autoFocus
              />
              <textarea
                value={s.intro}
                onChange={(e) => set("intro")(e.target.value)}
                placeholder="简介,留空不显示(也是落地页副标题)"
                className={INPUT_CLS + " min-h-[52px]"}
              />
              <input
                value={s.term}
                onChange={(e) => set("term")(e.target.value)}
                placeholder="魔方术语角标,如 CFOP / OLL / F2L"
                className={INPUT_CLS}
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
            </>
          ) : null}

          {active === "qr" ? (
            <>
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
          点左侧卡面上的元素(正面图 / 语录 / 二维码 / 背面文案)在此编辑。
        </div>
      )}
      {/* 保存按钮已统一到页面右上角(form={formId} 跨 DOM 提交),此处不再放 */}
      </div>
      </div>
    </div>
  );
}
