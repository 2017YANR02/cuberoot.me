'use client';

import {
  formatEventMs,
  type EventId,
  type RollingStatKey,
  type RollingStatProjection,
} from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';

export interface TimerHistoryColumnsHeaderProps {
  picker?: ReactNode;
  resultLabel: string;
}

/** Shared header shell; the host injects the already-shared persisted picker. */
export function TimerHistoryColumnsHeader({
  picker,
  resultLabel,
}: TimerHistoryColumnsHeaderProps) {
  return (
    <div className={['timer-history-columns-head', picker ? 'has-rolling' : ''].filter(Boolean).join(' ')}>
      <span className="idx">#</span>
      <span>{resultLabel}</span>
      {picker && <div className="timer-history-columns-picker">{picker}</div>}
    </div>
  );
}

export interface TimerHistoryDayDividerProps {
  countLabel: string;
  day: string;
}

export function TimerHistoryDayDivider({ countLabel, day }: TimerHistoryDayDividerProps) {
  return (
    <h2 aria-label={`${day}, ${countLabel}`} className="timer-history-day-divider">
      <time dateTime={day}>{day}</time>
      <span>{countLabel}</span>
    </h2>
  );
}

export interface TimerHistoryRollingCellsProps {
  columns: readonly RollingStatKey[];
  event: EventId;
  index: number;
  projection: RollingStatProjection;
}

/** Values and strict running PB markers for one canonical history row. */
export function TimerHistoryRollingCells({
  columns,
  event,
  index,
  projection,
}: TimerHistoryRollingCellsProps) {
  if (columns.length === 0) return null;
  return (
    <span className="timer-history-rolling-cells">
      {columns.map((key) => {
        const point = projection.get(key)?.[index];
        const value = formatEventMs(event, point?.value ?? null);
        const label = `; ${key}: ${value}${point?.isPb ? ', PB' : ''}`;
        return (
          <span aria-label={label} className="hao timer-history-rolling-cell" data-stat={key} key={key}>
            <span aria-hidden="true">{value}</span>
            {point?.isPb && <span aria-hidden="true" className="timer-history-rolling-pb">PB</span>}
          </span>
        );
      })}
    </span>
  );
}
