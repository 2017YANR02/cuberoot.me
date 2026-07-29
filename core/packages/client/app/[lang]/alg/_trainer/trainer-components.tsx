'use client';

// Ported from packages/client-vite/src/pages/trainer/components.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { Trash2, ChevronDown, ChevronRight, Check, Star, TriangleAlert } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import Link from '@/components/AppLink';
import { CaseThumb } from '@/components/CaseThumb';
import { VisualCube } from '@/components/VisualCube';
import { SegmentTime } from '@/components/SegmentTime';
import { TimerState } from '@/lib/trainer-store';
import type { TrainerSolve, TrainerPenalty, TrainerHistEntry } from '@/lib/trainer-store';
import type { ScrambleHist } from '@/lib/scramble-history';
import {
  useTrainerMarks, markStatus, markStarred, MARK_STATUS_LABEL,
  type CaseMarks, type CaseMarkStatus, type TrainerMarkBrush,
} from '@/lib/trainer-marks';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import { primaryCaseName, displayZbllToken } from '@/lib/alg_case_display';
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
export function ScrambleHeader({ scramble, label, font = 'sans', placeholder }: {
  scramble: string;
  label?: string;
  font?: string;
  /** 打乱还没有时摆什么(虚拟集的打乱是现算的,要等上一两秒 —— 空着一条杠像坏了)。 */
  placeholder?: string;
}) {
  return (
    <div>
      {label && <div className="trainer-scramble-label">{label}</div>}
      <div className={`trainer-scramble-text sf-${font}`}>{scramble || placeholder || '—'}</div>
    </div>
  );
}

