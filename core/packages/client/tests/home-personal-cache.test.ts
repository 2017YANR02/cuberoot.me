// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useCompFollows } from '@/components/CompFollow';
import PersonUpcomingComps from '@/components/persons/sections/PersonUpcomingComps';
import { useAuthStore } from '@/lib/auth-store';

const api = vi.hoisted(() => ({ follows: vi.fn(), catalog: vi.fn(), registrations: vi.fn() }));
vi.mock('@/lib/auth-store', async () => {
  const { create } = await import('zustand');
  return { useAuthStore: create(() => ({ user: { uid: 1, wcaId: '2023TEST01', isAdmin: false } })) };
});
vi.mock('@/lib/comp-follows', () => ({ fetchFollows: api.follows, addFollow: vi.fn(), removeFollow: vi.fn() }));
vi.mock('@/lib/comp-search', () => ({ loadLandingComps: api.catalog }));
vi.mock('@/lib/person-upcoming', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/person-upcoming')>(),
  fetchPersonUpcomingCompetitionIds: api.registrations,
}));
vi.mock('@/components/CompCardWithRounds', () => ({
  CompCardWithRounds: ({ comp }: { comp: { name: string } }) => createElement('span', null, comp.name),
  wcaRoundsSeed: vi.fn(),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
const host = document.createElement('div');
function PersonalArea() {
  const { follows, loaded } = useCompFollows();
  return loaded ? createElement(PersonUpcomingComps, {
    wcaId: '2023TEST01', isZh: false, compactDetails: true, title: null, followedIds: follows,
  }) : createElement('span', null, 'loading');
}
async function mount() {
  root = createRoot(host);
  await act(async () => root!.render(createElement(PersonalArea)));
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  useAuthStore.setState({ user: null });
});

it('shows cached personal competitions during a return refresh, updates them, and retains them on failure', async () => {
  const competition = { id: 'Followed2099', name: 'Cached competition', country: 'China', start_date: '2099-01-01', end_date: '2099-01-01' };
  api.follows.mockResolvedValue(['Followed2099']);
  api.catalog.mockResolvedValue([competition]);
  api.registrations.mockResolvedValue([]);
  await mount();
  expect(host.textContent).toBe('Cached competition');
  await act(async () => root!.unmount());

  let resolveCatalog!: (value: typeof competition[]) => void;
  api.catalog.mockImplementationOnce(() => new Promise(resolve => { resolveCatalog = resolve; }));
  await mount();
  expect(api.catalog).toHaveBeenCalledTimes(2);
  expect(api.follows).toHaveBeenCalledTimes(2);
  expect(host.textContent).toBe('Cached competition');
  await act(async () => resolveCatalog([{ ...competition, name: 'Updated competition' }]));
  expect(host.textContent).toBe('Updated competition');
  await act(async () => root!.unmount());

  api.catalog.mockRejectedValueOnce(new Error('offline'));
  api.follows.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(host.textContent).toBe('Updated competition');
});
