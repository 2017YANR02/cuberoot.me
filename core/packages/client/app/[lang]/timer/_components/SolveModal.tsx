'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Solve, Penalty } from '../_lib/types';
import { formatEventMs, formatMs, formatSolveResult, isMbldDnf, mbldPoints } from '../_lib/stats';
import CubePreview from '../_lib/cube/CubePreview';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import { onIdle } from '@/lib/on-idle';

/** 复盘报告。整份报告 200 KB 起步(还牵三维魔方和 cubing.js),而没录动作的那些
 *  成绩根本不渲染它 —— 所以留在自己的 chunk 里,别拖累「点一条成绩」这一下。 */
const ReconstructReport = dynamic(() => import('./ReconstructReport'), { ssr: false });

function BldSplits({ bld, totalMs }: { bld: NonNullable<Solve['bld']>; isZh: boolean; totalMs: number }) {
  const memo = bld.memoMs;
  const exec = totalMs - memo;
  return (
    <div className="stage-splits-table">
      <div className="stage-row">
        <span className="stage-name">{tr({ zh: '记忆', en: 'Memo'
        })}</span>
        <span className="stage-dur">{formatMs(memo)}</span>
        <span className="stage-cum">{formatMs(memo)}</span>
      </div>
      <div className="stage-row">
        <span className="stage-name">{tr({ zh: '执行', en: 'Execution'
        })}</span>
        <span className="stage-dur">{formatMs(exec)}</span>
        <span className="stage-cum">{formatMs(totalMs)}</span>
      </div>
      <div className="stage-row stage-total">
        <span className="stage-name">{tr({ zh: '总计', en: 'Total'
        })}</span>
        <span className="stage-dur"></span>
        <span className="stage-cum">{formatMs(totalMs)}</span>
      </div>
    </div>
  );
}

function StageSplits({ stages, totalMs }: { stages: NonNullable<Solve['stages']>; isZh: boolean; totalMs: number }) {
  const cross = stages.cross;
  const f2l = stages.f2l;
  const oll = stages.oll;
  const pll = stages.pll;
  const crossDur = cross !== undefined ? cross : null;
  const f2lDur = (f2l !== undefined && cross !== undefined) ? f2l - cross : (f2l !== undefined ? f2l : null);
  const ollDur = (oll !== undefined && f2l !== undefined) ? oll - f2l : (oll !== undefined && cross !== undefined ? oll - cross : (oll !== undefined ? oll : null));
  const pllDur = oll !== undefined ? pll - oll : (f2l !== undefined ? pll - f2l : (cross !== undefined ? pll - cross : pll));

  const rows: Array<{ name: string; cum: number | undefined; dur: number | null }> = [
    { name: tr({ zh: '十字', en: 'Cross' }), cum: cross, dur: crossDur },
    { name: 'F2L',                    cum: f2l,   dur: f2lDur },
    { name: 'OLL',                    cum: oll,   dur: ollDur },
    { name: 'PLL',                    cum: pll,   dur: pllDur },
  ];
  return (
    <div className="stage-splits-table">
      {rows.map(r => (
        <div className="stage-row" key={r.name}>
          <span className="stage-name">{r.name}</span>
          <span className="stage-dur">{r.dur !== null ? formatMs(r.dur) : '—'}</span>
          <span className="stage-cum">{r.cum !== undefined ? formatMs(r.cum) : '—'}</span>
        </div>
      ))}
      <div className="stage-row stage-total">
        <span className="stage-name">{tr({ zh: '总计', en: 'Total'
        })}</span>
        <span className="stage-dur"></span>
        <span className="stage-cum">{formatMs(totalMs)}</span>
      </div>
    </div>
  );
}

/**
 * MBLD breakdown. The modal title already shows the WCA result string via
 * `formatSolveResult`; this spells out the arithmetic behind it, and names
 * 9f12c when the attempt is voided by the rule rather than by a penalty.
 */
