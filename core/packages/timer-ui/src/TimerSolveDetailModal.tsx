'use client';

import {
  formatEventMs,
  formatMs,
  formatSolveResult,
  isMbldDnf,
  mbldPoints,
  sliceReconstruction,
  timerSolveDetailActionStates,
  timerSolveDetailBldTimes,
  timerSolveDetailStageRows,
  type Penalty,
  type Solve,
  type TimerHistoryLocalizedText,
  type TimerSolveDetailActionId,
  type TimerSolveDetailStageId,
} from '@cuberoot/shared/timer';
import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { modalFocusableElements } from './modal-focus';
import { TimerHistoryCommentEditor } from './TimerHistoryRow';
import { TimerReconstructMetrics } from './TimerReconstructMetrics';

const COPY = {
  attempted: { en: 'Attempted', zh: '已尝试' },
  chooseSession: { en: 'Choose…', zh: '选择分组…' },
  close: { en: 'Close', zh: '关闭' },
  comment: { en: 'Comment', zh: '注释' },
  commentPlaceholder: { en: 'Notes for this solve…', zh: '记录此次成绩的备注…' },
  cross: { en: 'Cross', zh: '十字' },
  date: { en: 'Date', zh: '日期' },
  delete: { en: 'Delete', zh: '删除' },
  execution: { en: 'Execution', zh: '执行' },
  memo: { en: 'Memo', zh: '记忆' },
  memoExecution: { en: 'Memo / Execution', zh: '记忆 / 执行' },
  moveToSession: { en: 'Move to session', zh: '移到分组' },
  multiBlindResult: { en: 'Multi-Blind result', zh: '多盲成绩' },
  netScore: { en: 'Net score', zh: '净得分' },
  noPenalty: { en: 'None', zh: '无' },
  penalty: { en: 'Penalty', zh: '罚时' },
  penaltyHelp: {
    en: 'DNS = did not start — scored like a DNF in every average',
    zh: 'DNS = 未开始，和 DNF 一样计入平均',
  },
  rawTime: { en: 'Raw time', zh: '原始时间' },
  rule9f12c: {
    en: 'Scored DNF by Regulation 9f12c: net score below 0, or only 1 puzzle solved.',
    zh: '按规则 9f12c 记 DNF：净得分小于 0，或只还原了 1 个魔方。',
  },
  scramble: { en: 'Scramble', zh: '打乱' },
  solved: { en: 'Solved', zh: '已还原' },
  stageSplits: { en: 'Stage splits', zh: '分阶段成绩' },
  time: { en: 'Time', zh: '用时' },
  total: { en: 'Total', zh: '总计' },
  unsolved: { en: 'Unsolved', zh: '未还原' },
} as const satisfies Record<string, TimerHistoryLocalizedText>;

const STAGE_COPY: Readonly<Record<TimerSolveDetailStageId, TimerHistoryLocalizedText>> = {
  cross: COPY.cross,
  f2l: { en: 'F2L', zh: 'F2L' },
  oll: { en: 'OLL', zh: 'OLL' },
  pll: { en: 'PLL', zh: 'PLL' },
};

export interface TimerSolveDetailModalProps {
  autoFocusComment?: boolean;
  formatDate?: (timestamp: number) => string;
  index: number;
  localize: (copy: TimerHistoryLocalizedText) => string;
  moveTargets?: readonly { id: string; name: string }[];
  onChangeComment?: (comment: string) => void;
  onChangePenalty?: (penalty: Penalty) => void;
  onClose: () => void;
  onDelete?: () => void;
  onMoveToSession?: (targetSessionId: string) => void;
  preview?: ReactNode;
  /** Host-owned reconstruction/report slot. Timer UI never imports Web code. */
  report?: ReactNode;
  solve: Solve;
}

function SplitTable({
  rows,
  total,
  totalLabel,
}: {
  rows: readonly {
    cumulativeMs: number | null;
    durationMs: number | null;
    id: TimerSolveDetailStageId;
    label: string;
  }[];
  total: string;
  totalLabel: string;
}) {
  return (
    <div className="timer-solve-detail-split-table">
      {rows.map((row) => (
        <div className="timer-solve-detail-split-row" key={row.id}>
          <span className="timer-solve-detail-split-name">{row.label}</span>
          <span>{row.durationMs === null ? '—' : formatMs(row.durationMs)}</span>
          <span className="timer-solve-detail-split-cumulative">
            {row.cumulativeMs === null ? '—' : formatMs(row.cumulativeMs)}
          </span>
        </div>
      ))}
      <div className="timer-solve-detail-split-row timer-solve-detail-split-total">
        <span className="timer-solve-detail-split-name">{totalLabel}</span>
        <span />
        <span className="timer-solve-detail-split-cumulative">{total}</span>
      </div>
    </div>
  );
}

