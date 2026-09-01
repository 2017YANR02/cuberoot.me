'use client';

import {
  type ReconstructSlices,
  type TimerHistoryLocalizedText,
} from '@cuberoot/shared/timer';

const COPY = {
  afterMemo: { en: 'after memo', zh: '记忆后' },
  firstMove: { en: 'First move', zh: '首动延迟' },
  fromStart: { en: 'from start', zh: '从计时开始' },
  longestPause: { en: 'Longest pause', zh: '最长停顿' },
  metrics: { en: 'Reconstruction metrics', zh: '复盘指标' },
  tps: { en: 'tps', zh: '步/秒' },
} as const satisfies Record<string, TimerHistoryLocalizedText>;

export interface TimerReconstructMetricsProps {
  localize: (copy: TimerHistoryLocalizedText) => string;
  metrics: ReconstructSlices;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function TimerReconstructMetrics({ localize, metrics }: TimerReconstructMetricsProps) {
  return (
    <div
      aria-label={localize(COPY.metrics)}
      className="timer-reconstruct-metrics"
      data-timer-reconstruct-metrics
      role="group"
    >
      <div className="timer-reconstruct-metric">
        <div className="timer-reconstruct-metric-num">{metrics.qtmCount}</div>
        <div className="timer-reconstruct-metric-label">QTM</div>
        <div className="timer-reconstruct-metric-sub">{metrics.qtps.toFixed(2)} {localize(COPY.tps)}</div>
      </div>
      <div className="timer-reconstruct-metric">
        <div className="timer-reconstruct-metric-num">{formatSeconds(metrics.firstMoveLatencyMs)}</div>
        <div className="timer-reconstruct-metric-label">{localize(COPY.firstMove)}</div>
        <div className="timer-reconstruct-metric-sub">
          {localize(metrics.memoMs === undefined ? COPY.fromStart : COPY.afterMemo)}
        </div>
      </div>
      <div className="timer-reconstruct-metric">
        <div className="timer-reconstruct-metric-num">{formatSeconds(metrics.longestPauseMs)}</div>
        <div className="timer-reconstruct-metric-label">{localize(COPY.longestPause)}</div>
        <div className="timer-reconstruct-metric-sub">{metrics.pauseCount} × &gt;0.5s</div>
      </div>
    </div>
  );
}
