/**
 * Trainer shared components.
 *
 * - TimerDisplay: big italic time, color by 5-state machine
 * - ScrambleHeader: "Scramble: U R U' R'…" formatted text
 * - SolveCard: sidebar Solve #N card (case + result + scramble + delete)
 * - StatsList: chip list of completed times + clear button
 * - CaseTreePicker: the subgroup tree on the selection page
 */
import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '../alg/CaseThumb';
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
  // Group by top-level subgroup label
  const groups = new Map<string, AlgCase[]>();
  for (const c of cases) {
    const top = (c.subgroup || '').split('/', 1)[0];
    const arr = groups.get(top) ?? [];
    arr.push(c);
    groups.set(top, arr);
  }

  const allSelected = cases.length > 0 && cases.every(c => selected.has(caseKey(c)));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) {
      for (const c of cases) next.delete(caseKey(c));
    } else {
      for (const c of cases) next.add(caseKey(c));
    }
    onChange(next);
  };

  return (
    <div className="trainer-set-block">
      <div className="trainer-set-header" onClick={toggleAll}>
        <input type="checkbox" checked={allSelected} readOnly />
        <span>{isZh ? '全选' : 'Select all'}</span>
        <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
          ({cases.filter(c => selected.has(caseKey(c))).length}/{cases.length})
        </span>
      </div>

      {[...groups.entries()].map(([label, groupCases]) => {
        const groupAll = groupCases.every(c => selected.has(caseKey(c)));
        const groupNone = groupCases.every(c => !selected.has(caseKey(c)));
        const indeterminate = !groupAll && !groupNone;
        const toggleGroup = () => {
          const next = new Set(selected);
          if (groupAll) {
            for (const c of groupCases) next.delete(caseKey(c));
          } else {
            for (const c of groupCases) next.add(caseKey(c));
          }
          onChange(next);
        };
        return (
          <div className="trainer-subgroup" key={label || '_root'}>
            {label && (
              <div className="trainer-subgroup-header" onClick={toggleGroup}>
                <input
                  type="checkbox"
                  checked={groupAll}
                  ref={el => { if (el) el.indeterminate = indeterminate; }}
                  readOnly
                />
                <span>{label}</span>
                <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
                  ({groupCases.filter(c => selected.has(caseKey(c))).length}/{groupCases.length})
                </span>
              </div>
            )}
            <div className="trainer-case-grid">
              {groupCases.map(c => {
                const k = caseKey(c);
                const isOn = selected.has(k);
                const toggleCase = () => {
                  const next = new Set(selected);
                  if (isOn) next.delete(k);
                  else next.add(k);
                  onChange(next);
                };
                return (
                  <div
                    key={k}
                    className={`trainer-case-cell${isOn ? ' is-selected' : ''}`}
                    onClick={toggleCase}
                  >
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
