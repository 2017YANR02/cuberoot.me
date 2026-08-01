'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Solve, Penalty } from '../_lib/types';
import { formatEventMs, formatMs, formatSolveResult, isMbldDnf, mbldPoints } from '../_lib/stats';
import CubePreview from '../_lib/cube/CubePreview';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import { onIdle } from '@/lib/on-idle';

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
  onOpenReconstruct?: () => void;
  /** Other sessions this solve can be moved into (excludes the active one). */
  moveTargets?: { id: string; name: string }[];
  onMoveToSession?: (targetSessionId: string) => void;
}

export default function SolveModal({ solve, index, isZh, onClose, onChangePenalty, onChangeComment, onDelete, onOpenReconstruct, moveTargets, onMoveToSession }: Props) {
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

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  // The reconstruction names its OLL and PLL case, and those names come from
  // lookup tables built by walking the whole alg set through cubing.js — two
  // fetches and a few thousand parses. Built on demand it lands exactly when
  // the panel opens and makes it unscrollable for a beat; built now, while the
  // solve modal is being read, it is already there. Only for solves that have
  // a move stream, since only those have a reconstruction to open.
  const hasMoves = (solve.moves?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasMoves) return;
    return onIdle(() => {
      void import('@/lib/oll_lookup').then((m) => { m.prewarmOllTable(); });
      void import('@/lib/pll_lookup').then((m) => { m.prewarmPllTable(); });
    });
  }, [hasMoves]);

  const dt = new Date(solve.ts);

  const overlayStyle = isMobile ? { padding: 8 } : undefined;
  const modalStyle = isMobile
    ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' }
    : undefined;
  const textareaStyle = isMobile
    ? ({ width: '100%', minHeight: 88, fontSize: 15, lineHeight: 1.5, boxSizing: 'border-box' as const })
    : undefined;
  const actionsStyle = isMobile
    ? ({ flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: 10 })
    : undefined;
  const actionBtnStyle = isMobile
    ? ({ minHeight: 44, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' })
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
          <div>{tr({ zh: '原始时间', en: 'Raw time'
        })}: {formatEventMs(solve.event, solve.timeMs)}</div>
          <div>{tr({ zh: '日期', en: 'Date' })}: {dt.toLocaleString()}</div>
        </div>
        <div className="modal-section">
          <div>{tr({ zh: '打乱', en: 'Scramble'
        })}:</div>
          <div className="scramble-text">{solve.scramble}</div>
        </div>
        <div className="modal-section modal-cube-row">
          <CubePreview event={solve.event} scramble={solve.scramble} size={14} />
        </div>
        {solve.stages && (
          <div className="modal-section">
            <h3 className="settings-h3">{tr({ zh: '分阶段成绩', en: 'Stage splits'
            })}</h3>
            <StageSplits stages={solve.stages} isZh={isZh} totalMs={solve.timeMs} />
          </div>
        )}
        {solve.bld && (
          <div className="modal-section">
            <h3 className="settings-h3">{tr({ zh: '记忆 / 执行', en: 'Memo / Execution'
            })}</h3>
            <BldSplits bld={solve.bld} isZh={isZh} totalMs={solve.timeMs} />
          </div>
        )}
        {solve.mbld && (
          <div className="modal-section">
            <h3 className="settings-h3">{tr({ zh: '多盲成绩', en: 'Multi-Blind result' })}</h3>
            <MbldBreakdown solve={solve} />
          </div>
        )}
        <div className="modal-section">
          <label>
            {tr({ zh: '注释', en: 'Comment'
            })}
            <textarea
              className="comment-textarea"
              value={comment}
              rows={3}
              style={textareaStyle}
              onChange={(e) => setComment(e.target.value)}
              onFocus={() => setEditing(true)}
              onBlur={() => {
                setEditing(false);
                if (comment !== (solve.comment ?? '')) onChangeComment(comment);
              }}
              placeholder={tr({ zh: '记录此次成绩的备注…', en: 'Notes for this solve…'
            })}
            />
          </label>
        </div>
        {moveTargets && moveTargets.length > 0 && onMoveToSession && (
          <div className="modal-section">
            <div className="solve-move-row">
              <span className="solve-move-label">{tr({ zh: '移到分组', en: 'Move to session'
            })}</span>
              <select
                className="solve-move-select"
                value=""
                onChange={(e) => { const id = e.target.value; if (id) onMoveToSession(id); }}
              >
                <option value="">{tr({ zh: '选择分组…', en: 'Choose…'
                })}</option>
                {moveTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="modal-actions" style={actionsStyle}>
          <button
            ref={firstButtonRef}
            className={solve.penalty === 'ok' ? 'modal-action-btn primary' : 'modal-action-btn'}
            style={actionBtnStyle}
            onClick={() => onChangePenalty('ok')}
          >
            OK
          </button>
          <button
            className={solve.penalty === '+2' ? 'modal-action-btn primary' : 'modal-action-btn'}
            style={actionBtnStyle}
            onClick={() => onChangePenalty('+2')}
          >
            +2
          </button>
          <button
            className={solve.penalty === 'DNF' ? 'modal-action-btn primary' : 'modal-action-btn'}
            style={actionBtnStyle}
            onClick={() => onChangePenalty('DNF')}
          >
            DNF
          </button>
          <button
            className={solve.penalty === 'DNS' ? 'modal-action-btn primary' : 'modal-action-btn'}
            style={actionBtnStyle}
            onClick={() => onChangePenalty('DNS')}
            title={tr({ zh: '未开始（DNS）— 与 DNF 同样计入平均', en: 'Did Not Start — scored like a DNF in every average' })}
          >
            DNS
          </button>
          {solve.moves && solve.moves.length > 0 && onOpenReconstruct && (
            <button className="modal-action-btn" style={actionBtnStyle} onClick={onOpenReconstruct}>
              {tr({ zh: '查看复盘', en: 'View reconstruct'
            })}
            </button>
          )}
          <button className="danger modal-action-btn" style={actionBtnStyle} onClick={onDelete}>
            {tr({ zh: '删除', en: 'Delete'
            })}
          </button>
          <button className="modal-action-btn" style={actionBtnStyle} onClick={onClose}>{tr({ zh: '关闭', en: 'Close'
        })}</button>
        </div>
      </div>
    </div>
  );
}
