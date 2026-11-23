'use client';

// 日历网格 —— FullCalendar 的薄封装。站内已经用它渲染比赛赛程(wca/comp/[slug]/
// ScheduleCalendar),这里补齐月 / 年 / 日程视图和交互插件,皮肤在 calendar.css 里按
// 主题 token 重写成 Google 日历那副样子。
//
// 只做「画 + 把交互回调翻译成业务事件」,不碰数据 —— 展开、落库都在上层。

import { forwardRef, useCallback, useEffect, useEffectEvent, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import './calendar-grid.css';
import type { CalendarOptions, EventInput, DateSelectArg, EventClickArg, EventDropArg, DatesSetArg, FormatterInput } from '@fullcalendar/core';
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
// 光写 locale="zh-cn" 不够 —— 语言包得真的加载进来,否则 allDayText / moreLinkText /
// noEventsText 静默退回英文(「all-day」「+2 more」混在中文表头里)。
import zhCn from '@fullcalendar/core/locales/zh-cn';
import { useCalendarSwipe } from '@/hooks/useCalendarSwipe';
import { DateTime } from 'luxon';
import { EVENT_STATUS_LABELS, VIEW_KEYS, VIEW_LABELS, formatClock, type ViewKey } from '@/lib/calendar-format';
import { tr } from '@/i18n/tr';

export interface GridRange {
  start: number;
  end: number;
  /** 视图锚点(FullCalendar 的 currentStart) */
  anchor: number;
}

export interface GridHandle {
  today: () => void;
  prev: () => void;
  next: () => void;
  gotoDate: (ms: number) => void;
}

interface KeyboardShortcuts {
  enabled: () => boolean;
  onViewChange: (view: ViewKey) => void;
  onCreate?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
}

interface Props {
  view: ViewKey;
  /** 初始日期;之后的跳转走 ref 上的方法(避免每次 prop 变化都重建视图) */
  initialDate: number;
  events: EventInput[];
  tz: string;
  /** 全天行左槽那个「GMT+08」 */
  tzLabel: string;
  /** Optional comparison axes, supplied only by the personal calendar. */
  timeZones?: { tz: string; label: string }[];
  isZh: boolean;
  hour24: boolean;
  omitZeroMinute?: boolean;
  weekStart: 0 | 1;
  weekends: boolean;
  weekNumbers?: boolean;
  mobile?: boolean;
  headerExpanded?: boolean;
  trackpadZoom?: boolean;
  keyboardShortcuts?: KeyboardShortcuts;
  editable: boolean;
  slotMinutes?: number;
  snapMinutes?: number;
  allDaySlot?: boolean;
  slotEventOverlap?: boolean;
  /** 拖出一段空白 → 新建 */
  onSelect?: (start: number, end: number, allDay: boolean) => void;
  /** 点一下空白格。做什么由上层按当前视图决定(新建 / 跳到那天)。 */
  onDateClick?: (ms: number, allDay: boolean) => void;
  /** 点表头那个日期数字 —— Google 的意思是「只看这一天」,由上层切到日视图。 */
  onDayLink?: (ms: number) => void;
  onEventClick: (id: string, el: HTMLElement) => void;
  /** 拖动 / 缩放后的新时间 */
  onEventMove?: (id: string, start: number, end: number, allDay: boolean, revert: () => void) => void;
  onRangeChange: (range: GridRange) => void;
}

const CalendarGrid = forwardRef<GridHandle, Props>(function CalendarGrid(props, ref) {
  const api = useRef<FullCalendar | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasKeyboardShortcuts = props.keyboardShortcuts !== undefined;
  const onCalendarKey = useEffectEvent((event: KeyboardEvent) => {
    const shortcuts = props.keyboardShortcuts;
    if (!shortcuts || event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') { shortcuts.onEscape?.(); return; }
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest(
      'input, textarea, select, [role="textbox"], [role="dialog"], [role="menu"], [role="listbox"], .list-select-popup, .list-select-trigger[aria-expanded="true"]',
    ))) return;
    if (!shortcuts.enabled()) return;

    const key = event.key.toLowerCase();
    const view = VIEW_KEYS.find((view) => VIEW_LABELS[view].hint && VIEW_LABELS[view].hint.toLowerCase() === key);
    if (view) { event.preventDefault(); shortcuts.onViewChange(view); return; }

    switch (key) {
      case 'arrowleft': case 'j': event.preventDefault(); api.current?.getApi().prev(); break;
      case 'arrowright': case 'k': event.preventDefault(); api.current?.getApi().next(); break;
      case 't': event.preventDefault(); api.current?.getApi().today(); break;
      case 'c': if (shortcuts.onCreate) { event.preventDefault(); shortcuts.onCreate(); } break;
      case '/': if (shortcuts.onSearch) { event.preventDefault(); shortcuts.onSearch(); } break;
      case '?': if (shortcuts.onHelp) { event.preventDefault(); shortcuts.onHelp(); } break;
    }
  });
  useEffect(() => {
    if (!hasKeyboardShortcuts) return;
    const handleKey = (event: KeyboardEvent) => onCalendarKey(event);
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasKeyboardShortcuts]);

  const baseSlotMinutes = props.slotMinutes ?? 30;
  const [slotDensity, setSlotDensity] = useState(0);
  const pinchFactor = useRef(1);
  const pinchAnchor = useRef<{ ratio: number; clientY: number } | null>(null);
  const slotMinutes = slotDensity > 0 ? baseSlotMinutes / 2 : slotDensity < 0 ? baseSlotMinutes * 2 : baseSlotMinutes;
  const onTrackpadPinch = useCallback((factor: number, event: MouseEvent) => {
    const scroller = event.target instanceof Element ? event.target.closest<HTMLElement>('.fc-scroller') : null;
    const slots = scroller?.querySelector<HTMLElement>('.fc-timegrid-slots');
    if (!slots || !gridRef.current?.contains(scroller)) return false;
    if (factor === 1) return true;
    pinchFactor.current *= factor;
    if (pinchFactor.current > 1 / 1.25 && pinchFactor.current < 1.25) return true;
    const direction = pinchFactor.current > 1 ? 1 : -1;
    pinchFactor.current = 1;
    const next = Math.max(-1, Math.min(1, slotDensity + direction));
    if (next === slotDensity) return true;
    const bounds = slots.getBoundingClientRect();
    if (bounds.height > 0) pinchAnchor.current = { ratio: (event.clientY - bounds.top) / bounds.height, clientY: event.clientY };
    setSlotDensity(next);
    return true;
  }, [slotDensity]);
  useLayoutEffect(() => {
    const anchor = pinchAnchor.current;
    pinchAnchor.current = null;
    if (!anchor) return;
    const slots = gridRef.current?.querySelector<HTMLElement>('.fc-timegrid-slots');
    const scroller = slots?.closest<HTMLElement>('.fc-scroller');
    if (!slots || !scroller) return;
    const bounds = slots.getBoundingClientRect();
    scroller.scrollTop += bounds.top + anchor.ratio * bounds.height - anchor.clientY;
  }, [slotDensity]);
  const { ignoreTapUntil, cancelSwipe, onClickCapture, onPageReady } = useCalendarSwipe(
    gridRef, () => api.current?.getApi().prev(), () => api.current?.getApi().next(),
    props.trackpadZoom ? onTrackpadPinch : undefined,
  );

  useImperativeHandle(ref, () => ({
    today: () => api.current?.getApi().today(),
    prev: () => api.current?.getApi().prev(),
    next: () => api.current?.getApi().next(),
    gotoDate: (ms: number) => api.current?.getApi().gotoDate(new Date(ms)),
  }), []);

  // initialView 只在挂载时生效 —— 之后换视图必须走 changeView,否则 URL 和顶栏都切了、
  // 网格还停在旧视图。用 ref 记住已生效的那个,免得每次重渲染都白调一次。
  //
  // 必须推到微任务里:FullCalendar 内部用 flushSync 重绘,在 effect(提交阶段)里直接调
  // 会撞上 React 的「flushSync was called from inside a lifecycle method」—— 每换一次视图
  // 刷几十条报错。挪出提交阶段就干净了。
  const appliedView = useRef(props.view);
  useEffect(() => {
    if (appliedView.current === props.view) return;
    appliedView.current = props.view;
    const view = props.view;
    queueMicrotask(() => api.current?.getApi().changeView(view));
  }, [props.view]);

  // 展开月历改变容器高度，但不触发 window resize；只在开合时重新量一次。
  useEffect(() => {
    const frame = requestAnimationFrame(() => api.current?.getApi().updateSize());
    return () => cancelAnimationFrame(frame);
  }, [props.headerExpanded]);

  // Sidebar width animates without a window resize. Observe only width to
  // avoid feeding FullCalendar's own height writes back into the observer.
  useEffect(() => {
    const node = gridRef.current;
    if (!node) return;
    let width = node.getBoundingClientRect().width;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => api.current?.getApi().updateSize());
    });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  // 多天视图复用同一个时间网格，只改变 duration。
  const views = useMemo<CalendarOptions['views']>(() => ({
    threeDay: { type: 'timeGrid', duration: { days: 3 } },
    fourDay: { type: 'timeGrid', duration: { days: 4 } },
    listMonth: { listDayFormat: { weekday: 'long', month: 'long', day: 'numeric' } },
  }), []);
  const timeFormat: FormatterInput = props.hour24 && props.omitZeroMinute ? compactTimeFormat : {
    hour: props.hour24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !props.hour24, omitZeroMinute: !props.hour24,
  };

  return (
    <div
      ref={gridRef}
      className="cal-grid"
      onClickCapture={onClickCapture}
    >
      <div className="cal-swipe-content">
        <FullCalendar
          ref={api}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin, luxonPlugin]}
          initialView={props.view}
          initialDate={new Date(props.initialDate)}
          views={views}
          timeZone={props.tz}
          locale={props.isZh ? zhCn : 'en'}
          headerToolbar={false}
          height="100%"
          expandRows
          nowIndicator
          firstDay={props.weekStart}
          weekends={props.weekends}
          weekNumbers={props.weekNumbers ?? false}
          weekNumberCalculation="ISO"
          weekNumberContent={(arg) => arg.num}
          dayMaxEvents
          editable={props.editable}
          eventStartEditable={props.editable}
          eventDurationEditable={props.editable}
          selectable={props.editable}
          selectMirror
          // 拖出一格就能新建;不加这个的话月视图里的单击会被当成 0 长度选区吞掉。
          selectMinDistance={1}
          scrollTime="07:00:00"
          slotDuration={{ minutes: slotMinutes }}
          snapDuration={{ minutes: props.snapMinutes ?? 15 }}
          allDaySlot={props.allDaySlot ?? true}
          slotEventOverlap={props.slotEventOverlap ?? true}
          // Google 在全天那行的左槽写的是网格所在时区的偏移(GMT+08),不是「全天」——
          // 一屏之内唯一说明「这些时间按哪儿算」的地方,而我们还带时区选择器,更该有。
          allDayContent={() => props.timeZones?.length ? <span className="cal-zone-axes">{props.timeZones.map(zone => <span key={zone.tz} title={zone.tz}>{zone.label}</span>)}</span> : props.tzLabel}
          slotLabelContent={props.timeZones?.length ? arg => {
            // FullCalendar's slot dates are in 1970. Rebuild the wall time on
            // the displayed range's first day so current DST offsets apply.
            const minutes = arg.time.milliseconds / 60000;
            const at = DateTime.fromJSDate(arg.view.currentStart, { zone: props.tz })
              .startOf('day').set({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
            return <span className="cal-zone-axes">{props.timeZones!.map(zone => <span key={zone.tz} title={at.setZone(zone.tz).toISO() ?? undefined}>{formatClock(at.toMillis(), zone.tz, props.hour24, props.isZh)}</span>)}</span>;
          } : undefined}
          slotLabelFormat={timeFormat}
          eventTimeFormat={timeFormat}
          // 表头日期数字 / 月视图格子里的数字可点 → 只看那一天。视图切换交给上层(URL 是
          // 单一真相),所以这里不用 FullCalendar 自己的跳转,只把日期报上去。
          navLinks
          navLinkDayClick={(date: Date) => { props.onDayLink?.(date.getTime()); }}
          dayHeaderFormat={{ weekday: 'short' }}
          dayHeaderContent={(arg) => {
            if (arg.view.type.startsWith('list')) return arg.text;
            // Google 的周 / 日表头是两行:星期在上,日号在下(今天的日号套一个实心圆)。
            // 单行交给 Intl 拼会得到「27日周一」这种别扭顺序,所以自己排。
            const weekday = props.mobile ? arg.text.replace(/^(星期|周)/, '') : arg.text;
            if (props.view === 'dayGridMonth' || props.view === 'multiMonthYear') return weekday;
            // 日号走 calendar.formatDate:它认 timeZone 设置。裸 getDate() 读的是浏览器本地时区,
            // 显示时区与本地不同时(时区选择器就是干这个的)整行表头会错开一天。
            // 只取数字:中文 locale 会给「27日」,Google 那个圆圈里只有数字。
            const num = (api.current?.getApi().formatDate(arg.date, { day: 'numeric' }) ?? '')
              .replace(/\D+/g, '') || String(arg.date.getUTCDate());
            return (
              <span className="cal-dayhead">
                <span className="cal-dayhead-wd">{weekday}</span>
                <span className={`cal-dayhead-num${arg.isToday ? ' is-today' : ''}`}>{num}</span>
              </span>
            );
          }}
          // 月 / 年格子里只要数字。中文 locale 会给「27日」,一格 42 个「日」是噪音,Google 也只写数字。
          dayCellContent={(arg) => arg.dayNumberText.replace(/\D+/g, '')}
          events={props.events}
          eventClassNames={({ event }) => event.extendedProps.status === 'tentative' ? ['cal-event-tentative'] : []}
          select={(arg: DateSelectArg) => {
            if (performance.now() >= ignoreTapUntil.current) props.onSelect?.(arg.start.getTime(), arg.end.getTime(), arg.allDay);
            api.current?.getApi().unselect();
          }}
          // 单击空白也要有反应(Google 的行为)。select 只在指针真的拖开之后才触发
          // (上面的 selectMinDistance),纯点击落不到那里,得单独接 dateClick。
          dateClick={(arg: DateClickArg) => {
            if (performance.now() >= ignoreTapUntil.current) props.onDateClick?.(arg.date.getTime(), arg.allDay);
          }}
          eventClick={(arg: EventClickArg) => {
            arg.jsEvent.preventDefault();
            if (performance.now() >= ignoreTapUntil.current) props.onEventClick(arg.event.id, arg.el);
          }}
          eventDragStart={cancelSwipe}
          eventResizeStart={cancelSwipe}
          eventDrop={(arg: EventDropArg) => {
            const start = arg.event.start?.getTime() ?? 0;
            const end = arg.event.end?.getTime() ?? start;
            props.onEventMove?.(arg.event.id, start, end, arg.event.allDay, arg.revert);
          }}
          eventResize={(arg: EventResizeDoneArg) => {
            const start = arg.event.start?.getTime() ?? 0;
            const end = arg.event.end?.getTime() ?? start;
            props.onEventMove?.(arg.event.id, start, end, arg.event.allDay, arg.revert);
          }}
          datesSet={(arg: DatesSetArg) => {
            props.onRangeChange({
              start: arg.start.getTime(),
              end: arg.end.getTime(),
              anchor: arg.view.currentStart.getTime(),
            });
            onPageReady();
          }}
          eventContent={(arg) => {
            // 受邀未回应的块画成描边款,和自己的实心块区分开(Google 同样处理)。
            const p = arg.event.extendedProps as { invited?: boolean; rsvp?: string; location?: string; status?: string; timeOnly?: boolean };
            const cls = `cal-chip${p.invited ? ' is-invited' : ''}${p.rsvp === 'pending' ? ' is-pending' : ''}`;
            const inList = arg.view.type.startsWith('list');
            const statusLabel = p.status === 'tentative' && !p.timeOnly ? tr(EVENT_STATUS_LABELS.tentative) : '';
            // 月 / 年 / 日程视图里,定时事件是「一个色点 + 一行字」(FullCalendar 的 dot-event),
            // 块本身不上色 —— 自定义 eventContent 会把它自带的点吃掉,得自己补,否则整月一片
            // 黑字,看不出事件属于哪个日历。全天事件仍是实心色条,不需要点。
            const dotted = !arg.event.allDay
              && (arg.view.type === 'dayGridMonth' || arg.view.type === 'multiMonthYear' || inList);
            // FullCalendar clips timeText at midnight when a timed card spans multiple columns.
            const timeText = arg.timeText && !dotted && (!arg.isStart || !arg.isEnd)
              ? arg.event.formatRange(timeFormat)
              : arg.timeText;
            return (
              <div className={cls} title={[timeText, arg.event.title, statusLabel].filter(Boolean).join(' · ')}>
                {dotted && (
                  <span
                    className="cal-chip-dot"
                    style={{ background: arg.borderColor || arg.backgroundColor }}
                    aria-hidden
                  />
                )}
                {/* 时间格里 Google 是「标题在上、时间在下」—— 一眼先看是什么事,格子的位置
                    本身已经说了几点。月 / 年 / 日程视图是一行「● 时间 标题」,那里时间在前,
                    靠 CSS order 换,不为此再分一套 DOM。 */}
                <span className="cal-chip-title">{arg.event.title}</span>
                {statusLabel && <span className={inList ? 'cal-chip-status' : 'sr-only'}>{statusLabel}</span>}
                {timeText && <span className="cal-chip-time">{timeText}</span>}
                {p.location && <span className="cal-chip-loc">{p.location}</span>}
              </div>
          );
        }}
      />
      </div>
    </div>
  );
});

// Keep FullCalendar's hour padding without the hour suffix that Intl can add in Chinese.
const compactTimeFormat: FormatterInput = ({ start, end, defaultSeparator }) => {
  const format = ({ hour, minute }: { hour: number; minute: number }) =>
    `${String(hour).padStart(2, '0')}${minute ? `:${String(minute).padStart(2, '0')}` : ''}`;
  const startText = format(start);
  const endText = end ? format(end) : startText;
  return startText === endText ? startText : `${startText}${defaultSeparator}${endText}`;
};

export default CalendarGrid;
