import type { Solve } from '../types';
import { effectiveMs } from '../types';
import { formatMs, pbSingleIndex } from '../stats';

interface Props {
  solves: Solve[];
  isZh: boolean;
  onRowClick: (solve: Solve, index: number) => void;
}

export default function HistoryPanel({ solves, isZh, onRowClick }: Props) {
  const reversed = [...solves].reverse(); // newest at top
  const pbIdx = pbSingleIndex(solves);
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
          const isPB = realIdx === pbIdx;
          return (
            <div
              className={`history-row ${isPB ? 'is-pb' : ''}`}
              key={s.id}
              onClick={() => onRowClick(s, realIdx)}
            >
              <div className="idx">{realIdx + 1}</div>
              <div className="time">
                {isPB && <span className="pb-badge" title={isZh ? '当前最佳' : 'Personal best'}>★</span>}
                {formatMs(time)}
                {s.penalty === '+2' && <span className="penalty-flag">(+2)</span>}
                {s.penalty === 'DNF' && <span className="penalty-flag">DNF</span>}
                {s.comment && <span className="comment-flag" title={s.comment}>·</span>}
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
