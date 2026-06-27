'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, GitCompare, ChevronDown, ChevronUp, CheckSquare, Trash2, MoreVertical, Check, Clipboard, MessageSquare } from 'lucide-react';
import type { Solve, Penalty } from '../_lib/types';
import { effectiveMs } from '../_lib/types';
import { formatMs, averageOfN } from '../_lib/stats';
import CompareSolvesModal from './CompareSolvesModal';
import { computeAllTags, TAG_DEFS, ALL_TAG_IDS } from '../_lib/storage/auto_tag';
import type { TagId } from '../_lib/storage/auto_tag';
import { ClearButton } from '@/components/ClearButton';
import { RecordBadge } from '@/components/RecordBadge';
import { tr } from '@/i18n/tr';

interface Props {
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
  /** Open the full SolveModal at this solve (for the "Comment" action). */
  onQuickComment?: (solve: Solve, index: number) => void;
  /** cstimer-style per-row rolling-average columns (e.g. [5, 12] → ao5/ao12
   *  ending at each solve). Defaults to [5, 12]; pass [] to hide the columns. */
  aoWindows?: number[];
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

export default function HistoryPanel({
  solves, isZh, onRowClick, onBulkDelete,
  onQuickPenalty, onQuickDelete, onQuickComment,
  aoWindows = [5, 12],
}: Props) {
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

  // ── Quick-action menu (right-click desktop / long-press mobile) ────────
  // Reuses SoloView's penalty/delete/comment handlers — no duplicate logic.
  const quickEnabled = !!(onQuickPenalty || onQuickDelete || onQuickComment);
  const [quickMenu, setQuickMenu] = useState<{ solve: Solve; index: number; x: number; y: number } | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const closeQuickMenu = useCallback(() => setQuickMenu(null), []);

  // Dismiss on outside-tap / Esc / scroll.
  useEffect(() => {
    if (!quickMenu) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (quickMenuRef.current && quickMenuRef.current.contains(e.target as Node)) return;
      closeQuickMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeQuickMenu(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', closeQuickMenu, true);
    window.addEventListener('resize', closeQuickMenu);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', closeQuickMenu, true);
      window.removeEventListener('resize', closeQuickMenu);
    };
  }, [quickMenu, closeQuickMenu]);

  const openQuickMenuAt = useCallback((s: Solve, index: number, x: number, y: number) => {
    if (!quickEnabled) return;
    if (compareMode || selectMode) return;
    setQuickMenu({ solve: s, index, x, y });
  }, [quickEnabled, compareMode, selectMode]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, s: Solve, index: number) => {
    if (!quickEnabled || compareMode || selectMode) return;
    e.preventDefault();
    openQuickMenuAt(s, index, e.clientX, e.clientY);
  }, [quickEnabled, compareMode, selectMode, openQuickMenuAt]);

