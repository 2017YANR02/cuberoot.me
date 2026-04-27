import type { Solve } from '../types';
import { effectiveMs } from '../types';
import { formatMs } from '../stats';

interface Props {
  solves: Solve[];
  isZh: boolean;
  onRowClick: (solve: Solve, index: number) => void;
}

export default function HistoryPanel({ solves, isZh, onRowClick }: Props) {
  const reversed = [...solves].reverse(); // newest at top
  return (
    <div className="history-panel">
      <div className="history-header">
        <span>{isZh ? '历史' : 'History'}</span>
        <span>{solves.length}</span>
      </div>
      <div className="history-list">
        {reversed.length === 0 && (
          <div className="history-empty">
            {isZh ? '还没有成绩。按住空格开始计时。' : 'No solves yet. Hold space to start.'}
          </div>
        )}
        {reversed.map((s, idxFromEnd) => {
          const realIdx = solves.length - 1 - idxFromEnd;
          const time = effectiveMs(s);
          return (
            <div className="history-row" key={s.id} onClick={() => onRowClick(s, realIdx)}>
              <div className="idx">{realIdx + 1}</div>
              <div className="time">
                {formatMs(time)}
                {s.penalty === '+2' && <span className="penalty-flag">(+2)</span>}
                {s.penalty === 'DNF' && <span className="penalty-flag">DNF</span>}
              </div>
              <div className="actions">
                <button onClick={(e) => { e.stopPropagation(); onRowClick(s, realIdx); }}>
                  {isZh ? '详情' : 'Info'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
