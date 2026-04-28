import { useEffect, useMemo, useRef, useState } from 'react';
import { Star, X, GitCompare, ChevronDown, ChevronUp, CheckSquare, Trash2, MoreVertical } from 'lucide-react';
import type { Solve, Penalty } from '../types';
import { effectiveMs } from '../types';
import { formatMs, pbSingleIndex } from '../stats';
import CompareSolvesModal from './CompareSolvesModal';
import { computeAllTags, TAG_DEFS, ALL_TAG_IDS } from '../storage/auto_tag';
import type { TagId } from '../storage/auto_tag';

interface Props {
  solves: Solve[];
  isZh: boolean;
  onRowClick: (solve: Solve, index: number) => void;
  /** Optional bulk-delete callback. When provided, a "select mode" toggle is
   *  shown that lets the user pick multiple solves and delete them in one go.
   *  Parent (TimerPage) is responsible for the actual db.deleteSolves call. */
  onBulkDelete?: (ids: string[]) => void;
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

const MOBILE_QUERY = '(max-width: 480px)';
const MOBILE_TAG_CAP = 2;

export default function HistoryPanel({ solves, isZh, onRowClick, onBulkDelete }: Props) {
  const [query, setQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  // Selected solve ids in click-order (oldest first). When a 3rd id is clicked
  // we drop the oldest (index 0) and keep the most recent two — matches the
  // spec'd "swap older selection" behavior.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<[Solve, Solve] | null>(null);

  // Select mode (multi-select for bulk delete). Mutually exclusive with
  // compareMode. Selection is a Set keyed by solve id; persists across filter
  // changes (mirrors compare-mode semantics — a selected solve that becomes
  // hidden via filters stays selected).
  const [selectMode, setSelectMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  // Mobile detection — used to compress header (overflow menu instead of two
  // standalone toggle buttons), shrink search placeholder, and cap per-row tag
  // chips. Tracked via matchMedia so it updates on resize / orientation.
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Safari < 14 only supports addListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  // Mobile-only overflow menu (Compare / Select).
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!actionsRef.current) return;
      if (!actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionsOpen]);

  // Structured filters
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeMax, setTimeMax] = useState('');
  const [penaltySet, setPenaltySet] = useState<Set<Penalty>>(new Set(ALL_PENALTIES));
  const [ollFilter, setOllFilter] = useState('');
  const [pllFilter, setPllFilter] = useState('');
  // Tag filter: only solves with at least one of these tags are kept.
  // Empty set => no tag filter applied.
  const [tagSet, setTagSet] = useState<Set<TagId>>(new Set());

  const reversed = [...solves].reverse(); // newest at top
  const pbIdx = pbSingleIndex(solves);

