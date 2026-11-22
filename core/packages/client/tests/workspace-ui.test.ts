// @vitest-environment jsdom
import { act, createElement as h, Fragment, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { parseAsString, useQueryState } from 'nuqs';
import { WorkspaceProvider, ReportEditor, Reports, ReportDetailPanel, useResource, workspaceText, type WorkspaceHost, type WorkReport } from '@app-foundation/workspace-ui';
import { displayCuberName } from '@/lib/cuber-name-display';
import type { Checklist, ProjectTask, Schedule } from '@cuberoot/shared/workspace-planning';
import MacSetupChecklist from '@/components/workspace/MacSetupChecklist';
import { replaceSortableItems } from '@/components/SortableList';
import Checklists from '@/app/[lang]/workspace/Checklists';
import Schedules from '@/app/[lang]/workspace/Schedules';
import { WorkspaceButton, WorkspaceDialog } from '@/app/[lang]/workspace/WorkspaceControls';
import { DateInput } from '@/components/DateInput';
import ScheduleTimeline from '@/app/[lang]/workspace/ScheduleTimeline';
import ProjectTasks from '@/app/[lang]/workspace/ProjectTasks';
import InternshipFieldForm from '@/app/[lang]/workspace/InternshipFieldForm';
import { completeInternshipFields, defaultInternshipSettlement, fillInternshipTemplate, internshipDailyRateCents, MONTHLY_PAYMENT_TIME, readInternshipTemplate } from '@/app/[lang]/workspace/contract-template-fields';

vi.mock('@/hooks/useT', () => { const t = (_zh: string, en: string) => en; return { useT: () => t }; });
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
      if (action === 'checklist') {
        const saved = { ...body as Checklist, version: (body as Checklist).version + 1 };
        lists = lists.some(list => list.id === saved.id) ? lists.map(list => list.id === saved.id ? saved : list) : [...lists, saved];
      }
      if (action === 'checklist-delete') lists = lists.filter(list => list.id !== (body as Checklist).id);
      if (action === 'schedule-delete') schedules = schedules.filter(row => row.id !== (body as Schedule).id);
      if (action === 'schedule') {
        const saved = { ...body as Schedule, version: (body as Schedule).version + 1, canEdit: true, };
        schedules = schedules.some(row => row.id === saved.id) ? schedules.map(row => row.id === saved.id ? saved : row) : [...schedules, saved];
      }
      return { id: (body as { id: string }).id, version: (body as { version: number }).version + 1 } as T;
    }
    const params = new URLSearchParams(action.split('?')[1]);
    const result = action.startsWith('checklists') ? { checklists: lists, hasMore: false } : { schedules, selected: schedules.find(row => row.id === params.get('id')) ?? null, hasMore: false };
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
  localStorage.clear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); calls = []; rejectSave = false; pendingSave = undefined; pendingRead = undefined;
  lists = [{ id: 'list', name: 'Launch', version: 1, active: true, canEdit: true, items: [{ id: 'a', text: 'First', done: false }, { id: 'b', text: 'Second', done: false }] }];

  schedules = [{ id: 'schedule', name: 'Launch', version: 1, active: true, canEdit: true, tasks: [{ id: 'task', name: 'Build', group: 'Product', owner: '', start: '2026-12-30', end: '2027-01-02', progress: 50, kind: 'task' }] }];
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount(node: ReactNode) { await act(async () => root.render(h(NuqsTestingAdapter, { hasMemory: true, children: h(WorkspaceProvider, { host, children: node }) }))); }
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label || button.getAttribute('aria-label') === label);
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

it('shows separate project fee and bonus and confirms the bonus through acceptance', async () => {
  let task: ProjectTask = { id: crypto.randomUUID(), userId: 2, assignee: 'Employee', title: 'Release',
    dueDate: '2026-10-15', criteria: 'Provide a preview.', amountCents: 100000, bonusCents: 15000, status: 'submitted', version: 3 };
  const api: WorkspaceHost['api'] = async <T>(action: string, body?: unknown) => {
    if (action === 'project-task-status') {
      calls.push({action, body});
      task = {...task, status:'accepted', version:4};
      return {id:task.id, status:task.status, version:task.version} as T;
    }
    return {tasks:[task], assignees:[], viewerUserId:1, canManage:true, hasMore:false} as T;
  };
  await act(async () => root.render(h(WorkspaceProvider, {host:{...host, api}, children:h(ProjectTasks)})));
  expect(container.textContent).toMatch(/Project fee .*1,000/);
  expect(container.textContent).toMatch(/Acceptance bonus .*150/);
  await click('Accept and confirm bonus');
  expect(calls).toEqual([{action:'project-task-status', body:{id:task.id, version:3, decision:'accept'}}]);
  expect(container.textContent).toMatch(/Confirmed bonus .*150/);
  expect(container.textContent).toMatch(/Project fee .*1,000/);
});