export function TimerSolveDetailModal({
  autoFocusComment = false,
  formatDate = (timestamp) => new Date(timestamp).toLocaleString(),
  index,
  localize,
  moveTargets = [],
  onChangeComment,
  onChangePenalty,
  onClose,
  onDelete,
  onMoveToSession,
  preview,
  report,
  solve,
}: TimerSolveDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const titleId = useId();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const penaltyRef = useRef<HTMLSelectElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const full = report !== undefined;
  const reconstructionMetrics = !full && solve.moves?.length
    ? sliceReconstruction(solve.moves, solve.timeMs, solve.bld?.memoMs)
    : null;
  const actionStates = timerSolveDetailActionStates({
    canChangePenalty: !!onChangePenalty,
    canClose: true,
    canComment: !!onChangeComment,
    canDelete: !!onDelete,
    canMove: !!onMoveToSession,
    moveTargetCount: moveTargets.length,
  });
  const action = (id: TimerSolveDetailActionId) => actionStates.find((state) => state.id === id)!;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    (autoFocusComment ? commentRef.current : penaltyRef.current)?.focus({ preventScroll: true });
    return () => {
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [autoFocusComment]);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      if (!editing) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = modalFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const penalty = (
    <label className="timer-solve-detail-penalty">
      <span>{localize(COPY.penalty)}</span>
      <select
        data-history-action-id="solve.detail.penalty"
        disabled={action('solve.detail.penalty').disabled}
        onChange={(event) => onChangePenalty?.(event.target.value as Penalty)}
        ref={penaltyRef}
        title={localize(COPY.penaltyHelp)}
        value={solve.penalty}
      >
        <option value="ok">{localize(COPY.noPenalty)}</option>
        <option value="+2">+2</option>
        <option value="DNF">DNF</option>
        <option value="DNS">DNS</option>
      </select>
    </label>
  );

  const stageRows = timerSolveDetailStageRows(solve);
  const bld = timerSolveDetailBldTimes(solve);
  const splitSections = (
    <>
      {stageRows.length > 0 && (
        <section className="timer-solve-detail-section">
          <h3>{localize(COPY.stageSplits)}</h3>
          <SplitTable
            rows={stageRows.map((row) => ({
              ...row,
              label: localize(STAGE_COPY[row.id]),
            }))}
            total={formatMs(Math.max(0, solve.timeMs))}
            totalLabel={localize(COPY.total)}
          />
        </section>
      )}
      {bld && (
        <section className="timer-solve-detail-section">
          <h3>{localize(COPY.memoExecution)}</h3>
          <div className="timer-solve-detail-split-table">
            <div className="timer-solve-detail-split-row">
              <span className="timer-solve-detail-split-name">{localize(COPY.memo)}</span>
              <span>{formatMs(bld.memoMs)}</span>
              <span className="timer-solve-detail-split-cumulative">{formatMs(bld.memoMs)}</span>
            </div>
            <div className="timer-solve-detail-split-row">
              <span className="timer-solve-detail-split-name">{localize(COPY.execution)}</span>
              <span>{formatMs(bld.executionMs)}</span>
              <span className="timer-solve-detail-split-cumulative">{formatMs(bld.totalMs)}</span>
            </div>
            <div className="timer-solve-detail-split-row timer-solve-detail-split-total">
              <span className="timer-solve-detail-split-name">{localize(COPY.total)}</span>
              <span />
              <span className="timer-solve-detail-split-cumulative">{formatMs(bld.totalMs)}</span>
            </div>
          </div>
        </section>
      )}
      {solve.mbld && (() => {
        const unsolved = solve.mbld.attempted - solve.mbld.solved;
        const points = mbldPoints(solve) ?? 0;
        return (
          <section className="timer-solve-detail-section">
            <h3>{localize(COPY.multiBlindResult)}</h3>
            <div className="timer-solve-detail-split-table">
              {([
                { id: 'solved', label: COPY.solved, value: String(solve.mbld.solved) },
                { id: 'unsolved', label: COPY.unsolved, value: String(unsolved) },
                { id: 'attempted', label: COPY.attempted, value: String(solve.mbld.attempted) },
                { id: 'score', label: COPY.netScore, value: `${solve.mbld.solved} − ${unsolved} = ${points}` },
              ] as const).map((row) => (
                <div className="timer-solve-detail-split-row" key={row.id}>
                  <span className="timer-solve-detail-split-name">{localize(row.label)}</span>
                  <span />
                  <span className="timer-solve-detail-split-cumulative">{row.value}</span>
                </div>
              ))}
              <div className="timer-solve-detail-split-row timer-solve-detail-split-total">
                <span className="timer-solve-detail-split-name">{localize(COPY.time)}</span>
                <span />
                <span className="timer-solve-detail-split-cumulative">{formatMs(solve.timeMs, 0)}</span>
              </div>
            </div>
            {isMbldDnf(solve) && <p className="timer-solve-detail-warning">{localize(COPY.rule9f12c)}</p>}
          </section>
        );
      })()}
    </>
  );

  const comment = (
    <section className="timer-solve-detail-section">
      <label className="timer-solve-detail-comment">
        <span>{localize(COPY.comment)}</span>
        <TimerHistoryCommentEditor
          ariaLabel={localize(COPY.comment)}
          disabled={action('solve.detail.comment').disabled}
          onBlurSave={(value) => onChangeComment?.(value)}
          onEditingChange={setEditing}
          placeholder={localize(COPY.commentPlaceholder)}
          ref={commentRef}
          value={solve.comment}
        />
      </label>
    </section>
  );

  const move = action('solve.detail.move-session').visible ? (
    <section className="timer-solve-detail-section">
      <label className="timer-solve-detail-move">
        <span>{localize(COPY.moveToSession)}</span>
        <select
          data-history-action-id="solve.detail.move-session"
          disabled={action('solve.detail.move-session').disabled}
          onChange={(event) => {
            if (event.target.value) onMoveToSession?.(event.target.value);
          }}
          value=""
        >
          <option value="">{localize(COPY.chooseSession)}</option>
          {moveTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
        </select>
      </label>
    </section>
  ) : null;

  const remove = (
    <button
      className="timer-solve-detail-action timer-solve-detail-danger"
      data-history-action-id="solve.detail.delete"
      disabled={action('solve.detail.delete').disabled}
      onClick={onDelete}
      type="button"
    >{localize(COPY.delete)}</button>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className={`timer-solve-detail-overlay${full ? ' timer-solve-detail-overlay--full' : ''}`}
      data-no-timer
      onClick={full ? undefined : onClose}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`timer-solve-detail-modal${full ? ' timer-solve-detail-modal--full' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {full ? (
          <>
            <header className="timer-solve-detail-full-head">
              <div className="timer-solve-detail-inner">
                <h2 id={titleId}>#{index + 1}</h2>
                <time dateTime={new Date(solve.ts).toISOString()}>{formatDate(solve.ts)}</time>
                {penalty}
                <button
                  aria-label={localize(COPY.close)}
                  className="timer-solve-detail-close"
                  data-history-action-id="solve.detail.close"
                  onClick={onClose}
                  type="button"
                ><X aria-hidden="true" size={16} /></button>
              </div>
            </header>
            <div className="timer-solve-detail-full-body">
              <div className="timer-solve-detail-inner">
                {report}
                {splitSections}
                {comment}
                {move}
                <div className="timer-solve-detail-actions timer-solve-detail-actions--start">{remove}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId}>
              #{index + 1} · {formatSolveResult(solve)}
              {solve.penalty === '+2' && ' (+2)'}
            </h2>
            <section className="timer-solve-detail-section">
              <div>{localize(COPY.rawTime)}: {formatEventMs(solve.event, solve.timeMs)}</div>
              <div>{localize(COPY.date)}: {formatDate(solve.ts)}</div>
            </section>
            <section className="timer-solve-detail-section">{penalty}</section>
            <section className="timer-solve-detail-section">
              <div>{localize(COPY.scramble)}:</div>
              <div className="timer-solve-detail-scramble">{solve.scramble}</div>
            </section>
            {preview && <section className="timer-solve-detail-preview">{preview}</section>}
            {reconstructionMetrics && (
              <TimerReconstructMetrics localize={localize} metrics={reconstructionMetrics} />
            )}
            {splitSections}
            {comment}
            {move}
            <div className="timer-solve-detail-actions">
              {remove}
              <button
                className="timer-solve-detail-action"
                data-history-action-id="solve.detail.close"
                onClick={onClose}
                type="button"
              >{localize(COPY.close)}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
