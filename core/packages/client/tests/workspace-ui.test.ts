// @vitest-environment jsdom
import { act, createElement as h, Fragment, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { parseAsString, useQueryState } from 'nuqs';
import { WorkspaceProvider, ReportEditor, useResource, workspaceText, type WorkspaceHost } from '@app-foundation/workspace-ui';
import type { Checklist, Schedule } from '@cuberoot/shared/workspace-planning';
import Checklists from '@/app/[lang]/workspace/Checklists';
import Schedules from '@/app/[lang]/workspace/Schedules';
import { WorkspaceButton, WorkspaceDialog } from '@/app/[lang]/workspace/WorkspaceControls';
import { DateInput } from '@/components/DateInput';
import ScheduleTimeline from '@/app/[lang]/workspace/ScheduleTimeline';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
let container: HTMLDivElement;
let root: Root;
let calls: { action: string; body: unknown }[];
let lists: Checklist[];
let schedules: Schedule[];
let rejectSave = false;
let pendingSave: Promise<void> | undefined;
let pendingRead: Promise<void> | undefined;
const host: WorkspaceHost = {
  api: async <T>(action: string, body?: unknown): Promise<T> => {
    if (body !== undefined) {
      calls.push({ action, body });
      if (rejectSave) throw new Error('Reload before saving');
      if (pendingSave) await pendingSave;
      if (action === 'checklist') lists = lists.map(list => list.id === (body as Checklist).id ? { ...body as Checklist, version: list.version + 1 } : list);
      if (action === 'schedule') {
        const saved = { ...body as Schedule, version: (body as Schedule).version + 1, canEdit: true, projectName: null, projectActive: null };
        schedules = schedules.some(row => row.id === saved.id) ? schedules.map(row => row.id === saved.id ? saved : row) : [...schedules, saved];
      }
      return { id: (body as { id: string }).id, version: (body as { version: number }).version + 1 } as T;
    }
    const params = new URLSearchParams(action.split('?')[1]);
    const result = action === 'projects' ? { projects: [] } : action.startsWith('checklists') ? { checklists: lists, categories: [...new Set(lists.map(list => list.category))], hasMore: false } : { schedules, selected: schedules.find(row => row.id === params.get('id')) ?? null, hasMore: false };
    if (pendingRead) await pendingRead;
    return result as T;
  },
  navigate: vi.fn(), t: text => workspaceText('en', text),
  Link: props => h('a', props),
  Button: WorkspaceButton,
  Dialog: WorkspaceDialog,
  DateInput,
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); calls = []; rejectSave = false; pendingSave = undefined; pendingRead = undefined;
  lists = [{ id: 'list', projectId: null, name: 'Launch', category: 'Product', version: 1, active: true, canEdit: true, projectName: null, projectActive: null, items: [{ id: 'a', text: 'First', done: false }, { id: 'b', text: 'Second', done: false }] }];
  schedules = [{ id: 'schedule', projectId: null, name: 'Launch', version: 1, active: true, canEdit: true, projectName: null, projectActive: null, tasks: [{ id: 'task', name: 'Build', group: 'Product', owner: '', start: '2026-12-30', end: '2027-01-02', progress: 50, kind: 'task' }] }];
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount(node: ReactNode) { await act(async () => root.render(h(NuqsTestingAdapter, { hasMemory: true, children: h(WorkspaceProvider, { host, children: node }) }))); }
async function click(label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label || button.getAttribute('aria-label') === label);
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}
async function setInput(input: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
function ExternalNavigation() {
  const [, setSelected] = useQueryState('schedule', parseAsString.withDefault(''));
  return h('button', { onClick: () => void setSelected('') }, 'External navigation');
}

it('uses bare icon actions while keeping explicit report submissions styled as buttons', async () => {
  await mount(h(Fragment, null, h(WorkspaceButton, { action: 'add', children: 'New task' }), h(WorkspaceButton, { action: 'send', iconOnly: false, children: 'Submit report' })));
  const icon = container.querySelector('[aria-label="New task"]')!;
  expect(icon.classList.contains('workspace-icon-action')).toBe(true);
  expect(icon.classList.contains('btn-primary')).toBe(false);
  expect(icon.classList.contains('btn-secondary')).toBe(false);
  expect(container.querySelector('.btn-primary')?.textContent).toBe('Submit report');
});

it('separates cross-year calendar headings from day ticks and uses proportional task positions', async () => {
  await mount(h(ScheduleTimeline, { tasks: schedules[0].tasks, scale: 'day', editable: true, onEdit: vi.fn() }));
  expect([...container.querySelectorAll('.workspace-gantt-period')].map(node => node.getAttribute('datetime'))).toEqual(['2026-12', '2027-01']);
  expect([...container.querySelectorAll('.workspace-gantt-tick time')].map(node => node.textContent)).toEqual(['30', '31', '01', '02', '03', '04', '05']);
  const bar = container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!;
  expect(bar.style.left).toContain('%');
  expect(bar.style.width).toContain('%');
  expect(bar.textContent).toContain('Build');
});

it('aligns week ticks to Mondays and month ticks to real calendar boundaries across leap February', async () => {
  const tasks = [{ ...schedules[0].tasks[0], start: '2028-02-28', end: '2028-03-02' }];
  await mount(h(ScheduleTimeline, { tasks, scale: 'week', editable: true, onEdit: vi.fn() }));
  expect([...container.querySelectorAll('.workspace-gantt-tick time')].map(node => node.getAttribute('datetime'))).toEqual(['2028-02-28', '2028-03-06', '2028-03-13', '2028-03-20']);
  await mount(h(ScheduleTimeline, { tasks, scale: 'month', editable: true, onEdit: vi.fn() }));
  const ticks = [...container.querySelectorAll<HTMLElement>('.workspace-gantt-tick')];
  expect(ticks.map(node => node.textContent)).toEqual(['2028-02', '2028-03', '2028-04']);
  expect(parseFloat(ticks[1].style.left)).toBeCloseTo(29 / 90 * 100);
  expect(parseFloat(ticks[2].style.left)).toBeCloseTo(60 / 90 * 100);
  await mount(h(ScheduleTimeline, { tasks: [{ ...tasks[0], start: '2027-05-31', end: '2027-06-02' }], scale: 'week', editable: true, onEdit: vi.fn() }));
  const partialMonth = container.querySelector('.workspace-gantt-period')!;
  expect(partialMonth.getAttribute('aria-label')).toBe('2027-05');
  expect(partialMonth.textContent).toBe('');
  expect(container.querySelector('.workspace-gantt-tick time')?.textContent).toBe('05-31');
});

it('uses the installed patched report editor to submit integer hours and reject reversed ranges', async () => {
  await mount(h(ReportEditor));
  const start = container.querySelector<HTMLSelectElement>('[name="startHour"]')!;
  const end = container.querySelector<HTMLSelectElement>('[name="endHour"]')!;
  expect(start.options.length).toBe(25);
  expect(start.closest('.staff-field')?.classList.contains('staff-field-short')).toBe(true);
  await setInput(start, '18'); await setInput(end, '9');
  await click('Submit report');
  expect(calls).toHaveLength(0);
  expect(container.textContent).toContain('End time must be after start time');
  await setInput(start, '9'); await setInput(end, '24');
  await click('Submit report');
  expect(calls.at(-1)).toMatchObject({ action: 'report', body: { startHour: 9, endHour: 24, status: 'submitted' } });
});

it('keeps the timeline mounted while editing and restores focus on a clean close', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  const bar = container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!;
  bar.focus();
  await act(async () => bar.click());
  expect(container.querySelector('dialog[open]')).not.toBeNull();
  expect(container.querySelector('.workspace-gantt-bar')).toBe(bar);
  expect(container.querySelector('[aria-label="Save"]')?.textContent).toBe('');
  await click('Close');
  expect(container.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(bar);
  expect(calls).toHaveLength(0);
});

it('keeps failed edits and asks before discarding unsaved input', async () => {
  rejectSave = true;
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  await setInput(container.querySelector<HTMLInputElement>('[name="name"]')!, 'Unsaved task');
  await click('Save');
  expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain('Reload before saving');
  await click('Close');
  expect(container.querySelector('dialog')?.textContent).toContain('Discard unsaved changes?');
  await click('Keep editing');
  expect(container.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe('Unsaved task');
  await click('Close'); await click('Discard changes');
  expect(container.querySelector('dialog')).toBeNull();
});

it('does not dismiss a saving dialog through Escape, close or a pending discard confirmation', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  await setInput(container.querySelector<HTMLInputElement>('[name="name"]')!, 'Updated task');
  await click('Close');
  let resolveSave!: () => void;
  pendingSave = new Promise<void>(resolve => { resolveSave = resolve; });
  await click('Save');
  const dialog = container.querySelector('dialog')!;
  await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(container.querySelector('dialog')).toBe(dialog);
  expect(dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.disabled).toBe(true);
  await click('Discard changes');
  expect(container.querySelector('dialog')).toBe(dialog);
  await act(async () => resolveSave());
  expect(container.querySelector('dialog')).toBeNull();
});

it('keeps the calendar and tooltip inside the native modal layer', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  const dialog = container.querySelector('dialog')!;
  const date = dialog.querySelector<HTMLInputElement>('input[type="date"]')!;
  await act(async () => date.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })));
  expect(document.querySelector('.date-input__calendar')?.closest('dialog')).toBe(dialog);
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(async () => date.dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(true);
  expect(document.querySelector('.date-input__calendar')).toBeNull();
  expect(container.querySelector('dialog')).toBe(dialog);
  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.focus());
  expect(document.querySelector('[role="tooltip"]')?.closest('dialog')).toBe(dialog);
});

