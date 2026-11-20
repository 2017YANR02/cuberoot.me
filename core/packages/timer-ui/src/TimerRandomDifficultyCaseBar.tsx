'use client';

import { TIMER_RANDOM_DIFFICULTY_CASE_COPY as COPY, timerRandomDifficultyCaseLabels } from '@cuberoot/shared/timer/random-difficulty';
import { trainerSpecKey, type TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';
import { useEffect, useRef, useState } from 'react';

import type { TimerUiLanguage } from './TimerColorSubsetPicker';

export interface TimerRandomDifficultySolution {
  frame: string;
  notation: string;
}

export interface TimerRandomDifficultyCaseBarProps {
  disabled?: boolean;
  depth: number;
  language: TimerUiLanguage;
  occurrenceKey: number | string;
  solve(signal: AbortSignal): Promise<TimerRandomDifficultySolution | null>;
  spec: TrainerSpec;
}

/** The exact difficulty case/answer row shared by every timer host. */
export function TimerRandomDifficultyCaseBar({
  disabled = false,
  depth,
  language,
  occurrenceKey,
  solve,
  spec,
}: TimerRandomDifficultyCaseBarProps) {
  const [solution, setSolution] = useState<TimerRandomDifficultySolution | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const text = (copy: Readonly<Record<TimerUiLanguage, string>>) => copy[language];
  const caseKey = `${occurrenceKey}|${language}|${trainerSpecKey(spec)}`;

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    requestRef.current += 1;
    setSolution(null);
    setShown(false);
    setBusy(false);
    setFailed(false);
    return () => {
      requestRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [caseKey]);

  useEffect(() => {
    if (!disabled) return;
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
  }, [disabled]);

  const reveal = async () => {
    if (disabled) return;
    if (solution) {
      setShown((value) => !value);
      return;
    }
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setFailed(false);
    try {
      const result = await solve(controller.signal);
      if (controller.signal.aborted || requestId !== requestRef.current) return;
      if (!result) {
        setFailed(true);
        return;
      }
      setSolution(result);
      setShown(true);
    } catch {
      if (!controller.signal.aborted && requestId === requestRef.current) setFailed(true);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (requestId === requestRef.current) {
        setBusy(false);
      }
    }
  };

  const labels = timerRandomDifficultyCaseLabels(spec, depth, language);

  return (
    <div
      className="trainer-case"
      data-no-timer
      onClick={(event) => event.stopPropagation()}
    >
      <span className="trainer-case-what">
        {labels.label}
        <span className="trainer-case-depth">{labels.depth}</span>
      </span>
      <button
        className="trainer-case-reveal"
        disabled={disabled || busy}
        onClick={(event) => { event.stopPropagation(); void reveal(); }}
        type="button"
      >
        {busy
          ? text(COPY.solving)
          : shown ? text(COPY.hide) : failed ? text(COPY.retry) : text(COPY.answer)}
      </button>
      {failed && <span className="trainer-case-error" role="status">{text(COPY.error)}</span>}
      {shown && solution && (
        <span className="trainer-case-sol">
          {solution.frame && <span className="trainer-case-frame">{solution.frame}</span>}
          {solution.notation}
        </span>
      )}
    </div>
  );
}
