'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronDown, ChevronUp, CheckSquare, Trash2, MoreVertical } from 'lucide-react';
import { eventInfo, type Solve, type Penalty } from '../_lib/types';
import { formatMs, formatEventMs } from '../_lib/stats';
import {
  TIMER_HISTORY_PENALTIES,
  TIMER_HISTORY_QUICK_ACTION_COPY,
  TIMER_HISTORY_QUICK_ACTION_IDS,
  computeTimerHistoryTags,
  filterTimerHistorySolves,
  pruneTimerHistoryCompareSelection,
  resolveTimerHistoryComparePair,
  timerHistoryCopyText,
  toggleTimerHistoryCompareSelection,
  toggleTimerHistoryTag,
  toggleTimerHistoryPenalty,
  type TimerHistoryTagId,
  type TimerHistoryQuickActionId,
} from '../_lib/history';
import {
  DEFAULT_ROLLING_STAT_COLUMNS,
  parseRollingStatKey,
  rollingStatCurrent,
  sanitizeRollingStatColumns,
  type RollingStatKey,
} from '../_lib/rolling_stats';
import RollingStatsPicker from './RollingStatsPicker';
import { dayKeyOf } from '../_lib/stats_buckets';
import { ClearButton } from '@/components/ClearButton';
import { DateRangeInput } from '@/components/DateRangeInput';
import { RecordBadge } from '@/components/RecordBadge';
import { tr } from '@/i18n/tr';
import {
  TimerHistoryCompareActions,
  TimerHistoryCompareModal,
  TimerHistoryCompareStatus,
  TimerHistoryRow,
  TimerHistoryTagBadges,
  TimerHistoryTagFilter,
  type TimerHistoryCompareLabels,
  type TimerHistoryQuickMenuLabels,
  type TimerHistoryRowQuickMenu,
} from '@cuberoot/timer-ui';

interface Props {
  historyContextKey: string;
  solves: Solve[];
  isZh: boolean;
  onRowClick: (solve: Solve, index: number) => void;
  /** Optional bulk-delete callback. When provided, a "select mode" toggle is
   *  shown that lets the user pick multiple solves and delete them in one go.
   *  Parent (TimerPage) is responsible for the actual db.deleteSolves call. */
  onBulkDelete?: (ids: string[]) => void;
  /** Quick per-row actions (right-click on desktop / long-press on mobile).
   *  Wired to SoloView's existing penalty/delete handlers — no duplication.
   *  When omitted the quick-action menu is disabled (normal row tap only). */
  onQuickPenalty?: (id: string, penalty: Penalty) => void;
  onQuickDelete?: (id: string) => void;
  /** Open the full SolveModal at this solve (for the "Comment" action).
   *  Tapping the row does the same thing — the solve page now opens with the
   *  reconstruction already on it, so there is no separate «复盘» action. */
  onQuickComment?: (solve: Solve, index: number) => void;
  /** Per-row rolling-stat columns ending at each solve. */
  rollingStatColumns?: RollingStatKey[];
}

const MOBILE_QUERY = '(max-width: 480px)';

