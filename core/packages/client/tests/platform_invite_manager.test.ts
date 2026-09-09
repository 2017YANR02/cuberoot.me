// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: ReactNode }) => children }));
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/platform-gateway', async importOriginal => ({ ...await importOriginal<object>(), loadPlatformResource: load }));
import { PlatformAdminActions } from '@/components/platform/PlatformDomainActions';

const course = { id: 'course-test', title: '测试课程', status: 'published', data: { lessons: [
  { id: 'intro', titleZh: '引言 01' }, { id: 'trial', titleZh: '试听课 01' },
  { id: 'core-1', titleZh: '正式课 01' }, { id: 'core-2', titleZh: '正式课 02' },
] } } as PlatformEntity;
afterEach(() => vi.clearAllMocks());
async function mount(entities: PlatformEntity[] = []) {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  const runAction = vi.fn().mockResolvedValue({ id: 'fake-id', code: 'TEST-ONLY-CODE' });
  await act(async () => root.render(createElement(PlatformAdminActions, {
    definition: { id: 'admin-invites' } as PlatformRouteDefinition, params: {}, entities, busy: null, runAction,
  })));
  return { host, runAction, close: () => act(async () => root.unmount()) };
}

it('creates distinct trial and formal access, with one learner by default and full access only when selected', async () => {
  load.mockResolvedValue({ items: [course] });
  const { host, runAction, close } = await mount();
  try {
    expect(host.querySelectorAll('details[open]')).toHaveLength(0);
    const form = host.querySelector('form')!;
    const scope = form.querySelectorAll('select')[1];
    const submit = () => act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await submit();
    expect(runAction.mock.lastCall?.[2]).toMatchObject({ maxRedemptions: 1, expiresAt: null,
      benefit: { courseId: course.id, lessonIds: ['core-1', 'core-2'] } });
    const result = host.querySelector('.platform-invite-result')!;
    expect(result.querySelector<HTMLInputElement>('input[readonly]')?.value).toBe('TEST-ONLY-CODE');
    expect(result.querySelector('textarea')).toBeNull();
    expect(result.textContent).not.toMatch(/离开页面|保存表格/);
    expect(result.textContent).toContain('下载');
    await act(async () => { scope.value = 'trial'; scope.dispatchEvent(new Event('change', { bubbles: true })); });
    await submit();
    expect(runAction.mock.lastCall?.[2].benefit).toEqual({ courseId: course.id, lessonIds: ['trial'] });
    expect(host.querySelector('textarea[readonly]')?.textContent).toBe('TEST-ONLY-CODE\nTEST-ONLY-CODE');
    expect(host.querySelector('textarea[readonly]')?.getAttribute('rows')).toBe('2');
    await act(async () => { scope.value = 'all'; scope.dispatchEvent(new Event('change', { bubbles: true })); });
    await submit();
    expect(runAction.mock.lastCall?.[2].benefit).toEqual({ courseId: course.id });
  } finally { await close(); }
});

it('presents existing records in everyday language and keeps management folded', async () => {
  load.mockResolvedValue({ items: [course] });
  const { host, close } = await mount([
    { id: 'first', title: '正式课测试', status: 'active', data: { distributionType: 'invitation', maxRedemptions: 1, redemptionCount: 1, benefitSnapshot: { courseId: course.id, lessonIds: ['core-1', 'core-2'] } } },
    { id: 'second', title: '试听测试', status: 'active', data: { expiresAt: '2020-01-01T00:00:00Z', redemptionCount: 0 } },
  ] as PlatformEntity[]);
  try {
    const records = host.querySelector('.platform-invite-records')!;
    expect(records.textContent).toContain('已用完');
    expect(records.textContent).toContain('已用 1 / 1 次');
    expect(records.textContent).toContain('已过期');
    expect(records.textContent).not.toMatch(/distributionType|invitation|benefitSnapshot|course-test|expiresAt|createdAt|revokedReason/);
    expect(records.querySelectorAll('details[open]')).toHaveLength(0);
    const actions = records.querySelector('.platform-domain-form .platform-write-actions')!;
    expect(Array.from(actions.querySelectorAll('button'), button => button.textContent)).toEqual(['保存', '删除']);
    expect(actions.querySelectorAll('button')[1].type).toBe('button');
    expect(records.textContent).not.toContain('停用并归档');
    expect(records.querySelector('textarea')).toBeNull();
    expect(records.querySelectorAll('.platform-invite-record')).toHaveLength(2);
    expect(records.querySelectorAll('.platform-invite-status[data-available="false"]')).toHaveLength(2);
    expect(records.querySelectorAll('.platform-invite-meta')[1].textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} 到期/);
    expect(host.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(host.querySelectorAll('.platform-invite-expiry .date-input')).toHaveLength(4);
    expect(host.querySelector<HTMLInputElement>('input[type="time"]')?.disabled).toBe(true);
  } finally { await close(); }
});

