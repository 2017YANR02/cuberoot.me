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
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

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

export default function ScheduleView({ slug, isZh, compName, view, detailsExpanded }: {
  slug: string; isZh: boolean; compName: string;
  view: View; detailsExpanded: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState(false);

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
        <span>{tr({ zh: '加载赛程…', en: 'Loading schedule…',
            zhHant: "載入賽程…"
        })}</span>
      </div>
    );
  }

  if (error || !data || !cols || cols.days.length === 0) {
    return (
      <div className="sched-empty">
        {tr({ zh: '暂无赛程', en: 'No schedule available',
            zhHant: "暫無賽程"
        })}
      </div>
    );
  }

  return (
    <>
      {data.venues.length > 1 && (
        <p className="sched-note">
          {i18n.language === 'zh-Hant' ? (`本賽程按第一個場地時區(${tz})顯示`) : (isZh
                              ? `本赛程按第一个场地时区(${tz})显示`
                              : `Times shown in the first venue's timezone (${tz})`)}
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
        />
      )}
    </>
  );
}

// Rendered up in the main view-tab row by CompDetailPage so the calendar/table
// toggle and the details switch share one line with 成绩 / 预排名 / 赛程.
export function ScheduleControls({ view, onViewChange, detailsExpanded, onToggleDetails, isZh }: {
  view: View; onViewChange: (v: View) => void;
  detailsExpanded: boolean; onToggleDetails: () => void; isZh: boolean;
}) {
  return (
    <div className="comp-sched-controls">
      <ScheduleToolbar view={view} onChange={onViewChange} isZh={isZh} />
      {view === 'table' && (
        <DetailsToggle expanded={detailsExpanded} onToggle={onToggleDetails} isZh={isZh} />
      )}
    </div>
  );
}

