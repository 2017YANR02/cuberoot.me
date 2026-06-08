'use client';
// NOTE: 统计面板 — 均值/标准差/把数/比赛/进步
// 从 viz/index.html L141-162 的 DOM 结构转为 React 组件

import { useTranslation } from 'react-i18next';
import { isFMC, isMBLD } from '../_engine/data_fetch';
import { useVizStore } from '../_stores/viz_store';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

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
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const eventId = useVizStore(s => s.currentEventId);

  const deltaText = isFMC(eventId) || isMBLD(eventId)
    ? Math.round(Math.abs(props.delta)) + (isMBLD(eventId) ? ' pts' : ' moves')
    : Math.abs(props.delta).toFixed(2) + 's';

  const deltaClass = props.improved ? 'stat-value mono improving'
    : props.regressed ? 'stat-value mono regressing'
    : 'stat-value mono';

  // NOTE: syncLabel 值来自 VizCanvas，中文为 '把数' 或 '日期'
  const syncLabelDisplay = i18n.language === 'zh-Hant' ? ((props.syncLabel || '把數')) : (isZh
      ? (props.syncLabel || '把数')
      : (props.syncLabel === '日期' ? 'Date' : 'Solves'));

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">{tr({ zh: '均值', en: 'Mean' })}</span>
        <span className="stat-value mono">{props.mean || '--'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{tr({ zh: '标准差', en: 'Stddev',
            zhHant: "標準差"
        })}</span>
        <span className="stat-value mono">{props.std || '--'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{syncLabelDisplay}</span>
        <span className="stat-value mono">{props.syncValue || '--'}</span>
      </div>
      <div className="stat-item stat-comp">
        <span className="stat-label">{tr({ zh: '比赛', en: 'Comp',
            zhHant: "比賽"
        })}</span>
        <span className="stat-value">{props.compName || '--'}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">
          {i18n.language === 'zh-Hant' ? ((props.improved ? '進步' : props.regressed ? '退步' : '進步')) : (isZh
                              ? (props.improved ? '进步' : props.regressed ? '退步' : '进步')
                              : (props.improved ? 'Progress' : props.regressed ? 'Regress' : 'Progress'))}
        </span>
        <span className={deltaClass}>{deltaText}</span>
      </div>
    </div>
  );
}
