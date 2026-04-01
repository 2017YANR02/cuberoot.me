// NOTE: 主 Canvas 组件 — 承载 KDE/折线/累积三种视图
// Canvas 内容用命令式渲染（zustand subscribe + drawFrame），React 仅管理 DOM 壳
// 交互事件：滚轮缩放、拖拽平移、双击重置、hover（折线图 tooltip）
// FIXME: 之前用 useVizStore() 订阅整个 store 导致 setupCanvas → setCanvasSize →
//        重渲染 → setupCanvas 无限循环。改为 zustand subscribe + getState 模式。

import { useRef, useEffect, useCallback } from 'react';
import { useVizStore, MARGIN } from '../stores/viz_store';
import { drawHistogramView } from '../renderers/histogram_view';
import { drawLineView } from '../renderers/line_view';
import { drawCumHistView } from '../renderers/cumhist_view';
import { stddev } from '../engine/kde';
import { fmtVal, isFMC, isMBLD, isHigherBetter, formatCompName } from '../engine/data_fetch';

// NOTE: 对外暴露统计回调类型
export type StatsCallback = (stats: {
  mean: string;
  std: string;
  syncLabel: string;
  syncValue: string;
  compName: string;
  delta: number;
  improved: boolean;
  regressed: boolean;
}) => void;

// NOTE: 对外暴露脊线图联动回调
export type RidgeHighlightCallback = (solveEndIdx: number) => void;

interface VizCanvasProps {
  onStats?: StatsCallback;
  onRidgeHighlight?: RidgeHighlightCallback;
}

