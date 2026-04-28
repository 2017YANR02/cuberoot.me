import { useMemo, useState } from 'react';
import { Star, X, GitCompare, ChevronDown, ChevronUp } from 'lucide-react';
import type { Solve, Penalty } from '../types';
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

/** Parse a "5.0" / "1:23.45" / "12.3" string into ms. Returns null on failure. */
function parseTimeSeconds(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  // Support "m:ss.xx" or plain seconds.
  const colonMatch = t.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (colonMatch) {
    const m = parseInt(colonMatch[1], 10);
    const s = parseFloat(colonMatch[2]);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    return Math.round((m * 60 + s) * 1000);
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000);
}

/** Parse YYYY-MM-DD into Unix-ms at start-of-local-day, or null. */
function parseDateStart(input: string): number | null {
  if (!input) return null;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

/** Parse YYYY-MM-DD into Unix-ms at end-of-local-day (exclusive next-day start). */
function parseDateEnd(input: string): number | null {
  if (!input) return null;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d + 1, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

const ALL_PENALTIES: Penalty[] = ['ok', '+2', 'DNF'];

export default function HistoryPanel({ solves, isZh, onRowClick }: Props) {
  const [query, setQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  // Selected solve ids in click-order (oldest first). When a 3rd id is clicked
  // we drop the oldest (index 0) and keep the most recent two — matches the
  // spec'd "swap older selection" behavior.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<[Solve, Solve] | null>(null);

  // Structured filters
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeMax, setTimeMax] = useState('');
  const [penaltySet, setPenaltySet] = useState<Set<Penalty>>(new Set(ALL_PENALTIES));
  const [ollFilter, setOllFilter] = useState('');
  const [pllFilter, setPllFilter] = useState('');

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

  const dateFromMs = parseDateStart(dateFrom);
  const dateToMs = parseDateEnd(dateTo);
  const timeMinMs = parseTimeSeconds(timeMin);
  const timeMaxMs = parseTimeSeconds(timeMax);
  const ollTrim = ollFilter.trim().toLowerCase();
  const pllTrim = pllFilter.trim().toLowerCase();

  // Count of active non-default filters (excluding the comment/scramble query).
  const activeFilterCount =
    (dateFromMs !== null ? 1 : 0) +
    (dateToMs !== null ? 1 : 0) +
    (timeMinMs !== null ? 1 : 0) +
    (timeMaxMs !== null ? 1 : 0) +
    (penaltySet.size !== ALL_PENALTIES.length ? 1 : 0) +
    (ollTrim ? 1 : 0) +
    (pllTrim ? 1 : 0);

  const filteredReversed = useMemo(() => {
    return reversed.filter((s) => {
      // Comment / scramble substring
      if (trimmed) {
        const c = (s.comment ?? '').toLowerCase();
        const sc = (s.scramble ?? '').toLowerCase();
        if (!c.includes(trimmed) && !sc.includes(trimmed)) return false;
      }
      // Date range (uses solve.ts)
      if (dateFromMs !== null && s.ts < dateFromMs) return false;
      if (dateToMs !== null && s.ts >= dateToMs) return false;
      // Time range (effective ms; DNF excluded if a time bound is set)
      if (timeMinMs !== null || timeMaxMs !== null) {
        const eff = effectiveMs(s);
        if (!Number.isFinite(eff)) return false;
        if (timeMinMs !== null && eff < timeMinMs) return false;
        if (timeMaxMs !== null && eff > timeMaxMs) return false;
      }
      // Penalty
      if (!penaltySet.has(s.penalty)) return false;
      // OLL / PLL case substring
      if (ollTrim) {
        const oll = (s.stageSegments?.ollCase ?? '').toLowerCase();
        if (!oll.includes(ollTrim)) return false;
      }
      if (pllTrim) {
        const pll = (s.stageSegments?.pllCase ?? '').toLowerCase();
        if (!pll.includes(pllTrim)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, solves, dateFromMs, dateToMs, timeMinMs, timeMaxMs, penaltySet, ollTrim, pllTrim]);

  const matchCount = filteredReversed.length;
  const hasAnyFilter = !!trimmed || activeFilterCount > 0;

  const clearAllFilters = () => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setTimeMin('');
    setTimeMax('');
    setPenaltySet(new Set(ALL_PENALTIES));
    setOllFilter('');
    setPllFilter('');
  };

  const togglePenalty = (p: Penalty) => {
    setPenaltySet(prev => {
      const next = new Set(prev);
      if (next.has(p)) {
        // Avoid leaving an empty set (which would hide everything silently);
        // re-enable all when user toggles off the last one.
        if (next.size === 1) return new Set(ALL_PENALTIES);
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

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

  // Inline style helpers for the filters panel
  const chipBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#2a3d4d' : 'transparent',
    border: '1px solid ' + (active ? '#4d7a99' : '#333'),
    color: active ? '#cde' : '#888',
    borderRadius: 4,
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: 11,
  });
  const inputStyle: React.CSSProperties = {
    background: '#0e0e11',
    border: '1px solid #333',
    color: '#ccc',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 11,
    width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
    display: 'block',
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
        {hasAnyFilter && (
          <span className="history-search-count">
            {isZh ? `${matchCount} 条匹配` : `${matchCount} matches`}
          </span>
        )}
      </div>
      <div
        style={{
          padding: '4px 14px 6px',
          borderBottom: filtersExpanded ? '1px solid #1f1f23' : 'none',
          background: '#15151a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setFiltersExpanded(v => !v)}
            aria-expanded={filtersExpanded}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              padding: '2px 0',
            }}
          >
            {filtersExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {isZh ? '筛选' : 'Filters'}
          </button>
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 11, color: '#cde' }}>
              {isZh
                ? `${activeFilterCount} 个筛选生效`
                : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`}
            </span>
          )}
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: '1px solid #333',
                color: '#888',
                borderRadius: 4,
                padding: '1px 6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
              }}
              title={isZh ? '清空所有筛选' : 'Clear all filters'}
            >
              <X size={10} />
              {isZh ? '清空' : 'Clear filters'}
            </button>
          )}
        </div>
        {filtersExpanded && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={labelStyle}>{isZh ? '日期 起' : 'Date from'}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{isZh ? '日期 止' : 'Date to'}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={labelStyle}>{isZh ? '最短 (秒)' : 'Min (s)'}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={timeMin}
                  onChange={(e) => setTimeMin(e.target.value)}
                  placeholder="5.0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{isZh ? '最长 (秒)' : 'Max (s)'}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={timeMax}
                  onChange={(e) => setTimeMax(e.target.value)}
                  placeholder="20.0"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{isZh ? '罚时' : 'Penalty'}</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {ALL_PENALTIES.map(p => {
                  const label = p === 'ok' ? 'OK' : p;
                  const active = penaltySet.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePenalty(p)}
                      aria-pressed={active}
                      style={chipBtn(active)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={labelStyle}>{isZh ? 'OLL 公式' : 'OLL case'}</label>
                <input
                  type="text"
                  value={ollFilter}
                  onChange={(e) => setOllFilter(e.target.value)}
                  placeholder={isZh ? '例如 OLL 21' : 'e.g. OLL 21'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{isZh ? 'PLL 公式' : 'PLL case'}</label>
                <input
                  type="text"
                  value={pllFilter}
                  onChange={(e) => setPllFilter(e.target.value)}
                  placeholder={isZh ? '例如 Aa' : 'e.g. Aa'}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
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
            <div>{isZh ? '没有匹配的成绩。' : 'No solves match these filters'}</div>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  marginTop: 6,
                  background: 'transparent',
                  border: 'none',
                  color: '#6aa3c8',
                  cursor: 'pointer',
                  fontSize: 12,
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {isZh ? '清空筛选' : 'Clear filters'}
              </button>
            )}
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
