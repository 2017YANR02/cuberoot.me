/**
 * Trainer shared components.
 *
 * - TimerDisplay: big italic time, color by 5-state machine
 * - ScrambleHeader: "Scramble: U R U' R'…" formatted text
 * - SolveCard: sidebar Solve #N card (case + result + scramble + delete)
 * - StatsList: chip list of completed times + clear button
 * - CaseTreePicker: the subgroup tree on the selection page
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '../alg/CaseThumb';
import { VisualCube } from '../../components/VisualCube';
import { TimerState } from '../../stores/trainerStore';
import type { TrainerSolve } from '../../stores/trainerStore';
import { caseKey } from '../../utils/trainerCaseKey';

/** Format ms as "0.65" / "1:23.45". */
export function formatMs(ms: number, precision = 2): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = ms / 1000;
  const min = Math.floor(total / 60);
  const sec = total - min * 60;
  if (min > 0) return `${min}:${sec.toFixed(precision).padStart(precision + 3, '0')}`;
  return sec.toFixed(precision);
}

/* ─────────── TimerDisplay ─────────── */

export function TimerDisplay({
  state, ms,
}: { state: TimerState; ms: number }) {
  const cls =
    state === TimerState.AWAITING_READY ? 'is-awaiting' :
    state === TimerState.READY          ? 'is-ready'    :
    state === TimerState.RUNNING        ? 'is-running'  :
    state === TimerState.STOPPING       ? 'is-stopping' :
                                          'is-idle';
  return <div className={`trainer-timer ${cls}`}>{formatMs(ms)}</div>;
}

/* ─────────── ScrambleHeader ─────────── */

export function ScrambleHeader({ scramble, label }: { scramble: string; label: string }) {
  return (
    <div>
      <div className="trainer-scramble-label">{label}</div>
      <div className="trainer-scramble-text">{scramble || '—'}</div>
    </div>
  );
}

/* ─────────── SolveCard ─────────── */

