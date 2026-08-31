'use client';

import { isValidIsoDate, toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

import { ClearButton } from './ClearButton';
import { usePopoverDismiss } from './usePopoverDismiss';

export interface DateInputLabels {
  clearDate: string;
  chooseDate: string;
  previousMonth: string;
  nextMonth: string;
  year: string;
  month: string;
  monthOption: (month: number) => string;
  weekdays: readonly [string, string, string, string, string, string, string];
  today: string;
  calendarDate: (year: number, month: number, day: number) => string;
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  if (!isValidIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function clampDate(value: string, min?: string, max?: string): string {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

export interface DateInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'children' | 'className' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'value'
> {
  labels: DateInputLabels;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  size?: 'default' | 'compact';
  clearable?: boolean;
  clearAriaLabel?: string;
}

export function DateInput({
  labels,
  value,
  defaultValue = '',
  onChange,
  className,
  placeholder = '',
  size = 'default',
  clearable = true,
  clearAriaLabel,
  disabled,
  readOnly,
  onClick,
  onPointerDown,
  onKeyDown,
  min,
  max,
  ...inputProps
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const initial = parseIsoDate(defaultValue) ?? parseIsoDate(toLocalIsoDate())!;
    return { year: initial.year, month: initial.month };
  });
  const currentValue = (controlled ? value : internalValue) ?? '';
  const minDate = typeof min === 'string' && isValidIsoDate(min) ? min : undefined;
  const maxDate = typeof max === 'string' && isValidIsoDate(max) ? max : undefined;
  const setValue = (nextValue: string) => {
    if (nextValue && (
      !isValidIsoDate(nextValue)
      || (minDate !== undefined && nextValue < minDate)
      || (maxDate !== undefined && nextValue > maxDate)
    )) return;
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  };
  const canClear = clearable && Boolean(currentValue) && !disabled && !readOnly;
  const close = () => setOpen(false);
  usePopoverDismiss(open, close, panelRef, inputRef);

  const openCalendar = () => {
    if (disabled || readOnly) return;
    const anchor = parseIsoDate(clampDate(
      isValidIsoDate(currentValue) ? currentValue : toLocalIsoDate(),
      minDate,
      maxDate,
    ))!;
    setViewMonth({ year: anchor.year, month: anchor.month });
    setOpen(current => !current);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = inputRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const positionPanel = () => {
      const anchor = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const margin = 8;
      const gap = 6;
      const minLeft = viewportLeft + margin;
      const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - panel.offsetWidth - margin);
      const left = Math.min(Math.max(minLeft, anchor.left), maxLeft);
      const below = anchor.bottom + gap;
      const viewportBottom = viewportTop + viewportHeight - margin;
      const top = below + panel.offsetHeight <= viewportBottom
        ? below
        : Math.max(viewportTop + margin, anchor.top - gap - panel.offsetHeight);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    window.visualViewport?.addEventListener('resize', positionPanel);
    window.visualViewport?.addEventListener('scroll', positionPanel);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
      window.visualViewport?.removeEventListener('resize', positionPanel);
      window.visualViewport?.removeEventListener('scroll', positionPanel);
    };
  }, [open]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, 1));
    const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewMonth.year, viewMonth.month, 0)).getUTCDate();
    const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - mondayOffset + 1;
      return day >= 1 && day <= daysInMonth ? day : null;
    });
  }, [viewMonth]);

  const today = toLocalIsoDate();
  const minYear = minDate
    ? Number(minDate.slice(0, 4))
    : Math.min(viewMonth.year, Number(today.slice(0, 4)) - 100);
  const maxYear = maxDate
    ? Number(maxDate.slice(0, 4))
    : Math.max(viewMonth.year, Number(today.slice(0, 4)) + 100);
  const years = Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, index) => minYear + index);
  const monthHasSelectableDay = (year: number, month: number): boolean => {
    const first = isoDate(year, month, 1);
    const last = isoDate(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
    return (!minDate || last >= minDate) && (!maxDate || first <= maxDate);
  };
  const previousMonth = shiftMonth(viewMonth.year, viewMonth.month, -1);
  const nextMonth = shiftMonth(viewMonth.year, viewMonth.month, 1);
  const todaySelectable = (!minDate || today >= minDate) && (!maxDate || today <= maxDate);

  return (
    <span
      className={[
        'date-input',
        `date-input--${size}`,
        canClear ? 'date-input--clearable' : '',
        className,
      ].filter(Boolean).join(' ')}
      data-disabled={disabled ? '' : undefined}
      data-readonly={readOnly ? '' : undefined}
    >
      <span className="date-input__display" aria-hidden="true">
        <Calendar className="date-input__icon" size={15} strokeWidth={1.8} />
        <span className={currentValue ? 'date-input__value' : 'date-input__placeholder'}>
          {currentValue || placeholder}
        </span>
      </span>
      <input
        {...inputProps}
        ref={inputRef}
        className="date-input__native"
        type="date"
        value={currentValue}
        disabled={disabled}
        readOnly={readOnly}
        min={minDate}
        max={maxDate}
        onChange={(event) => setValue(event.target.value)}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (event.defaultPrevented || disabled || readOnly) return;
          event.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
          openCalendar();
        }}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || disabled || readOnly) return;
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || disabled || readOnly) return;
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) openCalendar();
          }
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      />
      {canClear && (
        <ClearButton
          className="date-input__clear"
          ariaLabel={clearAriaLabel ?? labels.clearDate}
          preserveFocus
          onClick={() => setValue('')}
        />
      )}
      {open && createPortal(
        <div
          ref={panelRef}
          className="date-input__calendar"
          role="dialog"
          aria-label={labels.chooseDate}
        >
          <div className="date-input__calendar-header">
            <button
              type="button"
              className="date-input__calendar-nav"
              aria-label={labels.previousMonth}
              disabled={!monthHasSelectableDay(previousMonth.year, previousMonth.month)}
              onClick={() => setViewMonth(previousMonth)}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <select
              className="date-input__calendar-select"
              aria-label={labels.year}
              value={viewMonth.year}
              onChange={(event) => setViewMonth(current => ({ ...current, year: Number(event.target.value) }))}
            >
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <select
              className="date-input__calendar-select"
              aria-label={labels.month}
              value={viewMonth.month}
              onChange={(event) => setViewMonth(current => ({ ...current, month: Number(event.target.value) }))}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
                <option
                  key={month}
                  value={month}
                  disabled={!monthHasSelectableDay(viewMonth.year, month)}
                >
                  {labels.monthOption(month)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="date-input__calendar-nav"
              aria-label={labels.nextMonth}
              disabled={!monthHasSelectableDay(nextMonth.year, nextMonth.month)}
              onClick={() => setViewMonth(nextMonth)}
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="date-input__calendar-grid" role="grid">
            {labels.weekdays.map((weekday, index) => (
              <span key={`${index}-${weekday}`} className="date-input__calendar-weekday" role="columnheader">
                {weekday}
              </span>
            ))}
            {calendarDays.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
              const date = isoDate(viewMonth.year, viewMonth.month, day);
              const unavailable = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
              const selected = date === currentValue;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={labels.calendarDate(viewMonth.year, viewMonth.month, day)}
                  className={[
                    'date-input__calendar-day',
                    selected ? 'is-selected' : '',
                    date === today ? 'is-today' : '',
                  ].filter(Boolean).join(' ')}
                  disabled={unavailable}
                  onClick={() => {
                    setValue(date);
                    close();
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="date-input__calendar-today"
            disabled={!todaySelectable}
            onClick={() => {
              setValue(today);
              close();
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            {labels.today}
          </button>
        </div>,
        document.body,
      )}
    </span>
  );
}
