'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  initialTimer333Comparison,
  scheduleTimer333Comparison,
  TIMER_333_COMPARISON_COPY,
  timer333ComparisonRows,
  type MethodId,
} from '@cuberoot/puzzle-solvers/timer-333-step';
import MoreToggle from './MoreToggle';
import { TimerRoomDialog } from './TimerRoomDialog';
import '@cuberoot/shared/timer/solo-stage.css';

interface Props {
  scramble: string;
  isZh: boolean;
  onClose: () => void;
}

export default function TimerSolverCompareModal(props: Props) {
  return <SolverComparison key={props.scramble} {...props} />;
}

function SolverComparison({ scramble, isZh, onClose }: Props) {
  const language = isZh ? 'zh' : 'en';
  const [outcomes, setOutcomes] = useState(initialTimer333Comparison);
  const [busy, setBusy] = useState(true);
  const [openId, setOpenId] = useState<MethodId | null>(null);

  useEffect(() => scheduleTimer333Comparison(scramble,
    outcome => setOutcomes(previous => previous.map(current => current.id === outcome.id ? outcome : current)),
    () => setBusy(false),
    run => {
      const timer = setTimeout(run, 0);
      return () => clearTimeout(timer);
    },
    () => performance.now()), [scramble]);

  const rows = useMemo(() => timer333ComparisonRows(outcomes, language), [outcomes, language]);

  return (
    <TimerRoomDialog className="timer-solver-compare" overlayClassName="solver-compare-overlay"
      language={language} title={TIMER_333_COMPARISON_COPY.title[language]} onClose={onClose}>
      <div className="solver-compare-content">
        <div className="solver-compare-scramble">{scramble}</div>
        {busy && <div className="solver-compare-status" role="status">{TIMER_333_COMPARISON_COPY.loading[language]}</div>}
        <div className="solver-compare-grid">
          {rows.map(row => {
            const open = openId === row.id;
            const heading = <>
              <span className="solver-compare-name">{row.name}</span>
              <span className="solver-compare-total">{row.totalLabel}</span>
            </>;
            return <div key={row.id} className={row.best ? 'solver-compare-card is-best' : 'solver-compare-card'}>
              <div className="solver-compare-head solver-compare-static-head">{heading}</div>
              <MoreToggle className="solver-compare-head solver-compare-toggle" expanded={open}
                onClick={() => setOpenId(open ? null : row.id)}>
                {heading}
              </MoreToggle>
              <div className={open ? 'solver-compare-detail is-open' : 'solver-compare-detail'}>
                {row.error && <div className="solver-compare-error">{row.error}</div>}
                {row.stages.map(stage => <div key={stage.key} className="solver-compare-stage">
                  <span className="solver-compare-label">{stage.label}</span>
                  <span className="solver-compare-count">{stage.countLabel}</span>
                  <span className="solver-compare-moves">{stage.moveText}</span>
                </div>)}
                {row.elapsedLabel && <div className="solver-compare-time">{row.elapsedLabel}</div>}
              </div>
            </div>;
          })}
        </div>
      </div>
    </TimerRoomDialog>
  );
}
