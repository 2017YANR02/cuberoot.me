/** @module Shared workspace checklist and schedule contracts and calendar arithmetic. */
export type ChecklistItem = { id: string; text: string; done: boolean; archived?: boolean; categoryId?: string };
export type WorkspaceBoard = {
  id: string; name: string; version: number;
  active: boolean;
  canEdit: boolean;
};
export type ChecklistCategory = { id: string; name: string };
export type Checklist = WorkspaceBoard & { items: ChecklistItem[]; categories?: ChecklistCategory[] };

export const PROJECT_MAX_CENTS = 100_000_000;
export type ProjectTask = {
  id: string;
  userId: number;
  assignee: string;
  title: string;
  dueDate: string;
  criteria: string;
  amountCents: number;
  bonusCents: number;
  status: 'proposed' | 'in_progress' | 'submitted' | 'accepted';
  version: number;
};
export type ProjectAssignee = { userId: number; name: string };
export type ProjectTaskList = {
  tasks: ProjectTask[];
  assignees: ProjectAssignee[];
  viewerUserId: number;
  canManage: boolean;
  hasMore: boolean;
};

export type PayrollAttendance = {
  date: string;
  halfDays: 1 | 2;
  version: number;
  approved: boolean;
  dailyRateCents: number;
  amountCents: number;
};
export type PayrollProject = {
  id: string;
  title: string;
  acceptedDate: string;
  amountCents: number;
  bonusCents: number;
};
export type PayrollEmployee = {
  userId: number;
  name: string;
  dailyRateCents: number | null;
  canReport: boolean;
  attendance: PayrollAttendance[];
  projects: PayrollProject[];
  onsiteCents: number;
  projectCents: number;
  bonusCents: number;
  totalCents: number;
  paidAt: string | null;
};
export type PayrollMonth = {
  month: string;
  payDate: string;
  closed: boolean;
  canManage: boolean;
  rows: PayrollEmployee[];
};

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

export * from './work-calendar';
