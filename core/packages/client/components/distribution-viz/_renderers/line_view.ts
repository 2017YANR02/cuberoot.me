// NOTE: 折线图模式渲染器
// 从 viz/viz.js drawFrameLine() L1108-1411 1:1 翻译为 TypeScript
// 接收 ctx + 全部所需参数，不读取全局变量

import type { VizState } from '../_stores/viz_store';
import { MARGIN } from '../_stores/viz_store';
import { mean } from '../_engine/kde';
import {
  rawToVal, playerHSL, getShiftedHSL, fmtVal, isMBLD,
} from '../_engine/data_fetch';
import { ROUND_NAMES, ROUND_ZH } from '../_engine/data_fetch';
import { computePlayerFrame, getWindowTimes } from '../_engine/sync';
import { drawLineGrid, drawLineChart, ink, vizSurfaceTip } from './draw_utils';

/**
 * NOTE: 折线图帧渲染结果
 */
export interface LineFrameResult {
  apTimes: number[];
  apMean: number;
  apDate: string;
  apFrame: number;
  apEndIdx: number;
  progress: number;
}

/**
 * NOTE: 折线图的完整渲染
 * 1:1 翻译自 viz.js drawFrameLine()
 */
export function drawLineView(
  ctx: CanvasRenderingContext2D,
  state: VizState,
): LineFrameResult | null {
  const {
    players, activePlayerIdx, currentEventId, currentFrame, maxFrame,
    windowSize, xMin, xMax, userXMin, userXMax,
    lineXStart, lineXEnd, showLayers, syncMode, dataMode,
    lineHoverX, lineHoverY, cw, ch,
  } = state;

  if (players.length === 0) return null;

  const { top: mt, right: mr, bottom: mb, left: ml } = MARGIN;
  const pw = cw - ml - mr;
  const ph = ch - mt - mb;

  // NOTE: 播放进度映射到数据索引（-1 表示全量高亮）
  const ap = players[activePlayerIdx];
  const totalSolves = ap ? ap.channelData.length : 100;
  const progressIdx = maxFrame > 0
    ? Math.round((currentFrame / maxFrame) * (totalSolves - 1))
    : -1;

  // NOTE: Y 轴范围 — 复用 xMin/xMax（成绩范围），支持用户缩放
  let viewYMin = userXMin !== null ? userXMin : xMin;
  let viewYMax = userXMax !== null ? userXMax : xMax;

  // NOTE: X 轴可见范围（支持横向缩放/平移）
  const visStart = lineXStart !== null ? lineXStart : 1;
  const visEnd = lineXEnd !== null ? lineXEnd : totalSolves;

  // NOTE: 横向缩放时 Y 轴自适应可见数据范围（用户未手动设置 Y 时才启用）
  if (userXMin === null && lineXStart !== null) {
    let dataMin = Infinity, dataMax = -Infinity;
    for (let pi = 0; pi < players.length; pi++) {
      const data = players[pi].channelData;
      for (let i = 0; i < data.length; i++) {
        const solveNo = i + 1;
        if (solveNo < visStart - 1 || solveNo > visEnd + 1) continue;
        const v = rawToVal(data[i][0], currentEventId);
        if (v > 0) { dataMin = Math.min(dataMin, v); dataMax = Math.max(dataMax, v); }
      }
    }
    if (dataMin < dataMax) {
      const pad = (dataMax - dataMin) * 0.05;
      viewYMin = dataMin - pad;
      viewYMax = dataMax + pad;
    }
  }

  // 坐标映射
  const lsx = (n: number) => ml + ((n - visStart) / Math.max(1, visEnd - visStart)) * pw;
  const lsy = (v: number) => mt + ph - ((v - viewYMin) / (viewYMax - viewYMin)) * ph;

  // 1. 网格
  drawLineGrid(ctx, lsx, lsy, ml, mt, pw, ph, viewYMin, viewYMax, totalSolves, currentEventId, visStart, visEnd);

  // 2. 绘制每位选手的全量折线
  interface PlayerTimesData {
    times: (number | null)[];
    indices: number[];
    pbFlags: boolean[] | null;
    entries: typeof players[0]['solveEntries'];
  }
  const allPlayerTimes: PlayerTimesData[] = [];
  const meanPositions: { pi: number; mean: number; name: string }[] = [];

  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    const fullTimes: (number | null)[] = [];
    const origIndices: number[] = [];
    for (let i = 0; i < p.channelData.length; i++) {
      const v = rawToVal(p.channelData[i][0], currentEventId);
      if (v > 0) fullTimes.push(v);
      else fullTimes.push(null);
      origIndices.push(p.channelData[i][2] || (i + 1));
    }
    // NOTE: PB 标记
    let pbArr: boolean[] | null = null;
    if (dataMode === 'singles' && p.statsData && p.statsData.pbFlags) {
      pbArr = p.statsData.pbFlags.singles;
    } else if (p.statsData && p.statsData.pbFlags && p.statsData.pbFlags[dataMode]) {
      pbArr = p.statsData.pbFlags[dataMode];
    } else if (p.roundMetrics && p.roundMetrics.pbFlags && p.roundMetrics.pbFlags[dataMode]) {
      pbArr = p.roundMetrics.pbFlags[dataMode];
    }
    allPlayerTimes.push({ times: fullTimes, indices: origIndices, pbFlags: pbArr, entries: p.solveEntries });

    // 绘制折线
    drawLineChart(ctx, fullTimes, lsx, lsy, pi, activePlayerIdx, progressIdx, ch, players, currentEventId);

    // 均值水平线
    const validTimes = fullTimes.filter(t => t !== null) as number[];
    if (validTimes.length > 0) {
      const currentMean = mean(validTimes);
      meanPositions.push({ pi, mean: currentMean, name: p.nameZh || p.name });

      if (showLayers.meanLine) {
        const meanPy = lsy(currentMean);
        ctx.save();
        ctx.strokeStyle = getShiftedHSL(pi, 0.4, currentMean, players, currentEventId);
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ml, meanPy);
        ctx.lineTo(ml + pw, meanPy);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // NOTE: 播放进度竖线
  if (progressIdx >= 0) {
    const curPx = lsx(progressIdx + 1);
    ctx.save();
    ctx.strokeStyle = ink(0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(curPx, mt);
    ctx.lineTo(curPx, mt + ph);
    ctx.stroke();
    ctx.restore();
  }

  // 3. 均值标签（右侧）
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = '600 11px ui-monospace, monospace';
  for (const mp of meanPositions) {
    const py = lsy(mp.mean);
    const namePrefix = players.length > 1 ? mp.name.slice(0, 3) + ' ' : '';
    ctx.fillStyle = playerHSL(mp.pi, 0.8);
    ctx.textAlign = 'left';
    ctx.fillText(namePrefix + fmtVal(mp.mean, currentEventId), ml + pw + 4, py);
  }
  ctx.restore();

  // 4.5 PB 红色标记点 — 主选手所有模式
  {
    const apData = allPlayerTimes[activePlayerIdx];
    if (apData && apData.pbFlags) {
      ctx.save();
      for (let i = 0; i < apData.times.length; i++) {
        if (apData.times[i] === null) continue;
        const origI = apData.indices[i] - 1;
        if (!apData.pbFlags[origI]) continue;
        const px = lsx(i + 1);
        const py = lsy(apData.times[i]!);
        if (px < ml - 5 || px > ml + pw + 5) continue;
        const isFuture = progressIdx >= 0 && i > progressIdx;
        ctx.fillStyle = isFuture ? 'rgba(230, 50, 50, 0.22)' : 'rgba(230, 50, 50, 0.85)';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 5. hover tooltip — 卡片式
  if (lineHoverX !== null && allPlayerTimes.length > 0) {
    const solveIdx = Math.round(visStart + (lineHoverX - ml) / pw * (visEnd - visStart)) - 1;
    if (solveIdx >= 0 && solveIdx < totalSolves) {
      const tooltipX = lsx(solveIdx + 1);
      // 十字线（竖线）
      ctx.save();
      ctx.strokeStyle = ink(0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tooltipX, mt);
      ctx.lineTo(tooltipX, mt + ph);
      ctx.stroke();
      ctx.restore();

      // 高亮各选手数据点
      for (let pi = 0; pi < allPlayerTimes.length; pi++) {
        const { times: ft } = allPlayerTimes[pi];
        if (solveIdx < ft.length && ft[solveIdx] !== null) {
          const dotY = lsy(ft[solveIdx]!);
          ctx.save();
          ctx.fillStyle = playerHSL(pi, 0.9);
          ctx.beginPath();
          ctx.arc(tooltipX, dotY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // NOTE: 构建卡片内容行
      const cardLines: { text: string; color: string; bold: boolean }[] = [];
      for (let pi = 0; pi < allPlayerTimes.length; pi++) {
        const { times: ft, indices: origIdx, entries } = allPlayerTimes[pi];
        if (solveIdx >= ft.length || ft[solveIdx] === null) continue;
        const val = ft[solveIdx]!;
        const dispIdx = origIdx[solveIdx];

        const origSolveI = dispIdx - 1;
        const entry = entries ? entries[origSolveI] : null;
        if (entry) {
          const roundLabel = ROUND_ZH[entry.roundType] || ROUND_NAMES[entry.roundType] || entry.roundType;
          const prefix = players.length > 1 ? (players[pi].nameZh || players[pi].name) + ' — ' : '';
          cardLines.push({ text: prefix + entry.compName + ' | ' + roundLabel, color: ink(0.7), bold: false });
        }

        let progressStr = '';
        for (let prev = solveIdx - 1; prev >= 0; prev--) {
          if (ft[prev] !== null) {
            const delta = (ft[prev]! - val) / ft[prev]! * 100;
            if (isMBLD(currentEventId)) {
              const d2 = (val - ft[prev]!) / ft[prev]! * 100;
              progressStr = d2 > 0
                ? `（进步 ${d2.toFixed(1)}%）`
                : d2 < 0 ? `（退步 ${(-d2).toFixed(1)}%）` : '';
            } else {
              progressStr = delta > 0
                ? `（进步 ${delta.toFixed(1)}%）`
                : delta < 0 ? `（退步 ${(-delta).toFixed(1)}%）` : '';
            }
            break;
          }
        }
        const pbOrigI = dispIdx - 1;
        const isPB = allPlayerTimes[pi].pbFlags && allPlayerTimes[pi].pbFlags![pbOrigI];
        const pbTag = isPB ? ' 🏆' : '';
        const modeLabel = dataMode === 'singles' ? '单次' : dataMode.toUpperCase();
        cardLines.push({
          text: `● ${modeLabel}: ${fmtVal(val, currentEventId)}${pbTag}  ${progressStr}`,
          color: playerHSL(pi, 0.95),
          bold: true,
        });
      }

      // NOTE: 卡片绘制 — 半透明深色背景 + 圆角
      if (cardLines.length > 0) {
        ctx.save();
        const lineH = 18;
        const padX = 10, padY = 8;
        ctx.font = '600 11px ui-monospace, Inter, sans-serif';
        let maxW = 0;
        for (const ln of cardLines) {
          const w = ctx.measureText(ln.text).width;
          if (w > maxW) maxW = w;
        }
        const cardW = maxW + padX * 2;
        const cardH = cardLines.length * lineH + padY * 2;
        let cx = tooltipX + 12;
        if (cx + cardW > ml + pw) cx = tooltipX - cardW - 12;
        let cy = (lineHoverY ?? mt) - cardH / 2;
        if (cy < mt) cy = mt;
        if (cy + cardH > mt + ph) cy = mt + ph - cardH;

        // 圆角背景
        const r = 6;
        ctx.fillStyle = vizSurfaceTip();
        ctx.strokeStyle = ink(0.12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + cardW - r, cy);
        ctx.arcTo(cx + cardW, cy, cx + cardW, cy + r, r);
        ctx.lineTo(cx + cardW, cy + cardH - r);
        ctx.arcTo(cx + cardW, cy + cardH, cx + cardW - r, cy + cardH, r);
        ctx.lineTo(cx + r, cy + cardH);
        ctx.arcTo(cx, cy + cardH, cx, cy + cardH - r, r);
        ctx.lineTo(cx, cy + r);
        ctx.arcTo(cx, cy, cx + r, cy, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 文字行
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (let li = 0; li < cardLines.length; li++) {
          const ln = cardLines[li];
          ctx.font = ln.bold ? '600 11px ui-monospace, Inter, sans-serif' : '11px Inter, sans-serif';
          ctx.fillStyle = ln.color;
          ctx.fillText(ln.text, cx + padX, cy + padY + li * lineH);
        }
        ctx.restore();
      }
    }
  }

  // 6. 返回统计信息供外部更新
  const progress2 = maxFrame > 0 ? currentFrame / maxFrame : 0;
  if (ap) {
    const apFrame = computePlayerFrame(activePlayerIdx, progress2, players, windowSize, syncMode);
    const apTimes = getWindowTimes(activePlayerIdx, apFrame, players, windowSize, currentEventId, rawToVal);
    if (apTimes.length > 0) {
      const apEndIdx = Math.min(apFrame + windowSize - 1, ap.channelData.length - 1);
      const apDate = ap.compDates[ap.channelData[apEndIdx][1]];
      return {
        apTimes,
        apMean: mean(apTimes),
        apDate,
        apFrame,
        apEndIdx,
        progress: progress2,
      };
    }
  }
  return null;
}