export default function HistoryPanel({
  historyContextKey, solves, isZh, onRowClick, onBulkDelete,
  onQuickPenalty, onQuickDelete, onQuickComment,
  rollingStatColumns = DEFAULT_ROLLING_STAT_COLUMNS,
}: Props) {
  const [query, setQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSelectionContext, setCompareSelectionContext] = useState(historyContextKey);
  const compareContextMatches = compareSelectionContext === historyContextKey;
  const visibleCompareMode = compareMode && compareContextMatches;
  const visibleSelectedIds = compareContextMatches ? selectedIds : [];
  const compareContextRef = useRef(historyContextKey);
  useEffect(() => {
    if (compareContextRef.current === historyContextKey) return;
    compareContextRef.current = historyContextKey;
    setCompareMode(false);
    setSelectedIds([]);
    setCompareOpen(false);
    setCompareSelectionContext(historyContextKey);
  }, [historyContextKey]);
  useEffect(() => {
    setSelectedIds((current) => {
      const next = pruneTimerHistoryCompareSelection(solves, current);
      return next.length === current.length ? current : next;
    });
  }, [solves]);

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

  const quickMenuLabels = useMemo<TimerHistoryQuickMenuLabels>(() => ({
    actions: Object.fromEntries(TIMER_HISTORY_QUICK_ACTION_IDS.map(actionId => (
      [actionId, tr(TIMER_HISTORY_QUICK_ACTION_COPY[actionId])]
    ))) as Record<TimerHistoryQuickActionId, string>,
    actionTitles: {
      'history.quick.penalty-dns': tr({ zh: '未开始（DNS）', en: 'Did Not Start' }),
    },
    menu: tr({ zh: '更多操作', en: 'More actions' }),
  }), [isZh]);
  const compareLabels = useMemo<TimerHistoryCompareLabels>(() => ({
    bBetter: tr({ zh: 'B 更好', en: 'B better' }),
    bWorse: tr({ zh: 'B 更差', en: 'B worse' }),
    cancel: tr({ zh: '取消', en: 'Cancel' }),
    close: tr({ zh: '关闭', en: 'Close' }),
    compareSelected: tr({ zh: '对比这 2 个', en: 'Compare these 2' }),
    delta: tr({ zh: '差异', en: 'Delta' }),
    deltaDirection: tr({ zh: '差异 (B − A)', en: 'Delta (B − A)' }),
    eventName: (solve) => {
      const info = eventInfo(solve.event);
      return tr({ zh: info.nameZh, en: info.nameEn });
    },
    greenMeansBetter: tr({ zh: '绿色 = B 更好', en: 'Green = B better' }),
    htm: tr({ zh: '步数', en: 'HTM' }),
    locale: tr({ zh: 'zh-CN', en: 'en' }),
    moves: tr({ zh: '步', en: 'moves' }),
    noStageA: tr({ zh: 'A 没有阶段数据 — 可在设置中重新分析', en: 'A has no stage data — try Reanalyze in settings' }),
    noStageB: tr({ zh: 'B 没有阶段数据 — 可在设置中重新分析', en: 'B has no stage data — try Reanalyze in settings' }),
    noStageBoth: tr({ zh: '两次成绩都没有阶段数据 — 可在设置中重新分析', en: 'Neither solve has stage data — try Reanalyze in settings' }),
    selected: (count) => tr({
      zh: `选择 2 个成绩进行对比 (已选 ${count}/2)`,
      en: `Pick 2 solves to compare (${count}/2 selected)`,
    }),
    stage: {
      cross: tr({ zh: '十字', en: 'Cross' }),
      f2l: 'F2L',
      oll: 'OLL',
      pll: 'PLL',
    },
    tie: tr({ zh: '持平', en: 'tie' }),
    title: tr({ zh: '对比成绩', en: 'Compare solves' }),
    total: tr({ zh: '合计', en: 'Total' }),
    tps: 'TPS',
  }), [isZh]);

  // All persistence/clipboard/detail effects remain host injected. The shared
  // row owns only DOM, action ordering, focus, dismiss, and long-press behavior.
  const rowQuickMenu = useMemo<TimerHistoryRowQuickMenu | undefined>(() => {
    if (!onQuickPenalty && !onQuickDelete && !onQuickComment) return undefined;
    return {
      labels: quickMenuLabels,
      onChangePenalty: onQuickPenalty
        ? (solve, penalty) => onQuickPenalty(solve.id, penalty)
        : undefined,
      onComment: onQuickComment,
      onCopyScramble: async solve => {
        try { await navigator.clipboard.writeText(timerHistoryCopyText(solve)); } catch { /* ignore */ }
      },
      onDelete: onQuickDelete ? solve => onQuickDelete(solve.id) : undefined,
      variant: isMobile ? 'sheet' : 'popup',
    };
  }, [isMobile, onQuickComment, onQuickDelete, onQuickPenalty, quickMenuLabels]);

  // Structured filters
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeMax, setTimeMax] = useState('');
  const [penaltySet, setPenaltySet] = useState<Set<Penalty>>(new Set(TIMER_HISTORY_PENALTIES));
  const [ollFilter, setOllFilter] = useState('');
  const [pllFilter, setPllFilter] = useState('');
  // Tag filter: only solves with at least one of these tags are kept.
  // Empty set => no tag filter applied.
  const [tagSet, setTagSet] = useState<Set<TimerHistoryTagId>>(new Set());

  const reversed = [...solves].reverse(); // newest at top

  // Auto-tags computed once per history change.
  const tagsById = useMemo(() => computeTimerHistoryTags(solves), [solves]);
  const tagLanguage = tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh';

  // Map each solve's id back to its index in the original (un-reversed) solves
  // array, so PB highlight indices stay correct after filtering.
  const idToRealIdx = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < solves.length; i++) m.set(solves[i].id, i);
    return m;
  }, [solves]);

  // cstimer-style rolling columns: each value ends at the original-order solve
  // index. statPb flags the rows where that statistic set a new running best.
  // The panel only ever shows one event's history, so per-event decisions can
  // be made from the first solve.
  const panelEvent = solves.length > 0 ? solves[0].event : null;
  // MBLD ranks on points, not time — a rolling mean of its attempt durations is
  // a garbage number, so the columns are dropped rather than filled with one.
  const visibleStatColumns = panelEvent === '333mbld'
    ? []
    : sanitizeRollingStatColumns(rollingStatColumns);
  const statColumnKey = visibleStatColumns.join(',');
  const { statCols, statPb } = useMemo(() => {
    const cols: Partial<Record<RollingStatKey, (number | null)[]>> = {};
    const pb: Partial<Record<RollingStatKey, boolean[]>> = {};
    for (const key of visibleStatColumns) {
      const definition = parseRollingStatKey(key);
      if (!definition) continue;
      const arr: (number | null)[] = new Array(solves.length).fill(null);
      const pbArr: boolean[] = new Array(solves.length).fill(false);
      let best = Infinity;
      for (let i = definition.size - 1; i < solves.length; i++) {
        const v = rollingStatCurrent(solves.slice(i - definition.size + 1, i + 1), key);
        arr[i] = v;
        if (v != null && Number.isFinite(v) && v < best) { best = v; pbArr[i] = true; }
      }
      cols[key] = arr;
      pb[key] = pbArr;
    }
    return { statCols: cols, statPb: pb };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solves, statColumnKey]);

  // Each history row is its own grid, so `auto` ao columns would size to that
  // row's own content and never line up across rows. Pin a FIXED ao width =
  // widest rendered value/label + room for the PB badge, so every row's grid
  // resolves identically (and adapts per event: 3x3 is narrow, big cubes wider).
  // The rolling-average columns are formatted per-event — FMC renders move
  // counts, not times.
  const fmtRollingStat = useCallback(
    (v: number | null) => (panelEvent === null ? formatMs(v) : formatEventMs(panelEvent, v)),
    [panelEvent],
  );
  const statMaxLen = useMemo(() => {
    let max = 4; // "0.00"
    for (const key of visibleStatColumns) {
      max = Math.max(max, key.length);
      for (const value of (statCols[key] ?? [])) {
        max = Math.max(max, (value == null ? '-' : fmtRollingStat(value)).length);
      }
    }
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statCols, statColumnKey, fmtRollingStat]);
  const statColumnWidth = `calc(${statMaxLen}ch + 36px)`;
  const statTemplate = visibleStatColumns.length
    ? ' ' + visibleStatColumns.map(() => statColumnWidth).join(' ')
    : '';
  const timeColumnWidth = '12ch';
  const headTmpl = `32px ${timeColumnWidth}${statTemplate} minmax(0,1fr)`;
  const visiblePbTagIds = new Set<TimerHistoryTagId>();
  if (visibleStatColumns.includes('ao5')) visiblePbTagIds.add('pb-ao5');
  if (visibleStatColumns.includes('ao12')) visiblePbTagIds.add('pb-ao12');

  const historyFilterResult = useMemo(() => filterTimerHistorySolves(solves, {
    query,
    dateFrom,
    dateTo,
    timeMin,
    timeMax,
    penalties: penaltySet,
    ollCase: ollFilter,
    pllCase: pllFilter,
    tags: tagSet,
  }, tagsById), [
    solves, query, dateFrom, dateTo, timeMin, timeMax,
    penaltySet, ollFilter, pllFilter, tagSet, tagsById,
  ]);
  const filteredReversed = historyFilterResult.solves;
  const activeFilterCount = historyFilterResult.activeStructuredFilterCount;
  const matchCount = filteredReversed.length;
  const hasAnyFilter = historyFilterResult.hasAnyFilter;

  /** 每个日期分隔行右边那个数。数的是**筛选后**留下的把数 —— 分隔行下面摆着几行,
   *  它就该写几,否则筛完之后两者对不上。 */
  const dayCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const s of filteredReversed) {
      const k = dayKeyOf(s.ts);
      out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  }, [filteredReversed]);

  const clearAllFilters = () => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setTimeMin('');
    setTimeMax('');
    setPenaltySet(new Set(TIMER_HISTORY_PENALTIES));
    setOllFilter('');
    setPllFilter('');
    setTagSet(new Set());
  };

  const toggleTag = (tagId: TimerHistoryTagId) => {
    setTagSet(current => toggleTimerHistoryTag(current, tagId));
  };

  const togglePenalty = (p: Penalty) => {
    setPenaltySet(prev => toggleTimerHistoryPenalty(prev, p));
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setSelectedIds([]);
    setCompareOpen(false);
    setCompareSelectionContext(historyContextKey);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setBulkSelected(new Set());
  };

  const toggleCompareMode = () => {
    if (visibleCompareMode) {
      exitCompareMode();
    } else {
      // Compare and select are mutually exclusive.
      if (selectMode) exitSelectMode();
      setCompareMode(true);
      setSelectedIds([]);
      setCompareSelectionContext(historyContextKey);
    }
  };

  const toggleSelectMode = () => {
    if (selectMode) {
      exitSelectMode();
    } else {
      if (visibleCompareMode) exitCompareMode();
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
    const msg = (isZh
          ? `确认删除选中的 ${ids.length} 条成绩？此操作无法撤销。`
          : `Delete ${ids.length} selected solve${ids.length === 1 ? '' : 's'}? This cannot be undone.`);
    // eslint-disable-next-line no-alert
    if (!window.confirm(msg)) return;
    onBulkDelete(ids);
    exitSelectMode();
  };

  /** Compare-mode row click: select / deselect / swap-older. */
  const handleSelectInCompare = (s: Solve) => {
    setCompareSelectionContext(historyContextKey);
    setSelectedIds((current) => toggleTimerHistoryCompareSelection(current, s.id));
  };

  const comparePair = resolveTimerHistoryComparePair(solves, visibleSelectedIds);
  const compareReady = comparePair !== null;
  useEffect(() => {
    if (!compareReady) setCompareOpen(false);
  }, [compareReady]);
  const openCompareModal = () => { if (comparePair) setCompareOpen(true); };

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
        <span>{tr({ zh: '历史', en: 'History'
        })}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && (
            <button
              type="button"
              onClick={toggleCompareMode}
              title={tr({ zh: '对比两次成绩', en: 'Compare two solves'
            })}
              aria-pressed={visibleCompareMode}
              style={{
                background: visibleCompareMode ? '#2a3d4d' : 'transparent',
                border: '1px solid #333',
                color: visibleCompareMode ? '#cde' : '#888',
                borderColor: visibleCompareMode ? '#4d7a99' : '#333',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
            >
              {tr({ zh: '对比', en: 'Compare'
            })}
            </button>
          )}
          {!isMobile && onBulkDelete && (
            <button
              type="button"
              onClick={toggleSelectMode}
              title={tr({ zh: '多选删除', en: 'Select multiple to delete'
            })}
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
              {tr({ zh: '选择', en: 'Select'
            })}
            </button>
          )}
          {isMobile && (
            <div ref={actionsRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setActionsOpen(v => !v)}
                title={tr({ zh: '更多操作', en: 'More actions' })}
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                aria-label={tr({ zh: '更多操作', en: 'More actions' })}
                style={{
                  background: (visibleCompareMode || selectMode) ? '#2a3d4d' : 'transparent',
                  border: '1px solid ' + ((visibleCompareMode || selectMode) ? '#4d7a99' : '#333'),
                  color: (visibleCompareMode || selectMode) ? '#cde' : '#aaa',
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
                    aria-pressed={visibleCompareMode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      minHeight: 36,
                      background: visibleCompareMode ? '#2a3d4d' : 'transparent',
                      border: 'none',
                      color: visibleCompareMode ? '#cde' : '#ccc',
                      borderRadius: 3,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    {tr({ zh: '对比', en: 'Compare'
                    })}
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
                      {tr({ zh: '选择', en: 'Select'
                    })}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </span>
      </div>
      <div className="history-search">
        <div className="history-search-input-wrap">
          <input
            className="history-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isMobile
                ? tr({ zh: '搜索…', en: 'Search…'
                                    })
                : tr({ zh: '搜索注释或打乱…', en: 'Search comment or scramble…'
                                    })
            }
            aria-label={tr({ zh: '搜索注释或打乱', en: 'Search comment or scramble'
            })}
          />
          {query && (
            <ClearButton
              onClick={() => setQuery('')}
              isZh={isZh}
              ariaLabel={tr({ zh: '清空搜索', en: 'Clear search'
            })}
            />
          )}
        </div>
        {hasAnyFilter && (
          <span aria-live="polite" className="history-search-count" role="status">
            {(isZh ? `${matchCount} 条匹配` : `${matchCount} matches`)}
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
            {tr({ zh: '筛选', en: 'Filters'
            })}
          </button>
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 11, color: '#cde' }}>
              {(isZh
                                          ? `${activeFilterCount} 个筛选生效`
                                          : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`)}
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
              title={tr({ zh: '清空所有筛选', en: 'Clear all filters'
            })}
            >
              <X size={10} />
              {tr({ zh: '清空', en: 'Clear filters' })}
            </button>
          )}
        </div>
        {filtersExpanded && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DateRangeInput
              from={dateFrom}
              to={dateTo}
              onChange={(nextFrom, nextTo) => {
                setDateFrom(nextFrom);
                setDateTo(nextTo);
              }}
              fromLabel={tr({ zh: '日期 起', en: 'Date from' })}
              toLabel={tr({ zh: '日期 止', en: 'Date to' })}
              size="compact"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={labelStyle}>{tr({ zh: '最短 (秒)', en: 'Min (s)' })}</label>
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
                <label style={labelStyle}>{tr({ zh: '最长 (秒)', en: 'Max (s)'
                })}</label>
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
              <label style={labelStyle}>{tr({ zh: '罚时', en: 'Penalty'
            })}</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {TIMER_HISTORY_PENALTIES.map(p => {
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
                <label style={labelStyle}>{tr({ zh: 'OLL 公式', en: 'OLL case' })}</label>
                <input
                  type="text"
                  value={ollFilter}
                  onChange={(e) => setOllFilter(e.target.value)}
                  placeholder={tr({ zh: '例如 OLL 21', en: 'e.g. OLL 21' })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{tr({ zh: 'PLL 公式', en: 'PLL case' })}</label>
                <input
                  type="text"
                  value={pllFilter}
                  onChange={(e) => setPllFilter(e.target.value)}
                  placeholder={tr({ zh: '例如 Aa', en: 'e.g. Aa' })}
                  style={inputStyle}
                />
              </div>
            </div>
            <TimerHistoryTagFilter
              language={tagLanguage}
              legend={tr({ zh: '标签', en: 'Tags' })}
              onToggle={toggleTag}
              selected={tagSet}
            />
          </div>
        )}
      </div>
      {visibleCompareMode && (
        <TimerHistoryCompareStatus count={visibleSelectedIds.length} labels={compareLabels} />
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
            {(isZh
                                    ? `已选 ${bulkSelected.size} 条`
                                    : `${bulkSelected.size} selected`)}
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
            {(isZh ? `全选可见 (${matchCount})` : `Select all visible (${matchCount})`)}
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
            {tr({ zh: '清空选择', en: 'Select none'
            })}
          </button>
        </div>
      )}
      <div className="history-list">
        {reversed.length === 0 && (
          <div className="history-empty">
            {tr({ zh: '还没有成绩。按住空格开始计时。', en: 'No solves yet. Hold space to start.'
            })}
          </div>
        )}
        {reversed.length > 0 && filteredReversed.length === 0 && (
          <div className="history-empty">
            <div>{tr({ zh: '没有匹配的成绩。', en: 'No solves match these filters'
            })}</div>
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
                {tr({ zh: '清空筛选', en: 'Clear filters'
                })}
              </button>
            )}
          </div>
        )}
        {filteredReversed.length > 0 && !visibleCompareMode && !selectMode && (
          <div className="history-cols-head" style={{ gridTemplateColumns: headTmpl }}>
            <span className="idx">#</span>
            {/* MBLD's column holds "11/13 58:02", not a time. */}
            <span>{panelEvent === '333mbld'
              ? tr({ zh: '成绩', en: 'Result' })
              : tr({ zh: '时间', en: 'Time' })}</span>
            {visibleStatColumns.length > 0 && (
              <RollingStatsPicker triggerColumns={visibleStatColumns} />
            )}
          </div>
        )}
        {filteredReversed.map((s, listIdx) => {
          const realIdx = idToRealIdx.get(s.id) ?? -1;
          // 日期分隔行。列表是新到旧,所以每天的第一行上面插一条 —— 而不是给每行加
          // 一列日期:同一天的几十把会把同一个日期重复几十遍,窄屏还得为它让出一列。
          const dayKey = dayKeyOf(s.ts);
          const newDay = listIdx === 0 || dayKeyOf(filteredReversed[listIdx - 1].ts) !== dayKey;
          const isSelected = visibleCompareMode && visibleSelectedIds.includes(s.id);
          const isBulkSelected = selectMode && bulkSelected.has(s.id);

          const lead = (visibleCompareMode || selectMode) ? '14px ' : '';
          const rowStyle: React.CSSProperties = {
            gridTemplateColumns: `${lead}32px ${timeColumnWidth}${statTemplate} minmax(0,1fr)`,
          };

          const handleRowClick = () => {
            if (visibleCompareMode) {
              handleSelectInCompare(s);
            } else if (selectMode) {
              toggleBulkSelect(s.id);
            } else {
              onRowClick(s, realIdx);
            }
          };

          // Auto-tagged PBs move into their matching visible columns. If the
          // user replaces that column, keep the tag beside the shared result.
          const rowTags = (
            <TimerHistoryTagBadges
              hiddenTagIds={visiblePbTagIds}
              language={tagLanguage}
              tagIds={tagsById.get(s.id) ?? []}
            />
          );

          return (
            <Fragment key={s.id}>
            {newDay && (
              <div className="history-day">
                <span className="history-day-key">{dayKey}</span>
                <span className="history-day-n">
                  {tr({ zh: `${dayCounts.get(dayKey) ?? 0} 次`, en: `${dayCounts.get(dayKey) ?? 0}` })}
                </span>
              </div>
            )}
            <TimerHistoryRow
              index={realIdx}
              onActivate={handleRowClick}
              quickMenu={rowQuickMenu}
              resultExtras={rowTags}
              selected={isSelected || isBulkSelected}
              selectionMode={visibleCompareMode ? 'compare' : selectMode ? 'select' : 'none'}
              solve={s}
              style={rowStyle}
              trailing={visibleStatColumns.map(key => (
                <div className="hao" key={key}>
                  <span className="record-num-cell">
                    {fmtRollingStat(statCols[key]?.[realIdx] ?? null)}
                    {statPb[key]?.[realIdx] && <RecordBadge record="PB" variant="inline" />}
                  </span>
                </div>
              ))}
            />
            </Fragment>
          );
        })}
      </div>
      {visibleCompareMode && (
        <TimerHistoryCompareActions
          canCompare={compareReady}
          labels={compareLabels}
          onCancel={exitCompareMode}
          onCompare={openCompareModal}
        />
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
            {tr({ zh: '取消', en: 'Cancel' })}
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
            {(isZh
                                    ? `删除选中 ${bulkSelected.size}`
                                    : `Delete ${bulkSelected.size} selected`)}
          </button>
        </div>
      )}
      {compareOpen && comparePair && (
        <TimerHistoryCompareModal
          labels={compareLabels}
          onClose={() => setCompareOpen(false)}
          solveA={comparePair[0]}
          solveB={comparePair[1]}
        />
      )}
    </div>
  );
}
