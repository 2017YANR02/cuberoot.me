import { useMemo, useState } from 'react';
import { Star, X, GitCompare } from 'lucide-react';
import type { Solve } from '../types';
import { effectiveMs } from '../types';
import { formatMs, pbSingleIndex } from '../stats';
import CompareSolvesModal from './CompareSolvesModal';

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
  const [query, setQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  // Selected solve ids in click-order (oldest first). When a 3rd id is clicked
  // we drop the oldest (index 0) and keep the most recent two — matches the
  // spec'd "swap older selection" behavior.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<[Solve, Solve] | null>(null);

  const reversed = [...solves].reverse(); // newest at top
  const pbIdx = pbSingleIndex(solves);

  // PB windows are computed from the FULL history so they remain stable
  // regardless of any filtering applied to the rendered list.
  const pbAo5Win = useMemo(() => bestWindowIndices(solves, 5), [solves]);
  const pbAo12Win = useMemo(() => bestWindowIndices(solves, 12), [solves]);

  // Map each solve's id back to its index in the original (un-reversed) solves
  // array, so PB highlight indices stay correct after filtering.
  const idToRealIdx = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < solves.length; i++) m.set(solves[i].id, i);
    return m;
  }, [solves]);

  const trimmed = query.trim().toLowerCase();
  const filteredReversed = useMemo(() => {
    if (!trimmed) return reversed;
    return reversed.filter((s) => {
      const c = (s.comment ?? '').toLowerCase();
      const sc = (s.scramble ?? '').toLowerCase();
      return c.includes(trimmed) || sc.includes(trimmed);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, solves]);

  const matchCount = filteredReversed.length;

  const exitCompareMode = () => {
    setCompareMode(false);
    setSelectedIds([]);
    setCompareError(null);
  };

  const toggleCompareMode = () => {
    if (compareMode) {
      exitCompareMode();
    } else {
      setCompareMode(true);
      setSelectedIds([]);
      setCompareError(null);
    }
  };

  /** Compare-mode row click: select / deselect / swap-older. */
  const handleSelectInCompare = (s: Solve) => {
    setCompareError(null);
    setSelectedIds(prev => {
      // Click an already-selected solve → deselect it.
      if (prev.includes(s.id)) return prev.filter(id => id !== s.id);
      // 3rd click → drop oldest, append new.
      if (prev.length >= 2) return [prev[1], s.id];
      return [...prev, s.id];
    });
  };

  const openCompareModal = () => {
    if (selectedIds.length !== 2) return;
    if (selectedIds[0] === selectedIds[1]) {
      setCompareError(isZh ? '请选择两个不同的成绩' : 'Pick two different solves');
      return;
    }
    const a = solves.find(x => x.id === selectedIds[0]);
    const b = solves.find(x => x.id === selectedIds[1]);
    if (!a || !b) {
      setCompareError(isZh ? '成绩未找到' : 'Solve not found');
      return;
    }
    setComparePair([a, b]);
  };

  const closeCompareModal = () => {
    setComparePair(null);
  };

  return (
    <div className="history-panel">
      <div className="history-header">
        <span>{isZh ? '历史' : 'History'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={toggleCompareMode}
            title={isZh ? '对比两次成绩' : 'Compare two solves'}
            aria-pressed={compareMode}
            style={{
              background: compareMode ? '#2a3d4d' : 'transparent',
              border: '1px solid #333',
              color: compareMode ? '#cde' : '#888',
              borderColor: compareMode ? '#4d7a99' : '#333',
              borderRadius: 4,
              padding: '2px 6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
            }}
          >
            <GitCompare size={12} />
            {isZh ? '对比' : 'Compare'}
          </button>
          <span>{solves.length}</span>
        </span>
      </div>
      <div className="history-search">
        <div className="history-search-input-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isZh ? '搜索注释或打乱…' : 'Search comment or scramble…'}
            aria-label={isZh ? '搜索注释或打乱' : 'Search comment or scramble'}
          />
          {query && (
            <button
              type="button"
              className="history-search-clear"
              onClick={() => setQuery('')}
              aria-label={isZh ? '清空搜索' : 'Clear search'}
            >
              <X size={12} />
            </button>
          )}
        </div>
        {trimmed && (
          <span className="history-search-count">
            {isZh ? `${matchCount} 条匹配` : `${matchCount} matches`}
          </span>
        )}
      </div>
      {compareMode && (
        <div
          style={{
            padding: '6px 14px',
            fontSize: 11,
            color: '#aaa',
            borderBottom: '1px solid #1f1f23',
            background: '#15151a',
          }}
        >
          {isZh
            ? `选择 2 个成绩进行对比 (已选 ${selectedIds.length}/2)`
            : `Pick 2 solves to compare (${selectedIds.length}/2 selected)`}
          {compareError && (
            <div style={{ color: '#d97a7a', marginTop: 2 }}>{compareError}</div>
          )}
        </div>
      )}
      <div className="history-list">
        {reversed.length === 0 && (
          <div className="history-empty">
            {isZh ? '还没有成绩。按住空格开始计时。' : 'No solves yet. Hold space to start.'}
          </div>
        )}
        {reversed.length > 0 && filteredReversed.length === 0 && (
          <div className="history-empty">
            {isZh ? '没有匹配的成绩。' : 'No matching solves.'}
          </div>
        )}
        {filteredReversed.map((s) => {
          const realIdx = idToRealIdx.get(s.id) ?? -1;
          const time = effectiveMs(s);
          const isPB = realIdx === pbIdx;
          const inAo5 = pbAo5Win !== null && realIdx >= pbAo5Win.start && realIdx <= pbAo5Win.end;
          const inAo12 = pbAo12Win !== null && realIdx >= pbAo12Win.start && realIdx <= pbAo12Win.end;
          const isAo5End = pbAo5Win !== null && realIdx === pbAo5Win.end;
          const isAo12End = pbAo12Win !== null && realIdx === pbAo12Win.end;
          const isSelected = compareMode && selectedIds.includes(s.id);

          const classNames = ['history-row'];
          if (isPB) classNames.push('is-pb', 'pb-single');
          if (inAo5) classNames.push('pb-ao5');
          if (inAo12) classNames.push('pb-ao12');

          const tooltips: string[] = [];
          if (isAo5End) tooltips.push(isZh ? 'PB ao5 此处达成' : 'PB ao5 ends here');
          if (isAo12End) tooltips.push(isZh ? 'PB ao12 此处达成' : 'PB ao12 ends here');
          const rowTitle = tooltips.length ? tooltips.join(' · ') : undefined;

          const rowStyle: React.CSSProperties = isSelected
            ? { background: 'rgba(77, 122, 153, 0.18)', boxShadow: 'inset 2px 0 0 #4d7a99' }
            : {};

          const handleRowClick = () => {
            if (compareMode) {
              handleSelectInCompare(s);
            } else {
              onRowClick(s, realIdx);
            }
          };

          return (
            <div
              className={classNames.join(' ')}
              key={s.id}
              title={rowTitle}
              style={rowStyle}
              onClick={handleRowClick}
            >
              {compareMode && (
                <div
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '1.5px solid ' + (isSelected ? '#4d7a99' : '#444'),
                    background: isSelected ? '#4d7a99' : 'transparent',
                    marginLeft: -6,
                    marginRight: 2,
                    flexShrink: 0,
                  }}
                />
              )}
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
              {!compareMode && (
                <div className="actions">
                  <button onClick={(e) => { e.stopPropagation(); onRowClick(s, realIdx); }}>
                    {isZh ? '详情' : 'Info'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {compareMode && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid #1f1f23',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            background: '#15151a',
          }}
        >
          <button
            type="button"
            onClick={exitCompareMode}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              color: '#aaa',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={openCompareModal}
            disabled={selectedIds.length !== 2}
            style={{
              background: selectedIds.length === 2 ? '#2a3d4d' : '#1a1a1d',
              border: '1px solid ' + (selectedIds.length === 2 ? '#4d7a99' : '#333'),
              color: selectedIds.length === 2 ? '#cde' : '#555',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: selectedIds.length === 2 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <GitCompare size={12} />
            {isZh ? '对比这 2 个' : 'Compare these 2'}
          </button>
        </div>
      )}
      {comparePair && (
        <CompareSolvesModal
          solveA={comparePair[0]}
          solveB={comparePair[1]}
          isZh={isZh}
          onClose={closeCompareModal}
        />
      )}
    </div>
  );
}
