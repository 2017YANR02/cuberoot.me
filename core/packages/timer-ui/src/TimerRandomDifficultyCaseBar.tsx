'use client';

import { stageLabel, uiVariantOf, variantLabel } from '@cuberoot/shared/timer';
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

const COPY = {
  answer: { en: 'Answer', zh: '答案' },
  error: { en: 'Could not solve.', zh: '求解失败。' },
  hide: { en: 'Hide', zh: '收起' },
  moves: { en: 'moves', zh: '步' },
  retry: { en: 'Retry', zh: '重试' },
  solving: { en: 'Solving', zh: '求解中' },
} as const;

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

  const stage = stageLabel(spec.stage, language === 'zh');
  const uiVariant = uiVariantOf(spec.variant);
  const methodName = uiVariant === 'std' ? '' : variantLabel(uiVariant, language === 'zh');
  const method = methodName && !stage.startsWith(methodName) ? `${methodName} ` : '';
  const depthLabel = language === 'zh'
    ? `${depth} ${text(COPY.moves)}`
    : `${depth} move${depth === 1 ? '' : 's'}`;

  return (
    <div
      className="trainer-case"
      data-no-timer
      onClick={(event) => event.stopPropagation()}
    >
      <span className="trainer-case-what">
        {method}{stage}
        <span className="trainer-case-depth">{depthLabel}</span>
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
