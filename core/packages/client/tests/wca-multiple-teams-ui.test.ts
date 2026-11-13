// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { WcaTeacherDirectory } from '@/components/WcaTeacherCell';
import type { useWcaTeams } from '@/hooks/useWcaTeams';

interface Editor { onOpen: () => void; canSave: boolean; save: () => Promise<void>; render: (saving: boolean) => ReactNode }
const mocks = vi.hoisted(() => ({ editor: null as Editor | null }));
vi.mock('@/hooks/useWcaTeams', () => ({ useWcaTeams: vi.fn() }));
vi.mock('@/components/WcaTeacherCell', () => ({ WcaTeacherCell: ({ additionalEditor }: { additionalEditor: Editor }) => {
  mocks.editor = additionalEditor;
  return additionalEditor.render(false);
} }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }));
vi.mock('@/components/ListSelect', () => ({ ListSelect: ({ value, onChange, items }: {
  value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }>;
}) => createElement('select', { value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) },
  createElement('option', { value: '' }, 'Add team'), ...items.map(item => createElement('option', { key: item.value, value: item.value }, item.label))) }));
import { WcaPersonRelationCells } from '@/app/[lang]/wca/results/_components/WcaTeamCell';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';

afterEach(() => { vi.unstubAllGlobals(); });

it('adds and removes one membership without dropping the other, and resets cancelled edits on open', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const teams = [{ id: 1, name: 'MFG' }, { id: 2, name: 'Cubicle' }];
  const save = vi.fn().mockResolvedValue(undefined);
  const directory: ReturnType<typeof useWcaTeams> = { teams, assignments: [{ wcaId: '2023XIUY01', teamId: 1 }], ready: true, failed: false, isAdmin: true, retry: vi.fn(), save };
  try {
    await act(async () => root.render(createElement('table', {}, createElement('tbody', {}, createElement('tr', {},
      createElement(WcaPersonRelationCells, { wcaId: '2023XIUY01', eventIds: ['333'], teamDirectory: directory, teacherDirectory: {} as WcaTeacherDirectory, isZh: false }))))));
    await act(async () => mocks.editor!.onOpen());
    const select = host.querySelector('select')!;
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => mocks.editor!.save());
    expect(save).toHaveBeenLastCalledWith('2023XIUY01', ['MFG', 'Cubicle']);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Remove team: MFG"]')!.click());
    await act(async () => mocks.editor!.save());
    expect(save).toHaveBeenLastCalledWith('2023XIUY01', ['Cubicle']);
    await act(async () => mocks.editor!.onOpen());
    expect(host.querySelector('[aria-label="Remove team: MFG"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Remove team: Cubicle"]')).toBeNull();
    const calls = save.mock.calls.length;
    await act(async () => mocks.editor!.save());
    expect(save).toHaveBeenCalledTimes(calls);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('renders both team links and supports unlinked badges inside interactive person rows', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const teams = [{ id: 1, name: 'MFG' }, { id: 2, name: 'Cubicle' }];
  try {
    await act(async () => root.render(createElement(WcaPersonTeamBadge, { teams })));
    expect([...host.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/wca/teams?team=1', '/wca/teams?team=2']);
    expect(host.querySelector('img[alt="Cubicle"]')?.getAttribute('src')).toBe('/images/brands/cubicle.png');
    await act(async () => root.render(createElement(WcaPersonTeamBadge, { teams, linked: false })));
    expect(host.querySelectorAll('a')).toHaveLength(0);
    expect(host.querySelectorAll('.wca-person-team-badge')).toHaveLength(2);
  } finally { await act(async () => root.unmount()); }
});
