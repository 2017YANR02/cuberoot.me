'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, Table as TableIcon, Loader2, CalendarPlus } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  fetchCompSchedule, computeDayColumns, computeCalendarLayout, simpleTimeLabel,
  localizeActivityName, eventOfActivity, formatCell, timeLimitText, cutoffText,
  advancementText, dayHeaderLabel, fullDateLabel, roundIdOf,
  type ScheduleData, type DayColumn,
} from '@/lib/comp-schedule';

const WCA_REGS = 'https://www.worldcubeassociation.org/regulations';

// Google Calendar template link for a day's activities (text + UTC start/end).
function gcalUrl(startIso: string, endIso: string, name: string): string {
  const g = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE`
    + `&text=${encodeURIComponent(name)}&dates=${g(startIso)}/${g(endIso)}`;
}

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

export default function ScheduleView({ slug, isZh, compName }: { slug: string; isZh: boolean; compName: string }) {
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
        <CalendarSection data={data} tz={tz} isZh={isZh} />
      ) : (
        <TableView
          data={data}
          days={cols.days}
          tz={tz}
          isZh={isZh}
          compName={compName}
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
function CalendarSection({ data, tz, isZh }: {
  data: ScheduleData;
  tz: string;
  isZh: boolean;
}) {
  const isMobile = useIsMobile(600);
  const [dayIdx, setDayIdx] = useState(0);
  const layout = useMemo(() => computeCalendarLayout(data, tz), [data, tz]);
  const { dayKeys, slotMinTime, slotMaxTime } = layout;
  const activeIdx = Math.min(dayIdx, dayKeys.length - 1);
  const singleDay = isMobile && dayKeys.length > 1;

  return (
    <>
      {singleDay && (
        <div className="sched-day-switcher">
          {dayKeys.map((k, i) => (
            <button
              key={k}
              type="button"
              className={`sched-day-pill${i === activeIdx ? ' is-active' : ''}`}
              onClick={() => setDayIdx(i)}
            >
              {dayHeaderLabel(k, tz, isZh)}
            </button>
          ))}
        </div>
      )}
      <ScheduleCalendar
        data={data}
        tz={tz}
        isZh={isZh}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        dayKeys={dayKeys}
        mobileDayKey={singleDay ? dayKeys[activeIdx] : undefined}
      />
    </>
  );
}

function TableView({ data, days, tz, isZh, compName, detailsExpanded, onToggleDetails }: {
  data: ScheduleData;
  days: DayColumn[];
  tz: string;
  isZh: boolean;
  compName: string;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
}) {
  // The "Cutoff" legend section only appears when at least one round has a cutoff,
  // matching the WCA page (which links the column header to it conditionally).
  const hasCutoff = Object.values(data.rounds).some(r => r.cutoff);

  return (
    <div className="sched-table-section">
      <label className="sched-details-toggle">
        <span className={`sched-switch${detailsExpanded ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={detailsExpanded}
            onChange={onToggleDetails}
            aria-label={isZh ? '显示轮次详情' : 'Show Round Details'}
          />
          <span className="sched-switch-knob" />
        </span>
        <span className="sched-switch-label">{isZh ? '显示轮次详情' : 'Show Round Details'}</span>
      </label>

      {days.map(d => {
        const sorted = [...d.activities].sort(
          (a, b) => a.startMin - b.startMin || a.roomName.localeCompare(b.roomName),
        );
        const firstStart = sorted[0]?.startTime;
        const lastEnd = sorted.reduce(
          (m, a) => (a.endTime > m ? a.endTime : m), sorted[0]?.endTime ?? '',
        );
        return (
          <section key={d.dateKey} className="sched-day">
            <h2 className="sched-day-title">
              {firstStart && (
                <a
                  className="sched-cal-link"
                  href={gcalUrl(firstStart, lastEnd, compName)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={isZh ? '添加到 Google 日历' : 'Add to Google Calendar'}
                >
                  <CalendarPlus size={19} />
                </a>
              )}
              {isZh
                ? `${fullDateLabel(d.dateKey, true)} 赛程`
                : `Schedule for ${fullDateLabel(d.dateKey, false)}`}
            </h2>
            <div className="sched-table-wrap">
              <table className={`sched-table${detailsExpanded ? '' : ' sched-table--details-hidden'}`}>
                <thead>
                  <tr>
                    <th>{isZh ? '开始' : 'Start'}</th>
                    <th>{isZh ? '结束' : 'End'}</th>
                    <th>{isZh ? '活动' : 'Activity'}</th>
                    <th>{isZh ? '场地' : 'Room or Stage'}</th>
                    <th className="sched-col-format">{isZh ? '赛制' : 'Format'}</th>
                    <th className="sched-col-timelimit">
                      <a href="#sched-time-limit">{isZh ? '时间限制' : 'Time limit'}</a>
                    </th>
                    <th className="sched-col-cutoff">
                      <a href="#sched-cutoff">{isZh ? '截断' : 'Cutoff'}</a>
                    </th>
                    <th className="sched-col-proceed">{isZh ? '晋级' : 'Proceed'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(a => {
                    const evId = eventOfActivity(a);
                    const name = localizeActivityName(a, data.rounds, isZh, eventDisplayName);
                    const round = data.rounds[roundIdOf(a.activityCode)];
                    const fmt = round ? formatCell(round) : '';
                    const tl = round ? timeLimitText(round, data.rounds, isZh) : '';
                    const co = round ? cutoffText(round, isZh) : '';
                    const adv = round ? advancementText(round, isZh) : '';
                    const detailCell = (cls: string, label: string, val: string) => (
                      <td
                        className={`${cls}${val ? '' : ' sched-cell-empty'}`}
                        data-label={label}
                      >{val}</td>
                    );
                    return (
                      <tr key={a.id}>
                        <td className="sched-td-time" data-label={isZh ? '开始' : 'Start'}>
                          {simpleTimeLabel(a.startTime, tz, isZh)}
                        </td>
                        <td className="sched-td-time" data-label={isZh ? '结束' : 'End'}>
                          {simpleTimeLabel(a.endTime, tz, isZh)}
                        </td>
                        <td className="sched-td-activity" data-label={isZh ? '活动' : 'Activity'}>
                          {evId && <EventIcon event={evId} className="sched-block-icon" />}
                          {name}
                        </td>
                        <td className="sched-td-room" data-label={isZh ? '场地' : 'Room or Stage'}>{a.roomName}</td>
                        {detailCell('sched-col-format', isZh ? '赛制' : 'Format', fmt)}
                        {detailCell('sched-col-timelimit', isZh ? '时间限制' : 'Time limit', tl)}
                        {detailCell('sched-col-cutoff', isZh ? '截断' : 'Cutoff', co)}
                        {detailCell('sched-col-proceed', isZh ? '晋级' : 'Proceed', adv)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <ScheduleLegend isZh={isZh} hasCutoff={hasCutoff} />
    </div>
  );
}

// Explanatory legend below the tables — targets of the "Time limit" / "Cutoff"
// column-header links, mirroring the WCA competition page.
function ScheduleLegend({ isZh, hasCutoff }: { isZh: boolean; hasCutoff: boolean }) {
  const reg = (n: string) => (
    <a href={`${WCA_REGS}#${n}`} target="_blank" rel="noreferrer">
      {isZh ? `规则 ${n}` : `Regulation ${n}`}
    </a>
  );
  return (
    <div className="sched-legend">
      <h4 id="sched-time-limit">{isZh ? '时间限制' : 'Time limit'}</h4>
      <p>
        {isZh ? (
          <>若你在还原过程中达到时间限制,裁判会喊停,你的成绩将记为 DNF(见 {reg('A1a4')})。</>
        ) : (
          <>If you reach the time limit during your solve, the judge will stop you and your result will be DNF (see {reg('A1a4')}).</>
        )}
      </p>

      {hasCutoff && (
        <>
          <h4 id="sched-cutoff">{isZh ? '截断' : 'Cutoff'}</h4>
          <p>
            {isZh ? (
              <>进入截断轮第二阶段所需达到的成绩(见 {reg('9g')})。</>
            ) : (
              <>The result to beat to proceed to the second phase of a cutoff round (see {reg('9g')}).</>
            )}
          </p>
        </>
      )}

      <h4 id="sched-format">{isZh ? '赛制' : 'Format'}</h4>
      <p>
        {isZh ? (
          <>赛制规定如何依据成绩对选手排名。每个项目允许的赛制见 {reg('9b')},各赛制的说明见 {reg('9f')}。</>
        ) : (
          <>The format describes how to determine the ranking of competitors based on their results. The list of allowed formats per event is described in {reg('9b')}. See {reg('9f')} for a description of each format.</>
        )}
      </p>

      <h4 id="sched-advancement">{isZh ? '晋级条件' : 'Advancement Condition'}</h4>
      <p>
        {isZh
          ? '表中显示的晋级人数为计划上限。若实际参赛人数少于预期,或在晋级线上出现并列,实际晋级人数可能更少。'
          : 'The number of competitors shown as advancing to the next round is the planned maximum. The actual number may be lower if there are fewer competitors than expected, or if there are ties at the boundary.'}
      </p>
    </div>
  );
}
