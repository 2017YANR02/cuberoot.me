// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { initialLocalBattleState, transitionLocalBattle, createLocalBattleRound, requestLocalBattleScramble,
  normalizeTimerWcaSourceSettings, defaultLocalBattlePreferences, readLocalBattlePreferences, saveLocalBattlePreferences } from '@cuberoot/shared/timer';
const source = vi.hoisted(() => ({ kind: 'wca', available: true, random: 'R', next: null as (() => Promise<unknown>) | null }));
vi.mock('@/app/[lang]/timer/_lib/settings', () => ({ getSettings: () => ({ ...normalizeTimerWcaSourceSettings({}), scrambleSource: source.kind }) }));
vi.mock('@cuberoot/timer-ui/random-scramble', () => ({ createRandomScrambleClient: () => ({ generate: async ({ event }: { event: string }) => ({ ok: true, kind: 'generated', event, scramble: source.random }) }) }));
vi.mock('@/app/[lang]/timer/_battle/engine/engine_loader', () => ({ isScrambleEngineReady: () => true, loadScrambleEngine: async () => {} }));
vi.mock('@/app/[lang]/timer/_battle/engine/scramble_engine', () => ({ generateScramble: () => source.random, generateScrambleImageUrl: () => null }));
vi.mock('@/app/[lang]/timer/_lib/scramble/wca_pool', () => ({
  hasWcaSource: () => source.available, peekWcaRow: () => null, nextWcaRow: () => source.next?.() ?? Promise.resolve(null), prefetchWca: () => {},
}));
const { useBattleStore } = await import('@/app/[lang]/timer/_battle/engine/battle_store');
beforeEach(() => {
  localStorage.clear(); source.kind = 'wca'; source.available = true; source.random = 'R'; source.next = null;
  const s = useBattleStore.getState();
  useBattleStore.setState({ mode: '1v1', playerCount: 2, puzzleIds: ['333', '333', '333', '333'], scrambleRows: [null, null, null, null], scrambleErrors: [false, false, false, false],
    players: s.players.map(player => ({ ...player, isTiming: false, isReady: false, isInspecting: false, canStart: false, hasFinished: false, timerState: undefined, timerResult: undefined })) });
});
it('does not turn missing real data, incomplete selection or random error text into a playable scramble', async () => {
  for (const mode of ['missing', 'incomplete', 'random-error']) {
    source.available = mode !== 'incomplete'; source.kind = mode === 'random-error' ? 'random' : 'wca'; source.random = '⚠️ Scramble error';
    useBattleStore.getState().loadNewScramble();
    await vi.waitFor(() => expect(useBattleStore.getState().scrambleErrors.slice(0, 2)).toEqual([true, true]));
    useBattleStore.getState().playerDown(0);
    expect(useBattleStore.getState().players[0].isReady).toBe(false);
    expect(useBattleStore.getState().scrambles.slice(0, 2)).toEqual(['', '']);
  }
});
it('ignores a late WCA occurrence after changing all four slots to a new event', async () => {
  let resolve!: (row: unknown) => void; source.next = () => new Promise(done => { resolve = done; });
  useBattleStore.getState().loadNewScramble();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  source.kind = 'random'; source.random = 'F'; useBattleStore.getState().changeAllPuzzles('222');
  resolve({ scramble: 'R', slot: 'old', meta: null }); await new Promise(done => setTimeout(done, 0));
  expect(useBattleStore.getState().puzzleIds).toEqual(['222', '222', '222', '222']);
  expect(useBattleStore.getState().scrambles.slice(0, 2)).toEqual(['F', 'F']);
  useBattleStore.getState().setPlayerCount(4);
  await vi.waitFor(() => expect(useBattleStore.getState().scrambles).toEqual(['F', 'F', 'F', 'F']));
});
it('retains completed source and penalty editing while the next scramble fails', () => {
  let state = initialLocalBattleState(2);
  const apply = (action: Parameters<typeof transitionLocalBattle>[1]) => { const t = transitionLocalBattle(state, action, { inspectionSec: 0 }); state = t.state; return t; };
  apply({ type: 'request-next-scramble', event: '333' });
  apply({ type: 'scramble-ready', event: '333', revision: state.players[0].scrambleRevision, scramble: 'R', source: { kind: 'wca', identity: 'official-slot-1' } });
  apply({ type: 'start-all', nowMs: 0 });
  for (const id of [0, 1]) apply({ type: 'player-timer', playerId: id, action: { type: 'press-down', nowMs: 1000 + id * 500 } });
  apply({ type: 'request-next-scramble', event: '333', preserveResults: true });
  apply({ type: 'scramble-failed', event: '333', revision: state.players[0].scrambleRevision });
  expect(apply({ type: 'player-timer', playerId: 0, action: { type: 'press-down', nowMs: 3000 } }).accepted).toBe(false);
  apply({ type: 'request-next-scramble', event: '333', preserveResults: true });
  apply({ type: 'scramble-ready', event: '333', revision: state.players[0].scrambleRevision, scramble: 'F', source: { kind: 'wca', identity: 'official-slot-2' } });
  apply({ type: 'set-penalty', playerId: 0, penalty: '+2' });
  const round = createLocalBattleRound(state, 'round1', 100)!;
  expect(round.attempts[0].solve).toMatchObject({ scramble: 'R', timeMs: 1000, penalty: '+2', scrambleSource: { identity: 'official-slot-1' } });
});
it('bounds hanging providers and cancels obsolete requests', async () => {
  vi.useFakeTimers();
  try {
    const pending = requestLocalBattleScramble('333', () => new Promise(() => {}));
    const rejected = expect(pending).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(12_000); await rejected;
    const controller = new AbortController();
    const cancelled = requestLocalBattleScramble('333', () => new Promise(() => {}), controller.signal);
    controller.abort(); await expect(cancelled).rejects.toThrow('cancelled');
  } finally { vi.useRealTimers(); }
});
it('persists all supported local preferences using the shared Web keys', () => {
  const settings = { ...defaultLocalBattlePreferences(), precision: 0 as const, inspectionSec: 9999, layout: 'side' as const, flipTopRow: false, scrambleScale: 1.5, bgColors: ['#ff0000', '', '', ''] };
  saveLocalBattlePreferences(localStorage, settings);
  expect(readLocalBattlePreferences(localStorage)).toEqual(settings);
  localStorage.setItem('battle_timerPrecision', '1.2'); expect(readLocalBattlePreferences(localStorage).precision).toBe(3);
});
