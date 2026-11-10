// @vitest-environment jsdom
import { act, createElement, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { LocalBattleRound, Solve } from '@cuberoot/shared/timer';

const fixture = vi.hoisted(() => ({ rounds: [] as LocalBattleRound[], recap: vi.fn(), lookup: vi.fn() }));
vi.mock('next/dynamic', () => ({ default: (load: () => Promise<{ default: React.ComponentType }>) => lazy(load) }));
vi.mock('react-i18next', async importOriginal => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ i18n: { language: 'zh' } }),
}));
vi.mock('@/app/[lang]/timer/_battle/engine/battle_store', () => ({
  useBattleStore: () => ({ battleRounds: fixture.rounds, sessionId: '1', playerCount: 2, timerPrecision: 3 }),
  loadLegacyBattleRecords: () => ({ records: [], skippedKeys: 0 }),
  filterUnpairedLegacyBattleRecords: () => [],
  timerToBattleEvent: (event: string) => event,
}));
vi.mock('@/app/[lang]/timer/_lib/storage/db', () => ({
  battleReconIndex: fixture.lookup,
  battleReconKey: (scramble: string, timeMs: number) => `${scramble}:${timeMs}`,
}));
vi.mock('@/app/[lang]/timer/_components/SolveRecap', () => ({ default: (props: {
  solve: Solve; history: Solve[]; onFull(): void; onDismiss(): void;
}) => {
  fixture.recap(props);
  return createElement('div', { 'data-recap': props.solve.id },
    createElement('button', { onClick: props.onFull }, 'Full'),
    createElement('button', { onClick: props.onDismiss }, 'Hide'));
} }));
vi.mock('@/app/[lang]/timer/_components/ReconstructModal', () => ({ default: ({ solve }: { solve: Solve }) =>
  createElement('div', { 'data-full': solve.id }, solve.device?.name) }));

const { useBattleHistoryProps } = await import('@/app/[lang]/timer/_battle/VsHistoryPanel');
function HistoryDetail() {
  const props = useBattleHistoryProps({ onClose() {} });
  return createElement(Suspense, { fallback: 'Loading' }, props.roundDetails?.(fixture.rounds[1]));
}

it('opens the canonical recap and full report for each player without searching solo history', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.rounds = [0, 1].map(index => ({
    id: `round-${index}`, ts: 1000 + index, winners: [0, 1],
    attempts: [0, 1].map(playerId => ({ playerId, solve: {
      id: `solve-${index}-${playerId}`, event: '333', timeMs: 1000, scramble: 'R U', penalty: 'ok', ts: 1000 + index,
      moves: [{ m: "U'", ts: 0 }, { m: "R'", ts: 1000 }], device: { model: 'gan-v4', name: `Cube ${playerId}` },
    } })),
  }));
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(HistoryDetail)));
    expect(host.querySelectorAll('[data-recap]')).toHaveLength(2);
    expect(fixture.lookup).not.toHaveBeenCalled();
    for (const playerId of [0, 1]) {
      const props = fixture.recap.mock.calls.find(([props]) => props.solve.id === `solve-1-${playerId}`)![0];
      expect(props.history.map((solve: Solve) => solve.id)).toEqual([`solve-0-${playerId}`, `solve-1-${playerId}`]);
    }
    await act(async () => host.querySelector<HTMLButtonElement>('[data-recap="solve-1-1"] button')!.click());
    expect(host.querySelector('[data-full="solve-1-1"]')?.textContent).toBe('Cube 1');
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[data-recap="solve-1-0"] button')[1].click());
    expect(host.querySelector('[data-recap="solve-1-0"]')).toBeNull();
    expect(host.querySelector('[data-recap="solve-1-1"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
