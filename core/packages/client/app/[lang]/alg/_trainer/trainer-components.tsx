'use client';

// Ported from packages/client-vite/src/pages/trainer/components.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { Trash2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import { VisualCube } from '@/components/VisualCube';
import { TimerState } from '@/lib/trainer-store';
import type { TrainerSolve, TrainerPenalty } from '@/lib/trainer-store';
import { caseKey } from '@/lib/trainer-case-key';
import { primaryCaseName } from '@/lib/alg_case_display';
import { tr } from '@/i18n/tr';

export function formatMs(ms: number, precision = 2): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = ms / 1000;
  const min = Math.floor(total / 60);
  const sec = total - min * 60;
  if (min > 0) return `${min}:${sec.toFixed(precision).padStart(precision + 3, '0')}`;
  return sec.toFixed(precision);
}

/** A solve's displayed time, accounting for its penalty (DNF / +2). */
export function formatSolveTime(solve: { ms: number; penalty?: TrainerPenalty }): string {
  if (solve.penalty === 'DNF') return 'DNF';
  if (solve.penalty === '+2') return formatMs(solve.ms + 2000) + '+';
  return formatMs(solve.ms);
}

export function TimerDisplay({
  state, ms, penalty, font = 'lcd',
}: { state: TimerState; ms: number; penalty?: TrainerPenalty; font?: string }) {
  const cls =
    state === TimerState.AWAITING_READY ? 'is-awaiting' :
    state === TimerState.READY          ? 'is-ready'    :
    state === TimerState.RUNNING        ? 'is-running'  :
    state === TimerState.STOPPING       ? 'is-stopping' :
                                          'is-idle';
  // Penalty applies only to a finished solve being shown (idle / just-stopped).
  const showResult = state === TimerState.NOT_RUNNING || state === TimerState.STOPPING;
  const isDnf = showResult && penalty === 'DNF';
  const text =
    isDnf ? 'DNF' :
    showResult && penalty === '+2' ? formatMs(ms + 2000) + '+' :
    formatMs(ms);
  return <div className={`trainer-timer tf-${font} ${cls}${isDnf ? ' is-dnf' : ''}`}>{text}</div>;
}

/** 打乱正文。label(如「已复制」反馈)可选 —— 没有就只渲染打乱本身。 */
export function ScrambleHeader({ scramble, label }: { scramble: string; label?: string }) {
  return (
    <div>
      {label && <div className="trainer-scramble-label">{label}</div>}
      <div className="trainer-scramble-text">{scramble || '—'}</div>
    </div>
  );
}

