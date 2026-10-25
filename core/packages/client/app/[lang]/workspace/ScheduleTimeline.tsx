'use client';
/** @module Calendar-aligned timeline shared by all workspace schedules. */
import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { planningDay, planningDate, scheduleRange, type ScheduleTask } from '@cuberoot/shared/workspace-planning';
import { today } from '@app-foundation/workspace-ui';
import { useT } from '@/hooks/useT';

export default function ScheduleTimeline({ tasks, scale, editable, onEdit }: {
  tasks: ScheduleTask[]; scale: 'day' | 'week' | 'month'; editable: boolean; onEdit: (task: ScheduleTask) => void;
}) {
  const t = useT();
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  useEffect(() => {
    const refresh = () => setCurrentDay(planningDay(today()));
    refresh(); const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const range = scheduleRange(tasks);
  if (!range) return <p className="staff-empty">{t('暂无任务', 'No tasks')}</p>;
  const dayWidth = { day: 36, week: 12, month: 4 }[scale];
  const visibleDays = Math.max(range.days, { day: 7, week: 28, month: 90 }[scale]);
  const width = visibleDays * dayWidth;
  const groups = [...new Set(tasks.map(task => task.group))];
  const colors = ['var(--accent)', 'var(--signal-info)', 'var(--signal-success)', 'var(--signal-warning)'];
  const ticks = Array.from({ length: visibleDays }, (_, offset) => ({ date: planningDate(range.start + offset), offset }))
    .filter(({ date, offset }) => scale === 'day' || offset === 0 || (scale === 'week' ? offset % 7 === 0 : offset >= 20 && date.endsWith('-01')));
  const todayOffset = currentDay === null ? null : currentDay - range.start;
  return <div className="workspace-gantt-scroll" tabIndex={0} role="region" aria-label={t('排期时间表', 'Schedule timeline')}>
    <div className="workspace-gantt" style={{ '--gantt-width': `${width}px`, '--gantt-day': `${dayWidth}px` } as CSSProperties}>
      <div className="workspace-gantt-row workspace-gantt-header" data-site-surface="heading">
        <div className="workspace-gantt-label">{t('任务', 'Task')}</div>
        <div className="workspace-gantt-track">{ticks.map(({ date, offset }, index) => <time key={date} dateTime={date} className="workspace-gantt-tick" style={{ left: offset * dayWidth, width: ((ticks[index + 1]?.offset ?? visibleDays) - offset) * dayWidth }}>{scale === 'month' ? date.slice(0, 7) : date.slice(5)}</time>)}</div>
      </div>
      {groups.map((group, groupIndex) => <Fragment key={group}>
        <div className="workspace-gantt-row workspace-gantt-group" style={{ '--gantt-color': colors[groupIndex % colors.length] } as CSSProperties}><div className="workspace-gantt-label"><strong>{group}</strong></div><div className="workspace-gantt-track" /></div>
        {tasks.filter(task => task.group === group).map(task => {
          const offset = planningDay(task.start) - range.start;
          const duration = planningDay(task.end) - planningDay(task.start) + 1;
          const milestone = task.kind === 'milestone';
          const label = `${task.name} · ${task.start}${milestone ? '' : ` – ${task.end}`} · ${task.progress}%`;
          return <div key={task.id} className={`workspace-gantt-row${task.progress === 100 ? ' is-done' : ''}`} style={{ '--gantt-color': colors[groupIndex % colors.length] } as CSSProperties}>
            <div className="workspace-gantt-label"><button type="button" className="workspace-task-label" disabled={!editable} onClick={() => onEdit(task)}><span>{task.name}</span><small>{task.owner && `${task.owner} · `}{task.start.slice(5)}{!milestone && ` – ${task.end.slice(5)}`}</small></button></div>
            <div className="workspace-gantt-track">
              {todayOffset !== null && todayOffset >= 0 && todayOffset < visibleDays && <span aria-hidden="true" className="workspace-gantt-today" style={{ left: (todayOffset + 0.5) * dayWidth }} />}
              <button type="button" disabled={!editable} onClick={() => onEdit(task)} aria-label={label} className={milestone ? 'workspace-gantt-milestone' : 'workspace-gantt-bar'} style={{ left: offset * dayWidth + (milestone ? dayWidth / 2 : 1), ...(milestone ? {} : { width: Math.max(2, duration * dayWidth - 2) }) }}>
                {!milestone && <><span className="workspace-gantt-progress" style={{ width: `${task.progress}%` }} />{duration * dayWidth >= 42 && <span className="workspace-gantt-percent">{task.progress}%</span>}</>}
              </button>
            </div>
          </div>;
        })}
      </Fragment>)}
    </div>
  </div>;
}
