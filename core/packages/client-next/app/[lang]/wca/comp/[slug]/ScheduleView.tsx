'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Table as TableIcon, Loader2 } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  fetchCompSchedule, computeDayColumns, localParts, readableTextColor,
  localizeActivityName, eventOfActivity, formatName, timeLimitText, cutoffText,
  advancementText, dayHeaderLabel, roundIdOf,
  type ScheduleData, type DayColumn, type RoundInfo,
} from '@/lib/comp-schedule';

const HOUR_PX = 56;

type View = 'calendar' | 'table';

export default function ScheduleView({ slug, isZh }: { slug: string; isZh: boolean }) {
  const [view, setView] = useState<View>('calendar');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

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

  if (error || !data || !cols) {
    return (
      <div className="sched-empty">
        {isZh ? '暂无赛程' : 'No schedule available'}
      </div>
    );
  }

  if (cols.days.length === 0) {
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
        <CalendarGrid
          days={cols.days}
          slotMinHour={cols.slotMinHour}
          slotMaxHour={cols.slotMaxHour}
          tz={tz}
          rounds={data.rounds}
          isZh={isZh}
          selectedDayIdx={selectedDayIdx}
          onSelectDay={setSelectedDayIdx}
        />
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

function CalendarGrid({ days, slotMinHour, slotMaxHour, tz, rounds, isZh, selectedDayIdx, onSelectDay }: {
  days: DayColumn[];
  slotMinHour: number;
  slotMaxHour: number;
  tz: string;
  rounds: Record<string, RoundInfo>;
  isZh: boolean;
  selectedDayIdx: number;
  onSelectDay: (i: number) => void;
}) {
  const isMobile = useIsMobile(480);
  const hours: number[] = [];
  for (let h = slotMinHour; h < slotMaxHour; h++) hours.push(h);
  const colHeight = (slotMaxHour - slotMinHour) * HOUR_PX;
  const activeIdx = Math.min(selectedDayIdx, days.length - 1);

  return (
    <>
      {isMobile && (
        <div className="sched-day-switcher">
          {days.map((d, i) => (
            <button
              key={d.dateKey}
              type="button"
              className={`sched-day-pill${i === activeIdx ? ' is-active' : ''}`}
              onClick={() => onSelectDay(i)}
            >
              {dayHeaderLabel(d.dateKey, tz, isZh)}
            </button>
          ))}
        </div>
      )}
      <div className="sched-grid-container" style={{ maxWidth: days.length * 300 + 60 }}>
        <div className="sched-time-gutter">
          {hours.map(h => (
            <div key={h} className="sched-hour-label">{String(h).padStart(2, '0')}:00</div>
          ))}
        </div>
        <div>
          <div
            className="sched-day-headers"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(180px, 1fr))` }}
          >
            {days.map(d => (
              <div key={d.dateKey} className="sched-day-header">
                {dayHeaderLabel(d.dateKey, tz, isZh)}
              </div>
            ))}
          </div>
          <div
            className="sched-days"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(180px, 1fr))` }}
          >
            {days.map((d, i) => (
              <div
                key={d.dateKey}
                className={`sched-day-column${i === activeIdx ? ' is-active' : ''}`}
                style={{ height: colHeight }}
              >
                {d.activities.map(a => {
                  const start = localParts(a.startTime, tz);
                  const end = localParts(a.endTime, tz);
                  const evId = eventOfActivity(a);
                  const isOther = evId === '';
                  const name = localizeActivityName(a, rounds, isZh, eventDisplayName);
                  const top = ((a.startMin - slotMinHour * 60) / 60) * HOUR_PX;
                  const height = Math.max(18, ((a.endMin - a.startMin) / 60) * HOUR_PX);
                  const left = (a.columnIndex / a.columnCount) * 100;
                  const width = (1 / a.columnCount) * 100;
                  const blockStyle: React.CSSProperties = {
                    top, height, left: `${left}%`, width: `${width}%`,
                  };
                  if (!isOther) {
                    blockStyle.backgroundColor = a.roomColor;
                    blockStyle.color = readableTextColor(a.roomColor);
                  }
                  return (
                    <div
                      key={a.id}
                      className={`sched-block${isOther ? ' sched-block--other' : ''}`}
                      style={blockStyle}
                      title={`${start.hhmm}–${end.hhmm} ${name} · ${a.roomName}`}
                    >
                      <span className="sched-block-time">{start.hhmm}</span>
                      <span className="sched-block-name">
                        {!isOther && <EventIcon event={evId} className="sched-block-icon" />}
                        {name}
                      </span>
                      <span className="sched-block-room">{a.roomName}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
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