it('requires confirmation before removing a schedule task', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  await click('Remove task');
  expect(calls).toHaveLength(0);
  expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain('Remove this task');
  await click('Remove task');
  expect(calls.at(-1)).toMatchObject({ action: 'schedule', body: { tasks: [] } });
});

function ResourceProbe({ path }: { path: string }) {
  const resource = useResource<{ schedules: Schedule[] }>(path);
  return h(Fragment, null, h('button', { onClick: resource.reload }, 'Refresh resource'), h('div', { 'data-resource': true }, resource.data?.schedules.map(row => row.name).join(',')));
}
it('preserves rows during same-path reloads but clears them when the query scope changes', async () => {
  await mount(h(ResourceProbe, { path: 'schedules' }));
  expect(container.querySelector('[data-resource]')?.textContent).toBe('Launch');
  let resolveRead!: () => void;
  pendingRead = new Promise<void>(resolve => { resolveRead = resolve; });
  await click('Refresh resource');
  expect(container.querySelector('[data-resource]')?.textContent).toBe('Launch');
  await mount(h(ResourceProbe, { path: 'schedules?page=2' }));
  expect(container.querySelector('[data-resource]')?.textContent).toBe('');
  await act(async () => resolveRead());
});

it('persists checkbox completion and restores original order when unchecked', async () => {
  await mount(h(Checklists));
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect([...container.querySelectorAll('.workspace-check-text')].map(node => node.textContent)).toEqual(['Second', 'First']);
  expect(container.querySelector('.is-done')?.textContent).toContain('First');
  await act(async () => container.querySelector<HTMLInputElement>('.is-done input')!.click());
  expect([...container.querySelectorAll('.workspace-check-text')].map(node => node.textContent)).toEqual(['First', 'Second']);
});