export function SolveCard({
  puzzle, set, solve, c, isZh, onDelete, header,
}: {
  puzzle: AlgPuzzle;
  set: string;
  solve: TrainerSolve | null;
  c: AlgCase | null;
  isZh: boolean;
  onDelete?: () => void;
  header: ReactNode;
}) {
  return (
    <div className="trainer-solve-card">
      <div className="trainer-card-header">
        <span>{header}</span>
        {onDelete && solve && (
          <button className="trainer-icon-btn" onClick={onDelete}
            title={isZh ? '删除' : 'Remove'}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <hr className="trainer-card-divider" />
      {!solve || !c ? (
        <div className="trainer-stats-empty">{isZh ? '暂无成绩' : 'No solves yet'}</div>
      ) : (
        <>
          <div className="trainer-solve-thumb">
            <CaseThumb
              puzzle={puzzle}
              set={set}
              sticker={c.sticker}
              alg={c.algs.flat()[0]?.alg ?? c.standard ?? ''}
              setup={c.setup}
              size={120}
            />
          </div>
          <div className="trainer-solve-row">
            <span>{isZh ? '情况:' : 'Case:'}</span>{c.name}
          </div>
          <div className="trainer-solve-row">
            <span>{isZh ? '成绩:' : 'Result:'}</span>{formatMs(solve.ms)}
          </div>
          <div className="trainer-solve-row">
            <span>{isZh ? '打乱:' : 'Scramble:'}</span>
            <div className="trainer-solve-scramble">{solve.scramble}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────── StatsList ─────────── */

export function StatsList({
  solves, observingIdx, isZh, onPick, onClear,
}: {
  solves: TrainerSolve[];
  observingIdx: number;
  isZh: boolean;
  onPick: (i: number) => void;
  onClear: () => void;
}) {
  return (
    <div className="trainer-stats-card">
      <div className="trainer-card-header">
        <span>{isZh ? '统计' : 'Statistics'}</span>
        {solves.length > 0 && (
          <button className="trainer-icon-btn" onClick={onClear}
            title={isZh ? '清空' : 'Clear'}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <hr className="trainer-card-divider" />
      {solves.length === 0 ? (
        <div className="trainer-stats-empty">
          {isZh ? '空格开始计时' : 'Space to start'}
        </div>
      ) : (
        <div className="trainer-stats-list">
          {solves.map(s => (
            <span
              key={s.i}
              className={`trainer-stat-time${observingIdx === s.i ? ' is-active' : ''}`}
              onClick={() => onPick(s.i)}
            >
              {formatMs(s.ms)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── CaseTreePicker ─────────── */

/** Tri-state checkbox (checked / unchecked / indeterminate). */
function TriCheckbox({ checked, indeterminate }: { checked: boolean; indeterminate: boolean }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={el => { if (el) el.indeterminate = indeterminate; }}
      readOnly
    />
  );
}

interface TopGroup {
  label: string;
  /** Sub label "" means "no second level" (flat set). */
  subs: Map<string, AlgCase[]>;
  allCases: AlgCase[];
  /** First case in this top group — drives the OLL-pattern thumbnail. */
  sample: AlgCase;
}

export function CaseTreePicker({
  puzzle, set, cases, selected, onChange, isZh,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  /** Composite-key set (subgroup|name) — see utils/trainerCaseKey. */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  isZh: boolean;
}) {
  // Build hierarchy: top → sub → cases. For flat sets, sub key is "".
  const { tops, hasSubLevel } = useMemo(() => {
    const map = new Map<string, TopGroup>();
    let hasSub = false;
    for (const c of cases) {
      const parts = (c.subgroup || '').split('/');
      const top = parts[0] || '';
      const sub = parts.slice(1).join('/');
      if (sub) hasSub = true;
      let g = map.get(top);
      if (!g) {
        g = { label: top, subs: new Map(), allCases: [], sample: c };
        map.set(top, g);
      }
      g.allCases.push(c);
      const arr = g.subs.get(sub) ?? [];
      arr.push(c);
      g.subs.set(sub, arr);
    }
    return { tops: Array.from(map.values()), hasSubLevel: hasSub };
  }, [cases]);

  // Top-level expansion. Default-collapsed for umbrella sets (ZBLL).
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (hasSubLevel) return new Set();
    return new Set(tops.map(t => t.label));
  });
  const toggleTop = (label: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    return next;
  });

  // Sub-level expansion (only relevant when hasSubLevel). Default-collapsed —
  // expanding a top reveals sub-cards (COLL preview), expanding a sub reveals
  // the actual case cells. Key format: "${topLabel}/${subLabel}".
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const toggleSub = (key: string) => setExpandedSubs(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const totalSelected = cases.filter(c => selected.has(caseKey(c))).length;
  const allSelected = cases.length > 0 && totalSelected === cases.length;
  const noneSelected = totalSelected === 0;
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) {
      for (const c of cases) next.delete(caseKey(c));
    } else {
      for (const c of cases) next.add(caseKey(c));
    }
    onChange(next);
  };

  /** Toggle a bulk set of cases — adds all if any unselected, else removes all. */
  const toggleBulk = (bulk: AlgCase[]) => {
    const allOn = bulk.every(c => selected.has(caseKey(c)));
    const next = new Set(selected);
    if (allOn) {
      for (const c of bulk) next.delete(caseKey(c));
    } else {
      for (const c of bulk) next.add(caseKey(c));
    }
    onChange(next);
  };

  /** Top-level thumb: OLL pattern (yellow/gray) for hierarchical sets, full case
   *  preview otherwise. Sized small (44px) to keep the row compact. */
  function TopThumb({ g }: { g: TopGroup }) {
    if (hasSubLevel && puzzle === '3x3') {
      const firstAlg = g.sample.algs.flat()[0]?.alg ?? g.sample.standard ?? '';
      return <VisualCube algorithm={firstAlg} view="oll" size={44} />;
    }
    return (
      <CaseThumb
        puzzle={puzzle}
        set={set}
        sticker={g.sample.sticker}
        alg={g.sample.algs.flat()[0]?.alg ?? g.sample.standard ?? ''}
        setup={g.sample.setup}
        size={44}
      />
    );
  }

  return (
    <div className="trainer-set-block">
      <div className="trainer-set-header" onClick={toggleAll}>
        <TriCheckbox checked={allSelected} indeterminate={!allSelected && !noneSelected} />
        <span>{isZh ? '全选' : 'Select all'}</span>
        <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
          ({totalSelected}/{cases.length})
        </span>
      </div>

      {tops.map(top => {
        const isExpanded = expanded.has(top.label);
        const topSelectedCount = top.allCases.filter(c => selected.has(caseKey(c))).length;
        const topAll = topSelectedCount === top.allCases.length && top.allCases.length > 0;
        const topNone = topSelectedCount === 0;
        return (
          <div className="trainer-subgroup" key={top.label || '_root'}>
            {top.label && (
              <div className="trainer-subgroup-header">
                <button
                  type="button"
                  className="trainer-chevron-btn"
                  onClick={(e) => { e.stopPropagation(); toggleTop(top.label); }}
                  title={isExpanded ? (isZh ? '折叠' : 'Collapse') : (isZh ? '展开' : 'Expand')}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}
                  onClick={() => toggleBulk(top.allCases)}
                >
                  <TriCheckbox checked={topAll} indeterminate={!topAll && !topNone} />
                  <TopThumb g={top} />
                  <span>{set.toUpperCase()} {top.label}</span>
                  <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
                    ({topSelectedCount}/{top.allCases.length})
                  </span>
                </span>
              </div>
            )}

            {isExpanded && (
              hasSubLevel ? (
                // 3-level: sub-subgroups laid out horizontally (flex-wrap row). Each
                // sub starts collapsed showing only the COLL preview chip; clicking
                // its chevron grows it to full row-width and reveals its case cells.
                <div className="trainer-sub-subgroup-row">
                  {Array.from(top.subs.entries()).map(([subLabel, subCases]) => {
                    const subKey = `${top.label}/${subLabel}`;
                    const subExpanded = expandedSubs.has(subKey);
                    const subSelectedCount = subCases.filter(c => selected.has(caseKey(c))).length;
                    const subAll = subSelectedCount === subCases.length;
                    const subNone = subSelectedCount === 0;
                    const subSampleAlg = subCases[0]?.algs.flat()[0]?.alg ?? subCases[0]?.standard ?? '';
                    // ZBLL/1LLL/OLLCP second-level groups by COLL recognition — show COLL mask.
                    const useCollMask = puzzle === '3x3' && (set === 'zbll' || set === '1lll' || set === 'ollcp');
                    return (
                      <div
                        className={`trainer-sub-subgroup${subExpanded ? ' is-expanded' : ''}`}
                        key={subLabel || '_sub_root'}
                      >
                        {subLabel && (
                          <div className="trainer-sub-subgroup-header">
                            <button
                              type="button"
                              className="trainer-chevron-btn"
                              onClick={(e) => { e.stopPropagation(); toggleSub(subKey); }}
                              title={subExpanded ? (isZh ? '折叠' : 'Collapse') : (isZh ? '展开' : 'Expand')}
                            >
                              {subExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}
                              onClick={() => toggleBulk(subCases)}
                            >
                              <TriCheckbox checked={subAll} indeterminate={!subAll && !subNone} />
                              {useCollMask
                                ? <VisualCube algorithm={subSampleAlg} setup={subCases[0].setup} view="pll" mask="coll" size={36} />
                                : <CaseThumb puzzle={puzzle} set={set} sticker={subCases[0].sticker}
                                    alg={subSampleAlg} setup={subCases[0].setup} size={36} />}
                              <span>{subLabel}</span>
                              <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
                                ({subSelectedCount}/{subCases.length})
                              </span>
                            </span>
                          </div>
                        )}
                        {subExpanded && (
                          <div className="trainer-case-grid">
                            {subCases.map(c => <CaseCell key={caseKey(c)}
                              c={c} puzzle={puzzle} set={set} selected={selected} onChange={onChange} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Flat: cases directly inside top
                <div className="trainer-case-grid">
                  {top.allCases.map(c => <CaseCell key={caseKey(c)}
                    c={c} puzzle={puzzle} set={set} selected={selected} onChange={onChange} />)}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function CaseCell({
  c, puzzle, set, selected, onChange,
}: {
  c: AlgCase;
  puzzle: AlgPuzzle;
  set: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const k = caseKey(c);
  const isOn = selected.has(k);
  const toggle = () => {
    const next = new Set(selected);
    if (isOn) next.delete(k); else next.add(k);
    onChange(next);
  };
  return (
    <div className={`trainer-case-cell${isOn ? ' is-selected' : ''}`} onClick={toggle}>
      <div className="trainer-case-cell-thumb">
        <CaseThumb
          puzzle={puzzle}
          set={set}
          sticker={c.sticker}
          alg={c.algs.flat()[0]?.alg ?? c.standard ?? ''}
          setup={c.setup}
          size={64}
        />
      </div>
      <div className="trainer-case-cell-name">{c.name}</div>
    </div>
  );
}
