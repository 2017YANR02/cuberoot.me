/**
 * DrillModal — pick a single OLL or PLL case to drill repeatedly.
 *
 * Reuses the trainer-subset-modal CSS so the chips/grid/group layout matches
 * the existing TrainerSubsetModal. Selecting a case fires `onPick(type, id)`
 * and closes; the parent then locks the timer's scramble generator to that
 * case until drill mode is exited.
 *
 * Mobile (≤480px): chips become larger touch targets in a 3-column grid; a
 * search input lets the user filter cases by id / name (e.g. "21" or "T").
 */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { OLL_CASES } from '../scramble/algs/oll_cases';
import { PLL_CASES } from '../scramble/algs/pll_cases';
import type { DrillType } from '../scramble/drill';

interface Props {
  isZh: boolean;
  initialType?: DrillType;
  activeCase?: { type: DrillType; id: string } | null;
  onPick: (type: DrillType, caseId: string) => void;
  onExit: () => void;
  onClose: () => void;
}

/** True iff viewport ≤ 480px (phone-sized). Drives larger tap targets + 3-col grid. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 480px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export default function DrillModal({
  isZh,
  initialType,
  activeCase,
  onPick,
  onExit,
  onClose,
}: Props) {
  const [type, setType] = useState<DrillType>(initialType ?? activeCase?.type ?? 'oll');
  const [searchQuery, setSearchQuery] = useState('');
  const titleId = useId();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  // Reset query when toggling between OLL / PLL — names differ enough that a
  // stale filter would be confusing.
  useEffect(() => {
    setSearchQuery('');
  }, [type]);

  // OLL: group by `group`; PLL: flat. Filter by case-insensitive substring on
  // both id and name.
  const groups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = (c: { id: string; name: string }) =>
      !q || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);

    if (type === 'pll') {
      const cases = (PLL_CASES as readonly { id: string; name: string }[]).filter(matches);
      return [{ name: '', cases }];
    }
    const map = new Map<string, { id: string; name: string; group: string }[]>();
    for (const c of OLL_CASES) {
      if (!matches(c)) continue;
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries()).map(([name, cases]) => ({ name, cases }));
  }, [type, searchQuery]);

  const total = type === 'oll' ? OLL_CASES.length : PLL_CASES.length;
  const matchedCount = groups.reduce((n, g) => n + g.cases.length, 0);
  const activeId = activeCase && activeCase.type === type ? activeCase.id : null;

  // Mobile-only style overrides. Desktop keeps the existing dense flex-wrap
  // layout; on phones we switch to a 3-col CSS grid with min 44×44 tap targets.
  const gridStyle: CSSProperties | undefined = isMobile
    ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }
    : undefined;
  const chipStyle: CSSProperties | undefined = isMobile
    ? {
        minHeight: 44,
        minWidth: 44,
        padding: '10px 8px',
        fontSize: 14,
        justifyContent: 'center',
      }
    : undefined;
  const bodyStyle: CSSProperties | undefined = isMobile
    ? { maxHeight: '55dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
    : undefined;
  const searchStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#1a1a1d',
    color: '#ededed',
    border: '1px solid #444',
    borderRadius: 6,
    padding: isMobile ? '10px 12px' : '6px 10px',
    fontSize: isMobile ? 16 : 13,
    marginBottom: 10,
  };

  const searchPlaceholder = isZh
    ? type === 'oll' ? '搜索 (例如 21)' : '搜索 (例如 T)'
    : type === 'oll' ? 'Search (e.g. 21)' : 'Search (e.g. T)';

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal trainer-subset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          {isZh ? '专项练习' : 'Drill mode'}
          <span className="trainer-subset-count"> ({total})</span>
        </h2>

        <div className="trainer-subset-toolbar">
          <button
            ref={firstButtonRef}
            type="button"
            className={type === 'oll' ? 'primary' : ''}
            onClick={() => setType('oll')}
          >
            OLL
          </button>
          <button
            type="button"
            className={type === 'pll' ? 'primary' : ''}
            onClick={() => setType('pll')}
          >
            PLL
          </button>
          {activeCase && (
            <button type="button" onClick={() => { onExit(); onClose(); }}>
              {isZh ? `退出专项 (${activeCase.id})` : `Exit drill (${activeCase.id})`}
            </button>
          )}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={isZh ? '搜索 case' : 'Search cases'}
          style={searchStyle}
        />

        <div className="trainer-subset-body" style={bodyStyle}>
          {matchedCount === 0 ? (
            <div style={{ color: '#888', fontSize: 13, padding: '12px 4px' }}>
              {isZh ? '无匹配结果' : 'No matches'}
            </div>
          ) : (
            groups.map((g, gi) => (
              g.cases.length === 0 ? null : (
                <div key={gi} className="trainer-case-group">
                  {g.name && <h3 className="trainer-case-group-title">{g.name}</h3>}
                  <div className="trainer-case-grid" style={gridStyle}>
                    {g.cases.map(c => {
                      const checked = activeId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`trainer-case-chip ${checked ? 'checked' : ''}`}
                          style={chipStyle}
                          onClick={() => { onPick(type, c.id); onClose(); }}
                          title={c.id}
                        >
                          <span className="trainer-case-chip-label">
                            {type === 'oll' ? c.id.replace(/^OLL /, '') : c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ))
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