it('uses project amounts for remote contracts and pays both calculation modes monthly', async () => {
  const p = (text: string) => ({type:'paragraph', content:[{type:'text', text}]});
  const list = (text: string) => ({type:'bulletList', content:[{type:'listItem', content:[p(text)]}]});
  const template = {type:'doc', content:[
    p('乙方（实习生）：张三'), p('身份证号码：'), p('所在学校及院系：专业：'), p('年级/学制：学号：'),
    p('联系电话：电子邮箱：'), p('紧急联系人及电话：'), p('2.1 实习岗位：网站开发'),
    p('2.2 实习内容'), list('开发网站'), p('2.3 实习期限：自2026年11月18日起，至2027年1月1日止。'),
    p('2.4 实习方式与时间'), list('每周三天'), p('3.1 甲方按月向乙方发放实习津贴，标准为：人民币300元/日，于次月 15 日前支付至乙方银行账户：'),
    p('开户行：'), p('户名：'), p('账号：'), p('4.1 甲方（指导老师：李四，职位：负责人）负责指导'),
  ]};
  const initial = readInternshipTemplate(template)!.values;
  expect(initial.paymentTime).toBe('次月 15 日');
  expect(defaultInternshipSettlement(initial, '实习协议（远程）')).toBe('project');
  expect(internshipDailyRateCents(initial.allowance)).toBe(30000);
  const onApply = vi.fn();
  const onSave = vi.fn<(fields: Parameters<typeof fillInternshipTemplate>[1]) => Promise<void>>().mockResolvedValue(undefined);
  await mount(h(InternshipFieldForm, {initial, title:'实习协议（远程）', canSave:true, onApply, onSave, onCancel:vi.fn()}));
  expect(container.querySelector<HTMLSelectElement>('select[name="settlement"]')?.value).toBe('project');
  expect(container.querySelector('[name="dailyRate"]')).toBeNull();
  await click('Fill contract body');
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({settlement:'project', allowance:'', paymentTime:MONTHLY_PAYMENT_TIME}));
  const project = fillInternshipTemplate(template, onApply.mock.calls[0][0]);
  const paymentLine = (document: typeof project) => document.content?.[12].content?.map(run => run.text).join('');
  expect(paymentLine(project)).toContain('以双方事先确认的各项目任务卡所列金额为准');
  expect(paymentLine(project)).toContain('于次月15日支付');
  expect(paymentLine(project)).not.toContain('300元');
  expect(JSON.stringify(project)).toContain('延期不自动扣减报酬');
  const projectFields = readInternshipTemplate(project)!.values;
  expect(projectFields).toMatchObject({settlement:'project', allowance:'', paymentTime:MONTHLY_PAYMENT_TIME});
  expect(completeInternshipFields(projectFields)).toBe(true);
  const daily = fillInternshipTemplate(project, {...projectFields, settlement:'daily', allowance:'300元/日'});
  expect(paymentLine(daily)).toContain('于次月15日支付');
  expect(JSON.stringify(daily)).toContain('工作半天按一半日津贴计');
  expect(JSON.stringify(daily)).not.toContain('延期不自动扣减报酬');
  expect(readInternshipTemplate(daily)?.values).toMatchObject({settlement:'daily', allowance:'300元/日', paymentTime:MONTHLY_PAYMENT_TIME});

  await setInput(container.querySelector<HTMLSelectElement>('select[name="settlement"]')!, 'daily');
  await setInput(container.querySelector<HTMLInputElement>('input[name="dailyRate"]')!, '');
  await setInput(container.querySelector<HTMLInputElement>('input[aria-label="Internship start date"]')!, '');
  container.querySelector<HTMLTextAreaElement>('textarea[name="duties"]')!.value = '';
  const saveButton = container.querySelector<HTMLButtonElement>('button[value="save"]')!;
  expect(saveButton.formNoValidate).toBe(true);
  // jsdom does not honor formNoValidate on the submitter.
  await act(async () => saveButton.form!.dispatchEvent(new SubmitEvent('submit', { bubbles:true, cancelable:true, submitter:saveButton })));
  expect(onApply).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({duties:'', start:'', end:initial.end, allowance:''}));
  const partial = readInternshipTemplate(fillInternshipTemplate(template, onSave.mock.calls[0][0]))?.values;
  expect(partial).toMatchObject({duties:'', start:'', end:initial.end, settlement:'daily', allowance:''});
  expect(completeInternshipFields(partial!)).toBe(false);
});
function ExternalNavigation() {
  const [, setSelected] = useQueryState('schedule', parseAsString.withDefault(''));
  return h('button', { onClick: () => void setSelected('') }, 'External navigation');
}

