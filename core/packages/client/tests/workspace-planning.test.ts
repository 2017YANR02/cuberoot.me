import { expect, it } from 'vitest';
import { orderChecklistItems, copyScheduleTasks, isPlanningDate, planningDay, scheduleRange, type ScheduleTask } from '@cuberoot/shared/workspace-planning';
import { schedulePhases, scheduleTaskLabel } from '@/lib/workspace-schedule';

it('summarizes overlapping tasks without hiding gaps, merging adjacent stages or mutating records', () => {
  const base: ScheduleTask = { id: 'a', name: 'Stage', group: 'Launch', owner: '', start: '2026-12-01', end: '2026-12-04', kind: 'task', progress: 0 };
  const tasks = [
    { ...base, id: 'late', start: '2026-12-12', end: '2026-12-13' }, base,
    { ...base, id: 'parallel', start: '2026-12-02', end: '2026-12-05' },
    { ...base, id: 'next', start: '2026-12-06', end: '2026-12-07' },
    { ...base, id: 'goal', start: '2026-12-05', end: '2026-12-05', kind: 'milestone' as const },
  ];
  const before = structuredClone(tasks);
  expect(schedulePhases(tasks).map(phase => [phase.start, phase.end, phase.tasks.map(task => task.id)])).toEqual([
    ['2026-12-01', '2026-12-05', ['a', 'parallel']],
    ['2026-12-06', '2026-12-07', ['next']],
    ['2026-12-12', '2026-12-13', ['late']],
  ]);
  expect(tasks).toEqual(before);
  expect(schedulePhases([])).toEqual([]);
  expect(schedulePhases([tasks[4]])).toEqual([]);
  expect(scheduleTaskLabel('21 微信备案初审（06、20 后）')).toBe('微信备案初审');
  expect(scheduleTaskLabel('32 华为上架（现有包）')).toBe('华为上架（现有包）');
});

it('moves completed items to the bottom without changing the original restore order', () => {
  const items = [{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B', done: false }, { id: 'c', text: 'C', done: true }];
  expect(orderChecklistItems(items).map(item => item.id)).toEqual(['b', 'a', 'c']);
  expect(orderChecklistItems(items.map(item => ({ ...item, done: false }))).map(item => item.id)).toEqual(['a', 'b', 'c']);
  expect(items.map(item => item.id)).toEqual(['a', 'b', 'c']);
});

it('copies cross-year tasks and milestones with equal calendar offsets and reset progress', () => {
  const tasks: ScheduleTask[] = [{ id: 'a', name: 'Build', group: 'Product', owner: '', start: '2026-12-30', end: '2027-01-02', kind: 'task', progress: 80 }, { id: 'b', name: 'Launch', group: 'Product', owner: '', start: '2027-01-04', end: '2027-01-04', kind: 'milestone', progress: 100 }];
  let id = 0;
  const copied = copyScheduleTasks(tasks, '2028-02-28', () => `copy-${id++}`);
  expect(copied.map(task => [task.id, task.start, task.end, task.progress])).toEqual([['copy-0', '2028-02-28', '2028-03-02', 0], ['copy-1', '2028-03-04', '2028-03-04', 0]]);
  expect(scheduleRange(tasks)?.days).toBe(6);
  expect(scheduleRange(copied)?.days).toBe(6);
  expect(tasks[0].progress).toBe(80);
  expect(copyScheduleTasks([], '', () => '')).toEqual([]);
  expect(scheduleRange([])).toBeNull();
});

it('validates calendar dates and keeps day offsets independent of daylight saving time', () => {
  expect(isPlanningDate('2028-02-29')).toBe(true);
  for (const date of ['2027-02-29', '2026-02-31', '2026-13-01', '2026-1-01', 'invalid']) expect(isPlanningDate(date)).toBe(false);
  expect(planningDay('2026-03-09') - planningDay('2026-03-07')).toBe(2);
});
