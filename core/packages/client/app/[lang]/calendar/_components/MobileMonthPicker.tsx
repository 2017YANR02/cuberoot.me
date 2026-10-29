'use client';

import { Fragment, useLayoutEffect, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import MonthGrid from '@/components/MonthGrid';
import { tr, useLang } from '@/i18n/tr';
import { addDaysToKey, dayKeyIn, type FcEvent } from '../_lib/format';
import { useCalendarSwipe } from '../_lib/useCalendarSwipe';

interface Props {
  monthKey: string;
  selectedKey: string;
  todayKey: string;
  tz: string;
  weekStart: 0 | 1;
  events: FcEvent[];
  onMonth: (key: string) => void;
  onPick: (key: string) => void;
  inert?: boolean;
}

export default function MobileMonthPicker(props: Props) {
  const lang = useLang();
  const [year, month] = props.monthKey.split('-').map(Number);
  const monthDate = DateTime.utc(year, month, 1);
  const monthEnd = monthDate.plus({ months: 1 }).toISODate()!;
  const monthsRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const { onClickCapture, onPageReady } = useCalendarSwipe(rootRef,
    () => props.onMonth(monthDate.minus({ months: 1 }).toISODate()!),
    () => props.onMonth(monthDate.plus({ months: 1 }).toISODate()!));
  useLayoutEffect(() => {
    const strip = monthsRef.current;
    const current = strip?.querySelector<HTMLElement>('[aria-pressed=true]');
    if (strip && current) strip.scrollLeft = current.offsetLeft;
    onPageReady();
  }, [props.monthKey, onPageReady]);
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const day = DateTime.utc(2026, 10, 25).plus({ days: (i + props.weekStart) % 7 });
    return day.setLocale(lang).toFormat('EEEEE');
  });
  // 使用日历已有的无损事件，跨日/全天条目按结束日不包含的约定打点。
  const dots = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const event of props.events) {
      const first = event.allDay ? event.start : dayKeyIn(props.tz, Date.parse(event.start));
      const last = event.allDay
        ? addDaysToKey(event.end, -1)
        : dayKeyIn(props.tz, Math.max(Date.parse(event.start), Date.parse(event.end) - 1));
      for (let key = first < props.monthKey ? props.monthKey : first; key <= last && key < monthEnd; key = addDaysToKey(key, 1)) {
        const colors = result.get(key) ?? [];
        if (colors.length < 3) colors.push(event.backgroundColor);
        result.set(key, colors);
      }
    }
    return result;
  }, [props.events, props.tz, props.monthKey, monthEnd]);

  return (
    <section ref={rootRef} onClickCapture={onClickCapture} id="cal-mobile-month" className="cal-mobile-month" inert={props.inert} aria-label={tr({ zh: '选择日期', en: 'Choose date' })}>
      <MonthGrid
        className="cal-mobile-month-grid cal-swipe-content"
        year={year}
        month={month}
        weekStart={props.weekStart === 1 ? 'mon' : 'sun'}
        weekdays={weekdays}
        today={new Date(`${props.todayKey || '2000-01-01'}T12:00:00`)}
        renderWeekOverlay={(week) => <span className="cal-mobile-week-number">{DateTime.fromJSDate(week.days[props.weekStart === 1 ? 0 : 1]).weekNumber}</span>}
        renderDay={(date, ctx) => {
          if (!ctx.inView) return null;
          const key = DateTime.fromJSDate(date).toISODate()!;
          const colors = dots.get(key) ?? [];
          return (
            <button type="button" data-calendar-day className={`cal-mobile-date${key === props.selectedKey ? ' is-selected' : ''}${key === props.todayKey ? ' is-today' : ''}`}
              aria-label={key} aria-pressed={key === props.selectedKey} aria-current={key === props.todayKey ? 'date' : undefined}
              onClick={() => props.onPick(key)}>
              <span className="cal-mobile-date-number">{date.getDate()}</span>
              <span className="cal-mobile-date-dots" aria-hidden>
                {colors.slice(0, 2).map((color, i) => <i key={i} style={{ background: color }} />)}
                {colors.length > 2 && <span>+</span>}
              </span>
            </button>
          );
        }}
      />
      <nav ref={monthsRef} className="cal-mobile-months" aria-label={tr({ zh: '选择月份', en: 'Choose month' })}>
        {Array.from({ length: 25 }, (_, i) => {
          const date = monthDate.plus({ months: i - 12 });
          return <Fragment key={date.toISODate()}>
            {date.month === 1 && <span className="cal-mobile-year">{date.year}</span>}
            <button type="button" className={`cal-mobile-month-option${i === 12 ? ' is-current' : ''}`} aria-label={date.setLocale(lang).toFormat('yyyy LLLL')} aria-pressed={i === 12} onClick={() => props.onMonth(date.toISODate()!)}>
              {date.setLocale(lang).toFormat('LLL')}
            </button>
          </Fragment>;
        })}
      </nav>
    </section>
  );
}
