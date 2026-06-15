// NOTE: 累积直方图模式渲染器
// 从 viz/viz.js drawFrameCumHist() L1418-1543 1:1 翻译为 TypeScript
// 接收 ctx + 全部所需参数，不读取全局变量

import type { VizState } from '../_stores/viz_store';
import { MARGIN } from '../_stores/viz_store';
import { computeKDE, mean, computeHistogram } from '../_engine/kde';
import {
  rawToVal, getShiftedHSL, KDE_POINTS,
} from '../_engine/data_fetch';

import { drawGrid, drawCurve, drawMeanLabelsOnCanvas } from './draw_utils';
import type { MeanPosition } from './draw_utils';

/**
 * NOTE: 累积直方图帧渲染结果
 */
export interface CumHistFrameResult {
  cumTimes: number[];
  cumMean: number;
  lastDate: string;
  endIdx: number;
  progress: number;
}

/**
 * NOTE: 累积直方图模式的完整渲染
 * 1:1 翻译自 viz.js drawFrameCumHist()
 */
export function drawCumHistView(
  ctx: CanvasRenderingContext2D,
  state: VizState,
): CumHistFrameResult | null {
  const {
    players, activePlayerIdx, currentEventId, currentFrame, maxFrame,
    xMin, xMax, userXMin, userXMax, minBandwidth,
    showLayers, cw, ch,
  } = state;

  if (players.length === 0) return null;

  const { top: mt, right: mr, bottom: mb, left: ml } = MARGIN;
  const pw = cw - ml - mr;
  const ph = ch - mt - mb;

  const progress = maxFrame > 0 ? currentFrame / maxFrame : 1;
  // 可见 X 范围（支持用户缩放）
  const viewXMin = userXMin !== null ? userXMin : xMin;
  const viewXMax = userXMax !== null ? userXMax : xMax;
  const viewRange = viewXMax - viewXMin;

  // NOTE: 预计算所有选手的累积数据，确定全局 Y 轴最大值
  interface CumData {
    cumTimes: number[];
    bins: ReturnType<typeof computeHistogram>;
    endIdx: number;
  }
  const allCumData: (CumData | null)[] = [];
  let globalMaxDensity = 0;

  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    const totalSolves = p.channelData.length;
    const endIdx = Math.max(Math.min(Math.round(progress * totalSolves), totalSolves), 1);

    const cumTimes: number[] = [];
    for (let i = 0; i < endIdx; i++) {
      const v = rawToVal(p.channelData[i][0], currentEventId);
      if (v > 0) cumTimes.push(v);
    }
    if (cumTimes.length < 2) { allCumData.push(null); continue; }

    const bins = computeHistogram(cumTimes, viewRange);
    for (const b of bins) {
      if (b.density > globalMaxDensity) globalMaxDensity = b.density;
    }
    allCumData.push({ cumTimes, bins, endIdx });
  }
  globalMaxDensity = Math.max(globalMaxDensity, 0.01) * 1.15;

  // 坐标映射（Y 轴用 density，多选手共享比例）
  const sx = (x: number) => ml + ((x - viewXMin) / (viewXMax - viewXMin)) * pw;
  const sy = (y: number) => mt + ph - (y / globalMaxDensity) * ph;

  // 1. 网格
  drawGrid(ctx, sx, sy, ml, mt, pw, ph, viewXMin, viewXMax, currentEventId);

  // 2. 循环所有选手：绘制直方图 + KDE
  const meanPositions: MeanPosition[] = [];
  for (let pi = 0; pi < players.length; pi++) {
    const d = allCumData[pi];
    if (!d) continue;
    const { cumTimes, bins } = d;
    const cumMean = mean(cumTimes);
    meanPositions.push({ pi, mean: cumMean, currentVal: null, name: players[pi].nameZh || players[pi].name });

    // 直方图柱子（受"直方柱"开关控制）
    if (showLayers.histBars) {
      ctx.save();
      const midVal = (bins[0].xStart + bins[bins.length - 1].xEnd) / 2;
      ctx.fillStyle = getShiftedHSL(pi, 0.25, midVal, players, currentEventId);
      ctx.strokeStyle = getShiftedHSL(pi, 0.5, midVal, players, currentEventId);
      ctx.lineWidth = 1;
      const baseline = sy(0);
      for (const b of bins) {
        if (b.count === 0) continue;
        const x1 = sx(b.xStart);
        const x2 = sx(b.xEnd);
        const yTop = sy(b.density);
        if (x2 < ml || x1 > ml + pw) continue;
        ctx.fillRect(x1, yTop, x2 - x1, baseline - yTop);
        ctx.strokeRect(x1, yTop, x2 - x1, baseline - yTop);

        // 柱子顶部显示计数
        const barW = x2 - x1;
        if (barW > 12 && b.count > 0 && (players.length === 1 || pi === activePlayerIdx)) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '600 11px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(b.count), (x1 + x2) / 2, yTop - 3);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // KDE 叠加
    const kde = computeKDE(cumTimes, viewXMin, viewXMax, KDE_POINTS, minBandwidth);
    if (kde && kde.length > 0) {
      drawCurve(ctx, kde, sx, sy, {
        fill: getShiftedHSL(pi, 0.08, cumMean, players, currentEventId),
        stroke: getShiftedHSL(pi, 0.7, cumMean, players, currentEventId),
        lineWidth: pi === activePlayerIdx ? 2.5 : 1.8,
      });
    }
  }

  // 3. 均值标签
  drawMeanLabelsOnCanvas(ctx, sx, mt, meanPositions, players, showLayers, currentEventId);

  // 5. Y 轴标签改为 "Count"
  ctx.save();
  ctx.translate(16, mt + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Count', 0, 0);
  ctx.restore();

  // 6. 返回主选手统计信息
  const apData = allCumData[activePlayerIdx];
  if (apData) {
    const ap = players[activePlayerIdx];
    const lastCompIdx = ap.channelData[apData.endIdx - 1][1];
    const lastDate = ap.compDates[lastCompIdx];
    return {
      cumTimes: apData.cumTimes,
      cumMean: mean(apData.cumTimes),
      lastDate,
      endIdx: apData.endIdx,
      progress,
    };
  }
  return null;
}
