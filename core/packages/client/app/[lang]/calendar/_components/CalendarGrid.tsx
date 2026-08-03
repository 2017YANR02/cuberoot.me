'use client';

// 日历网格 —— FullCalendar 的薄封装。站内已经用它渲染比赛赛程(wca/comp/[slug]/
// ScheduleCalendar),这里补齐月 / 年 / 日程视图和交互插件,皮肤在 calendar.css 里按
// 主题 token 重写成 Google 日历那副样子。
//
// 只做「画 + 把交互回调翻译成业务事件」,不碰数据 —— 展开、落库都在上层。

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { CalendarOptions, DateSelectArg, EventClickArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
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
import type { FcEvent, ViewKey } from '../_lib/format';

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

interface Props {
  view: ViewKey;
  /** 初始日期;之后的跳转走 ref 上的方法(避免每次 prop 变化都重建视图) */
  initialDate: number;
  events: FcEvent[];
  tz: string;
  /** 全天行左槽那个「GMT+08」 */
  tzLabel: string;
  isZh: boolean;
  hour24: boolean;
  weekStart: 0 | 1;
  weekends: boolean;
  editable: boolean;
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

  // 「4 天」是 Google 有而 FullCalendar 没有预设的视图,自己拼一个 duration 出来。
  const views = useMemo<CalendarOptions['views']>(() => ({
    fourDay: { type: 'timeGrid', duration: { days: 4 } },
    listMonth: { listDayFormat: { weekday: 'long', month: 'long', day: 'numeric' } },
  }), []);

  return (
    <div className="cal-grid">
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
        dayMaxEvents
        editable={props.editable}
        eventStartEditable={props.editable}
        eventDurationEditable={props.editable}
        selectable={props.editable}
        selectMirror
        // 拖出一格就能新建;不加这个的话月视图里的单击会被当成 0 长度选区吞掉。
        selectMinDistance={1}
        scrollTime="07:00:00"
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        allDaySlot
        // Google 在全天那行的左槽写的是网格所在时区的偏移(GMT+08),不是「全天」——
        // 一屏之内唯一说明「这些时间按哪儿算」的地方,而我们还带时区选择器,更该有。
        allDayContent={() => props.tzLabel}
        slotLabelFormat={{ hour: props.hour24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !props.hour24, omitZeroMinute: !props.hour24 }}
        // 24 小时制不能省整点的分钟:中文 locale 会把 12:00 缩成「12时」,Google 那里写的是 12:00。
        // 12 小时制照 Google 省掉(12 PM)。
        eventTimeFormat={{ hour: props.hour24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !props.hour24, omitZeroMinute: !props.hour24 }}
        // 表头日期数字 / 月视图格子里的数字可点 → 只看那一天。视图切换交给上层(URL 是
        // 单一真相),所以这里不用 FullCalendar 自己的跳转,只把日期报上去。
        navLinks
        navLinkDayClick={(date: Date) => { props.onDayLink?.(date.getTime()); }}
        dayHeaderFormat={{ weekday: 'short' }}
        dayHeaderContent={(arg) => {
          // Google 的周 / 日表头是两行:星期在上,日号在下(今天的日号套一个实心圆)。
          // 单行交给 Intl 拼会得到「27日周一」这种别扭顺序,所以自己排。
          const weekday = arg.text;
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
        select={(arg: DateSelectArg) => {
          props.onSelect?.(arg.start.getTime(), arg.end.getTime(), arg.allDay);
          api.current?.getApi().unselect();
        }}
        // 单击空白也要有反应(Google 的行为)。select 只在指针真的拖开之后才触发
        // (上面的 selectMinDistance),纯点击落不到那里,得单独接 dateClick。
        dateClick={(arg: DateClickArg) => {
          props.onDateClick?.(arg.date.getTime(), arg.allDay);
        }}
        eventClick={(arg: EventClickArg) => {
          arg.jsEvent.preventDefault();
          props.onEventClick(arg.event.id, arg.el);
        }}
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
        }}
        eventContent={(arg) => {
          // 受邀未回应的块画成描边款,和自己的实心块区分开(Google 同样处理)。
          const p = arg.event.extendedProps as FcEvent['extendedProps'];
          const cls = `cal-chip${p.invited ? ' is-invited' : ''}${p.rsvp === 'pending' ? ' is-pending' : ''}`;
          // 月 / 年 / 日程视图里,定时事件是「一个色点 + 一行字」(FullCalendar 的 dot-event),
          // 块本身不上色 —— 自定义 eventContent 会把它自带的点吃掉,得自己补,否则整月一片
          // 黑字,看不出事件属于哪个日历。全天事件仍是实心色条,不需要点。
          const dotted = !arg.event.allDay
            && (arg.view.type === 'dayGridMonth' || arg.view.type === 'multiMonthYear' || arg.view.type.startsWith('list'));
          return (
            <div className={cls} title={`${arg.timeText} ${arg.event.title}`}>
              {dotted && (
                <span
                  className="cal-chip-dot"
                  style={{ background: arg.borderColor || arg.backgroundColor }}
                  aria-hidden
                />
              )}
              {arg.timeText && <span className="cal-chip-time">{arg.timeText}</span>}
              <span className="cal-chip-title">{arg.event.title}</span>
              {p.location && <span className="cal-chip-loc">{p.location}</span>}
            </div>
          );
        }}
      />
    </div>
  );
});

export default CalendarGrid;
