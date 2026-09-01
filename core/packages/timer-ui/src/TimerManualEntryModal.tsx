import {
  checkTimerFmcSolvedness,
  createTimerManualEntryDraft,
  validateTimerManualEntry,
  type EventId,
  type Penalty,
  type TimerFmcSolvedness,
  type TimerManualEntryCopy,
  type TimerManualEntryDraft,
  type TimerManualEntryValue,
} from '@cuberoot/shared/timer';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { modalFocusableElements } from './modal-focus';

export type TimerManualEntryLabels = TimerManualEntryCopy;

export interface TimerManualEntryModalProps {
  currentScramble: string;
  event: EventId;
  labels: TimerManualEntryLabels;
  onClose(): void;
  onSubmit(value: TimerManualEntryValue): void;
}

type FmcLiveStatus = 'idle' | 'checking' | TimerFmcSolvedness;

export function TimerManualEntryModal({
  currentScramble,
  event,
  labels,
  onClose,
  onSubmit,
}: TimerManualEntryModalProps) {
  const [draft, setDraft] = useState<TimerManualEntryDraft>(() => (
    createTimerManualEntryDraft(event, currentScramble)
  ));
  const [fmcStatus, setFmcStatus] = useState<FmcLiveStatus>('idle');
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const errorId = useId();
  const penaltyName = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    setDraft((current) => ({ ...current, currentScramble, event }));
  }, [currentScramble, event]);

  const validation = useMemo(() => validateTimerManualEntry(draft), [draft]);
  const effectiveScramble = draft.scramble.trim() || draft.currentScramble;

  useEffect(() => {
    const parsed = validation.fmc;
    if (!parsed || parsed.kind !== 'parsed') {
      setFmcStatus('idle');
      return;
    }
    let cancelled = false;
    setFmcStatus('checking');
    void checkTimerFmcSolvedness(effectiveScramble, parsed)
      .then((status) => {
        if (!cancelled) setFmcStatus(status);
      })
      .catch(() => {
        if (!cancelled) setFmcStatus('unchecked');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveScramble, validation.fmc]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const patchDraft = (patch: Partial<TimerManualEntryDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const touched = validation.kind === 'time'
    ? draft.time.length > 0
    : validation.kind === 'fmc'
      ? draft.fmcSolution.length + draft.fmcMoveCount.length > 0
      : draft.mbldSolved.length + draft.mbldAttempted.length + draft.time.length > 0;
  const visibleError = touched && validation.error !== null
    && !(validation.error === 'fmc-solution-invalid' && validation.fmc?.kind === 'invalid')
    ? labels.error(validation.error)
    : null;

  const onDialogKeyDown = (keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) => {
    // A modal interaction must never leak through to the host timer's global
    // key bindings (Space/number shortcuts).
    keyboardEvent.stopPropagation();
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      onCloseRef.current();
      return;
    }
    if (keyboardEvent.key !== 'Tab' || !dialogRef.current) return;
    const focusable = modalFocusableElements(dialogRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="timer-manual-entry__overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="timer-manual-entry__dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <h2 id={titleId}>{labels.title}</h2>

        {validation.kind === 'fmc' ? (
          <div className="timer-manual-entry__section">
            <label className="timer-manual-entry__label">
              {labels.fmcSolution}
              <textarea
                aria-describedby={validation.fmc?.kind === 'invalid' ? errorId : undefined}
                aria-invalid={validation.fmc?.kind === 'invalid' || undefined}
                className="timer-manual-entry__textarea timer-manual-entry__textarea--fmc"
                data-autofocus
                onChange={(inputEvent) => patchDraft({ fmcSolution: inputEvent.target.value })}
                placeholder={labels.fmcSolutionPlaceholder}
                rows={3}
                spellCheck={false}
                value={draft.fmcSolution}
              />
            </label>
            <FmcStatus
              errorId={errorId}
              labels={labels}
              parse={validation.fmc}
              status={fmcStatus}
            />
            <label className="timer-manual-entry__label timer-manual-entry__label--spaced">
              {labels.fmcMoveCount}
              <input
                aria-describedby={visibleError ? errorId : undefined}
                aria-invalid={visibleError ? true : undefined}
                className="timer-manual-entry__input"
                inputMode="numeric"
                onChange={(inputEvent) => patchDraft({ fmcMoveCount: inputEvent.target.value })}
                placeholder={validation.fmc?.kind === 'parsed'
                  ? String(validation.fmc.count)
                  : labels.fmcMoveCountPlaceholder}
                type="text"
                value={draft.fmcMoveCount}
              />
            </label>
            {visibleError && <div className="timer-manual-entry__error" id={errorId} role="status">{visibleError}</div>}
          </div>
        ) : validation.kind === 'mbld' ? (
          <div className="timer-manual-entry__section">
            <div className="timer-manual-entry__mbld-counts">
              <label className="timer-manual-entry__label">
                {labels.solved}
                <input
                  aria-describedby={visibleError ? errorId : undefined}
                  aria-invalid={visibleError ? true : undefined}
                  className="timer-manual-entry__input"
                  data-autofocus
                  inputMode="numeric"
                  onChange={(inputEvent) => patchDraft({ mbldSolved: inputEvent.target.value })}
                  placeholder={labels.solvedPlaceholder}
                  type="text"
                  value={draft.mbldSolved}
                />
              </label>
              <label className="timer-manual-entry__label">
                {labels.attempted}
                <input
                  aria-describedby={visibleError ? errorId : undefined}
                  aria-invalid={visibleError ? true : undefined}
                  className="timer-manual-entry__input"
                  inputMode="numeric"
                  onChange={(inputEvent) => patchDraft({ mbldAttempted: inputEvent.target.value })}
                  placeholder={labels.attemptedPlaceholder}
                  type="text"
                  value={draft.mbldAttempted}
                />
              </label>
            </div>
            <label className="timer-manual-entry__label timer-manual-entry__label--spaced">
              {labels.mbldTime}
              <input
                aria-describedby={visibleError ? errorId : undefined}
                aria-invalid={visibleError ? true : undefined}
                className="timer-manual-entry__input"
                onChange={(inputEvent) => patchDraft({ time: inputEvent.target.value })}
                placeholder={labels.mbldTimePlaceholder}
                type="text"
                value={draft.time}
              />
            </label>
            {validation.mbld ? (
              <div
                className={`timer-manual-entry__status timer-manual-entry__status--${validation.mbld.dnf ? 'warning' : 'success'}`}
                role="status"
              >
                {validation.mbld.result}
                {' · '}
                {labels.mbldPoints(validation.mbld.points)}
                {validation.mbld.dnf && <> · {labels.mbldDnf}</>}
              </div>
            ) : visibleError ? (
              <div className="timer-manual-entry__error" id={errorId} role="status">{visibleError}</div>
            ) : null}
          </div>
        ) : (
          <div className="timer-manual-entry__section">
            <label className="timer-manual-entry__label">
              {labels.time}
              <input
                aria-describedby={visibleError ? errorId : undefined}
                aria-invalid={visibleError ? true : undefined}
                className="timer-manual-entry__input"
                data-autofocus
                onChange={(inputEvent) => patchDraft({ time: inputEvent.target.value })}
                placeholder={labels.timePlaceholder}
                type="text"
                value={draft.time}
              />
            </label>
            {visibleError && <div className="timer-manual-entry__error" id={errorId} role="status">{visibleError}</div>}
          </div>
        )}

        {validation.kind === 'time' && (
          <fieldset className="timer-manual-entry__section timer-manual-entry__penalty">
            <legend className="timer-manual-entry__label">{labels.penalty}</legend>
            <div className="timer-manual-entry__radios">
              {(['ok', '+2', 'DNF', 'DNS'] as Penalty[]).map((penalty) => (
                <label className="timer-manual-entry__radio" key={penalty}>
                  <input
                    checked={draft.penalty === penalty}
                    name={penaltyName}
                    onChange={() => patchDraft({ penalty })}
                    type="radio"
                    value={penalty}
                  />
                  {penalty === 'ok' ? 'OK' : penalty}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="timer-manual-entry__section">
          <label className="timer-manual-entry__label">
            {labels.scramble}
            <textarea
              className="timer-manual-entry__textarea"
              onChange={(inputEvent) => patchDraft({ scramble: inputEvent.target.value })}
              placeholder={currentScramble}
              rows={2}
              value={draft.scramble}
            />
          </label>
        </div>

        <div className="timer-manual-entry__section">
          <label className="timer-manual-entry__label">
            {validation.kind === 'fmc' ? labels.fmcComment : labels.comment}
            <textarea
              className="timer-manual-entry__textarea"
              onChange={(inputEvent) => patchDraft({ comment: inputEvent.target.value })}
              placeholder={labels.commentPlaceholder}
              rows={2}
              value={draft.comment}
            />
          </label>
        </div>

        <div className="timer-manual-entry__actions">
          <button
            className="timer-manual-entry__action timer-manual-entry__action--primary"
            disabled={validation.value === null}
            onClick={() => {
              if (validation.value) onSubmit(validation.value);
            }}
            type="button"
          >
            {labels.save}
          </button>
          <button className="timer-manual-entry__action" onClick={onClose} type="button">{labels.cancel}</button>
        </div>
      </div>
    </div>
  );
}

function FmcStatus({
  errorId,
  labels,
  parse,
  status,
}: {
  errorId: string;
  labels: TimerManualEntryLabels;
  parse: ReturnType<typeof validateTimerManualEntry>['fmc'];
  status: FmcLiveStatus;
}) {
  if (!parse || parse.kind === 'empty') return null;
  if (parse.kind === 'invalid') {
    return <div className="timer-manual-entry__error" id={errorId} role="status">{labels.fmcInvalidToken(parse.token)}</div>;
  }
  let text: string;
  if (status === 'solved') text = labels.fmcSolved(parse.count);
  else if (status === 'unsolved') text = labels.fmcUnsolved(parse.count);
  else if (status === 'unchecked') text = labels.fmcUnchecked(parse.count);
  else text = labels.fmcChecking(parse.count);
  return (
    <div
      className={`timer-manual-entry__status timer-manual-entry__status--${status === 'solved' ? 'success' : status === 'unsolved' ? 'warning' : 'neutral'}`}
      role="status"
    >
      {text}
    </div>
  );
}
