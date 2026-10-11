// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { loadAlg } = vi.hoisted(() => ({ loadAlg: vi.fn() }));
vi.mock('@/lib/alg_case_alignment', () => ({ loadAlg }));
vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => false }));
vi.mock('@/hooks/useContentRefreshKey', () => ({ useContentRefreshKey: () => 0 }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  usePathname: () => '/alg/_/_/_',
}));
vi.mock('@/components/AlgCategoryView', () => ({
  default: ({ puzzleParam, set, subgroupParam }: { puzzleParam: string; set: string; subgroupParam: string }) => `${puzzleParam}/${set}/group:${subgroupParam}`,
}));
vi.mock('@/app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView', () => ({
  default: ({ puzzle, set, caseObj }: { puzzle: string; set: string; caseObj: { name: string } }) => `${puzzle}/${set}/case:${caseObj.name}`,
}));

import { TrainingHostProvider } from '@/lib/training-host';
import { resolveTrainingTarget } from '@/lib/timer-training-catalog';
import AlgSubOrCaseClient from '@/app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgSubOrCaseClient';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  loadAlg.mockResolvedValue({ cases: [{ name: 'CaseA', subgroup: 'u', algs: [[{ alg: 'R' }]] }] });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it.each([
  ['/alg/3x3/coll/casea', '3x3/coll/case:CaseA'],
  ['/alg/3x3/coll/%75', '3x3/coll/group:u'],
  ['/alg/333/coll/casea', '3x3/coll/case:CaseA'],
  ['/alg/333/coll/%75', '3x3/coll/group:u'],
])('resolves the hosted path %s instead of the surrounding timer URL', async (path, expected) => {
  window.history.replaceState({}, '', '/zh/timer?training=%2Falg%2F3x3%2Fcoll%2Fcasea');
  const target = resolveTrainingTarget(path)!;
  expect(target).not.toBeNull();
  await act(async () => root.render(createElement(TrainingHostProvider, {
    value: { path: target.path, params: target.params, mapHref: href => href },
    children: createElement(AlgSubOrCaseClient),
  })));
  expect(loadAlg).toHaveBeenCalledWith('3x3', 'coll', { fresh: false });
  expect(container.textContent).toBe(expected);
});

it('keeps resolving the actual standalone URL when Next supplies sentinel params', async () => {
  window.history.replaceState({}, '', '/zh/alg/3x3/coll/casea');
  await act(async () => root.render(createElement(AlgSubOrCaseClient)));
  expect(loadAlg).toHaveBeenCalledWith('3x3', 'coll', { fresh: false });
  expect(container.textContent).toBe('3x3/coll/case:CaseA');
});
