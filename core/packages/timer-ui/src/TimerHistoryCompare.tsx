'use client';

import {
  buildTimerHistoryComparison,
  compareMbld,
  effectiveMs,
  type Solve,
  type TimerHistoryCompareStageKey,
  type TimerHistoryCompareStageValue,
} from '@cuberoot/shared/timer';
import { ArrowRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface TimerHistoryCompareLabels {
  bBetter: string;
  bWorse: string;
  cancel: string;
  close: string;
  compareSelected: string;
  delta: string;
  deltaDirection: string;
  eventName(solve: Solve): string;
  greenMeansBetter: string;
  htm: string;
  locale: string;
  moves: string;
  noStageA: string;
  noStageB: string;
  noStageBoth: string;
  selected(count: number): string;
  stage: Readonly<Record<TimerHistoryCompareStageKey, string>>;
  tie: string;
  title: string;
  total: string;
  tps: string;
}

export function TimerHistoryCompareStatus({
  count,
  labels,
}: {
  count: number;
  labels: TimerHistoryCompareLabels;
}) {
  return <div className="timer-history-compare-status" role="status">{labels.selected(count)}</div>;
}

export function TimerHistoryCompareActions({
  canCompare,
  labels,
  onCancel,
  onCompare,
}: {
  canCompare: boolean;
  labels: TimerHistoryCompareLabels;
  onCancel(): void;
  onCompare(): void;
}) {
  return (
    <div className="timer-history-compare-actions">
      <button className="timer-history-compare-action" onClick={onCancel} type="button">
        {labels.cancel}
      </button>
      <button
        className="timer-history-compare-action timer-history-compare-action--primary"
        disabled={!canCompare}
        onClick={onCompare}
        type="button"
      >
        {labels.compareSelected}
      </button>
    </div>
  );
}

function fmtStage(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(2)}s`;
}

function fmtNumber(value: number | null): string {
  return value === null ? '—' : value.toFixed(2);
}

function Delta({
  a,
  b,
  higherIsBetter = false,
  suffix = '',
  tie,
  tieThreshold = 0,
}: {
  a: number | null;
  b: number | null;
  higherIsBetter?: boolean;
  suffix?: string;
  tie: string;
  tieThreshold?: number;
}) {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return <>—</>;
  const difference = b - a;
  if (difference === 0 || (tieThreshold > 0 && Math.abs(difference) < tieThreshold)) {
    return <span className="timer-history-compare-delta--tie">{tie}</span>;
  }
  const better = higherIsBetter ? difference > 0 : difference < 0;
  return (
    <span className={`timer-history-compare-delta--${better ? 'faster' : 'slower'}`}>
      {difference > 0 ? '+' : '−'}{Math.abs(difference).toFixed(suffix === 's' ? 2 : suffix ? 0 : 2)}{suffix}
    </span>
  );
}

function TimeDelta({
  a,
  b,
  tie,
}: {
  a: number | null;
  b: number | null;
  tie: string;
}) {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return <>—</>;
  const difference = b - a;
  if (Math.abs(difference) < 5) {
    return <span className="timer-history-compare-delta--tie">{tie}</span>;
  }
  return (
    <span className={`timer-history-compare-delta--${difference < 0 ? 'faster' : 'slower'}`}>
      {difference > 0 ? '+' : '−'}{(Math.abs(difference) / 1000).toFixed(2)}s
    </span>
  );
}

function StageSide({ caseChanged, labels, value }: {
  caseChanged: boolean;
  labels: TimerHistoryCompareLabels;
  value: TimerHistoryCompareStageValue;
}) {
  return (
    <>
      <strong>{fmtStage(value.ms)}</strong>
      <span>{value.htm === null ? '—' : `${value.htm} ${labels.htm} · ${fmtNumber(value.tps)} ${labels.tps}`}</span>
      {value.caseLabel && (
        <span className={caseChanged ? 'timer-history-compare-case--changed' : undefined}>
          {value.caseLabel}
        </span>
      )}
    </>
  );
}

function StageDelta({
  a,
  b,
  labels,
}: {
  a: TimerHistoryCompareStageValue;
  b: TimerHistoryCompareStageValue;
  labels: TimerHistoryCompareLabels;
}) {
  return (
    <>
      <TimeDelta a={a.ms} b={b.ms} tie={labels.tie} />
      <span>{labels.htm} <Delta a={a.htm} b={b.htm} suffix={` ${labels.htm}`} tie={labels.tie} /></span>
      <span>{labels.tps} <Delta a={a.tps} b={b.tps} higherIsBetter tie={labels.tie} tieThreshold={0.05} /></span>
    </>
  );
}

function Summary({
  date,
  dateTime,
  event,
  label,
  result,
}: {
  date: string;
  dateTime: string;
  event: string;
  label: string;
  result: string;
}) {
  return (
    <div className="timer-history-compare-summary">
      <span>{label} · {event}</span>
      <strong>{result}</strong>
      <time dateTime={dateTime}>{date}</time>
    </div>
  );
}

function compareResult(solve: Solve, result: string): string {
  return solve.penalty === '+2' ? `${result} (+2)` : result;
}

function TotalResultDelta({
  labels,
  solveA,
  solveB,
}: {
  labels: TimerHistoryCompareLabels;
  solveA: Solve;
  solveB: Solve;
}) {
  if (solveA.event !== solveB.event) return <>—</>;
  if (solveA.event === '333mbld') {
    if (!solveA.mbld || !solveB.mbld) return <>—</>;
    const rank = compareMbld(solveB, solveA);
    if (rank === 0) return <span className="timer-history-compare-delta--tie">{labels.tie}</span>;
    return (
      <span className={`timer-history-compare-delta--${rank < 0 ? 'faster' : 'slower'}`}>
        {rank < 0 ? labels.bBetter : labels.bWorse}
      </span>
    );
  }
  const a = effectiveMs(solveA);
  const b = effectiveMs(solveB);
  if (solveA.event === '333fm') {
    return <Delta a={a / 1000} b={b / 1000} suffix={` ${labels.moves}`} tie={labels.tie} />;
  }
  return <TimeDelta a={a} b={b} tie={labels.tie} />;
}

export function TimerHistoryCompareModal({
  labels,
  onClose,
  solveA,
  solveB,
}: {
  labels: TimerHistoryCompareLabels;
  onClose(): void;
  solveA: Solve;
  solveB: Solve;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;
  const comparison = useMemo(
    () => buildTimerHistoryComparison(solveA, solveB),
    [solveA, solveB],
  );
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(labels.locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }), [labels.locale]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;
  const missing = !comparison.a.stageSegments && !comparison.b.stageSegments
    ? labels.noStageBoth
    : !comparison.a.stageSegments ? labels.noStageA
      : !comparison.b.stageSegments ? labels.noStageB : null;

  return createPortal(
    <div className="timer-history-compare-backdrop" onClick={() => onCloseRef.current()}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="timer-history-compare-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <h2 id={titleId}>{labels.title}</h2>
        <div className="timer-history-compare-summaries">
          <Summary
            date={dateFormatter.format(solveA.ts)}
            dateTime={new Date(solveA.ts).toISOString()}
            event={labels.eventName(solveA)}
            label="A"
            result={compareResult(solveA, comparison.a.result)}
          />
          <Summary
            date={dateFormatter.format(solveB.ts)}
            dateTime={new Date(solveB.ts).toISOString()}
            event={labels.eventName(solveB)}
            label="B"
            result={compareResult(solveB, comparison.b.result)}
          />
          <div className="timer-history-compare-summary">
            <span>{labels.deltaDirection}</span>
            <strong><TotalResultDelta labels={labels} solveA={solveA} solveB={solveB} /></strong>
          </div>
        </div>

        {missing && <p className="timer-history-compare-empty">{missing}</p>}

        <div className="timer-history-compare-table">
          {comparison.stages.map((stage) => {
            const caseChanged = stage.a.caseLabel !== null
              && stage.b.caseLabel !== null
              && stage.a.caseLabel !== stage.b.caseLabel;
            return (
              <section className="timer-history-compare-row" key={stage.key}>
                <h3><span className={`timer-history-compare-dot timer-history-compare-dot--${stage.key}`} />{labels.stage[stage.key]}</h3>
                <div className="timer-history-compare-cell"><b>A</b><StageSide caseChanged={caseChanged} labels={labels} value={stage.a} /></div>
                <div className="timer-history-compare-cell"><b>B</b><StageSide caseChanged={caseChanged} labels={labels} value={stage.b} /></div>
                <div className="timer-history-compare-cell timer-history-compare-cell--delta"><b>{labels.delta}</b><StageDelta a={stage.a} b={stage.b} labels={labels} /></div>
              </section>
            );
          })}
          <section className="timer-history-compare-row timer-history-compare-row--total">
            <h3>{labels.total}</h3>
            <div className="timer-history-compare-cell"><b>A</b><strong>{comparison.a.totalHtm === null ? '—' : `${comparison.a.totalHtm} ${labels.htm}`}</strong><span>{fmtNumber(comparison.a.totalTps)} {labels.tps}</span></div>
            <div className="timer-history-compare-cell"><b>B</b><strong>{comparison.b.totalHtm === null ? '—' : `${comparison.b.totalHtm} ${labels.htm}`}</strong><span>{fmtNumber(comparison.b.totalTps)} {labels.tps}</span></div>
            <div className="timer-history-compare-cell timer-history-compare-cell--delta"><b>{labels.delta}</b><span>{labels.htm} <Delta a={comparison.a.totalHtm} b={comparison.b.totalHtm} suffix={` ${labels.htm}`} tie={labels.tie} /></span><span>{labels.tps} <Delta a={comparison.a.totalTps} b={comparison.b.totalTps} higherIsBetter tie={labels.tie} tieThreshold={0.05} /></span></div>
          </section>
        </div>

        <div className="timer-history-compare-legend">
          <span>A</span><ArrowRight aria-hidden="true" size={12} /><span>B</span><span>{labels.greenMeansBetter}</span>
        </div>
        <div className="timer-history-compare-close">
          <button className="timer-history-compare-action" onClick={() => onCloseRef.current()} ref={closeRef} type="button">
            {labels.close}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