export default function VizCanvas({ onStats, onRidgeHighlight }: VizCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startPx: number; startPy: number;
    origXMin: number; origXMax: number;
    origLineXStart: number; origLineXEnd: number;
  } | null>(null);

  // NOTE: 把 props 回调存到 ref 里，避免 drawFrame 闭包过时
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;
  const onRidgeRef = useRef(onRidgeHighlight);
  onRidgeRef.current = onRidgeHighlight;

  // NOTE: rAF 节流 — 防止 subscribe 回调在一帧内触发多次 drawFrame
  const rafPendingRef = useRef(false);
  // NOTE: delta 历史放在 ref 里而不是 store 里，避免写 store 触发 subscribe 循环
  const deltaHistRef = useRef<number[]>([]);

  // ─── Canvas 尺寸适配 ───
  // NOTE: 不依赖 React state，只用 ref + getState，因此不会触发重渲染循环
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = Math.min(Math.round(w * 0.5), 480);

    const s = useVizStore.getState();
    // NOTE: 只在尺寸实际变化时写入 store，打破无限循环
    if (s.cw === w && s.ch === h) return;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    useVizStore.getState().setCanvasSize(w, h);
  }, []);

  // ─── 渲染帧 ───
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = useVizStore.getState();
    if (s.cw === 0 || s.ch === 0) return;

    // NOTE: DPI 重建 — 每次绘制前重置 transform 确保尺寸正确
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (s.players.length === 0) {
      ctx.fillStyle = '#0c0c18';
      ctx.fillRect(0, 0, s.cw, s.ch);
      return;
    }

    // 清屏
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, s.cw, s.ch);

    let result: { apTimes?: number[]; apMean?: number; apDate?: string; apFrame?: number; apEndIdx?: number; progress?: number } | null = null;

    if (s.viewMode === 'cumHist') {
      const r = drawCumHistView(ctx, s);
      if (r) result = { apTimes: r.cumTimes, apMean: r.cumMean, apDate: r.lastDate, apEndIdx: r.endIdx, progress: r.progress };
    } else if (s.viewMode === 'line') {
      result = drawLineView(ctx, s);
    } else {
      result = drawHistogramView(ctx, s);
    }

    // 更新统计面板
    const cbStats = onStatsRef.current;
    if (result && result.apTimes && result.apTimes.length > 0 && cbStats) {
      const eventId = s.currentEventId;
      const currentMean = result.apMean!;
      const sd = stddev(result.apTimes);

      // NOTE: delta 计算 — 用本地 ref，不写 store，避免触发 subscribe 循环
      const dh = deltaHistRef.current;
      dh.push(currentMean);
      if (dh.length > 200) dh.splice(0, dh.length - 200);
      const DELTA_LAG = 30;
      const prevMean = dh.length > DELTA_LAG ? dh[dh.length - 1 - DELTA_LAG] : dh[0];
      const delta = currentMean - prevMean;
      const improved = isHigherBetter(eventId) ? delta > 0 : delta < 0;
      const regressed = isHigherBetter(eventId) ? delta < 0 : delta > 0;

      // 把数/日期
      const ap = s.players[s.activePlayerIdx];
      const apFrame = result.apFrame ?? 0;
      const apEndIdx = result.apEndIdx ?? 0;
      let syncLabel = '把数';
      let syncValue = `#${apFrame + 1}–#${apEndIdx + 1}`;
      if (s.viewMode === 'cumHist') {
        syncValue = `#1-#${apEndIdx}`;
      } else if (s.syncMode === 'date') {
        syncLabel = '日期';
        syncValue = result.apDate || '--';
      }

      // 比赛名
      const compIdx = ap.channelData[apEndIdx]?.[1] ?? 0;
      const compName = ap.competitions[compIdx] || '';

      cbStats({
        mean: fmtVal(currentMean, eventId),
        std: isFMC(eventId) || isMBLD(eventId) ? 'σ ' + sd.toFixed(1) : 'σ ' + sd.toFixed(2) + 's',
        syncLabel,
        syncValue,
        compName: formatCompName(compName),
        delta,
        improved,
        regressed,
      });

      // 脊线图联动
      const cbRidge = onRidgeRef.current;
      if (cbRidge && ap && s.viewMode === 'histogram') {
        cbRidge(apEndIdx);
      }
    }
  }, []);

  // ─── 初始化 + resize + store 订阅 ───
  useEffect(() => {
    setupCanvas();
    // NOTE: 初始化后立即绘制一帧
    drawFrame();

    const onResize = () => { setupCanvas(); drawFrame(); };
    window.addEventListener('resize', onResize);

    // NOTE: 用 zustand subscribe + rAF 节流监听状态变化触发重绘
    // FIXME: 之前每次 subscribe 都直接调 drawFrame，而 drawFrame 内部
    // pushDeltaHistory 又写 store，导致 subscribe 再次触发 → 无限循环
    // 修复：用 rAF 合并同一帧内的多次 subscribe 通知
    const unsub = useVizStore.subscribe(() => {
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          rafPendingRef.current = false;
          drawFrame();
        });
      }
    });

    return () => {
      window.removeEventListener('resize', onResize);
      unsub();
    };
  }, [setupCanvas, drawFrame]);

  // ─── 动画循环 ───
  // NOTE: 用独立 subscribe 监听 isPlaying 变化
  useEffect(() => {
    let rafId = 0;
    let isRunning = false;

    const tick = () => {
      const s = useVizStore.getState();
      if (s.currentFrame >= s.maxFrame) {
        s.setPlaying(false);
        isRunning = false;
        return;
      }
      s.setFrame(s.currentFrame + s.playSpeed);
      rafId = requestAnimationFrame(tick);
    };

    const unsub = useVizStore.subscribe(
      (state) => {
        if (state.isPlaying && !isRunning) {
          isRunning = true;
          rafId = requestAnimationFrame(tick);
        } else if (!state.isPlaying && isRunning) {
          cancelAnimationFrame(rafId);
          isRunning = false;
        }
      },
    );

    // 如果初始状态就是播放中，启动动画
    if (useVizStore.getState().isPlaying) {
      isRunning = true;
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      unsub();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ─── 交互事件 ───

  // 滚轮缩放
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const s = useVizStore.getState();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;

    if (s.viewMode === 'line') {
      if (e.shiftKey) {
        // Y 轴缩放
        const vMin = s.userXMin ?? s.xMin;
        const vMax = s.userXMax ?? s.xMax;
        const py = (e.clientY - rect.top) * ratio;
        const { top: mt, bottom: mb } = MARGIN;
        const ph = s.ch - mt - mb;
        const anchor = vMax - ((py - mt) / ph) * (vMax - vMin);
        let nMin = anchor - (anchor - vMin) * factor;
        let nMax = anchor + (vMax - anchor) * factor;
        if (nMax - nMin < 0.5) { const mid = (nMin + nMax) / 2; nMin = mid - 0.25; nMax = mid + 0.25; }
        s.setUserZoom(nMin, nMax);
      } else {
        // X 轴缩放
        const ap = s.players[s.activePlayerIdx];
        const total = ap ? ap.channelData.length : 100;
        const vs = s.lineXStart ?? 1;
        const ve = s.lineXEnd ?? total;
        const { left: ml2 } = MARGIN;
        const pw2 = s.cw - ml2 - MARGIN.right;
        const px = (e.clientX - rect.left) * ratio;
        const anchor = vs + ((px - ml2) / pw2) * (ve - vs);
        let ns = anchor - (anchor - vs) * factor;
        let ne = anchor + (ve - anchor) * factor;
        if (ne - ns < 10) { const mid = (ns + ne) / 2; ns = mid - 5; ne = mid + 5; }
        s.setLineXRange(ns, ne);
      }
    } else {
      const vMin = s.userXMin ?? s.xMin;
      const vMax = s.userXMax ?? s.xMax;
      const px = (e.clientX - rect.left) * ratio;
      const { left: ml3 } = MARGIN;
      const pw3 = s.cw - ml3 - MARGIN.right;
      const anchor = vMin + ((px - ml3) / pw3) * (vMax - vMin);
      let nMin = anchor - (anchor - vMin) * factor;
      let nMax = anchor + (vMax - anchor) * factor;
      if (nMax - nMin < 0.5) { const mid = (nMin + nMax) / 2; nMin = mid - 0.25; nMax = mid + 0.25; }
      s.setUserZoom(nMin, nMax);
    }
  }, []);

  // 拖拽平移
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = useVizStore.getState();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    const ap = s.players[s.activePlayerIdx];
    const total = ap ? ap.channelData.length : 100;
    dragRef.current = {
      startPx: (e.clientX - rect.left) * ratio,
      startPy: (e.clientY - rect.top) * ratio,
      origXMin: s.userXMin ?? s.xMin,
      origXMax: s.userXMax ?? s.xMax,
      origLineXStart: s.lineXStart ?? 1,
      origLineXEnd: s.lineXEnd ?? total,
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const s = useVizStore.getState();
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const dx = (e.clientX - rect.left) * ratio - dragRef.current.startPx;
      const dy = (e.clientY - rect.top) * ratio - dragRef.current.startPy;
      const { left: ml4, right: mr4, top: mt4, bottom: mb4 } = MARGIN;

      if (s.viewMode === 'line') {
        const pw = s.cw - ml4 - mr4;
        const ph = s.ch - mt4 - mb4;
        const vs = dragRef.current.origLineXStart;
        const ve = dragRef.current.origLineXEnd;
        const xShift = -dx / pw * (ve - vs);
        s.setLineXRange(vs + xShift, ve + xShift);
        // Y 平移
        const vMin = dragRef.current.origXMin;
        const vMax = dragRef.current.origXMax;
        const yShift = dy / ph * (vMax - vMin);
        s.setUserZoom(vMin + yShift, vMax + yShift);
      } else {
        const pw = s.cw - ml4 - mr4;
        const range = dragRef.current.origXMax - dragRef.current.origXMin;
        const shift = -(dx / pw) * range;
        s.setUserZoom(dragRef.current.origXMin + shift, dragRef.current.origXMax + shift);
      }
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // 双击重置缩放
  const onDoubleClick = useCallback(() => {
    useVizStore.getState().resetZoom();
  }, []);

  // hover（折线图 tooltip）
  const onMouseMoveCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = useVizStore.getState();
    if (s.viewMode !== 'line') return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * ratio;
    const y = (e.clientY - rect.top) * ratio;
    s.setLineHover(x, y);
  }, []);

  const onMouseLeave = useCallback(() => {
    useVizStore.getState().setLineHover(null, null);
  }, []);

  return (
    <div className="canvas-wrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        id="kdeCanvas"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onMouseMove={onMouseMoveCanvas}
        onMouseLeave={onMouseLeave}
      />
    </div>
  );
}
