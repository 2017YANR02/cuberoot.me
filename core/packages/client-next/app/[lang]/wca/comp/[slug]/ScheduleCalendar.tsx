'use client';

// FullCalendar timeGrid calendar for the comp schedule — same engine the WCA
// site uses (thewca next-frontend Schedule/CalendarView.tsx), so concurrent
// activities split into side-by-side columns and short blocks size their text
// instead of occluding neighbours. We only feed it our trimmed ScheduleData.
import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { DateTime } from 'luxon';
import { eventDisplayName } from '@/lib/wca-events';
import {
  localizeActivityName, eventOfActivity, readableTextColor, dayHeaderLabel,
  type ScheduleData,
} from '@/lib/comp-schedule';

// WCA's ACTIVITY_OTHER_GREY — non-event activities (check-in, lunch, ceremony).
const OTHER_GREY = '#666666';

const pad = (h: number) => `${String(h).padStart(2, '0')}:00:00`;

export default function ScheduleCalendar({
  data, tz, isZh, slotMinHour, slotMaxHour, dayKeys, mobileDayKey,
}: {
  data: ScheduleData;
  tz: string;
  isZh: boolean;
  slotMinHour: number;
  slotMaxHour: number;
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
          backgroundColor: color,
          borderColor: color,
          textColor: readableTextColor(color),
          extendedProps: { room: a.roomName },
        };
      }),
    [data, isZh],
  );

  const range = useMemo(() => {
    const keys = mobileDayKey ? [mobileDayKey] : dayKeys;
    const start = DateTime.fromISO(keys[0], { zone: tz }).startOf('day');
    const end = DateTime.fromISO(keys[keys.length - 1], { zone: tz })
      .startOf('day')
      .plus({ days: 1 });
    return { start: start.toJSDate(), end: end.toJSDate() };
  }, [dayKeys, mobileDayKey, tz]);

  return (
    <div className="sched-fc">
      <FullCalendar
        plugins={[timeGridPlugin, luxonPlugin]}
        initialView="tg"
        views={{ tg: { type: 'timeGrid', visibleRange: range } }}
        allDaySlot={false}
        headerToolbar={false}
        nowIndicator={false}
        slotMinTime={pad(slotMinHour)}
        slotMaxTime={pad(Math.max(slotMaxHour, slotMinHour + 1))}
        slotDuration="00:15:00"
        slotLabelInterval="01:00:00"
        slotEventOverlap={false}
        height="auto"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        timeZone={tz}
        events={events}
        dayHeaderContent={(arg) => {
          const key = DateTime.fromJSDate(arg.date, { zone: 'utc' }).toFormat('yyyy-MM-dd');
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