  // Auto-tags computed once per history change.
  const tagsByid = useMemo(() => computeAllTags(solves), [solves]);

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
    (pllTrim ? 1 : 0) +
    (tagSet.size > 0 ? 1 : 0);

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
      // Tag filter: require at least one selected tag to be present.
      if (tagSet.size > 0) {
        const t = tagsByid.get(s.id) ?? [];
        let hit = false;
        for (const tg of t) {
          if (tagSet.has(tg)) { hit = true; break; }
        }
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, solves, dateFromMs, dateToMs, timeMinMs, timeMaxMs, penaltySet, ollTrim, pllTrim, tagSet, tagsByid]);

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
    setTagSet(new Set());
  };

  const toggleTag = (t: TagId) => {
    setTagSet(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
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

  const exitSelectMode = () => {
    setSelectMode(false);
    setBulkSelected(new Set());
  };

  const toggleCompareMode = () => {
    if (compareMode) {
      exitCompareMode();
    } else {
      // Compare and select are mutually exclusive.
      if (selectMode) exitSelectMode();
      setCompareMode(true);
      setSelectedIds([]);
      setCompareError(null);
    }
  };

  const toggleSelectMode = () => {
    if (selectMode) {
      exitSelectMode();
    } else {
      if (compareMode) exitCompareMode();
      setSelectMode(true);
      setBulkSelected(new Set());
    }
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Select all solves currently visible after the active filter set. */
  const selectAllVisible = () => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      for (const s of filteredReversed) next.add(s.id);
      return next;
    });
  };

  const selectNone = () => {
    setBulkSelected(new Set());
  };

  const handleBulkDelete = () => {
    if (!onBulkDelete) return;
    const ids = Array.from(bulkSelected);
    if (ids.length === 0) return;
    const msg = isZh
      ? `确认删除选中的 ${ids.length} 条成绩？此操作无法撤销。`
      : `Delete ${ids.length} selected solve${ids.length === 1 ? '' : 's'}? This cannot be undone.`;
    // eslint-disable-next-line no-alert
    if (!window.confirm(msg)) return;
    onBulkDelete(ids);
    exitSelectMode();
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

  // Tone -> { bg, border, color } palette for tag chips.
  const TAG_TONE_STYLE: Record<'gold' | 'green' | 'red' | 'muted', React.CSSProperties> = {
    gold:  { background: 'rgba(212, 166, 87, 0.16)',  border: '1px solid #8a7345', color: '#d4a657' },
    green: { background: 'rgba(106, 168, 100, 0.14)', border: '1px solid #4d7a44', color: '#8fc28a' },
    red:   { background: 'rgba(217, 122, 122, 0.14)', border: '1px solid #7a4444', color: '#d97a7a' },
    muted: { background: 'transparent',               border: '1px solid #333',    color: '#888'    },
  };

  const tagChipStyle = (tone: 'gold' | 'green' | 'red' | 'muted'): React.CSSProperties => ({
    ...TAG_TONE_STYLE[tone],
    borderRadius: 3,
    padding: '0 5px',
    fontSize: 9,
    lineHeight: '14px',
    display: 'inline-block',
    whiteSpace: 'nowrap',
  });

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
          {!isMobile && (
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
          )}
          {!isMobile && onBulkDelete && (
            <button
              type="button"
              onClick={toggleSelectMode}
              title={isZh ? '多选删除' : 'Select multiple to delete'}
              aria-pressed={selectMode}
              style={{
                background: selectMode ? '#3d2a2a' : 'transparent',
                border: '1px solid ' + (selectMode ? '#995a4d' : '#333'),
                color: selectMode ? '#edc' : '#888',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
            >
              <CheckSquare size={12} />
              {isZh ? '选择' : 'Select'}
            </button>
          )}
          {isMobile && (
            <div ref={actionsRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setActionsOpen(v => !v)}
                title={isZh ? '更多操作' : 'More actions'}
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                aria-label={isZh ? '更多操作' : 'More actions'}
                style={{
                  background: (compareMode || selectMode) ? '#2a3d4d' : 'transparent',
                  border: '1px solid ' + ((compareMode || selectMode) ? '#4d7a99' : '#333'),
                  color: (compareMode || selectMode) ? '#cde' : '#aaa',
                  borderRadius: 4,
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <MoreVertical size={16} />
              </button>
              {actionsOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    minWidth: 140,
                    background: '#1a1a1f',
                    border: '1px solid #333',
                    borderRadius: 4,
                    padding: 4,
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setActionsOpen(false); toggleCompareMode(); }}
                    aria-pressed={compareMode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      minHeight: 36,
                      background: compareMode ? '#2a3d4d' : 'transparent',
                      border: 'none',
                      color: compareMode ? '#cde' : '#ccc',
                      borderRadius: 3,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <GitCompare size={14} />
                    {isZh ? '对比' : 'Compare'}
                  </button>
                  {onBulkDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setActionsOpen(false); toggleSelectMode(); }}
                      aria-pressed={selectMode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        minHeight: 36,
                        background: selectMode ? '#3d2a2a' : 'transparent',
                        border: 'none',
                        color: selectMode ? '#edc' : '#ccc',
                        borderRadius: 3,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontSize: 13,
                        textAlign: 'left',
                        marginTop: 2,
                      }}
                    >
                      <CheckSquare size={14} />
                      {isZh ? '选择' : 'Select'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <span>{solves.length}</span>
        </span>
      </div>
      <div className="history-search">
        <div className="history-search-input-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isMobile
                ? (isZh ? '搜索…' : 'Search…')
                : (isZh ? '搜索注释或打乱…' : 'Search comment or scramble…')
            }
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
              fontSize: isMobile ? 13 : 11,
              padding: isMobile ? '10px 4px' : '2px 0',
              minHeight: isMobile ? 44 : undefined,
              marginLeft: isMobile ? -4 : 0,
            }}
          >
            {filtersExpanded ? <ChevronUp size={isMobile ? 16 : 12} /> : <ChevronDown size={isMobile ? 16 : 12} />}
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
            <div>
              <label style={labelStyle}>{isZh ? '标签' : 'Tags'}</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ALL_TAG_IDS.map(tid => {
                  const def = TAG_DEFS[tid];
                  const active = tagSet.has(tid);
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => toggleTag(tid)}
                      aria-pressed={active}
                      style={chipBtn(active)}
                    >
                      {isZh ? def.labelZh : def.labelEn}
                    </button>
                  );
                })}
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
      {selectMode && (
        <div
          style={{
            padding: '6px 14px',
            fontSize: 11,
            color: '#aaa',
            borderBottom: '1px solid #1f1f23',
            background: '#15151a',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span>
            {isZh
              ? `已选 ${bulkSelected.size} 条`
              : `${bulkSelected.size} selected`}
          </span>
          <button
            type="button"
            onClick={selectAllVisible}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              color: '#cde',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {isZh ? `全选可见 (${matchCount})` : `Select all visible (${matchCount})`}
          </button>
          <button
            type="button"
            onClick={selectNone}
            disabled={bulkSelected.size === 0}
            style={{
              background: 'transparent',
              border: '1px solid #444',
              color: bulkSelected.size === 0 ? '#555' : '#aaa',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: bulkSelected.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: 11,
            }}
          >
            {isZh ? '清空选择' : 'Select none'}
          </button>
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
          const isBulkSelected = selectMode && bulkSelected.has(s.id);

          const classNames = ['history-row'];
          if (isPB) classNames.push('is-pb', 'pb-single');
          if (inAo5) classNames.push('pb-ao5');
          if (inAo12) classNames.push('pb-ao12');

          const tooltips: string[] = [];
          if (isAo5End) tooltips.push(isZh ? 'PB ao5 此处达成' : 'PB ao5 ends here');
          if (isAo12End) tooltips.push(isZh ? 'PB ao12 此处达成' : 'PB ao12 ends here');
          const rowTitle = tooltips.length ? tooltips.join(' · ') : undefined;

          let rowStyle: React.CSSProperties = {};
          if (isSelected) {
            rowStyle = { background: 'rgba(77, 122, 153, 0.18)', boxShadow: 'inset 2px 0 0 #4d7a99' };
          } else if (isBulkSelected) {
            rowStyle = { background: 'rgba(153, 90, 77, 0.18)', boxShadow: 'inset 2px 0 0 #995a4d' };
          }

          const handleRowClick = () => {
            if (compareMode) {
              handleSelectInCompare(s);
            } else if (selectMode) {
              toggleBulkSelect(s.id);
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
              {selectMode && (
                <div
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: '1.5px solid ' + (isBulkSelected ? '#995a4d' : '#444'),
                    background: isBulkSelected ? '#995a4d' : 'transparent',
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
                {(() => {
                  const ts = tagsByid.get(s.id);
                  if (!ts || ts.length === 0) return null;
                  const cap = isMobile ? MOBILE_TAG_CAP : ts.length;
                  const shown = ts.slice(0, cap);
                  const overflow = ts.length - shown.length;
                  const fullList = ts
                    .map(tid => isZh ? TAG_DEFS[tid].labelZh : TAG_DEFS[tid].labelEn)
                    .join(' · ');
                  return (
                    <span
                      style={{ display: 'inline-flex', gap: 3, marginLeft: 6, flexWrap: 'wrap', verticalAlign: 'middle' }}
                      title={overflow > 0 ? fullList : undefined}
                    >
                      {shown.map(tid => {
                        const def = TAG_DEFS[tid];
                        return (
                          <span key={tid} style={tagChipStyle(def.tone)}>
                            {isZh ? def.labelZh : def.labelEn}
                          </span>
                        );
                      })}
                      {overflow > 0 && (
                        <span style={tagChipStyle('muted')} title={fullList}>
                          +{overflow}
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
              {!compareMode && !selectMode && (
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
      {selectMode && (
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
            onClick={exitSelectMode}
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
            onClick={handleBulkDelete}
            disabled={bulkSelected.size === 0}
            style={{
              background: bulkSelected.size > 0 ? '#3d2a2a' : '#1a1a1d',
              border: '1px solid ' + (bulkSelected.size > 0 ? '#995a4d' : '#333'),
              color: bulkSelected.size > 0 ? '#edc' : '#555',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: bulkSelected.size > 0 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Trash2 size={12} />
            {isZh
              ? `删除选中 ${bulkSelected.size}`
              : `Delete ${bulkSelected.size} selected`}
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
