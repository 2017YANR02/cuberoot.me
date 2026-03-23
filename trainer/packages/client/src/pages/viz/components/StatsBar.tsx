// NOTE: 统计面板 — 均值/标准差/把数/比赛/进步
// 从 viz/index.html L141-162 的 DOM 结构转为 React 组件

import { isFMC, isMBLD } from '../engine/data_fetch';
import { useVizStore } from '../stores/viz_store';

interface StatsBarProps {
  mean: string;
  std: string;
  syncLabel: string;
  syncValue: string;
  compName: string;
  delta: number;
  improved: boolean;
  regressed: boolean;
}

export default function StatsBar(props: StatsBarProps) {
  const eventId = useVizStore(s => s.currentEventId);

  const deltaText = isFMC(eventId) || isMBLD(eventId)
    ? Math.round(Math.abs(props.delta)) + (isMBLD(eventId) ? ' pts' : ' moves')
    : Math.abs(props.delta).toFixed(2) + 's';

  const deltaClass = props.improved ? 'stat-value mono improving'
    : props.regressed ? 'stat-value mono regressing'
    : 'stat-value mono';

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">均值</span>
        <span className="stat-value mono">{props.mean || '--'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">标准差</span>
        <span className="stat-value mono">{props.std || '--'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{props.syncLabel || '把数'}</span>
        <span className="stat-value mono">{props.syncValue || '--'}</span>
      </div>
      <div className="stat-item stat-comp">
        <span className="stat-label">比赛</span>
        <span className="stat-value">{props.compName || '--'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{props.improved ? '进步' : props.regressed ? '退步' : '进步'}</span>
        <span className={deltaClass}>{deltaText}</span>
      </div>
    </div>
  );
}
