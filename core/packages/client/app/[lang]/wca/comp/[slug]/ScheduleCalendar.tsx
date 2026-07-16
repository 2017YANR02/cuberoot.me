'use client';

// FullCalendar timeGrid calendar for the comp schedule — same engine the WCA
// site uses (thewca next-frontend Schedule/CalendarView.tsx), so concurrent
// activities split into side-by-side columns and short blocks size their text
// instead of occluding neighbours. We only feed it our trimmed ScheduleData.
import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { eventDisplayName } from '@/lib/wca-events';
import { EventIcon } from '@/components/EventIcon';
import {
  localizeActivityName, eventOfActivity, readableTextColor, dayHeaderLabel,
  addDaysToKey,
  type ScheduleData,
} from '@/lib/comp-schedule';

// WCA's ACTIVITY_OTHER_GREY — non-event activities (check-in, lunch, ceremony).
const OTHER_GREY = '#666666';

// 背景带(签到/开幕/午餐…)的标签都贴在带子顶部,起始时间相近的两条带子标签会叠在
// 一起(如「开场简介」压住「3x3x3 Blindfolded Check-in」)。把同一时段的背景活动按
// 标签占用的纵向高度做区间着色,给每条分一条横向 lane,标签并排不再重叠。
// LABEL_SPAN_MIN ≈ 一个标签竖直方向占的分钟数(标签≈20px、~2px/min)。
const LABEL_SPAN_MIN = 12;

function assignLabelLanes(
  activities: ScheduleData['activities'],
): Map<number, { lane: number; lanes: number }> {
  const items = activities
    .map((a) => {
      const start = Date.parse(a.startTime) / 60000;
      return { id: a.id, start, end: start + LABEL_SPAN_MIN };
    })
    .sort((x, y) => x.start - y.start);
  const result = new Map<number, { lane: number; lanes: number }>();
  let cluster: typeof items = [];
  let clusterMaxEnd = -Infinity;
  const flush = () => {
    const laneEnds: number[] = [];
    const laneOf = new Map<number, number>();
    for (const it of cluster) {
      let lane = laneEnds.findIndex((e) => e <= it.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.end); }
      else laneEnds[lane] = it.end;
      laneOf.set(it.id, lane);
    }
    const lanes = laneEnds.length;
    for (const it of cluster) result.set(it.id, { lane: laneOf.get(it.id)!, lanes });
    cluster = [];
    clusterMaxEnd = -Infinity;
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterMaxEnd) flush();
    cluster.push(it);
    clusterMaxEnd = Math.max(clusterMaxEnd, it.end);
  }
  if (cluster.length) flush();
  return result;
}

export default function ScheduleCalendar({
  data, tz, isZh, slotMinTime, slotMaxTime, dayKeys, mobileDayKey,
}: {
  data: ScheduleData;
  tz: string;
  isZh: boolean;
  slotMinTime: string;
  slotMaxTime: string;
  dayKeys: string[];
  mobileDayKey?: string;
}) {
  const events = useMemo(
    () => {
      const lanes = assignLabelLanes(data.activities.filter((a) => eventOfActivity(a) === ''));
      return data.activities.map((a) => {
        const evId = eventOfActivity(a);
        const isOther = evId === '';
        const color = isOther ? OTHER_GREY : a.roomColor;
        const ln = isOther ? lanes.get(a.id) : undefined;
        return {
          title: localizeActivityName(a, data.rounds, isZh, eventDisplayName),
          start: a.startTime,
          end: a.endTime,
          // 非比赛活动(签到 / 午餐 / 颁奖 / 其他)退成背景带,不抢列宽:否则一段长签到
          // 会把整天劈成两列,真正的比赛轮次被挤到半宽。蓝色实块=要参加的轮次。
          display: isOther ? 'background' : 'auto',
          backgroundColor: color,
          borderColor: color,
          textColor: readableTextColor(color),
          extendedProps: { room: a.roomName, isOther, eventId: evId, lane: ln?.lane ?? 0, lanes: ln?.lanes ?? 1 },
        };
      });
    },
    [data, isZh],
  );

  // visibleRange as plain "YYYY-MM-DD" strings so FullCalendar reads them as
  // timezone-agnostic markers — passing JS Dates makes it take the UTC fields,
  // which shifts the column (and its header) a day off for east-of-UTC venues.
  const range = useMemo(() => {
    const keys = mobileDayKey ? [mobileDayKey] : dayKeys;
    return { start: keys[0], end: addDaysToKey(keys[keys.length - 1], 1) };
  }, [dayKeys, mobileDayKey]);

  return (
    <div className="sched-fc">
      <FullCalendar
        plugins={[timeGridPlugin, luxonPlugin]}
        initialView="tg"
        views={{ tg: { type: 'timeGrid', visibleRange: range } }}
        allDaySlot={false}
        headerToolbar={false}
        nowIndicator={false}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        slotDuration="00:15:00"
        slotLabelInterval="01:00:00"
        slotEventOverlap={false}
        expandRows={false}
        // Blocks shorter than this render time + title on one inline line rather
        // than stacking two lines into a box too short to show them — so a 15-min
        // round (~31px) stays readable instead of clipping its title.
        eventShortHeight={34}
        height="auto"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        timeZone={tz}
        events={events}
        dayHeaderContent={(arg) => {
          // arg.date is the real instant of this column's local midnight, so
          // resolve the calendar day back in the venue timezone (not UTC).
          const key = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(arg.date);
          return dayHeaderLabel(key, tz, isZh);
        }}
        eventContent={(arg) => {
          // 轮次块标题前加项目图标(复刻默认 timegrid DOM 结构,短块 CSS 仍生效);
          // 背景带(签到/午餐等)保持默认渲染。
          const evId = arg.event.extendedProps.eventId as string;
          if (!evId || arg.event.extendedProps.isOther) return true;
          return (
            <div className="fc-event-main-frame">
              <div className="fc-event-time">{arg.timeText}</div>
              <div className="fc-event-title-container">
                <div className="fc-event-title fc-sticky">
                  <EventIcon event={evId} className="sched-block-icon" />
                  {arg.event.title}
                </div>
              </div>
            </div>
          );
        }}
        eventDidMount={(info) => {
          const room = info.event.extendedProps.room as string | undefined;
          info.el.title = `${info.timeText} ${info.event.title}${room ? ` · ${room}` : ''}`;
          // 起始时间相近的多条背景带,标签默认都贴左上会叠字(如「开场简介」压住
          // 「3x3x3 Blindfolded Check-in」)。按预算好的 lane 把标题横向分槽并排。
          const lanes = (info.event.extendedProps.lanes as number) || 1;
          if (info.event.extendedProps.isOther && lanes > 1) {
            const lane = (info.event.extendedProps.lane as number) || 0;
            const title = info.el.querySelector<HTMLElement>('.fc-event-title');
            if (title) {
              title.style.position = 'absolute';
              title.style.top = '0';
              title.style.left = `${(lane / lanes) * 100}%`;
              title.style.width = `${100 / lanes}%`;
              title.style.boxSizing = 'border-box';
              title.classList.add('sched-bg-label-split');
            }
          }
        }}
      />
    </div>
  );
}
