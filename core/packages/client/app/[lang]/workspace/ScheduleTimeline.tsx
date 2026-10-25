'use client';
/** @module Calendar-aligned timeline shared by all workspace schedules. */
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { planningDay, planningDate, scheduleRange, type ScheduleTask } from '@cuberoot/shared/workspace-planning';
import { today } from '@app-foundation/workspace-ui';
import { useT } from '@/hooks/useT';
import { Tooltip } from '@/components/Tooltip';
import { schedulePhases, scheduleTaskLabel } from '@/lib/workspace-schedule';

export default function ScheduleTimeline({ tasks, scale: requestedScale, editable, onEdit }: {
  tasks: ScheduleTask[]; scale: 'fit' | 'day' | 'week' | 'month'; editable: boolean; onEdit: (task: ScheduleTask) => void;
}) {
  const t = useT();
  const regionId = useId();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (group: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const headerTrack = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(800);
  const hasTasks = tasks.length > 0;
  useEffect(() => {
    const element = headerTrack.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setTrackWidth(previous => previous === width ? previous : width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasTasks]);
  useEffect(() => {
    const refresh = () => setCurrentDay(planningDay(today()));
    refresh(); const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const range = scheduleRange(tasks);
  if (!range) return <p className="staff-empty">{t('暂无任务', 'No tasks')}</p>;
  const fit = requestedScale === 'fit';
  const scale = fit ? (range.days <= 14 ? 'day' : range.days <= 120 ? 'week' : 'month') : requestedScale;
  // Complete weeks/months avoid narrow partial ticks at either edge.
  const start = scale === 'month' ? planningDay(`${planningDate(range.start).slice(0, 7)}-01`)
    : scale === 'week' ? range.start - (range.start + 3) % 7 : range.start;
  const endDate = new Date(`${planningDate(range.end)}T00:00:00Z`);
  const startDate = new Date(`${planningDate(start)}T00:00:00Z`);
  const visibleDays = scale === 'month'
    ? Math.max(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1), Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 3, 1)) / 86400000 - start
    : scale === 'week' ? Math.max(28, Math.ceil((range.end - start + 1) / 7) * 7) : Math.max(range.days, 7);
  const dayWidth = fit ? trackWidth / visibleDays : { day: 36, week: 10, month: 4 }[scale];
  const percent = (days: number) => `${days / visibleDays * 100}%`;
  const days = Array.from({ length: visibleDays }, (_, offset) => ({ date: planningDate(start + offset), offset, weekday: (start + offset + 4) % 7 }));
  const groups = [...new Set(tasks.map(task => task.group))];
  const colors = ['var(--accent)', 'var(--signal-info)', 'var(--signal-success)', 'var(--signal-warning)'];
  let lastTick = -Infinity;
  const ticks = days.filter(({ date, offset }) => {
    const candidate = scale === 'day' || (scale === 'week' ? offset % 7 === 0 : date.endsWith('-01'));
    if (!candidate || (fit && ((offset - lastTick) * dayWidth < 52 || (visibleDays - offset) * dayWidth < 36))) return false;
    lastTick = offset;
    return true;
  });
  const periods = days.filter(({ date, offset }) => offset === 0 || (scale === 'month' ? date.endsWith('-01-01') : date.endsWith('-01')));
  const weekdays = [t('日', 'Su'), t('一', 'Mo'), t('二', 'Tu'), t('三', 'We'), t('四', 'Th'), t('五', 'Fr'), t('六', 'Sa')];
  const grid = `linear-gradient(to right, ${ticks.flatMap(({ offset }) => [`transparent ${percent(offset)}`, `var(--border-default) ${percent(offset)}`, `var(--border-default) calc(${percent(offset)} + 1px)`, `transparent calc(${percent(offset)} + 1px)`]).join(', ')})`;
  const weekends = scale === 'day' ? days.filter(({ weekday, offset }) => weekday === 6 || (offset === 0 && weekday === 0)) : [];
  const weekendShade = weekends.length ? `linear-gradient(to right, ${weekends.flatMap(({ offset, weekday }) => {
    const end = Math.min(visibleDays, offset + (weekday === 6 ? 2 : 1));
    const shade = 'color-mix(in srgb, var(--foreground) 4%, transparent)';
    return [`transparent ${percent(offset)}`, `${shade} ${percent(offset)}`, `${shade} ${percent(end)}`, `transparent ${percent(end)}`];
  }).join(', ')})` : 'none';
  const todayOffset = currentDay === null ? null : currentDay - start;
  const todayLine = todayOffset !== null && todayOffset >= 0 && todayOffset < visibleDays
    ? <span aria-hidden="true" className="workspace-gantt-today" style={{ left: percent(todayOffset + 0.5) }} /> : null;
  return <div className="workspace-gantt-scroll" tabIndex={0} role="region" aria-label={t('排期时间表', 'Schedule timeline')}>
    <div className={`workspace-gantt${fit ? ' workspace-gantt-fit' : ''}`} style={{ '--gantt-min-width': `${visibleDays * dayWidth}px`, '--gantt-grid': grid, '--gantt-weekends': weekendShade } as CSSProperties}>
      <div className="workspace-gantt-row workspace-gantt-header" data-site-surface="heading">
        <div className="workspace-gantt-label"><strong>{t('任务', 'Task')}</strong></div>
        <div className="workspace-gantt-track" ref={headerTrack}>
          {periods.map(({ date, offset }, index) => {
            const length = (periods[index + 1]?.offset ?? visibleDays) - offset;
            const period = date.slice(0, scale === 'month' ? 4 : 7);
            return <time key={date} dateTime={period} aria-label={period} className="workspace-gantt-period" style={{ left: percent(offset), width: percent(length) }}>{length * dayWidth < 28 ? '' : scale === 'month' ? period : length * dayWidth >= 72 ? period : date.slice(5, 7)}</time>;
          })}
          {ticks.map(({ date, offset, weekday }, index) => <div key={date} className={`workspace-gantt-tick${scale === 'day' && (weekday === 0 || weekday === 6) ? ' is-weekend' : ''}`} style={{ left: percent(offset), width: percent((ticks[index + 1]?.offset ?? visibleDays) - offset) }}><time dateTime={date}>{scale === 'day' ? date.slice(8) : scale === 'week' ? date.slice(5) : date.slice(0, 7)}</time>{scale === 'day' && <small>{weekdays[weekday]}</small>}</div>)}
          {todayLine}
        </div>
      </div>
      {groups.map((group, groupIndex) => {
        const groupTasks = tasks.filter(task => task.group === group);
        const collapsible = fit && groupTasks.length > 1;
        const collapsed = collapsible && !expanded.has(group);
        const phases = schedulePhases(groupTasks);
        const contentId = `${regionId}-${groupIndex}`;
        return <Fragment key={group}>
        <div className={`workspace-gantt-row workspace-gantt-group${collapsed ? ' workspace-gantt-lane' : ''}`} style={{ '--gantt-color': colors[groupIndex % colors.length] } as CSSProperties}>
          <div className="workspace-gantt-label">{collapsible ? <button type="button" className="workspace-lane-toggle" aria-label={group} aria-expanded={!collapsed} aria-controls={contentId} onClick={() => toggle(group)}>{collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}<span>{scheduleTaskLabel(group)}</span></button> : <strong>{scheduleTaskLabel(group)}</strong>}</div>
          <div className="workspace-gantt-track">
            {todayLine}
            {collapsed && phases.map(phase => {
              const offset = planningDay(phase.start) - start;
              const duration = planningDay(phase.end) - planningDay(phase.start) + 1;
              const name = phase.tasks.length === 1 ? scheduleTaskLabel(phase.tasks[0].name) : t(`${phase.tasks.length} 项任务`, `${phase.tasks.length} tasks`);
              const label = `${phase.tasks.map(task => task.name).join(' · ')} · ${phase.start} – ${phase.end}`;
              return <Tooltip key={phase.tasks[0].id} content={label}>{tip => <button {...tip} type="button" aria-label={label} className="workspace-gantt-bar workspace-gantt-phase" onClick={() => toggle(group)} style={{ left: percent(offset), width: `max(2px, ${percent(duration)})` }}>
                {duration * dayWidth >= 60 && <span className="workspace-gantt-bar-name">{name}</span>}
              </button>}</Tooltip>;
            })}
          </div>
        </div>
        <div id={contentId}>
        {groupTasks.filter(task => !collapsed || task.kind === 'milestone').map(task => {
          const offset = planningDay(task.start) - start;
          const duration = planningDay(task.end) - planningDay(task.start) + 1;
          const milestone = task.kind === 'milestone';
          const label = `${task.name}${task.owner ? ` · ${task.owner}` : ''} · ${task.start}${milestone ? '' : ` – ${task.end}`} · ${task.progress}%`;
          return <div key={task.id} className={`workspace-gantt-row workspace-gantt-task${task.progress === 100 ? ' is-done' : ''}`} style={{ '--gantt-color': colors[groupIndex % colors.length] } as CSSProperties}>
            <div className="workspace-gantt-label"><Tooltip content={label}>{tip => <button {...tip} type="button" className="workspace-task-label" aria-disabled={!editable} aria-label={label} onClick={() => { if (editable) onEdit(task); }}><span>{milestone ? t('里程碑', 'Milestone') : scheduleTaskLabel(task.name)}</span></button>}</Tooltip></div>
            <div className="workspace-gantt-track">
              {todayLine}
              <button type="button" disabled={!editable} onClick={() => onEdit(task)} aria-label={label} className={milestone ? 'workspace-gantt-milestone' : 'workspace-gantt-bar'} style={{ left: milestone ? percent(offset + 0.5) : percent(offset), ...(milestone ? {} : { width: `max(2px, ${percent(duration)})` }) }}>
                {!milestone && <><span className="workspace-gantt-progress" style={{ width: `${task.progress}%` }} />{duration * dayWidth >= 130 && <span className="workspace-gantt-bar-name">{task.start.slice(5)} – {task.end.slice(5)}</span>}{task.progress > 0 && duration * dayWidth >= 52 && <span className="workspace-gantt-percent">{task.progress}%</span>}</>}
              </button>
              {milestone && <span className={`workspace-gantt-key-label${offset > visibleDays / 2 ? ' is-end' : ''}`} style={{ left: percent(offset + 0.5) }}>{task.start.slice(5)} · {scheduleTaskLabel(task.name)}</span>}
            </div>
          </div>;
        })}
        </div>
      </Fragment>;
      })}
    </div>
  </div>;
}
