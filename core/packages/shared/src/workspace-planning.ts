/** @module Shared workspace checklist and schedule contracts and calendar arithmetic. */
export type ChecklistItem = { id: string; text: string; done: boolean; archived?: boolean };
export type WorkspaceBoard = {
  id: string; projectId: string | null; name: string; version: number;
  active: boolean; projectName: string | null; projectActive: boolean | null;
  canEdit: boolean;
};
export type Checklist = WorkspaceBoard & { items: ChecklistItem[] };

/** Stable partition: restoring an item returns it to its original position. */
export function orderChecklistItems(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items.filter(item => !item.done), ...items.filter(item => item.done)];
}

export type ScheduleTask = {
  id: string; group: string; name: string; owner: string;
  start: string; end: string; kind: 'task' | 'milestone'; progress: number;
};
export type Schedule = WorkspaceBoard & { tasks: ScheduleTask[] };
const DAY_MS = 86400000;
export const planningDay = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
export const planningDate = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
export function isPlanningDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = planningDay(value);
  return Number.isFinite(day) && planningDate(day) === value;
}
export function scheduleRange(tasks: readonly ScheduleTask[]) {
  if (!tasks.length) return null;
  const start = Math.min(...tasks.map(task => planningDay(task.start)));
  const end = Math.max(...tasks.map(task => planningDay(task.end)));
  return { start, end, days: end - start + 1 };
}
/** Copy the relative plan, including milestones, to a new start without timezone/DST drift. */
export function copyScheduleTasks(tasks: readonly ScheduleTask[], start: string, id: () => string): ScheduleTask[] {
  const range = scheduleRange(tasks);
  const offset = range ? planningDay(start) - range.start : 0;
  return tasks.map(task => ({ ...task, id: id(), start: planningDate(planningDay(task.start) + offset), end: planningDate(planningDay(task.end) + offset), progress: 0 }));
}
