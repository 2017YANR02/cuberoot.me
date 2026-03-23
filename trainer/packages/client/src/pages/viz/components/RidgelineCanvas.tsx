// NOTE: 脊线图 Canvas 组件
// 独立的 useRef<HTMLCanvasElement> + 绘制/交互/联动
// 1:1 翻译自 ridgeline.js initRidgeline + onRidgeClick + resize 逻辑

import { useRef, useEffect, useCallback, useState } from 'react';
import { useVizStore } from '../stores/viz_store';
import {
  buildGroups, computeAllKDEs, drawRidgeline,
  getRidgeCanvasHeight, getClickedRow,
} from '../renderers/ridgeline_renderer';
import type { RidgeGroup } from '../renderers/ridgeline_renderer';
import type { KDEPoint } from '../engine/kde';

interface RidgelineCanvasProps {
  highlightSolveIdx: number;
}

export default function RidgelineCanvas({ highlightSolveIdx }: RidgelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const players = useVizStore(s => s.players);
  const activePlayerIdx = useVizStore(s => s.activePlayerIdx);
  const currentEventId = useVizStore(s => s.currentEventId);
  const xMin = useVizStore(s => s.xMin);
  const xMax = useVizStore(s => s.xMax);
  const minBandwidth = useVizStore(s => s.minBandwidth);
  const viewMode = useVizStore(s => s.viewMode);

  // NOTE: 状态缓存 — groups 和 KDEs
  const [groups, setGroups] = useState<RidgeGroup[]>([]);
  const [kdes, setKdes] = useState<(KDEPoint[] | null)[]>([]);
  const [maxDensity, setMaxDensity] = useState(0);
  const [highlightRow, setHighlightRow] = useState(-1);
  const [rcw, setRcw] = useState(0);
  const [rch, setRch] = useState(0);

  // NOTE: 重建数据（players/activePlayerIdx/dataMode 变化时）
  useEffect(() => {
    const ap = players[activePlayerIdx];
    if (!ap || ap.channelData.length === 0) {
      setGroups([]);
      setKdes([]);
      setMaxDensity(0);
      return;
    }

    const newGroups = buildGroups(ap, currentEventId);
    const { kdes: newKdes, maxDensity: newMax } = computeAllKDEs(newGroups, xMin, xMax, minBandwidth);
    setGroups(newGroups);
    setKdes(newKdes);
    setMaxDensity(newMax);
  }, [players, activePlayerIdx, currentEventId, xMin, xMax, minBandwidth]);

  // NOTE: Canvas 尺寸设置
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || groups.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = getRidgeCanvasHeight(groups.length);

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    setRcw(w);
    setRch(h);
  }, [groups]);

  // NOTE: 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rcw === 0 || groups.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawRidgeline(ctx, rcw, rch, groups, kdes, maxDensity, highlightRow, xMin, xMax, currentEventId);
  }, [rcw, rch, groups, kdes, maxDensity, highlightRow, xMin, xMax, currentEventId]);

  // NOTE: 尺寸初始化 + resize
  useEffect(() => {
    setupCanvas();
    const onResize = () => setTimeout(setupCanvas, 120);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  // NOTE: 联动高亮（外部传入 solveIdx 变化时更新高亮行）
  useEffect(() => {
    if (highlightSolveIdx < 0 || groups.length === 0) return;
    let newRow = -1;
    for (let i = 0; i < groups.length; i++) {
      if (highlightSolveIdx >= groups[i].startIdx && highlightSolveIdx <= groups[i].endIdx) {
        newRow = i;
        break;
      }
    }
    if (newRow !== highlightRow) {
      setHighlightRow(newRow);
      // 自动滚动
      if (newRow >= 0 && wrapperRef.current) {
        const rowY = 30 + newRow * 32;  // RIDGE_MARGIN.top + row * ROW_HEIGHT
        const wrapperH = wrapperRef.current.clientHeight;
        wrapperRef.current.scrollTo({ top: rowY - wrapperH / 2 + 32, behavior: 'smooth' });
      }
    }
  }, [highlightSolveIdx, groups, highlightRow]);

  // NOTE: 点击交互 — 跳转到对应比赛
  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || groups.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rowIdx = getClickedRow(y, groups.length);
    if (rowIdx < 0) return;

    const group = groups[rowIdx];
    const s = useVizStore.getState();
    const targetFrame = Math.max(0, Math.min(
      group.startIdx - Math.floor(s.windowSize / 2),
      s.maxFrame,
    ));
    s.setPlaying(false);
    s.setFrame(targetFrame);
  }, [groups]);

  // NOTE: 折线图和累积模式下隐藏脊线图
  if (viewMode === 'line' || viewMode === 'cumHist') return null;
  if (players.length === 0) return null;

  return (
    <>
      <div className="section-divider" />
      <h2 className="section-title">分布全景</h2>
      <div className="ridgeline-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} id="ridgelineCanvas" onClick={onClick} />
      </div>
    </>
  );
}
