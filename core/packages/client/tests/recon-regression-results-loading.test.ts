// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), intake: vi.fn(), mobile: false, user: { wcaId: 'admin' } }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: mocks.fetch }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, useIsAdmin: () => true }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}), handleApi: (response: Response) => response.json() }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (url: string) => url }));
vi.mock('@/i18n/tr', () => ({ tr: (copy: { zh: string }) => copy.zh, useLang: () => 'zh' }));
vi.mock('@/lib/recon-intake-api', () => ({ intakeRequest: mocks.intake, resolveIntakeSource: async (source: unknown) => source }));
vi.mock('@/components/InfoTooltip/InfoTooltip', () => ({ InfoTooltip: () => null }));
vi.mock('@/components/PageHeading', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/components/WcaAuth', () => ({ default: () => null }));
vi.mock('@/components/MoreToggle', () => ({ default: () => null }));
vi.mock('@/app/[lang]/recon/ground-truth/SourceInfo', () => ({ default: () => null }));
import RegressionResults from '@/app/[lang]/recon/ground-truth/RegressionResults';

let root: Root;
let host: HTMLDivElement;
const pending: Array<(value: unknown) => void> = [];
const history = (issue: string) => ({ scope: 'local', runs: [], cases: [{
  id: 'fixture', issue, source: '', approved: true, expected: [], status: 'not-run', errors: [],
}], hasMore: false });
const respond = (index: number, data: unknown) => pending[index]({ json: async () => data });
beforeEach(() => {
  vi.useFakeTimers(); pending.length = 0;
  mocks.mobile = false;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.fetch.mockReset().mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  mocks.intake.mockReset().mockResolvedValue({ items: [], hasMore: false });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});

it('paginates the complete catalog and applies person and collector filters before paging', async () => {
  const first = '00000000-0000-4000-8000-000000000001';
  const last = '00000000-0000-4000-8000-000000000013';
  mocks.intake.mockResolvedValueOnce({ items: [{ id: first, createdBy: 'collector-a', sourceSnapshot: {
    id: 1, metadata: { personId: 'solver-a', person: 'Solver A' },
  } }], hasMore: true }).mockResolvedValueOnce({ items: [{ id: last, createdBy: 'collector-b', sourceSnapshot: {
    id: 13, metadata: { personId: 'solver-b', person: 'Solver B' },
  } }], hasMore: false });
  const cases = Array.from({ length: 13 }, (_, i) => ({
    ...history('Issue ' + i).cases[0], id: i === 0 ? 'intake-' + first + '-v1' : i === 12 ? 'intake-' + last + '-v1' : 'case-' + i,
  }));
  await act(async () => root.render(createElement(RegressionResults)));
  await act(async () => respond(0, { scope: 'local', runs: [], cases, hasMore: false }));
  expect(mocks.intake).toHaveBeenNthCalledWith(2, '?status=all&summary=1&offset=50');
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(6);
  const next = host.querySelector<HTMLButtonElement>('[aria-label="下一页样例"]')!;
  await act(async () => next.click());
  expect(host.querySelector('.gt-pages')?.textContent).toContain('2 / 3');
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(6);
  const select = async (label: string, value: string) => {
    const control = [...host.querySelectorAll('label')].find(item => item.querySelector('span')?.textContent === label)!.querySelector('select')!;
    await act(async () => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); });
  };
  await select('选手', 'solver-b');
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(1);
  expect(host.querySelector('.gt-candidate')?.textContent).toContain('Solver B');
  expect(host.querySelector('.gt-pages')?.textContent).toContain('1 / 1');
  await select('收录人', 'collector-a');
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(0);
  await select('选手', '');
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(1);
  await select('收录人', 'unknown');
  expect(host.querySelector('.gt-section-head')?.textContent).toContain('11');
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(6);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('loads immediately after StrictMode effect replay and ignores the stale response', async () => {
  await act(async () => root.render(createElement(StrictMode, null, createElement(RegressionResults))));
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain('正在加载检查记录');
  expect(host.textContent).not.toContain('当前没有符合筛选条件的样例');
  await act(async () => respond(0, history('旧结果')));
  expect(host.textContent).not.toContain('旧结果');
  // The stale request's finally must not unlock the replacement request.
  await act(async () => vi.advanceTimersByTime(15000));
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async () => respond(1, history('首次切换的结果')));
  expect(host.textContent).toContain('首次切换的结果');
  expect(host.textContent).not.toContain('正在加载检查记录');
});

it('shows an empty state only after an empty response completes', async () => {
  await act(async () => root.render(createElement(RegressionResults)));
  expect(host.textContent).not.toContain('当前没有符合筛选条件的样例');
  await act(async () => respond(0, { scope: 'local', runs: [], cases: [], hasMore: false }));
  expect(host.textContent).toContain('当前没有符合筛选条件的样例');
  expect(host.textContent).toContain('还没有检查记录');
});

it('keeps narrow-screen pages to three cases', async () => {
  mocks.mobile = true;
  await act(async () => root.render(createElement(RegressionResults)));
  await act(async () => respond(0, { scope: 'local', runs: [], hasMore: false,
    cases: Array.from({ length: 7 }, (_, i) => ({ ...history('Issue').cases[0], id: 'case-' + i })),
  }));
  expect(host.querySelectorAll('.gt-candidate')).toHaveLength(3);
  expect(host.querySelector('.gt-pages')?.textContent).toContain('1 / 3');
});
