// @vitest-environment jsdom
import { act, createElement as h, Fragment, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { parseAsString, useQueryState } from 'nuqs';
import { WorkspaceProvider, ReportEditor, workspaceText, type WorkspaceHost } from '@app-foundation/workspace-ui';
import type { Checklist, Schedule } from '@cuberoot/shared/workspace-planning';
import Checklists from '@/app/[lang]/workspace/Checklists';
import Schedules from '@/app/[lang]/workspace/Schedules';

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
  Button: ({ variant, size, ...props }) => h('button', { type: 'button', ...props }),
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); calls = []; rejectSave = false; pendingSave = undefined; pendingRead = undefined;
  lists = [{ id: 'list', projectId: null, name: 'Launch', category: 'Product', version: 1, active: true, canEdit: true, projectName: null, projectActive: null, items: [{ id: 'a', text: 'First', done: false }, { id: 'b', text: 'Second', done: false }] }];
  schedules = [{ id: 'schedule', projectId: null, name: 'Launch', version: 1, active: true, canEdit: true, projectName: null, projectActive: null, tasks: [{ id: 'task', name: 'Build', group: 'Product', owner: '', start: '2026-12-30', end: '2027-01-02', progress: 50, kind: 'task' }] }];
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount(node: ReactNode) { await act(async () => root.render(h(NuqsTestingAdapter, { hasMemory: true, children: h(WorkspaceProvider, { host, children: node }) }))); }
async function click(label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label);
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

it('uses the installed patched report editor to submit integer hours and reject reversed ranges', async () => {
  await mount(h(ReportEditor));
  const start = container.querySelector<HTMLSelectElement>('[name="startHour"]')!;
  const end = container.querySelector<HTMLSelectElement>('[name="endHour"]')!;
  expect(start.options.length).toBe(25);
  await setInput(start, '18'); await setInput(end, '9');
  await click('Submit report');
  expect(calls).toHaveLength(0);
  expect(container.textContent).toContain('End time must be after start time');
  await setInput(start, '9'); await setInput(end, '24');
  await click('Submit report');
  expect(calls.at(-1)).toMatchObject({ action: 'report', body: { startHour: 9, endHour: 24, status: 'submitted' } });
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