function DetailsToggle({ expanded, onToggle, isZh }: {
  expanded: boolean; onToggle: () => void; isZh: boolean;
}) {
  return (
    <label className="sched-details-toggle">
      <span className={`sched-switch${expanded ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={expanded}
          onChange={onToggle}
          aria-label={tr({ zh: '显示轮次详情', en: 'Show Round Details',
              zhHant: "顯示輪次詳情"
        })}
        />
        <span className="sched-switch-knob" />
      </span>
      <span className="sched-switch-label">{tr({ zh: '显示轮次详情', en: 'Show Round Details',
          zhHant: "顯示輪次詳情"
    })}</span>
    </label>
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
        aria-label={tr({ zh: '日历', en: 'Calendar',
            zhHant: "日曆"
        })}
        title={tr({ zh: '日历', en: 'Calendar',
            zhHant: "日曆"
        })}
      >
        <CalendarDays size={16} />
      </button>
      <button
        type="button"
        className={`sched-subtoggle-btn${view === 'table' ? ' is-active' : ''}`}
        onClick={() => onChange('table')}
        aria-label={tr({ zh: '表格', en: 'Table' })}
        title={tr({ zh: '表格', en: 'Table' })}
      >
        <TableIcon size={16} />
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

function TableView({ data, days, tz, isZh, compName, detailsExpanded }: {
  data: ScheduleData;
  days: DayColumn[];
  tz: string;
  isZh: boolean;
  compName: string;
  detailsExpanded: boolean;
}) {
  // The "Cutoff" legend section only appears when at least one round has a cutoff,
  // matching the WCA page (which links the column header to it conditionally).
  const hasCutoff = Object.values(data.rounds).some(r => r.cutoff);

  return (
    <div className="sched-table-section">
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
                  aria-label={tr({ zh: '添加到 Google 日历', en: 'Add to Google Calendar',
                      zhHant: "新增到 Google 日曆"
                })}
                >
                  <CalendarPlus size={19} />
                </a>
              )}
              {i18n.language === 'zh-Hant' ? (`${fullDateLabel(d.dateKey, true)} 賽程`) : (isZh
                                    ? `${fullDateLabel(d.dateKey, true)} 赛程`
                                    : `Schedule for ${fullDateLabel(d.dateKey, false)}`)}
            </h2>
            <div className="sched-table-wrap">
              <table className={`sched-table${detailsExpanded ? '' : ' sched-table--details-hidden'}`}>
                <thead>
                  <tr>
                    <th>{tr({ zh: '开始', en: 'Start',
                        zhHant: "開始"
                    })}</th>
                    <th>{tr({ zh: '结束', en: 'End',
                        zhHant: "結束"
                    })}</th>
                    <th>{tr({ zh: '活动', en: 'Activity',
                        zhHant: "活動"
                    })}</th>
                    <th>{tr({ zh: '场地', en: 'Room or Stage',
                        zhHant: "場地"
                    })}</th>
                    <th className="sched-col-format">{tr({ zh: '赛制', en: 'Format',
                        zhHant: "賽制"
                    })}</th>
                    <th className="sched-col-timelimit">
                      <a href="#sched-time-limit">{tr({ zh: '还原时限', en: 'Time limit',
                          zhHant: "還原時限"
                    })}</a>
                    </th>
                    <th className="sched-col-cutoff">
                      <a href="#sched-cutoff">{tr({ zh: '及格线', en: 'Cutoff',
                          zhHant: "及格線"
                    })}</a>
                    </th>
                    <th className="sched-col-proceed">{tr({ zh: '晋级', en: 'Proceed',
                        zhHant: "晉級"
                    })}</th>
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
                        <td className="sched-td-time" data-label={tr({ zh: '开始', en: 'Start',
                            zhHant: "開始"
                        })}>
                          {simpleTimeLabel(a.startTime, tz, isZh)}
                        </td>
                        <td className="sched-td-time" data-label={tr({ zh: '结束', en: 'End',
                            zhHant: "結束"
                        })}>
                          {simpleTimeLabel(a.endTime, tz, isZh)}
                        </td>
                        <td className="sched-td-activity" data-label={tr({ zh: '活动', en: 'Activity',
                            zhHant: "活動"
                        })}>
                          {evId && <EventIcon event={evId} className="sched-block-icon" />}
                          {name}
                        </td>
                        <td className="sched-td-room" data-label={tr({ zh: '场地', en: 'Room or Stage',
                            zhHant: "場地"
                        })}>{a.roomName}</td>
                        {detailCell('sched-col-format', tr({ zh: '赛制', en: 'Format',
                            zhHant: "賽制"
                        }), fmt)}
                        {detailCell('sched-col-timelimit', tr({ zh: '还原时限', en: 'Time limit',
                            zhHant: "還原時限"
                        }), tl)}
                        {detailCell('sched-col-cutoff', tr({ zh: '及格线', en: 'Cutoff',
                            zhHant: "及格線"
                        }), co)}
                        {detailCell('sched-col-proceed', tr({ zh: '晋级', en: 'Proceed',
                            zhHant: "晉級"
                        }), adv)}
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
      {i18n.language === 'zh-Hant' ? (`規則 ${n}`) : (isZh ? `规则 ${n}` : `Regulation ${n}`)}
    </a>
  );
  return (
    <div className="sched-legend">
      <h4 id="sched-time-limit">{tr({ zh: '还原时限', en: 'Time limit',
          zhHant: "還原時限"
    })}</h4>
      <p>
        {i18n.language === 'zh-Hant' ? ((
                        <>若你在還原過程中達到還原時限,裁判會喊停,你的成績將記為 DNF(見 {reg('A1a4')})。</>
                      )) : (isZh ? (
                        <>若你在还原过程中达到还原时限,裁判会喊停,你的成绩将记为 DNF(见 {reg('A1a4')})。</>
                      ) : (
                        <>If you reach the time limit during your solve, the judge will stop you and your result will be DNF (see {reg('A1a4')}).</>
                      ))}
      </p>

      {hasCutoff && (
        <>
          <h4 id="sched-cutoff">{tr({ zh: '及格线', en: 'Cutoff',
              zhHant: "及格線"
        })}</h4>
          <p>
            {i18n.language === 'zh-Hant' ? ((
                                    <>及格線是進入第二階段所需達到的成績(見 {reg('9g')})。</>
                                  )) : (isZh ? (
                                    <>及格线是进入第二阶段所需达到的成绩(见 {reg('9g')})。</>
                                  ) : (
                                    <>The result to beat to proceed to the second phase of a cutoff round (see {reg('9g')}).</>
                                  ))}
          </p>
        </>
      )}

      <h4 id="sched-format">{tr({ zh: '赛制', en: 'Format',
          zhHant: "賽制"
    })}</h4>
      <p>
        {i18n.language === 'zh-Hant' ? ((
                        <>賽制規定如何依據成績對選手排名。每個項目允許的賽制見 {reg('9b')},各賽制的說明見 {reg('9f')}。</>
                      )) : (isZh ? (
                        <>赛制规定如何依据成绩对选手排名。每个项目允许的赛制见 {reg('9b')},各赛制的说明见 {reg('9f')}。</>
                      ) : (
                        <>The format describes how to determine the ranking of competitors based on their results. The list of allowed formats per event is described in {reg('9b')}. See {reg('9f')} for a description of each format.</>
                      ))}
      </p>

      <h4 id="sched-advancement">{tr({ zh: '晋级条件', en: 'Advancement Condition',
          zhHant: "晉級條件"
    })}</h4>
      <p>
        {tr({ zh: '表中显示的晋级人数为计划上限。若实际参赛人数少于预期,或在晋级线上出现并列,实际晋级人数可能更少。', en: 'The number of competitors shown as advancing to the next round is the planned maximum. The actual number may be lower if there are fewer competitors than expected, or if there are ties at the boundary.',
            zhHant: "表中顯示的晉級人數為計劃上限。若實際參賽人數少於預期,或在晉級線上出現並列,實際晉級人數可能更少。"
        })}
      </p>
    </div>
  );
}
