// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/i18n/tr', () => ({ tr: (text: { zh: string }) => text.zh }));
vi.mock('@/components/WcaPersonPicker', () => ({ WcaPersonPicker: () => null }));
vi.mock('@/components/WcaEventSelector', () => ({ default: () => null }));
vi.mock('@/components/EventIcon', () => ({ EventIcon: () => null }));
vi.mock('@/components/Flag', () => ({ Flag: () => null }));
vi.mock('@/components/PersonLink', () => ({ default: ({ name }: { name: string }) => name }));
import { WcaTeacherCell, type WcaTeacherDirectory } from '@/components/WcaTeacherCell';

const company = { id: '11111111-1111-4111-8111-111111111111', name: '上海魔方根科技有限公司' };
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
function directory(hasTeacher = false, hasInstitution = false): WcaTeacherDirectory {
  return {
    teachers: new Map(hasTeacher ? [['2023GENG02:333', { studentWcaId: '2023GENG02', eventId: '333', teacherWcaId: '2017YANR02', teacherName: '颜瑞民', teacherCountryIso2: null, isSelfTaught: false }]] : []),
    loading: false, ready: true, loadFailed: false, userWcaId: '2017YANR02', isAdmin: true, canSelfAssign: true,
    save: vi.fn(), remove: vi.fn(),
    institutions: { institutions: [company], assignments: [], ready: true, failed: false, retry: vi.fn(), get: () => hasInstitution ? company : undefined, save: vi.fn() },
  };
}
async function render(data: WcaTeacherDirectory) {
  await act(async () => root.render(createElement(WcaTeacherCell, { studentWcaId: '2023GENG02', eventIds: ['333'], directory: data, isZh: true })));
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent === text || node.getAttribute('aria-label') === text)!;
  expect(button).toBeTruthy(); await act(async () => button.click());
}
async function select(label: string, value: string) {
  const control = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  await act(async () => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('displays all four combinations without turning an institution-only student into self-taught', async () => {
  for (const teacher of [false, true]) for (const institution of [false, true]) {
    await render(directory(teacher, institution));
    expect(host.textContent?.includes('颜瑞民')).toBe(teacher);
    expect(host.textContent?.includes(company.name)).toBe(institution);
    expect(host.textContent).not.toContain('自学');
  }
});
it('saves an institution alone without creating or removing teacher relations', async () => {
  const data = directory(); await render(data); await click('填写');
  await select('培训机构', company.id); await click('保存');
  expect(data.institutions.save).toHaveBeenCalledWith('2023GENG02', company.id);
  expect(data.save).not.toHaveBeenCalled(); expect(data.remove).not.toHaveBeenCalled();
});
it('clears a teacher only on save and retains the independent institution', async () => {
  const data = directory(true, true); await render(data); await click('编辑');
  await select('选择学习方式', 'none'); expect(data.remove).not.toHaveBeenCalled();
  await click('保存'); expect(data.remove).toHaveBeenCalledWith('2023GENG02', '333');
  expect(data.institutions.save).not.toHaveBeenCalled();
});
it('cancels both edits without writing either relation', async () => {
  const data = directory(true, true); await render(data); await click('编辑');
  await select('选择学习方式', 'none'); await select('培训机构', ''); await click('取消');
  expect(data.remove).not.toHaveBeenCalled(); expect(data.save).not.toHaveBeenCalled(); expect(data.institutions.save).not.toHaveBeenCalled();
});