it('keeps the checkbox unchanged when saving conflicts', async () => {
  rejectSave = true; await mount(h(Checklists));
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reload before saving');
});

it('preserves unsaved task text when another checklist item is completed', async () => {
  lists.push({ ...lists[0], id: 'other', name: 'Other', items: [{ id: 'c', text: 'Third', done: false }] });
  await mount(h(Checklists));
  const draft = container.querySelector<HTMLInputElement>('.workspace-add-item input')!;
  await setInput(draft, 'Keep this draft');
  const other = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2];
  await act(async () => other.click());
  expect(container.querySelector('.workspace-add-item input')).toBe(draft);
  expect(draft.value).toBe('Keep this draft');
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(draft.value).toBe('Keep this draft');
});

it('does not let a delayed refresh overwrite a successfully saved checkbox version', async () => {
  await mount(h(Checklists));
  let resolveRead!: () => void;
  pendingRead = new Promise<void>(resolve => { resolveRead = resolve; });
  await click('Reload');
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => resolveRead());
  expect(container.querySelector('.is-done')?.textContent).toContain('First');
  await act(async () => container.querySelector<HTMLInputElement>('.is-done input')!.click());
  expect(calls.at(-1)).toMatchObject({ action: 'checklist', body: { version: 2 } });
});

it('opens the same editor from a timeline task and copies a schedule with shifted dates', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  const progress = container.querySelector<HTMLInputElement>('[name="progress"]')!;
  await setInput(progress, '100'); await click('Save');
  expect(calls.at(-1)).toMatchObject({ action: 'schedule', body: { version: 1, tasks: [{ progress: 100 }] } });
  await click('Copy schedule');
  await setInput(container.querySelector<HTMLInputElement>('[name="start"]')!, '2028-02-28');
  await click('Save');
  const copy = calls.at(-1)?.body as Schedule;
  expect(copy.id).not.toBe('schedule');
  expect(copy.version).toBe(0);
  expect(copy.tasks[0]).toMatchObject({ start: '2028-02-28', end: '2028-03-02', progress: 0 });
  expect(copy.tasks[0].id).not.toBe('task');
  expect(schedules[0].tasks[0].start).toBe('2026-12-30');
});

it('binds the editor to its schedule when external navigation clears the selected ID', async () => {
  schedules.push({ ...schedules[0], id: 'second', name: 'Second plan', tasks: [{ ...schedules[0].tasks[0], id: 'second-task', name: 'Second task' }] });
  await mount(h(Fragment, null, h(ExternalNavigation), h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } })));
  const chooser = container.querySelector<HTMLSelectElement>('select')!;
  await setInput(chooser, 'second');
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  expect(container.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe('Second task');
  await click('External navigation');
  expect(container.querySelector('[name="name"]')).toBeNull();
  expect(calls).toHaveLength(0);
});

it('locks local editor switches while saving and ignores late navigation callbacks', async () => {
  schedules.push({ ...schedules[0], id: 'second', name: 'Second plan', tasks: [{ ...schedules[0].tasks[0], id: 'second-task', name: 'Second task' }] });
  await mount(h(Fragment, null, h(ExternalNavigation), h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } })));
  await setInput(container.querySelector<HTMLSelectElement>('select')!, 'second');
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  let resolveSave!: () => void;
  pendingSave = new Promise<void>(resolve => { resolveSave = resolve; });
  await click('Save');
  expect(container.querySelector('select')!.matches(':disabled')).toBe(true);
  await click('External navigation');
  await act(async () => resolveSave());
  expect(container.querySelector<HTMLSelectElement>('select')!.value).toBe('schedule');
  expect(container.querySelector('[name="name"]')).toBeNull();
  expect(schedules[0].tasks[0].id).toBe('task');
});
