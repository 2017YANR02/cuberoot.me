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
import {
  localizeActivityName, eventOfActivity, readableTextColor, dayHeaderLabel,
  addDaysToKey,
  type ScheduleData,
} from '@/lib/comp-schedule';

// WCA's ACTIVITY_OTHER_GREY — non-event activities (check-in, lunch, ceremony).
const OTHER_GREY = '#666666';

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
    () =>
      data.activities.map((a) => {
        const isOther = eventOfActivity(a) === '';
        const color = isOther ? OTHER_GREY : a.roomColor;
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
          extendedProps: { room: a.roomName, isOther },
        };
      }),
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
        eventDidMount={(info) => {
          const room = info.event.extendedProps.room as string | undefined;
          info.el.title = `${info.timeText} ${info.event.title}${room ? ` · ${room}` : ''}`;
        }}
      />
    </div>
  );
}
