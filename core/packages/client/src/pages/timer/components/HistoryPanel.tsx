import { useMemo } from 'react';
import { Star } from 'lucide-react';
import type { Solve } from '../types';
import { effectiveMs } from '../types';
import { formatMs, pbSingleIndex } from '../stats';

interface Props {
  solves: Solve[];
  isZh: boolean;
  onRowClick: (solve: Solve, index: number) => void;
}

/**
 * Best ao{n} window across the full history. Returns the inclusive [start,end]
 * indices of the best window plus its trimmed mean (post-truncation in ms),
 * or null when there are fewer than n solves or every window is DNF.
 */
function bestWindowIndices(
  solves: Solve[],
  n: number,
): { start: number; end: number; ms: number } | null {
  if (solves.length < n) return null;
  const trim = Math.max(1, Math.ceil(n / 20));
  const dnfCap = n <= 12 ? 1 : trim;
  let best = Infinity;
  let bestStart = -1;
  for (let i = 0; i + n <= solves.length; i++) {
    const window = solves.slice(i, i + n).map(effectiveMs);
    const sorted = [...window].sort((a, b) => a - b);
    const dnfCount = sorted.filter(t => t === Infinity).length;
    if (dnfCount > dnfCap) continue;
    const middle = sorted.slice(trim, n - trim);
    if (middle.some(t => t === Infinity)) continue;
    const avg = middle.reduce((a, b) => a + b, 0) / middle.length;
    if (avg < best) {
      best = avg;
      bestStart = i;
    }
  }
  if (bestStart < 0) return null;
  return { start: bestStart, end: bestStart + n - 1, ms: Math.floor(best / 10) * 10 };
}

export default function HistoryPanel({ solves, isZh, onRowClick }: Props) {
  const reversed = [...solves].reverse(); // newest at top
  const pbIdx = pbSingleIndex(solves);

  const pbAo5Win = useMemo(() => bestWindowIndices(solves, 5), [solves]);
  const pbAo12Win = useMemo(() => bestWindowIndices(solves, 12), [solves]);

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
          const inAo5 = pbAo5Win !== null && realIdx >= pbAo5Win.start && realIdx <= pbAo5Win.end;
          const inAo12 = pbAo12Win !== null && realIdx >= pbAo12Win.start && realIdx <= pbAo12Win.end;
          const isAo5End = pbAo5Win !== null && realIdx === pbAo5Win.end;
          const isAo12End = pbAo12Win !== null && realIdx === pbAo12Win.end;

          const classNames = ['history-row'];
          if (isPB) classNames.push('is-pb', 'pb-single');
          if (inAo5) classNames.push('pb-ao5');
          if (inAo12) classNames.push('pb-ao12');

          const tooltips: string[] = [];
          if (isAo5End) tooltips.push(isZh ? 'PB ao5 此处达成' : 'PB ao5 ends here');
          if (isAo12End) tooltips.push(isZh ? 'PB ao12 此处达成' : 'PB ao12 ends here');
          const rowTitle = tooltips.length ? tooltips.join(' · ') : undefined;

          return (
            <div
              className={classNames.join(' ')}
              key={s.id}
              title={rowTitle}
              onClick={() => onRowClick(s, realIdx)}
            >
              <div className="idx">{realIdx + 1}</div>
              <div className="time">
                {isPB && (
                  <Star
                    size={10}
                    className="pb-icon"
                    aria-label={isZh ? '当前最佳' : 'Personal best'}
                  />
                )}
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
