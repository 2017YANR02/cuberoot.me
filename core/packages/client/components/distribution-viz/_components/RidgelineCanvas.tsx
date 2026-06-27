'use client';
// NOTE: 脊线图 Canvas 组件
// 独立的 useRef<HTMLCanvasElement> + 绘制/交互/联动
// 1:1 翻译自 ridgeline.js initRidgeline + onRidgeClick + resize 逻辑

import { useRef, useEffect, useCallback, useState } from 'react';
import { useVizStore } from '../_stores/viz_store';
import {
  buildGroups, computeAllKDEs, drawRidgeline,
  getRidgeCanvasHeight, getClickedRow,
} from '../_renderers/ridgeline_renderer';
import type { RidgeGroup } from '../_renderers/ridgeline_renderer';
import type { KDEPoint } from '../_engine/kde';
import { applyVizPalette, watchVizTheme } from '../theme-sync';
import { tr } from '@/i18n/tr';

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

  // NOTE: 尺寸 + 绘制合一 —— 给 canvas.width 赋值会清空画布。原本「定尺」和「绘制」
  // 拆成两个 effect,某些加载时序下 setupCanvas 会在 draw 之后跑、把刚画好的清掉
  // (选手页内嵌的 loadSingle → rebuildAllChannels 双次 groups 变更正好触发,表现为
  // 脊线图空白)。合并成一步:每次数据变化「定尺 → 立即重绘」,原子完成,不留清空窗口。
  const sizeAndDraw = useCallback(() => {
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
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    drawRidgeline(ctx, w, h, groups, kdes, maxDensity, highlightRow, xMin, xMax, currentEventId);
  }, [groups, kdes, maxDensity, highlightRow, xMin, xMax, currentEventId]);

  // 按当前主题设调色板(首帧前)+ 绘制
  useEffect(() => { applyVizPalette(); sizeAndDraw(); }, [sizeAndDraw]);

  // NOTE: resize 重新定尺 + 重绘;主题切换重设调色板 + 重绘
  useEffect(() => {
    const onResize = () => setTimeout(sizeAndDraw, 120);
    window.addEventListener('resize', onResize);
    const unwatchTheme = watchVizTheme(() => sizeAndDraw());
    return () => { window.removeEventListener('resize', onResize); unwatchTheme(); };
  }, [sizeAndDraw]);

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
      <h2 className="section-title">{tr({ zh: '分布全景', en: 'Distribution overview'
    })}</h2>
      <div className="ridgeline-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} id="ridgelineCanvas" onClick={onClick} />
      </div>
    </>
  );
}