it('blocks creation when lessons fail to load or the selected section has no lessons', async () => {
  load.mockResolvedValueOnce({ items: [course] }).mockRejectedValueOnce(new Error('fixture failure'));
  const { host, runAction, close } = await mount();
  try {
    expect(host.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
    expect(host.textContent).toContain('课程加载失败');
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(runAction).not.toHaveBeenCalled();
  } finally { await close(); }
});

it('requires confirmation to delete only the selected invitation without submitting its settings', async () => {
  load.mockResolvedValue({ items: [course] });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const { host, runAction, close } = await mount([
    { id: 'delete-target', title: '待删除正式课', status: 'active' },
    { id: 'keep-target', title: '保留试听课', status: 'active' },
  ] as PlatformEntity[]);
  try {
    const button = Array.from(host.querySelectorAll('button')).find(button => button.textContent === '删除')!;
    await act(async () => button.click());
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('待删除正式课'));
    expect(runAction).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => button.click());
    expect(runAction).toHaveBeenCalledExactlyOnceWith('admin-delete', 'delete-target', undefined);
    // No optimistic removal: the list changes only after the parent reloads persisted data.
    expect(host.querySelectorAll('.platform-invite-record')).toHaveLength(2);
  } finally { confirm.mockRestore(); await close(); }
});

it('hides archived invitations after reload but retains physical-bundle audit controls', async () => {
  load.mockResolvedValue({ items: [course] });
  const { host, close } = await mount([
    { id: 'archived', title: '已删除记录', status: 'archived' },
    { id: 'physical', title: '实体赠课记录', status: 'archived', data: { distributionType: 'physical_bundle' } },
  ] as PlatformEntity[]);
  try {
    const records = host.querySelector('.platform-invite-records')!;
    expect(records.textContent).not.toContain('已删除记录');
    expect(records.textContent).toContain('实体赠课记录');
    expect(Array.from(records.querySelectorAll('button')).some(button => button.textContent === '删除')).toBe(false);
  } finally { await close(); }
  const empty = await mount([{ id: 'archived', title: '已删除记录', status: 'archived' }] as PlatformEntity[]);
  try {
    expect(empty.host.querySelectorAll('.platform-invite-record')).toHaveLength(0);
    expect(empty.host.textContent).toContain('还没有兑换码。');
  } finally { await empty.close(); }
});

it('rejects expired new codes and invalid learner limits without sending requests', async () => {
  load.mockResolvedValue({ items: [course] });
  const { host, runAction, close } = await mount();
  try {
    const form = host.querySelector('form')!;
    const expires = form.querySelector<HTMLInputElement>('[name="expiresAt"]')!;
    const maximum = form.querySelector<HTMLInputElement>('[name="maxRedemptions"]')!;
    expires.value = '2020-01-01T00:00';
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(host.textContent).toContain('请选择将来的到期时间');
    expires.value = '';
    maximum.value = '0';
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(host.textContent).toContain('可用人数请填写正整数');
    expect(runAction).not.toHaveBeenCalled();
  } finally { await close(); }
});
