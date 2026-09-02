'use client';

import {
  OLL_CASES,
  PLL_CASES,
  TIMER_DRILL_PICKER_COPY,
  type TimerDrillTarget,
  type TimerDrillType,
  type TimerTrainerCase,
} from '@cuberoot/shared/timer';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { ClearButton } from './ClearButton';
import { modalFocusableElements } from './modal-focus';
import { TimerPillToggle } from './TimerPillToggle';

export interface TimerDrillPickerProps {
  activeCase?: TimerDrillTarget | null;
  initialType?: TimerDrillType;
  language: 'en' | 'zh';
  onClose(): void;
  onExit(): void;
  onPick(target: TimerDrillTarget): void;
}

interface DrillGroup {
  readonly cases: readonly TimerTrainerCase[];
  readonly key: string;
  readonly name: string;
}

/** The single OLL/PLL drill picker shared by Web and every installed React host. */
export function TimerDrillPicker({
  activeCase,
  initialType,
  language,
  onClose,
  onExit,
  onPick,
}: TimerDrillPickerProps) {
  const [type, setType] = useState<TimerDrillType>(activeCase?.type ?? initialType ?? 'oll');
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFirst = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      (modalFocusableElements(dialog)[0] ?? dialog).focus();
    };
    const frame = requestAnimationFrame(focusFirst);
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', onDocumentKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onDocumentKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = previousBodyOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const groups = useMemo<readonly DrillGroup[]>(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (item: TimerTrainerCase) => !normalized || [
      item.id,
      item.name,
    ].some((value) => value?.toLowerCase().includes(normalized));
    if (type === 'pll') {
      return [{ cases: PLL_CASES.filter(matches), key: 'pll', name: '' }];
    }
    const grouped = new Map<string, TimerTrainerCase[]>();
    for (const item of OLL_CASES) {
      if (!matches(item)) continue;
      const name = item.group ?? '';
      const cases = grouped.get(name);
      if (cases) cases.push(item);
      else grouped.set(name, [item]);
    }
    return [...grouped].map(([name, cases]) => ({ cases, key: name, name }));
  }, [query, type]);

  const total = type === 'oll' ? OLL_CASES.length : PLL_CASES.length;
  const matchCount = groups.reduce((count, group) => count + group.cases.length, 0);
  const activeId = activeCase?.type === type ? activeCase.id : null;
  const copy = TIMER_DRILL_PICKER_COPY;

  const selectType = (next: TimerDrillType) => {
    setType(next);
    setQuery('');
  };

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
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

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="timer-drill-picker__backdrop"
      data-no-timer
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="timer-drill-picker__dialog"
        data-no-timer
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="timer-drill-picker__title" id={titleId}>
          {copy.title[language]}
          <span className="timer-drill-picker__count">({total})</span>
        </h2>

        <div className="timer-drill-picker__toolbar">
          <span data-drill-type={type}>
            <TimerPillToggle
              ariaLabel={copy.typeLabel[language]}
              offLabel="PLL"
              onChange={(oll) => selectType(oll ? 'oll' : 'pll')}
              onLabel="OLL"
              value={type === 'oll'}
            />
          </span>
          {activeCase && (
            <button
              className="timer-drill-picker__button timer-drill-picker__button--exit"
              onClick={() => {
                onExit();
                onCloseRef.current();
              }}
              type="button"
            >
              {copy.exit[language]} ({activeCase.id})
            </button>
          )}
        </div>

        <div className="timer-drill-picker__search-wrap">
          <input
            aria-label={copy.searchLabel[language]}
            className="timer-drill-picker__search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder[type][language]}
            type="search"
            value={query}
          />
          {query && (
            <ClearButton
              ariaLabel={copy.clearSearch[language]}
              onClick={() => setQuery('')}
              preserveFocus
            />
          )}
        </div>

        <div className="timer-drill-picker__body">
          {matchCount === 0 ? (
            <div className="timer-drill-picker__empty" role="status">
              {copy.noMatches[language]}
            </div>
          ) : groups.map((group) => (
            <section className="timer-drill-picker__group" key={group.key}>
              {group.name && (
                <h3 className="timer-drill-picker__group-title">{group.name}</h3>
              )}
              <div className="timer-drill-picker__grid">
                {group.cases.map((item) => {
                  const active = item.id === activeId;
                  const caseLabel = type === 'oll' ? item.id.replace(/^OLL /, '') : item.name ?? item.id;
                  const accessibleLabel = item.name && item.name !== item.id
                    ? `${item.id} — ${item.name}`
                    : item.id;
                  return (
                    <button
                      aria-label={accessibleLabel}
                      aria-pressed={active}
                      className="timer-drill-picker__case"
                      data-drill-case={item.id}
                      key={item.id}
                      onClick={() => {
                        onPick({ id: item.id, type });
                        onCloseRef.current();
                      }}
                      title={item.id}
                      type="button"
                    >
                      {caseLabel}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="timer-drill-picker__actions">
          <button
            className="timer-drill-picker__button"
            onClick={() => onCloseRef.current()}
            type="button"
          >
            {copy.close[language]}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