  const LONG_PRESS_MS = 450;
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleRowTouchStart = useCallback((e: React.TouchEvent, s: Solve, index: number) => {
    if (!quickEnabled || compareMode || selectMode) return;
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    longPressFiredRef.current = false;
    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      // Bottom action-sheet: coordinates ignored on mobile (CSS pins it).
      openQuickMenuAt(s, index, 0, 0);
    }, LONG_PRESS_MS);
  }, [quickEnabled, compareMode, selectMode, cancelLongPress, openQuickMenuAt]);

  const handleRowTouchMove = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    const t = e.touches[0];
    if (!start || !t) return;
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancelLongPress();
  }, [cancelLongPress]);

  const handleRowTouchEnd = useCallback(() => { cancelLongPress(); }, [cancelLongPress]);

  // Build the menu items for a given solve.
  const setQuickPenalty = (s: Solve, p: Penalty) => {
    onQuickPenalty?.(s.id, p);
    closeQuickMenu();
  };
  const doQuickDelete = (s: Solve) => {
    onQuickDelete?.(s.id);
    closeQuickMenu();
  };
  const doQuickComment = (s: Solve, index: number) => {
    onQuickComment?.(s, index);
    closeQuickMenu();
  };
  const doCopyScramble = async (s: Solve) => {
    try { await navigator.clipboard.writeText(s.scramble ?? ''); } catch { /* ignore */ }
    closeQuickMenu();
  };

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

  // Auto-tags computed once per history change.
  const tagsByid = useMemo(() => computeAllTags(solves), [solves]);

  // Map each solve's id back to its index in the original (un-reversed) solves
  // array, so PB highlight indices stay correct after filtering.
  const idToRealIdx = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < solves.length; i++) m.set(solves[i].id, i);
    return m;
  }, [solves]);

  // cstimer-style rolling aoN columns: for each window n, aoCols[n][i] is the
  // trimmed aoN ending at the (original-order) solve index i. O(N·n) per window.
  // aoPb[n][i] flags the rows where that aoN set a new running best (PB) — used
  // to drop a "PB" badge straight into the matching ao column.
  const visibleAoWindows = aoWindows.filter(n => n >= 2);
  const aoColKey = visibleAoWindows.join(',');
  const { aoCols, aoPb } = useMemo(() => {
    const cols: Record<number, (number | null)[]> = {};
    const pb: Record<number, boolean[]> = {};
    for (const n of visibleAoWindows) {
      const arr: (number | null)[] = new Array(solves.length).fill(null);
      const pbArr: boolean[] = new Array(solves.length).fill(false);
      let best = Infinity;
      for (let i = n - 1; i < solves.length; i++) {
        const v = averageOfN(solves.slice(i - n + 1, i + 1), n);
        arr[i] = v;
        if (v != null && Number.isFinite(v) && v < best) { best = v; pbArr[i] = true; }
      }
      cols[n] = arr;
      pb[n] = pbArr;
    }
    return { aoCols: cols, aoPb: pb };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solves, aoColKey]);

  // Each history row is its own grid, so `auto` ao columns would size to that
  // row's own content and never line up across rows. Pin a FIXED ao width =
  // widest rendered value/label + room for the PB badge, so every row's grid
  // resolves identically (and adapts per event: 3x3 is narrow, big cubes wider).
  const aoMaxLen = useMemo(() => {
    let max = 4; // "0.00"
    for (const n of visibleAoWindows) {
      max = Math.max(max, `ao${n}`.length);
      for (const v of (aoCols[n] ?? [])) max = Math.max(max, (v == null ? '-' : formatMs(v)).length);
    }
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoCols, aoColKey]);
  const aoColW = `calc(${aoMaxLen}ch + 28px)`;
  const aoTmpl = visibleAoWindows.length ? ' ' + visibleAoWindows.map(() => aoColW).join(' ') : '';
  const headTmpl = `32px minmax(0,1fr)${aoTmpl}`;

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
      setCompareError(tr({ zh: '请选择两个不同的成绩', en: 'Pick two different solves'
    }));
      return;
    }
    const a = solves.find(x => x.id === selectedIds[0]);
    const b = solves.find(x => x.id === selectedIds[1]);
    if (!a || !b) {
      setCompareError(tr({ zh: '成绩未找到', en: 'Solve not found'
    }));
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
        <span>{tr({ zh: '历史', en: 'History'
        })}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && (
            <button
              type="button"
              onClick={toggleCompareMode}
              title={tr({ zh: '对比两次成绩', en: 'Compare two solves'
            })}
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
          <span>{solves.length}</span>
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
          <span className="history-search-count">
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={labelStyle}>{tr({ zh: '日期 起', en: 'Date from' })}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{tr({ zh: '日期 止', en: 'Date to' })}</label>
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
            <div>
              <label style={labelStyle}>{tr({ zh: '标签', en: 'Tags'
            })}</label>
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
                      {(isZh ? def.labelZh : def.labelEn)}
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
          {(isZh
                              ? `选择 2 个成绩进行对比 (已选 ${selectedIds.length}/2)`
                              : `Pick 2 solves to compare (${selectedIds.length}/2 selected)`)}
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
        {filteredReversed.length > 0 && !compareMode && !selectMode && (
          <div className="history-cols-head" style={{ gridTemplateColumns: headTmpl }}>
            <span className="idx">#</span>
            <span>{tr({ zh: '时间', en: 'Time'
            })}</span>
            {visibleAoWindows.map(n => <span key={n} className="hao-head">ao{n}</span>)}
          </div>
        )}
        {filteredReversed.map((s) => {
          const realIdx = idToRealIdx.get(s.id) ?? -1;
          const time = effectiveMs(s);
          const isSelected = compareMode && selectedIds.includes(s.id);
          const isBulkSelected = selectMode && bulkSelected.has(s.id);

          const classNames = ['history-row'];

          let rowStyle: React.CSSProperties = {};
          if (isSelected) {
            rowStyle = { background: 'rgba(77, 122, 153, 0.18)', boxShadow: 'inset 2px 0 0 #4d7a99' };
          } else if (isBulkSelected) {
            rowStyle = { background: 'rgba(153, 90, 77, 0.18)', boxShadow: 'inset 2px 0 0 #995a4d' };
          }
          const lead = (compareMode || selectMode) ? '14px ' : '';
          rowStyle = { ...rowStyle, gridTemplateColumns: `${lead}32px minmax(0,1fr)${aoTmpl}` };

          const handleRowClick = () => {
            // A long-press just opened the quick-action sheet — swallow the
            // synthetic click that follows touchend so we don't also open the
            // full modal.
            if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
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
              style={rowStyle}
              onClick={handleRowClick}
              onContextMenu={(e) => handleRowContextMenu(e, s, realIdx)}
              onTouchStart={(e) => handleRowTouchStart(e, s, realIdx)}
              onTouchMove={handleRowTouchMove}
              onTouchEnd={handleRowTouchEnd}
              onTouchCancel={handleRowTouchEnd}
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
                {formatMs(time)}
                {s.penalty === '+2' && <span className="penalty-flag">(+2)</span>}
                {/* DNF already shown by the time column (formatMs → "DNF") — no
                    extra flag/tag (penalty also drops the 'dnf'/'plus2' chips below). */}
                {s.comment && <span className="comment-flag" title={s.comment}>·</span>}
                {(() => {
                  // pb-ao5 / pb-ao12 render as "PB" badges inside the ao5 / ao12
                  // columns instead — keep only single-PB + the descriptive tags here.
                  // 'dnf'/'plus2' are conveyed by the time column + (+2) flag — drop
                  // the redundant chips. pb-ao5/pb-ao12 render in their ao columns.
                  const ts = (tagsByid.get(s.id) ?? []).filter(t => t !== 'pb-ao5' && t !== 'pb-ao12' && t !== 'dnf' && t !== 'plus2');
                  if (ts.length === 0) return null;
                  const cap = isMobile ? MOBILE_TAG_CAP : ts.length;
                  const shown = ts.slice(0, cap);
                  const overflow = ts.length - shown.length;
                  const fullList = ts
                    .map(tid => (isZh ? TAG_DEFS[tid].labelZh : TAG_DEFS[tid].labelEn))
                    .join(' · ');
                  return (
                    <span
                      style={{ display: 'inline-flex', gap: 3, marginLeft: 6, flexWrap: 'wrap', verticalAlign: 'middle' }}
                      title={overflow > 0 ? fullList : undefined}
                    >
                      {shown.map(tid => {
                        const def = TAG_DEFS[tid];
                        // Single PB uses the shared RecordBadge (PR style) so it reads
                        // the same as record badges elsewhere on the site.
                        if (tid === 'pb-single') {
                          return <RecordBadge key={tid} record={def.labelEn} variant="standalone" />;
                        }
                        return (
                          <span key={tid} style={tagChipStyle(def.tone)}>
                            {(isZh ? def.labelZh : def.labelEn)}
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
              {visibleAoWindows.map(n => (
                <div className="hao" key={n}>
                  <span className="record-num-cell">
                    {formatMs(aoCols[n]?.[realIdx] ?? null)}
                    {aoPb[n]?.[realIdx] && <RecordBadge record="PB" variant="inline" />}
                  </span>
                </div>
              ))}
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
            {tr({ zh: '取消', en: 'Cancel' })}
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
            {tr({ zh: '对比这 2 个', en: 'Compare these 2'
            })}
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
      {comparePair && (
        <CompareSolvesModal
          solveA={comparePair[0]}
          solveB={comparePair[1]}
          isZh={isZh}
          onClose={closeCompareModal}
        />
      )}
      {quickMenu && (() => {
        const s = quickMenu.solve;
        const items = (
          <>
            <button
              type="button"
              role="menuitem"
              className={`row-quick-item${s.penalty === 'ok' ? ' active' : ''}`}
              onClick={() => setQuickPenalty(s, 'ok')}
            >
              <Check size={14} />
              <span>{tr({ zh: '无罚时', en: 'OK'
            })}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={`row-quick-item${s.penalty === '+2' ? ' active' : ''}`}
              onClick={() => setQuickPenalty(s, '+2')}
            >
              <span className="row-quick-glyph">+2</span>
              <span>+2</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={`row-quick-item${s.penalty === 'DNF' ? ' active' : ''}`}
              onClick={() => setQuickPenalty(s, 'DNF')}
            >
              <span className="row-quick-glyph">DNF</span>
              <span>DNF</span>
            </button>
            <div className="row-quick-sep" role="separator" />
            <button type="button" role="menuitem" className="row-quick-item" onClick={() => doQuickComment(s, quickMenu.index)}>
              <MessageSquare size={14} />
              <span>{tr({ zh: '评论', en: 'Comment'
            })}</span>
            </button>
            <button type="button" role="menuitem" className="row-quick-item" onClick={() => doCopyScramble(s)}>
              <Clipboard size={14} />
              <span>{tr({ zh: '复制打乱', en: 'Copy scramble'
            })}</span>
            </button>
            <div className="row-quick-sep" role="separator" />
            <button type="button" role="menuitem" className="row-quick-item danger" onClick={() => doQuickDelete(s)}>
              <Trash2 size={14} />
              <span>{tr({ zh: '删除', en: 'Delete'
            })}</span>
            </button>
          </>
        );
        if (isMobile) {
          return (
            <div className="row-quick-sheet-backdrop" data-no-timer onClick={closeQuickMenu}>
              <div className="row-quick-sheet" ref={quickMenuRef} role="menu" onClick={(e) => e.stopPropagation()}>
                <div className="row-quick-sheet-head">
                  #{quickMenu.index + 1} · {formatMs(effectiveMs(s))}
                </div>
                {items}
              </div>
            </div>
          );
        }
        // Desktop: anchored popup. Clamp to viewport.
        const MENU_W = 184, MENU_H = 300;
        const left = Math.min(quickMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1280) - MENU_W - 8);
        const top = Math.min(quickMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - MENU_H - 8);
        return (
          <div
            className="row-quick-menu"
            data-no-timer
            ref={quickMenuRef}
            role="menu"
            style={{ left: Math.max(8, left), top: Math.max(8, top) }}
            onClick={(e) => e.stopPropagation()}
          >
            {items}
          </div>
        );
      })()}
    </div>
  );
}
