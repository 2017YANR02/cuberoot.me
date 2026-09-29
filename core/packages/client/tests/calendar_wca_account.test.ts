// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useWcaCalendar } from '@/app/[lang]/calendar/_lib/useWcaCalendar';
import { fetchWcaPersonCompetitions } from '@/lib/wca-person-api';
import type { WcaCompetition } from '@/lib/wca-person-api';

vi.mock('@/lib/wca-person-api', () => ({ fetchWcaPersonCompetitions: vi.fn() }));
vi.mock('@/lib/person-upcoming', () => ({ fetchPersonUpcomingCompetitions: async () => ({ ids: [], incomplete: false }) }));
vi.mock('@/lib/comp-follows', () => ({ fetchFollows: async () => [] }));
vi.mock('@/lib/comp-search', () => ({ loadComps: async () => [] }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('clears one account’s competitions immediately and ignores its late response after switching accounts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  let finishOld!: (rows: WcaCompetition[]) => void;
  vi.mocked(fetchWcaPersonCompetitions).mockImplementation((id) => id === '2017ROOT01'
    ? new Promise((resolve) => { finishOld = resolve; })
    : Promise.resolve([{ id: 'NewAccountComp', name: 'New', city: 'City', country_iso2: 'CN', start_date: '2026-09-01', end_date: '2026-09-01' }]));
  function Harness({ id }: { id: string }) {
    const state = useWcaCalendar(id, '2026-09-28');
    return createElement('div', null, state.competitions.map((c) => c.id).join(','));
  }
  try {
    await act(async () => root.render(createElement(Harness, { id: '2017ROOT01' })));
    await act(async () => root.render(createElement(Harness, { id: '2018ROOT01' })));
    expect(host.textContent).toBe('NewAccountComp');
    await act(async () => finishOld([{ id: 'OldAccountComp', name: 'Old', city: 'City', country_iso2: 'CN', start_date: '2017-09-01', end_date: '2017-09-01' }]));
    expect(host.textContent).toBe('NewAccountComp');
    await act(async () => root.render(createElement(Harness, { id: '' })));
    expect(host.textContent).toBe('');
  } finally {
    await act(async () => root.unmount());
  }
});
