'use client';

// Ported from packages/client-vite/src/pages/trainer/components.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { Trash2, ChevronDown, ChevronRight, Check, Pause, Star } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import { VisualCube } from '@/components/VisualCube';
import { SegmentTime } from '@/components/SegmentTime';
import { TimerState } from '@/lib/trainer-store';
import type { TrainerSolve, TrainerPenalty } from '@/lib/trainer-store';
import {
  useTrainerMarks, markStatus, markStarred, MARK_STATUS_LABEL,
  type CaseMarks, type CaseMarkStatus, type TrainerMarkBrush,
} from '@/lib/trainer-marks';
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
  // 分钟冒号统一走 SegmentTime(Segment7 的 ':' 是横杠,换成 CSS 两点),与 /timer 共用。
  return (
    <div className={`trainer-timer tf-${font} ${cls}${isDnf ? ' is-dnf' : ''}`}>
      <SegmentTime text={text} />
    </div>
  );
}

/** 打乱正文。label(如「已复制」反馈)可选 —— 没有就只渲染打乱本身。 */
export function ScrambleHeader({ scramble, label, font = 'sans' }: { scramble: string; label?: string; font?: string }) {
  return (
    <div>
      {label && <div className="trainer-scramble-label">{label}</div>}
      <div className={`trainer-scramble-text sf-${font}`}>{scramble || '—'}</div>
    </div>
  );
}

