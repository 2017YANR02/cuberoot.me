// NOTE: 滑窗 KDE 模式渲染器
// 从 viz/viz.js drawFrame() L1549-1738 1:1 翻译为 TypeScript
// 接收 ctx + 全部所需参数，不读取全局变量

import type { VizState } from '../_stores/viz_store';
import { MARGIN } from '../_stores/viz_store';
import {
  computeKDE, mean, computeHistogram, detectPeaks,
} from '../_engine/kde';
import {
  rawToVal, playerHSL, getShiftedHSL,
  KDE_POINTS,
} from '../_engine/data_fetch';
import { computePlayerFrame, getWindowTimes } from '../_engine/sync';
import {
  drawGrid, drawCurve, drawMeanLine, drawHistogramBars,
  drawMeanLabelsOnCanvas,
} from './draw_utils';
import type { MeanPosition } from './draw_utils';

/**
 * NOTE: 滑窗模式的完整主渲染（histogram viewMode）
 * 1:1 翻译自 viz.js drawFrame() 中 viewMode==='histogram' 的分支
 *
 * 返回当前帧的统计信息，供外部更新 StatsBar 和 RidgelineCanvas
 */
export interface HistogramFrameResult {
  /** 主选手当前窗口内的成绩 */
  apTimes: number[];
  /** 主选手当前窗口均值 */
  apMean: number;
  /** 主选手当前帧对应的比赛日期 */
  apDate: string;
  /** 主选手当前窗口起始帧 */
  apFrame: number;
  /** 主选手当前窗口结束索引 */
  apEndIdx: number;
  /** 进度比 */
  progress: number;
}

