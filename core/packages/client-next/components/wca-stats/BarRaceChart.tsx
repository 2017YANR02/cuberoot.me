'use client';

// 共享横条竞速图(X 轴刻度 + 网格 + 横条),wr_metric(Top10HistoryPage)与 SOR(SorRace)
// 共用同一份渲染:bar 长度 = 真实值 / axisMax × barFrac(0 锚定),刻度/网格 left% 同公式。
// 数据来源不同(逐日 PB vs 年帧 SOR)由各自上层算好 rows + 轴再喂进来。复用 top10_history.css。
import type { ReactNode } from 'react';
import { Flag } from '@/components/Flag';
import { colorForRow } from '@/lib/bar-race-colors';

const BAR_FRAC = 60;

export interface BarRaceRow {
  key: string;            // 稳定 id(选手 wcaId),决定重排动画身份 + 配色
  href: string;
  name: string;
  iso2: string | null;
  country?: string | null;
  value: number;          // 真实值(决定条长)
  valueLabel: string;     // 行尾显示文案
  rankLabel: ReactNode;   // 名次显示(slot 由数组顺序定,这里只管文字)
  trailing?: ReactNode;   // 行尾附加件(wr_metric 的比赛链接;SOR 无)
}

interface Props {
  rows: BarRaceRow[];       // 已按显示顺序(slot 0..N)排好
  axisMax: number;
  ticks: number[];
  tickLabel: (v: number) => string;
  hideAxisLabels?: boolean; // MBLD 等隐藏文字刻度,仍画网格
  rowH: number;
  showN: number;
  barFrac?: number;
  emptyText?: string;
}

export default function BarRaceChart({
  rows, axisMax, ticks, tickLabel, hideAxisLabels = false, rowH, showN, barFrac = BAR_FRAC, emptyText,
}: Props) {
  const left = (v: number) => `${(v / axisMax) * barFrac}%`;
  return (
    <>
      {!hideAxisLabels && (
        <div className="t10h-axis" aria-hidden="true">
          {ticks.map(v => (
            <span key={v} className="t10h-tick" style={{ left: left(v) }}>{tickLabel(v)}</span>
          ))}
        </div>
      )}
      <div className="t10h-bars" style={{ height: `${showN * rowH}px` }}>
        {ticks.length > 0 && (
          <div className="t10h-grid" aria-hidden="true">
            {ticks.map(v => (
              <span key={v} className={`t10h-grid-line${v === 0 ? ' t10h-grid-line-zero' : ''}`} style={{ left: left(v) }} />
            ))}
          </div>
        )}
        {rows.map((row, i) => (
          <div key={row.key} className="t10h-row" style={{ transform: `translateY(${i * rowH}px)` }}>
            <div className="t10h-rank">{row.rankLabel}</div>
            <a className="t10h-bar" href={row.href} target="_blank" rel="noopener"
              style={{ width: left(row.value), background: colorForRow(row.key, row.country) }} title={row.name}>
              {row.iso2 && <Flag iso2={row.iso2} className="t10h-bar-flag" />}
              <span className="t10h-bar-name">{row.name}</span>
            </a>
            <span className="t10h-value">{row.valueLabel}</span>
            {row.trailing}
          </div>
        ))}
        {rows.length === 0 && emptyText && (
          <div className="t10h-status" style={{ padding: '40px 0' }}>{emptyText}</div>
        )}
      </div>
    </>
  );
}