function MbldBreakdown({ solve }: { solve: Solve }) {
  const m = solve.mbld;
  if (!m) return null;
  const points = mbldPoints(solve) ?? 0;
  const unsolved = m.attempted - m.solved;
  const rows: Array<{ name: string; value: string }> = [
    { name: tr({ zh: '已还原', en: 'Solved' }), value: String(m.solved) },
    { name: tr({ zh: '未还原', en: 'Unsolved' }), value: String(unsolved) },
    { name: tr({ zh: '已尝试', en: 'Attempted' }), value: String(m.attempted) },
    { name: tr({ zh: '净得分', en: 'Net score' }), value: `${m.solved} − ${unsolved} = ${points}` },
  ];
  return (
    <div className="stage-splits-table">
      {rows.map(r => (
        <div className="stage-row" key={r.name}>
          <span className="stage-name">{r.name}</span>
          <span className="stage-dur"></span>
          <span className="stage-cum">{r.value}</span>
        </div>
      ))}
      <div className="stage-row stage-total">
        <span className="stage-name">{tr({ zh: '用时', en: 'Time' })}</span>
        <span className="stage-dur"></span>
        <span className="stage-cum">{formatMs(solve.timeMs, 0)}</span>
      </div>
      {isMbldDnf(solve) && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--signal-warning)' }}>
          {tr({
            zh: '按规则 9f12c 记 DNF：净得分小于 0，或只还原了 1 个魔方。',
            en: 'Scored DNF by Regulation 9f12c: net score below 0, or only 1 puzzle solved.',
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  solve: Solve;
  index: number;
  isZh: boolean;
  onClose: () => void;
  onChangePenalty: (p: Penalty) => void;
  onChangeComment: (text: string) => void;
  onDelete: () => void;
  /** Same-event history, for the report's per-stage personal averages. */
  history?: Solve[];
  /** Load this solve's scramble into the timer (and close — the timer is
   *  behind this page). Omitted where there is no timer to load into. */
  onUseScramble?: (scramble: string) => void;
  /** "Is this reconstruction right?" — see ReconstructReport. */
  onReconFeedback?: (ok: boolean | undefined) => void;
  /** Other sessions this solve can be moved into (excludes the active one). */
  moveTargets?: { id: string; name: string }[];
  onMoveToSession?: (targetSessionId: string) => void;
}

export default function SolveModal({
  solve, index, isZh, onClose, onChangePenalty, onChangeComment, onDelete,
  history, onUseScramble, onReconFeedback, moveTargets, onMoveToSession,
}: Props) {
  const [comment, setComment] = useState(solve.comment ?? '');
  const [editing, setEditing] = useState(false);
  const titleId = useId();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile(480);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  // preventScroll: the report below can be several screens tall, and focusing a
  // button that happens to sit under it would scroll past everything.
  useEffect(() => {
    firstButtonRef.current?.focus({ preventScroll: true });
  }, []);

  // 复盘报告就在这一屏上(2026-08-02 起不再是「查看复盘」那一下),所以它自己的
  // chunk 一挂载就在下载了。这里补的是它**下面**那几层 —— 不补的话又是一条串行
  // 瀑布,每层都得等上层先执行起来才开始下载(2026-08-01 dev 实测,resource timing):
  //
  //   挂载 ─┬─ 125ms ── 报告自己的 chunk(211 KB)───────────────── 916ms
  //         └─ 要等它开始执行 ─┬─ 719ms ── oll/pll 查找表 chunk ── 405ms
  //                            │            └─ 再等它去取 /oll /pll 公式库
  //                            └─ 1252ms ── SimCubeView → three + cubing.js
  //
  // 合计 ~1.5s 才齐活,而且 chunk 编译是主线程的活 —— 这正是用户说过的「面板出来
  // 了但拉不动进度条」:画面在,主线程在编译。
  //
  // 提前发同样几个 import(),三层同时下载,轮到渲染时模块已在注册表里,dynamic
  // 直接命中。都是 import 幂等,不会多下一份。查找表还要再走一遍 cubing.js 解析,
  // 所以额外调 prewarm 把表也建好(见 lib/build-yield.ts)。
  //
  // 只对有动作流的成绩做 —— 报告本来就只在那时才渲染。
  const hasMoves = (solve.moves?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasMoves) return;
    return onIdle(() => {
      void import('@/components/sim-embed/SimCubeView');
      void import('@/components/sim-embed/mountSimWorld');
      void import('@/lib/oll_lookup').then((m) => { m.prewarmOllTable(); });
      void import('@/lib/pll_lookup').then((m) => { m.prewarmPllTable(); });
      // timeout 卡在 500ms:真闲下来就立刻拉,一直不闲也别等满两秒 —— 报告本体
      // 已经在路上了,这几层等太久就白等。
    }, { timeout: 500 });
  }, [hasMoves]);

  const dt = new Date(solve.ts);

  const penaltyButtons = (
    <>
      <button
        ref={firstButtonRef}
        className={solve.penalty === 'ok' ? 'modal-action-btn primary' : 'modal-action-btn'}
        onClick={() => onChangePenalty('ok')}
      >
        OK
      </button>
      <button
        className={solve.penalty === '+2' ? 'modal-action-btn primary' : 'modal-action-btn'}
        onClick={() => onChangePenalty('+2')}
      >
        +2
      </button>
      <button
        className={solve.penalty === 'DNF' ? 'modal-action-btn primary' : 'modal-action-btn'}
        onClick={() => onChangePenalty('DNF')}
      >
        DNF
      </button>
      <button
        className={solve.penalty === 'DNS' ? 'modal-action-btn primary' : 'modal-action-btn'}
        onClick={() => onChangePenalty('DNS')}
        title={tr({ zh: '未开始（DNS）— 与 DNF 同样计入平均', en: 'Did Not Start — scored like a DNF in every average' })}
      >
        DNS
      </button>
    </>
  );

  const scrambleSection = (
    <div className="modal-section">
      <div>{tr({ zh: '打乱', en: 'Scramble' })}:</div>
      <div className="scramble-text">{solve.scramble}</div>
    </div>
  );

  const cubeRow = (
    <div className="modal-section modal-cube-row">
      <CubePreview event={solve.event} scramble={solve.scramble} size={14} />
    </div>
  );

  const splitSections = (
    <>
      {solve.stages && (
        <div className="modal-section">
          <h3 className="settings-h3">{tr({ zh: '分阶段成绩', en: 'Stage splits' })}</h3>
          <StageSplits stages={solve.stages} isZh={isZh} totalMs={solve.timeMs} />
        </div>
      )}
      {solve.bld && (
        <div className="modal-section">
          <h3 className="settings-h3">{tr({ zh: '记忆 / 执行', en: 'Memo / Execution' })}</h3>
          <BldSplits bld={solve.bld} isZh={isZh} totalMs={solve.timeMs} />
        </div>
      )}
      {solve.mbld && (
        <div className="modal-section">
          <h3 className="settings-h3">{tr({ zh: '多盲成绩', en: 'Multi-Blind result' })}</h3>
          <MbldBreakdown solve={solve} />
        </div>
      )}
    </>
  );

  const commentSection = (
    <div className="modal-section">
      <label>
        {tr({ zh: '注释', en: 'Comment' })}
        <textarea
          className="comment-textarea"
          value={comment}
          rows={3}
          style={isMobile
            ? ({ width: '100%', minHeight: 88, fontSize: 15, lineHeight: 1.5, boxSizing: 'border-box' as const })
            : undefined}
          onChange={(e) => setComment(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false);
            if (comment !== (solve.comment ?? '')) onChangeComment(comment);
          }}
          placeholder={tr({ zh: '记录此次成绩的备注…', en: 'Notes for this solve…' })}
        />
      </label>
    </div>
  );

  const moveSection = moveTargets && moveTargets.length > 0 && onMoveToSession ? (
    <div className="modal-section">
      <div className="solve-move-row">
        <span className="solve-move-label">{tr({ zh: '移到分组', en: 'Move to session' })}</span>
        <select
          className="solve-move-select"
          value=""
          onChange={(e) => { const id = e.target.value; if (id) onMoveToSession(id); }}
        >
          <option value="">{tr({ zh: '选择分组…', en: 'Choose…' })}</option>
          {moveTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </div>
  ) : null;

  /**
   * 有动作流的那些成绩:详情和复盘是**同一页**,整屏铺开。
   *
   * 以前复盘藏在「查看复盘」后面 —— 多一下点击,而且那一下要先知道有这个东西。
   * 录了动作的成绩,报告就是这一页的主体,罚时/注释这些围着它转,所以标题栏吸顶
   * (OK/+2/DNF 随时够得着),下面一路是报告本体。
   */
  if (hasMoves) {
    return (
      <div className="timer-modal-overlay solve-full-overlay">
        <div
          className="timer-modal solve-full-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="solve-full-head">
            <div className="solve-full-inner">
              <h2 id={titleId}>#{index + 1}</h2>
              <span className="solve-full-when">{dt.toLocaleString()}</span>
              <div className="modal-actions solve-full-penalties">{penaltyButtons}</div>
              <button
                type="button"
                className="solver-modal-x solve-full-x"
                onClick={onClose}
                aria-label={tr({ zh: '关闭', en: 'Close' })}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="solve-full-body">
            <div className="solve-full-inner">
              <ReconstructReport
                solve={solve}
                isZh={isZh}
                history={history}
                hideDate
                onUseScramble={onUseScramble && ((s) => { onUseScramble(s); onClose(); })}
                onReconFeedback={onReconFeedback}
              />

              {/* 这里不再摆打乱和打乱图(2026-08-03):打乱已经是谱子的第一行
                  (StepMoveList),摆两遍等于让人怀疑是不是两条不一样的;而打乱图
                  是给「拿手拧」用的 —— 智能魔方这把已经拧完了,那张图没有读者,
                  却占着一屏。手动计时的成绩(下面那个分支)照旧两样都有。 */}
              {splitSections}
              {commentSection}
              {moveSection}

              {/* 整屏这一形态里内容整体靠左,一个孤零零右浮的删除会脱队。 */}
              <div className="modal-actions solve-full-danger">
                <button className="danger modal-action-btn" onClick={onDelete}>
                  {tr({ zh: '删除', en: 'Delete' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 没录动作的成绩(手动计时 / 键盘计时):没有报告可看,还是那个小弹窗。
  const overlayStyle = isMobile ? { padding: 8 } : undefined;
  const modalStyle = isMobile
    ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' }
    : undefined;
  const actionsStyle = isMobile
    ? ({ flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: 10 })
    : undefined;

  return (
    <div className="timer-modal-overlay" style={overlayStyle} onClick={onClose}>
      <div
        className="timer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          #{index + 1} · {formatSolveResult(solve)}
          {solve.penalty === '+2' && ' (+2)'}
        </h2>
        <div className="modal-section">
          <div>{tr({ zh: '原始时间', en: 'Raw time' })}: {formatEventMs(solve.event, solve.timeMs)}</div>
          <div>{tr({ zh: '日期', en: 'Date' })}: {dt.toLocaleString()}</div>
        </div>
        {scrambleSection}
        {cubeRow}
        {splitSections}
        {commentSection}
        {moveSection}
        <div className={`modal-actions${isMobile ? ' solve-actions-stacked' : ''}`} style={actionsStyle}>
          {penaltyButtons}
          <button className="danger modal-action-btn" onClick={onDelete}>
            {tr({ zh: '删除', en: 'Delete' })}
          </button>
          <button className="modal-action-btn" onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
        </div>
      </div>
    </div>
  );
}
