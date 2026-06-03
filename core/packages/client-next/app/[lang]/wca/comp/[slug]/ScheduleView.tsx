'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, Table as TableIcon, Loader2 } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  fetchCompSchedule, computeDayColumns, localParts,
  localizeActivityName, eventOfActivity, formatName, timeLimitText, cutoffText,
  advancementText, dayHeaderLabel, roundIdOf,
  type ScheduleData, type DayColumn,
} from '@/lib/comp-schedule';

// FullCalendar (and luxon) is ~200KB; only pull it in when the calendar is
// actually rendered, never on the results/psych tabs.
const ScheduleCalendar = dynamic(() => import('./ScheduleCalendar'), {
  ssr: false,
  loading: () => (
    <div className="sched-loading">
      <Loader2 className="sched-loading-spinner is-spinning" />
    </div>
  ),
});

type View = 'calendar' | 'table';

export default function ScheduleView({ slug, isZh }: { slug: string; isZh: boolean }) {
  const [view, setView] = useState<View>('calendar');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState(false);
  // Default on so Format / Time limit / Cutoff / Proceed are visible like the
  // WCA site; the toggle still lets users collapse to a simpler table.
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(false);
    setData(null);
    fetchCompSchedule(slug)
      .then(d => {
        if (cancel) return;
        if (!d) setError(true);
        else setData(d);
      })
      .catch(() => { if (!cancel) setError(true); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [slug]);

  const tz = data?.venues[0]?.timezone ?? 'UTC';
  const cols = useMemo(() => (data ? computeDayColumns(data, tz) : null), [data, tz]);

  if (loading) {
    return (
      <div className="sched-loading">
        <Loader2 className="sched-loading-spinner is-spinning" />
        <span>{isZh ? '加载赛程…' : 'Loading schedule…'}</span>
      </div>
    );
  }

  if (error || !data || !cols || cols.days.length === 0) {
    return (
      <div className="sched-empty">
        {isZh ? '暂无赛程' : 'No schedule available'}
      </div>
    );
  }

  return (
    <>
      <ScheduleToolbar view={view} onChange={setView} isZh={isZh} />
      {data.venues.length > 1 && (
        <p className="sched-note">
          {isZh
            ? `本赛程按第一个场地时区(${tz})显示`
            : `Times shown in the first venue's timezone (${tz})`}
        </p>
      )}
      {view === 'calendar' ? (
        <CalendarSection data={data} cols={cols} tz={tz} isZh={isZh} />
      ) : (
        <TableView
          data={data}
          days={cols.days}
          tz={tz}
          isZh={isZh}
          detailsExpanded={detailsExpanded}
          onToggleDetails={() => setDetailsExpanded(v => !v)}
        />
      )}
    </>
  );
}

function ScheduleToolbar({ view, onChange, isZh }: {
  view: View; onChange: (v: View) => void; isZh: boolean;
}) {
  return (
    <div className="sched-subtoggle">
      <button
        type="button"
        className={`sched-subtoggle-btn${view === 'calendar' ? ' is-active' : ''}`}
        onClick={() => onChange('calendar')}
      >
        <CalendarDays size={15} /> {isZh ? '日历' : 'Calendar'}
      </button>
      <button
        type="button"
        className={`sched-subtoggle-btn${view === 'table' ? ' is-active' : ''}`}
        onClick={() => onChange('table')}
      >
        <TableIcon size={15} /> {isZh ? '表格' : 'Table'}
      </button>
    </div>
  );
}

// On a phone the multi-day grid is cramped, so show one day at a time with a
// pill switcher; on wider screens FullCalendar lays out every day side by side.
function CalendarSection({ data, cols, tz, isZh }: {
  data: ScheduleData;
  cols: { days: DayColumn[]; slotMinHour: number; slotMaxHour: number };
  tz: string;
  isZh: boolean;
}) {
  const isMobile = useIsMobile(600);
  const [dayIdx, setDayIdx] = useState(0);
  const { days, slotMinHour, slotMaxHour } = cols;
  const activeIdx = Math.min(dayIdx, days.length - 1);
  const dayKeys = useMemo(() => days.map(d => d.dateKey), [days]);
  const singleDay = isMobile && days.length > 1;

  return (
    <>
      {singleDay && (
        <div className="sched-day-switcher">
          {days.map((d, i) => (
            <button
              key={d.dateKey}
              type="button"
              className={`sched-day-pill${i === activeIdx ? ' is-active' : ''}`}
              onClick={() => setDayIdx(i)}
            >
              {dayHeaderLabel(d.dateKey, tz, isZh)}
            </button>
          ))}
        </div>
      )}
      <ScheduleCalendar
        data={data}
        tz={tz}
        isZh={isZh}
        slotMinHour={slotMinHour}
        slotMaxHour={slotMaxHour}
        dayKeys={dayKeys}
        mobileDayKey={singleDay ? days[activeIdx].dateKey : undefined}
      />
    </>
  );
}

function TableView({ data, days, tz, isZh, detailsExpanded, onToggleDetails }: {
  data: ScheduleData;
  days: DayColumn[];
  tz: string;
  isZh: boolean;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
}) {
  return (
    <div className="sched-table-section">
      <div className="sched-details-toggle">
        <input
          type="checkbox"
          id="sched-details"
          checked={detailsExpanded}
          onChange={onToggleDetails}
        />
        <label htmlFor="sched-details">{isZh ? '显示轮次详情' : 'Show Round Details'}</label>
      </div>
      {days.map(d => {
        const sorted = [...d.activities].sort(
          (a, b) => a.startMin - b.startMin || a.roomName.localeCompare(b.roomName),
        );
        return (
          <div key={d.dateKey}>
            <h3 className="sched-day-title">{dayHeaderLabel(d.dateKey, tz, isZh)}</h3>
            <div className="sched-table-wrap">
              <table className={`sched-table${detailsExpanded ? '' : ' sched-table--details-hidden'}`}>
                <thead>
                  <tr>
                    <th>{isZh ? '开始' : 'Start'}</th>
                    <th>{isZh ? '结束' : 'End'}</th>
                    <th>{isZh ? '活动' : 'Activity'}</th>
                    <th>{isZh ? '场地' : 'Room or Stage'}</th>
                    <th className="sched-col-format">{isZh ? '赛制' : 'Format'}</th>
                    <th className="sched-col-timelimit">{isZh ? '时间限制' : 'Time limit'}</th>
                    <th className="sched-col-cutoff">{isZh ? '截断' : 'Cutoff'}</th>
                    <th className="sched-col-proceed">{isZh ? '晋级' : 'Proceed'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(a => {
                    const start = localParts(a.startTime, tz);
                    const end = localParts(a.endTime, tz);
                    const evId = eventOfActivity(a);
                    const name = localizeActivityName(a, data.rounds, isZh, eventDisplayName);
                    const round = data.rounds[roundIdOf(a.activityCode)];
                    const fmt = round ? formatName(round.format, isZh) : '—';
                    const tl = round ? (timeLimitText(round, data.rounds, isZh) || '—') : '—';
                    const co = round ? (cutoffText(round, isZh) || '—') : '—';
                    const adv = round ? (advancementText(round, isZh) || '—') : '—';
                    return (
                      <tr key={a.id}>
                        <td className="sched-td-time" data-label={isZh ? '开始' : 'Start'}>{start.hhmm}</td>
                        <td className="sched-td-time" data-label={isZh ? '结束' : 'End'}>{end.hhmm}</td>
                        <td className="sched-td-activity" data-label={isZh ? '活动' : 'Activity'}>
                          {evId && <EventIcon event={evId} className="sched-block-icon" />}
                          {name}
                        </td>
                        <td className="sched-td-room" data-label={isZh ? '场地' : 'Room or Stage'}>{a.roomName}</td>
                        <td className="sched-col-format" data-label={isZh ? '赛制' : 'Format'}>{fmt}</td>
                        <td className="sched-col-timelimit" data-label={isZh ? '时间限制' : 'Time limit'}>{tl}</td>
                        <td className="sched-col-cutoff" data-label={isZh ? '截断' : 'Cutoff'}>{co}</td>
                        <td className="sched-col-proceed" data-label={isZh ? '晋级' : 'Proceed'}>{adv}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