export function SolveCard({
  puzzle, set, scramble, c, header, markSlot, onShowCase, caseHref, showThumb = true,
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
  /**
   * case 名做成链接指向详情页(没有弹窗可弹的集用这条,如 LSLL)。
   * 真 `<a>`,中键 / Ctrl 点能新开;与 `onShowCase` 二选一,两个都给时链接优先。
   */
  caseHref?: (c: AlgCase) => string;
  /** 打乱图开关(「打乱图」关时整卡不出 CaseThumb)。默认 true。 */
  showThumb?: boolean;
}) {
  // 标题行三格:左「上一个」/ 正中 case 名 / 右标记图标 —— 名字在图正上方,不再单占一行
  const name = c ? primaryCaseName(puzzle, set, c) : null;
  return (
    <div className="trainer-solve-card">
      {/* 打乱排在图下方 —— 与主屏 / 记忆模式同序。head / body 两段是给 .trainer-run
          的 subgrid 用的:三列共用同一套行,三张图的顶边自然齐平。 */}
      <div className="trainer-card-head">
        {(header != null || markSlot != null || name != null) && (
          <div className="trainer-card-header is-solve">
            <span className="trainer-card-slot">{header}</span>
            <span className="trainer-card-name">
              {name != null && (caseHref && c ? (
                <Link
                  href={caseHref(c)}
                  className="trainer-case-link"
                  title={tr({ zh: '查看该情况', en: 'View this case' })}
                  prefetch={false}
                >
                  {name}
                </Link>
              ) : onShowCase && c ? (
                <button
                  type="button"
                  className="trainer-case-link"
                  onClick={() => onShowCase(c)}
                  title={tr({ zh: '查看该情况', en: 'View this case' })}
                >
                  {name}
                </button>
              ) : name)}
            </span>
            <span className="trainer-card-slot is-end">{markSlot}</span>
          </div>
        )}
      </div>
      <div className="trainer-card-body">
        {!scramble || !c ? (
          <div className="trainer-stats-empty">{tr({ zh: '暂无成绩', en: 'No solves yet'
          })}</div>
        ) : (
          <>
            {showThumb && (() => {
              const thumb = (
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
              );
              // 图和名字指的是同一个 case,点哪个都该开详情 —— 图还是更大更好点的那个目标。
              // 真 <button>(剥 UA 样式),不用 div onClick:iOS Safari 的 tap 只在原生可交互元素上可靠。
              return onShowCase ? (
                <button
                  type="button"
                  className="trainer-solve-thumb is-clickable"
                  onClick={() => onShowCase(c)}
                  title={tr({ zh: '查看该情况', en: 'View this case' })}
                  aria-label={`${primaryCaseName(puzzle, set, c)} — ${tr({ zh: '查看该情况', en: 'View this case' })}`}
                >
                  {thumb}
                </button>
              ) : (
                <div className="trainer-solve-thumb">{thumb}</div>
              );
            })()}
            <div className="trainer-solve-scramble">{scramble}</div>
          </>
        )}
      </div>
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
          {/* 最新一条在最前 —— 刚练完那条才是要看的,不该滚到列表末尾去找。
              `s.i` 是这条在会话里的原始序号(高亮 / 点击回看都按它),倒序只换呈现。 */}
          {solves.slice().reverse().map(s => (
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

/**
 * 不计时模式的「历史」面板:列出打乱历史(hist.list),点某条 = 跳回查看那条打乱(主屏 +
 * 上/下卡片一起切过去)。不计时没有用时可统计 —— 列的是 case 本身,当前所在条高亮。
 *
 * 每条给足三样:**打乱图**(按该条**实际打乱**渲染,含 AUF —— 与主屏那张同源,不是 case 规范
 * setup)、case 名、**公式**。以前只有一个名字药丸,打乱塞在 `title` 里 —— 触屏没有 hover,
 * 等于回看历史全靠盲点。
 *
 * 当前所在那条不印公式:历史里包含「正在做的这题」,在训练模式下把答案摆出来就没得练了。
 * (点开详情弹窗是另一回事 —— 那是明着要看答案。)
 */
export function HistoryList({
  hist, cases, puzzle, set, onPick, onShowCase,
}: {
  hist: ScrambleHist<TrainerHistEntry>;
  cases: AlgCase[];
  puzzle: AlgPuzzle;
  set: string;
  /** 点第 i 条:跳到该历史条目。 */
  onPick: (i: number) => void;
  /**
   * 同一下点击顺带弹出该 case 的详情(元数据 / 全部公式),与 SolveCard 的图和名字一个待遇。
   * 没有 meta 的集不传 —— 那时点一下就只是回看。
   */
  onShowCase?: (c: AlgCase) => void;
}) {
  // set 名当页首已给(topbar「3×3 · ZBLL …」),卡片里再顶个 "ZBLL " 冗余 —— 剥掉只留组号。
  const setPrefix = new RegExp('^' + set.toUpperCase() + '\\s+', 'i');
  return (
    <div className="trainer-stats-card">
      <div className="trainer-card-header">
        <span>{tr({ zh: '历史', en: 'History' })}</span>
      </div>
      <hr className="trainer-card-divider" />
      {hist.list.length === 0 ? (
        <div className="trainer-stats-empty">{tr({ zh: '暂无打乱历史', en: 'No scrambles yet'
        })}</div>
      ) : (
        <div className="trainer-hist-grid">
          {/* 同 StatsList:最新在最前。`i` 必须是原始下标(onPick / 高亮都按它),
              所以先带上下标再倒序,别 reverse 完拿新下标。 */}
          {hist.list.map((e, i) => [e, i] as const).reverse().map(([e, i]) => {
            const c = findCaseByKey(cases, e.key);
            const name = (c ? primaryCaseName(puzzle, set, c) : e.name).replace(setPrefix, '');
            const active = hist.idx === i;
            const alg = c ? (c.algs.flat()[0]?.alg ?? c.standard ?? '') : '';
            return (
              // 真 <button>:iOS Safari 的 tap 只在原生可交互元素上可靠(与 solve 卡同一理由)
              <button
                key={i}
                type="button"
                className={`trainer-hist-item${active ? ' is-active' : ''}`}
                // 回看那条打乱 + 摊开这个 case:一次点击两件事,因为它们是同一个意图
                // (「这题我看看」)。有详情可看的集才弹,其余仍旧只是回看。
                onClick={() => { onPick(i); if (c?.meta) onShowCase?.(c); }}
                title={e.scramble}
                aria-current={active ? 'true' : undefined}
              >
                {c && (
                  <CaseThumb
                    puzzle={puzzle}
                    set={set}
                    sticker={c.sticker}
                    alg={alg}
                    // 图从该条的实际打乱渲染(含 pre/post-AUF),否则与回看时主屏那张对不上
                    setup={e.scramble || c.setup}
                    size={56}
                  />
                )}
                <span className="trainer-hist-name">{name}</span>
                {alg && !active && <code className="trainer-hist-alg">{alg}</code>}
              </button>
            );
          })}
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

/** run 页卡片标题行右侧的学习标记直选条:两个图标按钮(不熟 / 星标),
 *  再点同一个 = 取消该标记。数字键 1、2、4 仍是快捷键(绑定在 TrainerRunClient 的
 *  keydown 里,title 里带提示),但不再渲染可见的数字小标。data-no-timer:按压不触发计时。
 *
 *  不摆「已掌握」—— 换到下一题就自动算掌握(见 TrainerRunClient 的 markPassedAsMastered),
 *  摆出来等于要用户手点一遍默认值。键盘 2 仍然在,当作把「不熟」直接提成「已掌握」的快捷键。
 *  只出图标、跟卡片标题挤同一行:卡片本体是图 + 打乱,标记是顺手一点的事,不该占两行文字。
 *  文字进 title / aria-label,不靠视觉也读得到。 */
const MARK_ACTIONS: { digit: string; s?: CaseMarkStatus; star?: boolean }[] = [
  { digit: '1', s: 'learning' },
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
            aria-label={label}
            title={`${label} (${a.digit})`}
            onClick={() => (a.star
              ? applyMarks([k], { f: !starred })
              : applyMarks([k], { s: st === a.s ? null : a.s }))}
          >
            {a.star
              ? <Star size={22} className="trainer-mark-btn-star" aria-hidden />
              : <TriangleAlert size={22} aria-hidden />}
          </button>
        );
      })}
    </span>
  );
}

/** case 图上的学习标记角标:右上状态(✓ 已掌握 / ● 不熟),左上星标。 */
export function CaseMarkBadges({ marks, k }: { marks: CaseMarks; k: string }) {
  const st = markStatus(marks, k);
  const starred = markStarred(marks, k);
  if (!st && !starred) return null;
  return (
    <>
      {st && (
        <span className={`trainer-mark-badge is-${st}`} aria-hidden>
          {st === 'mastered' ? <Check size={11} strokeWidth={3.5} /> : null /* learning = 纯色圆点 */}
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
                  <span>{set.toUpperCase()} {set === 'zbll' ? displayZbllToken(top.label) : top.label}</span>
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
                              <span>{set === 'zbll' ? displayZbllToken(subLabel) : subLabel}</span>
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