export function SolveCard({
  puzzle, set, scramble, c, header, markSlot, onShowCase,
}: {
  puzzle: AlgPuzzle;
  set: string;
  /** 展示的打乱(计时模式 = 所观察那条成绩的;不计时 = 当前题的)。 */
  scramble: string | null;
  c: AlgCase | null;
  isZh: boolean;
  /** 卡片标题(如 `#3`)。省略 = 不渲染标题行(跟随当前题时无需「当前」字样)。 */
  header?: ReactNode;
  /** 标题行右侧的学习标记 pill(CaseMarkPill)。 */
  markSlot?: ReactNode;
  /** 点 case 名弹出该情况的详情弹窗(元数据 / 公式)。 */
  onShowCase?: (c: AlgCase) => void;
}) {
  return (
    <div className="trainer-solve-card">
      {(header != null || markSlot != null) && (
        <>
          <div className="trainer-card-header">
            <span>{header}</span>
          </div>
          {markSlot && <div className="trainer-mark-row">{markSlot}</div>}
          <hr className="trainer-card-divider" />
        </>
      )}
      {!scramble || !c ? (
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
              // 图从「实际打乱」渲染(含 pre/post-AUF),而非 case 规范 setup —— 否则
              // 图与卡片上的打乱公式朝向对不上(3x3/2x2 才有 AUF;其余打乱==规范 setup)。
              setup={scramble ?? c.setup}
              // 与左栏大图 / 离屏预取同 size=140:同一 URL 共用浏览器缓存,换题时秒出不再重取。
              size={140}
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
              </button>
            ) : (
              primaryCaseName(puzzle, set, c)
            )}
          </div>
          <div className="trainer-solve-row">
            <div className="trainer-solve-scramble">{scramble}</div>
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

/** run 页卡片头的学习标记直选条:4 个可直接点的按钮(学习中 / 已掌握 / 搁置 / 星标),
 *  每行 2 个;再点同一个 = 取消该标记。数字键 1-4 仍是快捷键(绑定在 TrainerRunClient 的
 *  keydown 里,title 里带提示),但不再渲染可见的数字小标。data-no-timer:按压不触发计时。 */
const MARK_ACTIONS: { digit: string; s?: CaseMarkStatus; star?: boolean }[] = [
  { digit: '1', s: 'learning' },
  { digit: '2', s: 'mastered' },
  { digit: '3', s: 'paused' },
  { digit: '4', star: true },
];

export function CaseMarkBar({ k }: { k: string }) {
  const marks = useTrainerMarks(s => s.marks);
  const applyMarks = useTrainerMarks(s => s.applyMarks);
  const st = markStatus(marks, k);
  const starred = markStarred(marks, k);
  return (
    <span className="trainer-mark-bar" data-no-timer>
      {MARK_ACTIONS.map((a) => {
        const active = a.star ? starred : st === a.s;
        const label = a.star ? tr({ zh: '星标', en: 'Star' }) : MARK_STATUS_LABEL[a.s!]();
        return (
          <button
            key={a.digit}
            type="button"
            className={`trainer-mark-btn ${a.star ? 'is-star' : `is-${a.s}`}${active ? ' is-active' : ''}`}
            aria-pressed={active}
            title={`${label} (${a.digit})`}
            onClick={() => (a.star
              ? applyMarks([k], { f: !starred })
              : applyMarks([k], { s: st === a.s ? null : a.s }))}
          >
            {a.star
              ? <Star size={12} className="trainer-mark-btn-star" aria-hidden />
              : <span className={`trainer-mark-dot is-${a.s}`} aria-hidden />}
            <span className="trainer-mark-btn-label">{label}</span>
          </button>
        );
      })}
    </span>
  );
}

/** case 图上的学习标记角标:右上状态(✓ 已掌握 / ● 学习中 / ⏸ 搁置),左上星标。 */
export function CaseMarkBadges({ marks, k }: { marks: CaseMarks; k: string }) {
  const st = markStatus(marks, k);
  const starred = markStarred(marks, k);
  if (!st && !starred) return null;
  return (
    <>
      {st && (
        <span className={`trainer-mark-badge is-${st}`} aria-hidden>
          {st === 'mastered' ? <Check size={11} strokeWidth={3.5} />
            : st === 'paused' ? <Pause size={9} strokeWidth={3} />
            : null /* learning = 纯色圆点 */}
        </span>
      )}
      {starred && <Star className="trainer-mark-star" size={13} aria-hidden />}
    </>
  );
}

interface TopGroup {
  label: string;
  subs: Map<string, AlgCase[]>;
  allCases: AlgCase[];
  sample: AlgCase;
}

export function CaseTreePicker({
  puzzle, set, cases, selected, onChange, marks, brush, onPaint,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  isZh: boolean;
  /** per-case 学习标记(角标显示)。 */
  marks?: CaseMarks;
  /** 画笔模式:非空时,点 cell / 组头 = 涂标记而不是改选择(由 onPaint 落地)。 */
  brush?: TrainerMarkBrush | null;
  onPaint?: (keys: string[]) => void;
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

  const painting = !!brush && !!onPaint;

  const totalSelected = cases.filter(c => selected.has(caseKey(c))).length;
  const allSelected = cases.length > 0 && totalSelected === cases.length;
  const noneSelected = totalSelected === 0;
  const toggleAll = () => {
    if (painting) { onPaint!(cases.map(caseKey)); return; }
    const next = new Set(selected);
    if (allSelected) {
      for (const c of cases) next.delete(caseKey(c));
    } else {
      for (const c of cases) next.add(caseKey(c));
    }
    onChange(next);
  };

  const toggleBulk = (bulk: AlgCase[]) => {
    if (painting) { onPaint!(bulk.map(caseKey)); return; }
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
    <div className={`trainer-set-block${painting ? ' is-painting' : ''}`}>
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
                              c={c} puzzle={puzzle} set={set} selected={selected} onChange={onChange}
                              marks={marks} painting={painting} onPaint={onPaint} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="trainer-case-grid">
                  {top.allCases.map(c => <CaseCell key={caseKey(c)}
                    c={c} puzzle={puzzle} set={set} selected={selected} onChange={onChange}
                    marks={marks} painting={painting} onPaint={onPaint} />)}
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
  c, puzzle, set, selected, onChange, marks, painting, onPaint,
}: {
  c: AlgCase;
  puzzle: AlgPuzzle;
  set: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  marks?: CaseMarks;
  painting?: boolean;
  onPaint?: (keys: string[]) => void;
}) {
  const k = caseKey(c);
  const isOn = selected.has(k);
  const toggle = () => {
    if (painting && onPaint) { onPaint([k]); return; }
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
        {marks && <CaseMarkBadges marks={marks} k={k} />}
      </span>
      <span className="trainer-case-cell-name">{primaryCaseName(puzzle, set, c)}</span>
    </button>
  );
}
