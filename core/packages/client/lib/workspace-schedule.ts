/** @module Read-only schedule summaries; preserve gaps, task identity and source dates. */
import type { ScheduleTask } from '@cuberoot/shared/workspace-planning';

export type SchedulePhase = { start: string; end: string; tasks: ScheduleTask[] };

/** Overlapping tasks form one overview phase; adjacent sequential tasks stay distinct. */
export function schedulePhases(tasks: readonly ScheduleTask[]): SchedulePhase[] {
  const phases: SchedulePhase[] = [];
  for (const task of tasks.filter(task => task.kind === 'task').sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))) {
    const previous = phases.at(-1);
    if (previous && task.start <= previous.end) {
      previous.end = previous.end > task.end ? previous.end : task.end;
      previous.tasks.push(task);
    } else phases.push({ start: task.start, end: task.end, tasks: [task] });
  }
  return phases;
}

/** Short display label only; editing and persistence retain the exact source name. */
export function scheduleTaskLabel(name: string): string {
  return name.replace(/^\d+\s+/, '').replace(/（[\d、，\s]+后）$/, '');
}
