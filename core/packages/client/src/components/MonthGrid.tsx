import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type WeekStart = 'mon' | 'sun';

export interface MonthWeek {
  days: Date[];
}

export interface DayCtx {
  inView: boolean;
  isToday: boolean;
  /** 周行索引(0..N-1) */
  weekIdx: number;
  /** 周内列索引(0..6) */
  dayIdx: number;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function gridStartFor(year: number, month0: number, weekStart: WeekStart): Date {
  const first = new Date(year, month0, 1);
  const dow = first.getDay(); // Sun=0..Sat=6
  const offset = weekStart === 'mon' ? (dow + 6) % 7 : dow;
  return addDays(first, -offset);
}

/** 计算给定月份 1-12 的周行数组。周一起始,padding 前后跨月日期凑满整周;
 *  生成最多 6 行,最后一行如果整行都在下月则省略(与 CalendarPage 行为一致)。 */
export function getMonthWeeks(year: number, month: number, weekStart: WeekStart = 'mon'): MonthWeek[] {
  const month0 = month - 1;
  const gridStart = gridStartFor(year, month0, weekStart);
  const monthEnd = new Date(year, month0 + 1, 0);
  const weeks: MonthWeek[] = [];
  for (let w = 0; w < 6; w++) {
    const weekStartDate = addDays(gridStart, w * 7);
    if (w >= 4 && weekStartDate > monthEnd) break;
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStartDate, i));
    weeks.push({ days });
  }
  return weeks;
}

export interface MonthGridProps {
  year: number;
  /** 1-12 */
  month: number;
  weekStart?: WeekStart;
  /** 长度 7,顺序与 weekStart 对应 */
  weekdays: ReactNode[];
  renderDay: (date: Date, ctx: DayCtx) => ReactNode;
  /** 给 day-cell 加额外 class / 事件(role/tabIndex/onClick 等);compact 模式让整格可点击时用 */
  dayCellProps?: (date: Date, ctx: DayCtx) => Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'> | undefined;
  renderWeekOverlay?: (week: MonthWeek, weekIdx: number) => ReactNode;
  weekRowStyle?: (week: MonthWeek, weekIdx: number) => CSSProperties | undefined;
  className?: string;
  today?: Date;
  /** 透传到外层 .calendar div(动画/触摸/点击拦截/style 等);不要在这里设 className,用上面的 className prop */
  outerProps?: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;
}

export default function MonthGrid({
  year,
  month,
  weekStart = 'mon',
  weekdays,
  renderDay,
  dayCellProps,
  renderWeekOverlay,
  weekRowStyle,
  className,
  today,
  outerProps,
}: MonthGridProps) {
  const month0 = month - 1;
  const weeks = getMonthWeeks(year, month, weekStart);
  const todayDate = today ?? new Date();
  return (
    <div {...outerProps} className={`calendar${className ? ` ${className}` : ''}`}>
      <div className="weekday-header">
        {weekdays.map((d, i) => (
          <div key={i} className="weekday-cell">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="week-row" style={weekRowStyle?.(week, wi)}>
          {week.days.map((day, di) => {
            const inView = day.getMonth() === month0;
            const isToday = inView && sameDay(day, todayDate);
            const ctx: DayCtx = { inView, isToday, weekIdx: wi, dayIdx: di };
            const extra = dayCellProps?.(day, ctx);
            const baseClass = `day-cell${inView ? '' : ' out-of-month'}${isToday ? ' is-today' : ''}`;
            const mergedClass = extra?.className ? `${baseClass} ${extra.className}` : baseClass;
            return (
              <div
                key={di}
                {...extra}
                className={mergedClass}
                style={{ gridColumn: di + 1, gridRow: 1 }}
              >
                {renderDay(day, ctx)}
              </div>
            );
          })}
          {renderWeekOverlay?.(week, wi)}
        </div>
      ))}
    </div>
  );
}