export function SolveCard({
  puzzle, set, solve, c, header, onShowCase,
}: {
  puzzle: AlgPuzzle;
  set: string;
  solve: TrainerSolve | null;
  c: AlgCase | null;
  isZh: boolean;
  header: ReactNode;
  /** 点 case 名弹出该情况的详情弹窗(元数据 / 公式)。 */
  onShowCase?: (c: AlgCase) => void;
}) {
  return (
    <div className="trainer-solve-card">
      <div className="trainer-card-header">
        <span>{header}</span>
      </div>
      <hr className="trainer-card-divider" />
      {!solve || !c ? (
        <div className="trainer-stats-empty">{tr({ zh: '暂无成绩', en: 'No solves yet'
        })}</div>
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
            {onShowCase ? (
              <button
                type="button"
                className="trainer-case-link"
                onClick={() => onShowCase(c)}
                title={tr({ zh: '查看该情况', en: 'View this case' })}
              >
                {primaryCaseName(puzzle, set, c)}
                <Info size={12} />
              </button>
            ) : (
              primaryCaseName(puzzle, set, c)
            )}
          </div>
          <div className="trainer-solve-row">
            <span>{tr({ zh: '打乱:', en: 'Scramble:'
            })}</span>
            <div className="trainer-solve-scramble">{solve.scramble}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function StatsList({
  solves, observingIdx, onPick, onClear,
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
        <span>{tr({ zh: '统计', en: 'Statistics'
        })}</span>
        {solves.length > 0 && (
          <button className="trainer-icon-btn" onClick={onClear}
            title={tr({ zh: '清空', en: 'Clear' })}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <hr className="trainer-card-divider" />
      {solves.length === 0 ? (
        <div className="trainer-stats-empty">
          {tr({ zh: '空格开始计时', en: 'Space to start'
        })}
        </div>
      ) : (
        <div className="trainer-stats-list">
          {solves.map(s => (
            <span
              key={s.i}
              className={`trainer-stat-time${observingIdx === s.i ? ' is-active' : ''}${s.penalty === 'DNF' ? ' is-dnf' : ''}`}
              onClick={() => onPick(s.i)}
            >
              {formatSolveTime(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// CSS-drawn tri-state checkbox (no <input>): a native checkbox can't live inside
// a <button>, and the whole row is the real tap target. iOS Safari only reliably
// fires tap→click on native interactive elements, so the rows below are buttons.
function TriCheckbox({ checked, indeterminate }: { checked: boolean; indeterminate: boolean }) {
  const cls = checked ? ' is-checked' : indeterminate ? ' is-indeterminate' : '';
  return <span className={`trainer-checkbox${cls}`} aria-hidden />;
}

interface TopGroup {
  label: string;
  subs: Map<string, AlgCase[]>;
  allCases: AlgCase[];
  sample: AlgCase;
}

export function CaseTreePicker({
  puzzle, set, cases, selected, onChange,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  isZh: boolean;
}) {
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

  function TopThumb({ g }: { g: TopGroup }) {
    if (hasSubLevel && puzzle === '3x3') {
      const firstAlg = g.sample.algs.flat()[0]?.alg ?? g.sample.standard ?? '';
      // setup 优先:公式带起手转体 / 收尾 AUF 时,inverse(alg) 会把图整体转一格。
      return <VisualCube setup={g.sample.setup} algorithm={firstAlg} view="oll" size={44} />;
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
      <button type="button" className="trainer-set-header" onClick={toggleAll}>
        <TriCheckbox checked={allSelected} indeterminate={!allSelected && !noneSelected} />
        <span>{tr({ zh: '全选', en: 'Select all'
        })}</span>
        <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, fontSize: '0.85rem' }}>
          ({totalSelected}/{cases.length})
        </span>
      </button>

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
                  title={isExpanded ? tr({ zh: '折叠', en: 'Collapse'
                                  }) : tr({ zh: '展开', en: 'Expand'
                                      })}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <button
                  type="button"
                  className="trainer-bulk-toggle"
                  onClick={() => toggleBulk(top.allCases)}
                >
                  <TriCheckbox checked={topAll} indeterminate={!topAll && !topNone} />
                  <TopThumb g={top} />
                  <span>{set.toUpperCase()} {top.label}</span>
                  <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, fontSize: '0.85rem' }}>
                    ({topSelectedCount}/{top.allCases.length})
                  </span>
                </button>
              </div>
            )}

            {isExpanded && (
              hasSubLevel ? (
                <div className="trainer-sub-subgroup-row">
                  {Array.from(top.subs.entries()).map(([subLabel, subCases]) => {
                    const subKey = `${top.label}/${subLabel}`;
                    const subExpanded = expandedSubs.has(subKey);
                    const subSelectedCount = subCases.filter(c => selected.has(caseKey(c))).length;
                    const subAll = subSelectedCount === subCases.length;
                    const subNone = subSelectedCount === 0;
                    const subSampleAlg = subCases[0]?.algs.flat()[0]?.alg ?? subCases[0]?.standard ?? '';
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
                              title={subExpanded ? tr({ zh: '折叠', en: 'Collapse'
                                                          }) : tr({ zh: '展开', en: 'Expand'
                                                              })}
                            >
                              {subExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <button
                              type="button"
                              className="trainer-bulk-toggle"
                              onClick={() => toggleBulk(subCases)}
                            >
                              <TriCheckbox checked={subAll} indeterminate={!subAll && !subNone} />
                              {useCollMask
                                ? <VisualCube algorithm={subSampleAlg} setup={subCases[0].setup} view="pll" mask="coll" size={36} />
                                : <CaseThumb puzzle={puzzle} set={set} sticker={subCases[0].sticker}
                                    alg={subSampleAlg} setup={subCases[0].setup} size={36} />}
                              <span>{subLabel}</span>
                              <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, fontSize: '0.85rem' }}>
                                ({subSelectedCount}/{subCases.length})
                              </span>
                            </button>
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
    <button type="button" className={`trainer-case-cell${isOn ? ' is-selected' : ''}`}
      aria-pressed={isOn} onClick={toggle}>
      <span className="trainer-case-cell-thumb">
        <CaseThumb
          puzzle={puzzle}
          set={set}
          sticker={c.sticker}
          alg={c.algs.flat()[0]?.alg ?? c.standard ?? ''}
          setup={c.setup}
          size={64}
        />
      </span>
      <span className="trainer-case-cell-name">{primaryCaseName(puzzle, set, c)}</span>
    </button>
  );
}