it('renders account names consistently across reports, comments and pickers without changing raw data', async () => {
  const rawName = 'Lang Yuan (袁朗)';
  const actor = { kind: 'staff', id: 12, role: 'member', name: rawName } as const;
  const directory = [{ id: 12, name: rawName, active: true }];
  const report: WorkReport = { id: 'name-report', memberId: 12, name: rawName, workDate: '2026-11-12', status: 'submitted', visibility: 'company', version: 1, progress: rawName, resultUrl: '', help: '', next: '', createdAt: 1, updatedAt: 1 };
  const detail = { report, comments: [{ id: 'comment', name: rawName, body: rawName, createdAt: 1 }], revisions: [] };
  const original = JSON.stringify({ directory, detail });
  const api: WorkspaceHost['api'] = async <T>(action: string) => (action.startsWith('reports?') ? { reports: [report], hasMore: false, page: 1 } : detail) as T;
  for (const [lang, expected] of [['zh', '袁朗'], ['en', 'Lang Yuan']] as const) {
    const nameHost: WorkspaceHost = { ...host, api, formatName: name => displayCuberName(name, lang === 'zh') };
    await act(async () => root.render(h(WorkspaceProvider, { host: nameHost, children: h(Fragment, null,
      h(Reports, { actor, directory }), h(ReportDetailPanel, { actor, id: report.id }),
    ) })));
    expect([...container.querySelectorAll('.staff-report-meta strong')].map(node => node.textContent)).toEqual([expected, expected, expected]);
    expect(container.querySelector('select[name="memberId"] option[value="12"]')?.textContent).toBe(expected);
    expect(container.querySelector('.staff-comment .staff-preserve')?.textContent).toBe(rawName);
    expect(JSON.stringify({ directory, detail })).toBe(original);
  }
});

