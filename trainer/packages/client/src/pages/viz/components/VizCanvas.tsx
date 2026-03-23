// NOTE: 主 Canvas 组件 — 承载 KDE/折线/累积三种视图
// Canvas 内容用命令式渲染（useEffect + drawFrame），React 仅管理 DOM 壳
// 交互事件：滚轮缩放、拖拽平移、双击重置、hover（折线图 tooltip）

import { useRef, useEffect, useCallback } from 'react';
import { useVizStore, MARGIN } from '../stores/viz_store';
import { drawHistogramView } from '../renderers/histogram_view';
import { drawLineView } from '../renderers/line_view';
import { drawCumHistView } from '../renderers/cumhist_view';
import { mean, stddev } from '../engine/kde';
import { rawToVal, fmtVal, isFMC, isMBLD, isHigherBetter, formatCompName } from '../engine/data_fetch';
import { computePlayerFrame, getWindowTimes } from '../engine/sync';

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

  // NOTE: 从 store 订阅状态（浅比较优化）
  const state = useVizStore();

  // ─── Canvas 尺寸适配 ───
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = Math.min(Math.round(w * 0.5), 480);

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    state.setCanvasSize(w, h);
  }, [state]);

  // ─── 渲染帧 ───
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = useVizStore.getState();
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
    if (result && result.apTimes && result.apTimes.length > 0 && onStats) {
      const eventId = s.currentEventId;
      const currentMean = result.apMean!;
      const sd = stddev(result.apTimes);

      // delta 计算 — 与 30 帧前比较
      s.pushDeltaHistory(currentMean);
      const hist = useVizStore.getState().deltaHistory;
      const DELTA_LAG = 30;
      const prevMean = hist.length > DELTA_LAG ? hist[hist.length - 1 - DELTA_LAG] : hist[0];
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

      onStats({
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
      if (onRidgeHighlight && ap && s.viewMode === 'histogram') {
        onRidgeHighlight(apEndIdx);
      }
    }
  }, [onStats, onRidgeHighlight]);

  // ─── 初始化 + resize ───
  useEffect(() => {
    setupCanvas();
    const onResize = () => { setupCanvas(); drawFrame(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas, drawFrame]);

  // ─── 状态变化时重绘 ───
  useEffect(() => {
    if (state.cw > 0 && state.ch > 0) {
      drawFrame();
    }
  }, [
    state.players, state.activePlayerIdx, state.currentFrame,
    state.viewMode, state.dataMode, state.syncMode,
    state.userXMin, state.userXMax, state.lineXStart, state.lineXEnd,
    state.showLayers, state.windowSize, state.cw, state.ch,
    state.lineHoverX, state.lineHoverY,
    drawFrame,
  ]);

  // ─── 动画循环 ───
  useEffect(() => {
    if (!state.isPlaying) return;

    let id: number;
    const tick = () => {
      const s = useVizStore.getState();
      if (s.currentFrame >= s.maxFrame) {
        s.setPlaying(false);
        return;
      }
      s.setFrame(s.currentFrame + s.playSpeed);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [state.isPlaying, state.playSpeed]);

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