export function drawHistogramView(
  ctx: CanvasRenderingContext2D,
  state: VizState,
): HistogramFrameResult | null {
  const {
    players, activePlayerIdx, currentEventId, currentFrame, maxFrame,
    windowSize, xMin, xMax, userXMin, userXMax, minBandwidth,
    globalMaxY, showLayers, syncMode, viewMode,
  } = state;
  const { cw, ch } = state;

  if (players.length === 0) return null;

  const { top: mt, right: mr, bottom: mb, left: ml } = MARGIN;
  const pw = cw - ml - mr;
  const ph = ch - mt - mb;

  // NOTE: 用户缩放/平移覆盖自动范围
  let viewXMin = userXMin !== null ? userXMin : xMin;
  let viewXMax = userXMax !== null ? userXMax : xMax;

  // NOTE: 动态 Y 轴上限 — 直方图模式需要考虑 histogram density
  let frameMaxY = globalMaxY;
  const progress = maxFrame > 0 ? currentFrame / maxFrame : 0;
  if (viewMode === 'histogram') {
    for (let pi = 0; pi < players.length; pi++) {
      const pf = computePlayerFrame(pi, progress, players, windowSize, syncMode);
      const t = getWindowTimes(pi, pf, players, windowSize, currentEventId, rawToVal);
      if (t.length < 2) continue;
      const bins = computeHistogram(t, viewXMax - viewXMin);
      for (const b of bins) {
        if (b.density > frameMaxY) frameMaxY = b.density;
      }
    }
    frameMaxY *= 1.1;
  }

  let sx = (x: number) => ml + ((x - viewXMin) / (viewXMax - viewXMin)) * pw;
  const sy = (y: number) => mt + ph - (y / frameMaxY) * ph;

  // 1. 网格和坐标轴
  drawGrid(ctx, sx, sy, ml, mt, pw, ph, viewXMin, viewXMax, currentEventId);

  // 2. 循环绘制每位选手
  const meanPositions: MeanPosition[] = [];

  // NOTE: 均值居中模式 — 先算主选手均值，再调整 X 轴范围
  if (showLayers.followMean && players.length > 0) {
    const apf = computePlayerFrame(activePlayerIdx, progress, players, windowSize, syncMode);
    const at = getWindowTimes(activePlayerIdx, apf, players, windowSize, currentEventId, rawToVal);
    if (at.length > 0) {
      const activeMean = mean(at);
      const halfRange = (viewXMax - viewXMin) / 2;
      viewXMin = activeMean - halfRange;
      viewXMax = activeMean + halfRange;
      sx = (x: number) => ml + ((x - viewXMin) / (viewXMax - viewXMin)) * pw;
      // 重绘网格以反映新范围
      ctx.fillStyle = '#0c0c18';
      ctx.fillRect(0, 0, cw, ch);
      drawGrid(ctx, sx, sy, ml, mt, pw, ph, viewXMin, viewXMax, currentEventId);
    }
  }

  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    const pFrame = computePlayerFrame(pi, progress, players, windowSize, syncMode);

    // 幽灵残影（可关闭）
    if (showLayers.ghost && p.ghostKDE && currentFrame > 0) {
      drawCurve(ctx, p.ghostKDE, sx, sy, {
        fill: playerHSL(pi, 0.03),
        stroke: playerHSL(pi, 0.12),
        lineWidth: 1,
      });
      drawMeanLine(ctx, sx, mt, ph, p.ghostMean, playerHSL(pi, 0.12), true);
    }

    const times = getWindowTimes(pi, pFrame, players, windowSize, currentEventId, rawToVal);
    const kde = computeKDE(times, viewXMin, viewXMax, KDE_POINTS, minBandwidth);
    if (!kde) continue;
    const currentMean = mean(times);

    // NOTE: 非 singles 模式下获取当前 average 值
    let currentVal: number | null = null;
    const dataMode = state.dataMode;
    if (dataMode !== 'singles') {
      const endIdx = Math.min(pFrame + windowSize - 1, p.channelData.length - 1);
      const v = rawToVal(p.channelData[endIdx][0], currentEventId);
      if (v > 0) currentVal = v;
    }
    meanPositions.push({ pi, mean: currentMean, currentVal, name: p.nameZh || p.name });

    // NOTE: 轨迹拖尾 — 记录 + 绘制
    if (showLayers.trail) {
      while (p.meanTrail.length > 0 && p.meanTrail[p.meanTrail.length - 1].frame >= currentFrame) {
        p.meanTrail.pop();
      }
      if (currentFrame > 0) {
        p.meanTrail.push({ x: currentMean, frame: currentFrame });
      }
      const MAX_TRAIL = 600;
      if (p.meanTrail.length > MAX_TRAIL) p.meanTrail.splice(0, p.meanTrail.length - MAX_TRAIL);
      const trailLen = p.meanTrail.length;
      if (trailLen > 1) {
        for (let ti = 0; ti < trailLen; ti++) {
          const age = (trailLen - 1 - ti) / trailLen;
          const alpha = 0.6 * (1 - age * age);
          const r = 1.5 + 1.5 * (1 - age);
          ctx.fillStyle = getShiftedHSL(pi, alpha, p.meanTrail[ti].x, players, currentEventId);
          ctx.beginPath();
          ctx.arc(sx(p.meanTrail[ti].x), sy(0) - 3, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // NOTE: 根据 viewMode 绘制直方图和/或 KDE
    if (viewMode === 'histogram' && showLayers.histBars) {
      const bins = computeHistogram(times, viewXMax - viewXMin);
      drawHistogramBars(ctx, bins, sx, sy, pi, true, players, currentEventId);
    }
    if (viewMode === 'histogram') {
      drawCurve(ctx, kde, sx, sy, {
        fill: getShiftedHSL(pi, 0.15, currentMean, players, currentEventId),
        stroke: getShiftedHSL(pi, 0.85, currentMean, players, currentEventId),
        lineWidth: pi === activePlayerIdx ? 2.5 : 1.8,
        glow: pi === activePlayerIdx,
      });
    }

    // NOTE: 双峰检测
    if (showLayers.bimodal) {
      const peaks = detectPeaks(kde);
      if (peaks.length >= 2) {
        const midX = (peaks[0].x + peaks[1].x) / 2;
        const midPx = sx(midX);
        ctx.save();
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', midPx, mt + 30 + pi * 32);
        ctx.restore();
      }
    }

    // 均值线（半透明，可关闭）
    if (showLayers.meanLine) {
      drawMeanLine(ctx, sx, mt, ph, currentMean, getShiftedHSL(pi, 0.5, currentMean, players, currentEventId), false);
    }

    // 当前值线（亮色，可关闭）
    if (showLayers.currentVal && currentVal !== null) {
      drawMeanLine(ctx, sx, mt, ph, currentVal, getShiftedHSL(pi, 0.9, currentMean, players, currentEventId), false);
    }
  }

  // 3. 均值标签
  drawMeanLabelsOnCanvas(ctx, sx, mt, meanPositions, players, showLayers, currentEventId);

  // 4. 返回统计信息供外部更新 DOM
  const ap = players[activePlayerIdx];
  if (ap) {
    const apFrame = computePlayerFrame(activePlayerIdx, progress, players, windowSize, syncMode);
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
        progress,
      };
    }
  }
  return null;
}