it.each([false, true])('edits and deletes a report from the feed with server permissions (super administrator: %s)', async superAdmin => {
  const actor = { kind: 'staff', id: superAdmin ? 99 : 12, role: 'manager', name: 'Reader', canManageReports: superAdmin } as const;
  let report: WorkReport | undefined = { id: 'editable', memberId: 12, name: 'Author', workDate: '2026-11-12', startHour: 8, endHour: 13, status: 'submitted', visibility: 'company', version: 1, progress: 'Original', resultUrl: '', help: '', next: '', createdAt: 1, updatedAt: 1, canEdit: true, canDelete: true };
  let denyDelete = true;
  const api: WorkspaceHost['api'] = async <T>(action: string, body?: unknown): Promise<T> => {
    if (body !== undefined) {
      calls.push({action, body});
      if (action === 'report') report = {...report!, ...body as Partial<WorkReport>, version: 2};
      if (action === 'report-delete') { if (denyDelete) throw new Error('Reload before deleting'); report = undefined; }
      return {id: 'editable'} as T;
    }
    return ({reports: report ? [report] : [], hasMore: false, page: 1}) as T;
  };
  await act(async () => root.render(h(WorkspaceProvider, {host: {...host, api}, children: h(Reports, {actor, directory: []})})));
  await click('Edit report');
  expect(container.querySelector<HTMLInputElement>('[name="workDate"]')?.readOnly).toBe(!superAdmin);
  expect(container.querySelector('[name="memberId"]')).not.toBeNull(); // feed filter only; editing preserves authorship
  expect(container.querySelector('dialog [name="memberId"]')).toBeNull();
  const progress = container.querySelector<HTMLTextAreaElement>('textarea[name="progress"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(progress, 'Correction'); progress.dispatchEvent(new Event('input', {bubbles:true})); });
  await click('Save changes');
  expect(calls.at(-1)).toMatchObject({action:'report',body:{id:'editable',version:1,progress:'Correction'}});
  expect(container.querySelector('dialog')).toBeNull();
  expect(container.querySelector('.staff-preserve')?.textContent).toBe('Correction');
  await click('Delete report');
  expect(calls.filter(call => call.action==='report-delete')).toHaveLength(0);
  expect(container.querySelector('dialog')?.textContent).toContain('Author');
  await click('Confirm deletion');
  expect(container.querySelector('dialog')?.textContent).toContain('Reload before deleting');
  expect(container.querySelector('.staff-feed')?.textContent).toContain('Correction');
  denyDelete=false;await click('Confirm deletion');
  expect(calls.at(-1)).toEqual({action:'report-delete',body:{id:'editable',version:2}});
  expect(container.querySelector('dialog')).toBeNull();
  expect(container.querySelector('.staff-feed')?.textContent).not.toContain('Correction');
});

it('uses server permissions for detail actions and lets super administrators select an author when creating', async () => {
  const actor = {kind:'staff',id:99,role:'manager',name:'Root',canManageReports:true} as const;
  const report: WorkReport = { id:'other-report',memberId:12,name:'Author',workDate:'2026-11-12',startHour:8,endHour:13,status:'submitted',visibility:'company',version:1,progress:'Original',resultUrl:'',help:'',next:'',createdAt:1,updatedAt:1,canEdit:false,canDelete:false };
  const api: WorkspaceHost['api'] = async <T>(action: string, body?: unknown): Promise<T> => {
    if(body !== undefined){calls.push({action,body});return {id:'created'} as T;}
    return ({report,comments:[],revisions:[]}) as T;
  };
  const render = async (children: ReactNode) => { await act(async()=>root.render(h(WorkspaceProvider,{host:{...host,api},children}))); };
  await render(h(ReportDetailPanel,{actor,id:report.id}));
  expect(container.querySelector('[aria-label="Edit report"]')).toBeNull();
  expect(container.querySelector('[aria-label="Delete report"]')).toBeNull();
  report.canEdit=true;report.canDelete=true;
  await render(h(ReportDetailPanel,{actor,id:report.id}));
  await click('Edit report');
  expect(container.querySelector('dialog')).not.toBeNull();
  await render(h(ReportEditor,{actor,directory:[{id:99,name:'Root',active:true},{id:12,name:'Author',active:true}]}));
  await setInput(container.querySelector<HTMLSelectElement>('[name="memberId"]')!,'12');
  await click('Save draft');
  expect(calls.at(-1)).toMatchObject({action:'report',body:{memberId:12,version:0,status:'draft'}});
});


it('uses bare icon actions while keeping explicit report submissions styled as buttons', async () => {
  await mount(h(Fragment, null, h(WorkspaceButton, { action: 'add', children: 'New task' }), h(WorkspaceButton, { action: 'send', iconOnly: false, children: 'Submit report' })));
  const icon = container.querySelector('[aria-label="New task"]')!;
  expect(icon.classList.contains('workspace-icon-action')).toBe(true);
  expect(icon.classList.contains('btn-primary')).toBe(false);
  expect(icon.classList.contains('btn-secondary')).toBe(false);
  expect(container.querySelector('.btn-primary')?.textContent).toBe('Submit report');
});

it('collapses overlapping work into lanes while retaining milestones and editable task identity', async () => {
  const base = schedules[0].tasks[0];
  const tasks = [base, { ...base, id: 'parallel', name: 'Publish Android' }, { ...base, id: 'goal', name: 'Release target', kind: 'milestone' as const, start: '2027-01-02', end: '2027-01-02' }];
  const onEdit = vi.fn();
  await mount(h(ScheduleTimeline, { tasks, scale: 'fit', editable: true, onEdit }));
  expect(container.querySelectorAll('.workspace-gantt-phase')).toHaveLength(1);
  expect(container.querySelectorAll('.workspace-gantt-task')).toHaveLength(1);
  expect(container.querySelector('.workspace-gantt-key-label')?.textContent).toContain('Release target');
  const toggle = container.querySelector<HTMLButtonElement>('.workspace-lane-toggle')!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-phase')!.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelectorAll('.workspace-gantt-task')).toHaveLength(3);
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  expect(onEdit).toHaveBeenCalledWith(base);
  await act(async () => toggle.click());
  expect(container.querySelectorAll('.workspace-gantt-task')).toHaveLength(1);
  await mount(h(ScheduleTimeline, { tasks, scale: 'week', editable: false, onEdit }));
  expect(container.querySelectorAll('.workspace-gantt-task')).toHaveLength(3);
  expect(container.querySelector('.workspace-lane-toggle')).toBeNull();
  await mount(h(ScheduleTimeline, { tasks, scale: 'fit', editable: false, onEdit }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-lane-toggle')!.click());
  expect(container.querySelectorAll('.workspace-gantt-task')).toHaveLength(3);
  expect(onEdit).toHaveBeenCalledTimes(1);
});

it('fits a cross-year plan and thins ticks on narrow screens without moving tasks', async () => {
  let resize: (entries: { contentRect: { width: number } }[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: typeof resize) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  try {
    const tasks = [{ ...schedules[0].tasks[0], start: '2026-10-25', end: '2027-01-15' }];
    await mount(h(ScheduleTimeline, { tasks, scale: 'fit', editable: true, onEdit: vi.fn() }));
    expect(container.querySelector('.workspace-gantt-fit')).not.toBeNull();
    const bar = container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!;
    const position = [bar.style.left, bar.style.width];
    await act(async () => resize([{ contentRect: { width: 1100 } }]));
    const wideTicks = container.querySelectorAll('.workspace-gantt-tick').length;
    await act(async () => resize([{ contentRect: { width: 180 } }]));
    expect(container.querySelectorAll('.workspace-gantt-tick').length).toBeLessThan(wideTicks);
    expect(container.querySelectorAll('.workspace-gantt-tick').length).toBeGreaterThan(0);
    expect([bar.style.left, bar.style.width]).toEqual(position);
    await mount(h(ScheduleTimeline, { tasks: [], scale: 'fit', editable: true, onEdit: vi.fn() }));
    expect(disconnect).toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});

it('separates cross-year calendar headings from day ticks and uses proportional task positions', async () => {
  await mount(h(ScheduleTimeline, { tasks: schedules[0].tasks, scale: 'day', editable: true, onEdit: vi.fn() }));
  expect([...container.querySelectorAll('.workspace-gantt-period')].map(node => node.getAttribute('datetime'))).toEqual(['2026-12', '2027-01']);
  expect([...container.querySelectorAll('.workspace-gantt-tick time')].map(node => node.textContent)).toEqual(['30', '31', '01', '02', '03', '04', '05']);
  const bar = container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!;
  expect(bar.style.left).toContain('%');
  expect(bar.style.width).toContain('%');
  expect(bar.textContent).toBe('Build');
  expect(bar.getAttribute('aria-label')).toContain('Build');
  expect(bar.getAttribute('aria-label')).toContain('2026-12-30');
  expect(bar.getAttribute('aria-label')).toContain('2027-01-02');
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
  expect(container.querySelector('[name="resultUrl"], [name="help"], [name="next"]')).toBeNull();
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
  expect(calls.at(-1)).toMatchObject({ action: 'report', body: { startHour: 9, endHour: 24, status: 'submitted', resultUrl: '', help: '', next: '' } });
});

it('preserves historical optional report data when editing progress in the simplified form', async () => {
  const report: WorkReport = {
    id: 'report', memberId: 1, name: 'Alex', workDate: '2026-10-27', startHour: 9, endHour: 18, progress: 'Shipped',
    resultUrl: 'https://example.com/result', help: 'Review', next: 'Follow up',
    visibility: 'company', status: 'submitted', version: 2, createdAt: 1, updatedAt: 1,
  };
  await mount(h(ReportEditor, { report }));
  expect(container.querySelector('[name="resultUrl"], [name="help"], [name="next"]')).toBeNull();
  await click('Save changes');
  expect(calls.at(-1)).toMatchObject({ action: 'report', body: {
    id: report.id, version: 2, resultUrl: report.resultUrl, help: report.help, next: report.next,
  } });
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
  const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')!;
  await act(async () => close.focus());
  expect(close.hasAttribute('title')).toBe(false);
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Remove task"]')!.focus());
  const tooltip = document.querySelector('[role="tooltip"]');
  expect(tooltip?.textContent).toBe('Remove task');
  expect(tooltip?.closest('dialog')).toBe(dialog);
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

it('uses explicit categories and preserves literal prefixes when editing', async () => {
  lists[0].categories = [{ id: 'category', name: 'Development' }];
  lists[0].items = [{ id: 'a', text: '/timer Connection', done: false, categoryId: 'category' }];
  await mount(h(Checklists));
  expect([...container.querySelectorAll('.workspace-check-folder-name')].map(node => node.textContent)).toEqual(['Development']);
  await click('/timer Connection');
  await setInput(container.querySelector<HTMLInputElement>('[name="text"]')!, '/recon Connection');
  await click('Save');
  expect(calls.at(-1)).toMatchObject({ body: { categories: [{ id: 'category', name: 'Development' }], items: [{ id: 'a', text: '/recon Connection', categoryId: 'category' }] } });
  expect([...container.querySelectorAll('.workspace-check-folder-name')].map(node => node.textContent)).toEqual(['Development']);
});

it('applies checklist filters directly and excludes archived tasks from progress in every view', async () => {
  lists[0].categories = [{ id: 'release', name: 'Release' }];
  lists[0].items = [
    { id: 'a', text: 'Active incomplete', categoryId: 'release', done: false },
    { id: 'b', text: 'Active completed', categoryId: 'release', done: true },
    { id: 'c', text: 'Archived completed', categoryId: 'release', done: true, archived: true },
    { id: 'd', text: 'Archived incomplete', categoryId: 'release', done: false, archived: true },
  ];
  await mount(h(Checklists));
  const texts = () => [...container.querySelectorAll('.workspace-check-text')].map(node => node.textContent);
  const progress = () => container.querySelector('.workspace-check-count')?.textContent;
  expect(progress()).toBe('1/2');
  await click('Filters');
  expect(document.querySelector('.workspace-check-filters select')).toBeNull();
  expect(document.querySelectorAll('.workspace-check-filters [role="tablist"]')).toHaveLength(3);
  await click('Archived');
  expect(texts()).toEqual(['Archived incomplete', 'Archived completed']);
  expect(progress()).toBe('1/2');
  await click('Completed');
  expect(texts()).toEqual(['Archived completed']);
  expect(progress()).toBe('1/2');
  const archiveFilters = document.querySelector('[role="tablist"][aria-label="Task archive"]')!;
  await act(async () => [...archiveFilters.querySelectorAll('button')].find(button => button.textContent === 'All')!.click());
  expect(texts()).toEqual(['Active completed', 'Archived completed']);
  expect(progress()).toBe('1/2');
  await click('Reset filters');
  expect(texts()).toEqual(['Active incomplete', 'Active completed']);
  expect(progress()).toBe('1/2');
  expect(calls).toHaveLength(0);
});

it('creates an empty category, adds tasks in it, and deletes its hidden archived contents', async () => {
  await mount(h(Checklists));
  await click('Checklist actions: Launch'); await click('New category');
  await setInput(container.querySelector<HTMLInputElement>('[aria-label="Category name"]')!, 'Development');
  await click('Save');
  const category = lists[0].categories![0];
  expect(category.name).toBe('Development');
  await setInput(container.querySelector<HTMLInputElement>('[aria-label="New task"]')!, '/any literal');
  await click('Save');
  expect(lists[0].items.at(-1)).toMatchObject({ text: '/any literal', categoryId: category.id });
  const groups = container.querySelectorAll('.workspace-check-category');
  expect(groups[0].querySelector('.workspace-category-heading')).toBeNull();
  expect(groups[0].querySelector('.workspace-check-item')?.textContent).toContain('First');
  expect(groups[1].querySelector('.workspace-check-folder-name')?.textContent).toBe('Development');
  expect(container.querySelector<HTMLInputElement>('[aria-label="New task"]')!.value).toBe('');
  await click('Cancel');
  // Archived task is absent from the current filter, but belongs to the category.
  lists[0].items.push({ id: 'hidden', text: 'Archived', categoryId: category.id, done: true, archived: true });
  await mount(h(Checklists));
  await click('Category actions: Development'); await click('Delete category');
  expect(container.querySelector('dialog')?.textContent).toContain('2 tasks');
  await click('Delete all');
  expect(lists[0].categories).toEqual([]);
  expect(lists[0].items.map(item => item.id)).toEqual(['a', 'b']);
});

it('keeps a failed inline edit and cancels it without changing the saved task', async () => {
  await mount(h(Checklists));
  await click('First');
  const input = container.querySelector<HTMLInputElement>('[aria-label="Task"]')!;
  await setInput(input, 'Unsaved edit');
  rejectSave = true;
  await click('Save');
  expect(input.value).toBe('Unsaved edit');
  expect(lists[0].items[0].text).toBe('First');
  await click('Cancel');
  expect(container.querySelector('[aria-label="Task"]')).toBeNull();
  expect(container.textContent).toContain('First');
});

it('keeps separate drafts when switching the category used for task entry', async () => {
  lists[0].categories = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
  lists[0].items = [];
  await mount(h(Checklists));
  const groups = container.querySelectorAll<HTMLElement>('.workspace-check-category');
  await act(async () => groups[0].querySelector<HTMLButtonElement>('.workspace-category-heading > .more-toggle')!.click());
  await act(async () => groups[1].querySelector<HTMLButtonElement>('.workspace-category-heading > .more-toggle')!.click());
  await act(async () => groups[0].querySelector<HTMLButtonElement>('.workspace-add-task')!.click());
  await setInput(container.querySelector<HTMLInputElement>('[aria-label="New task"]')!, 'Draft one');
  await act(async () => groups[1].querySelector<HTMLButtonElement>('.workspace-add-task')!.click());
  await setInput(container.querySelector<HTMLInputElement>('[aria-label="New task"]')!, 'Draft two');
  await act(async () => groups[0].querySelector<HTMLButtonElement>('.workspace-add-task')!.click());
  expect(container.querySelector<HTMLInputElement>('[aria-label="New task"]')!.value).toBe('Draft one');
  await click('Save');
  expect(lists[0].items[0]).toMatchObject({ text: 'Draft one', categoryId: 'one' });
});

it('persists checkbox completion and restores original order when unchecked', async () => {
  await mount(h(Checklists));
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect([...container.querySelectorAll('.workspace-check-text')].map(node => node.textContent)).toEqual(['Second', 'First']);
  expect(container.querySelector('.is-done')?.textContent).toContain('First');
  await act(async () => container.querySelector<HTMLInputElement>('.is-done input')!.click());
  expect([...container.querySelectorAll('.workspace-check-text')].map(node => node.textContent)).toEqual(['First', 'Second']);
});

it('creates a checklist using only its name and sharing settings', async () => {
  await mount(h(Checklists));
  expect(container.textContent).not.toContain('All categories');
  await click('New checklist');
  expect(container.querySelector('[name="category"]')).toBeNull();
  await setInput(container.querySelector<HTMLInputElement>('[name="name"]')!, 'Named list');
  await click('Save');
  expect(calls.at(-1)).toMatchObject({ action: 'checklist', body: { name: 'Named list', active: true, items: [] } });
  expect(calls.at(-1)?.body).not.toHaveProperty('category');
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
  await click('+ Add task');
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
  rejectSave = true;
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  rejectSave = false;
  let resolveRead!: () => void;
  pendingRead = new Promise<void>(resolve => { resolveRead = resolve; });
  await click('Reload');
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => resolveRead());
  expect(container.querySelector('.is-done')?.textContent).toContain('First');
  await act(async () => container.querySelector<HTMLInputElement>('.is-done input')!.click());
  expect(calls.at(-1)).toMatchObject({ action: 'checklist', body: { version: 2 } });
});

it('confirms whole-checklist deletion, supports cancellation and retains failed deletions', async () => {
  await mount(h(Checklists));
  expect(container.querySelector('.workspace-toolbar [aria-label="Reload"]')).toBeNull();
  expect(container.querySelector('.workspace-check-items [aria-label*="Delete"]')).toBeNull();
  await click('Checklist actions: Launch'); await click('Delete checklist');
  expect(container.querySelector('dialog')?.textContent).toContain('Launch');
  expect(container.querySelector('dialog')?.textContent).toContain('2 tasks');
  expect(calls).toHaveLength(0);
  await click('Cancel');
  expect(container.querySelector('dialog')).toBeNull();
  expect(container.querySelector('.workspace-checklist')).not.toBeNull();
  await click('Checklist actions: Launch'); await click('Delete checklist');
  rejectSave = true;
  await click('Delete all');
  expect(container.querySelector('dialog')?.textContent).toContain('Reload before saving');
  expect(container.querySelector('.workspace-checklist')).not.toBeNull();
  rejectSave = false;
  await click('Delete all');
  expect(calls.at(-1)).toEqual({ action: 'checklist-delete', body: { id: 'list', version: 1 } });
  expect(container.querySelector('.workspace-checklist')).toBeNull();
});

it('does not restore a deleted checklist from an older pending read', async () => {
  await mount(h(Checklists));
  rejectSave = true;
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  rejectSave = false;
  let resolveRead!: () => void;
  pendingRead = new Promise<void>(resolve => { resolveRead = resolve; });
  await click('Reload');
  await click('Checklist actions: Launch'); await click('Delete checklist');
  await click('Delete all');
  expect(container.querySelector('.workspace-checklist')).toBeNull();
  await act(async () => resolveRead());
  expect(container.querySelector('.workspace-checklist')).toBeNull();
});

it('hides checklist deletion when editing is unavailable', async () => {
  lists[0].canEdit = false;
  await mount(h(Checklists));
  expect(container.querySelector('[aria-label="Delete checklist: Launch"]')).toBeNull();
});

it('confirms deletion in schedule settings and retains edits on cancellation or failure', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await click('Settings');
  await setInput(container.querySelector<HTMLInputElement>('[name="name"]')!, 'Unsaved name');
  await click('Delete current schedule');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Launch');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Tasks: 1');
  expect(calls).toHaveLength(0);
  await click('Cancel deletion');
  expect(container.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe('Unsaved name');
  await click('Delete current schedule');
  rejectSave = true;
  await click('Confirm deletion');
  expect(container.querySelector('dialog')?.textContent).toContain('Reload before saving');
  expect(container.querySelector('.workspace-gantt')).not.toBeNull();
  rejectSave = false;
  await click('Confirm deletion');
  expect(calls.at(-1)).toEqual({ action: 'schedule-delete', body: { id: 'schedule', version: 1 } });
  expect(container.querySelector('dialog')).toBeNull();
  expect(container.querySelector('.workspace-gantt')).toBeNull();
  expect(container.textContent).toContain('No schedules');
});

it('keeps deleted schedules out of delayed reads and locks dismissal while deleting', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  let resolveRead!: () => void;
  pendingRead = new Promise<void>(resolve => { resolveRead = resolve; });
  await click('Reload');
  await click('Settings');
  await click('Delete current schedule');
  let resolveSave!: () => void;
  pendingSave = new Promise<void>(resolve => { resolveSave = resolve; });
  await click('Confirm deletion');
  await act(async () => container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(container.querySelector('dialog')).not.toBeNull();
  expect(container.querySelector('select')!.matches(':disabled')).toBe(true);
  await act(async () => resolveSave());
  expect(container.querySelector('.workspace-gantt')).toBeNull();
  await act(async () => resolveRead());
  expect(container.querySelector('.workspace-gantt')).toBeNull();
  expect(container.querySelector('select')?.textContent).not.toContain('Launch');
});

it('does not expose schedule settings or deletion to read-only members', async () => {
  schedules[0].canEdit = false;
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'member', name: 'Member' } }));
  expect(container.querySelector('[aria-label="Settings"]')).toBeNull();
  expect(container.textContent).not.toContain('Delete current schedule');
});

it('opens the same editor from a timeline task and copies a schedule with shifted dates', async () => {
  await mount(h(Schedules, { actor: { kind: 'staff', id: 1, role: 'manager', name: 'Manager' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('.workspace-gantt-bar')!.click());
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Complete"]')!.click());
  await click('Save');
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


it('saves the Mac checklist on first edit and preserves deletion of every item after remount', async () => {
  lists = [];
  await mount(h(MacSetupChecklist));
  expect(container.textContent).not.toContain('RustDesk');
  expect(calls).toHaveLength(0);
  expect(container.querySelector('[aria-label="Required"]')?.textContent).toContain('Homebrew');
  expect(container.querySelector('[aria-label="Optional"]')?.textContent).toContain('Chrome');
  expect(container.querySelectorAll('th').length).toBe(8);
  await click('Delete task: Chrome：Browse and debug, optional (Safari included)');
  expect(lists).toHaveLength(1);
  expect(lists[0].version).toBe(1);
  expect(lists[0].items.some(item => item.text.startsWith('Chrome'))).toBe(false);
  expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  expect(container.querySelector('[aria-label="Drag to reorder: ChatGPT / Codex"]')).not.toBeNull();
  await click('Move to optional: ChatGPT / Codex');
  expect(container.querySelector('[aria-label="Optional"]')?.textContent).toContain('ChatGPT / Codex');
  await click('Move to required: ChatGPT / Codex');
  expect(container.querySelector('[aria-label="Required"]')?.textContent).toContain('ChatGPT / Codex');
  await setInput(container.querySelector<HTMLInputElement>('[aria-label="New task"]')!, 'Custom app: My task');
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(lists[0].items.at(-1)?.text).toBe('Custom app: My task');
  for (const item of [...lists[0].items]) await click(`Delete task: ${item.text}`);
  expect(lists[0].items).toEqual([]);
  await mount(null);
  await mount(h(MacSetupChecklist));
  expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
});

it('keeps Mac checklist items visible when saving is rejected', async () => {
  lists = [];
  await mount(h(MacSetupChecklist));
  rejectSave = true;
  await click('Delete task: Chrome：Browse and debug, optional (Safari included)');
  expect(container.textContent).toContain('Reload before saving');
  expect(container.querySelector('[aria-label="Move to required: Chrome"]')).not.toBeNull();
  expect(lists).toHaveLength(0);
});

it('reorders visible items without moving hidden items or other groups', () => {
  const items = [{ id: 'a' }, { id: 'hidden' }, { id: 'b' }, { id: 'other' }, { id: 'c' }];
  expect(replaceSortableItems(items, [items[4], items[0], items[2]]).map(item => item.id)).toEqual(['c', 'hidden', 'a', 'other', 'b']);
  expect(items.map(item => item.id)).toEqual(['a', 'hidden', 'b', 'other', 'c']);
});
