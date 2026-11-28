// @vitest-environment jsdom
import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaBoardToggle, ArenaLocalCube, ArenaRemoteCube, type ArenaCube } from '@/components/competitions/CompetitionArenaParts';
import { SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { rankArena } from '@/components/competitions/competition-results';
import { useCompetitionCube } from '@/components/competitions/useCompetitionCube';
import { setInstalledBleBridge } from '@/lib/installed-ble-bridge';
import type { CompetitionArenaPlayer } from '@/lib/online-competition-api';

const mock = vi.hoisted(() => ({
  arenaPhase: vi.fn(), duelPhase: vi.fn(), start: vi.fn(), report: vi.fn(), refresh: vi.fn(),
  connect: vi.fn(), disconnect: vi.fn(), publishMove: vi.fn(), publishGyro: vi.fn(),
  anchor: { move: vi.fn() },
}));

vi.mock('@cuberoot/timer-ui', () => ({
  TimerCubePreview: ({ event, scramble, visualization }: { event: string; scramble: string; visualization: string }) =>
    createElement('div', { 'data-preview': visualization, 'data-event': event }, scramble || 'solved'),
  useNetBattleLiveCube: () => ({ players: {}, ready: false, publishMove: mock.publishMove, publishGyro: mock.publishGyro }),
}));
vi.mock('@cuberoot/timer-ui/LiveCubeState', () => ({
  default: ({ mode, facelets }: { mode: string; facelets: string }) =>
    createElement('div', { 'data-preview': mode, 'data-facelets': facelets }),
}));
vi.mock('@/lib/online-competition-api', () => ({
  setCompetitionArenaPhase: mock.arenaPhase,
  setCompetitionDuelPhase: mock.duelPhase,
  startCompetitionTelemetry: mock.start,
  reportCompetitionTelemetry: mock.report,
}));
vi.mock('@/lib/bluetooth', () => ({
  mayUseMiniProgramBridge: () => false,
  useBluetoothCube: () => ({ status: { connected: false }, facelets: null, connect: mock.connect, disconnect: mock.disconnect }),
}));
vi.mock('@/app/[lang]/timer/_shared/useLiveCubeAnchor', () => ({
  useLiveCubeAnchor: () => ({ anchor: mock.anchor, moves: [], algAnchored: false }),
}));
vi.mock('@/app/[lang]/timer/_lib/bluetooth/scramble_fixup', () => ({ fixupScramble: vi.fn() }));
vi.mock('@/app/[lang]/timer/_lib/sound', () => ({ play: vi.fn(), playInspectionBeep: vi.fn(), warmupSound: vi.fn() }));
vi.mock('@/components/competitions/CompetitionReconstruction', () => ({ preloadCompetitionReconstruction: vi.fn(), replaySolve: () => null }));

let host: HTMLDivElement;
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mock.arenaPhase.mockResolvedValue({});
  mock.duelPhase.mockResolvedValue({});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setInstalledBleBridge(null);
  vi.useRealTimers();
});

const issued = '2026-11-26T12:00:00.000Z';
function Reload({ duel, inspected, settled = false }: { duel: boolean; inspected: boolean; settled?: boolean }) {
  const cube = useCompetitionCube({
    id: 'seat', duel, smart: true, roomId: null, credentials: null, roundNumber: 2,
    round: { number: 2, issued, scramble: 'R U', inspectAt: inspected ? '2026-11-26T12:00:20.000Z' : null },
    offset: Date.parse(issued), settled, refresh: mock.refresh,
  });
  return createElement('output', null, cube.phase?.kind === 'finished' ? cube.phase.reason : cube.phase?.kind);
}

describe('competition arena acceptance', () => {
  it.each([false, true])('automatically reports DNF for an interrupted run on reload (duel=%s)', async duel => {
    await act(async () => root.render(createElement(Reload, { duel, inspected: true })));
    const phase = duel ? mock.duelPhase : mock.arenaPhase;
    expect(phase).toHaveBeenCalledExactlyOnceWith('seat', 2, 'disconnected', expect.any(String), undefined);
    expect(mock.start).not.toHaveBeenCalled();
    expect(mock.refresh).toHaveBeenCalledOnce();
    expect(host.textContent).toBe('disconnected');
  });

  it('retries reload settlement with the same key and leaves a settled run alone', async () => {
    vi.useFakeTimers();
    mock.arenaPhase.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(createElement(Reload, { duel: false, inspected: true })));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(mock.arenaPhase).toHaveBeenCalledTimes(2);
    expect(mock.arenaPhase.mock.calls[1]).toEqual(mock.arenaPhase.mock.calls[0]);
    await act(async () => root.render(createElement(Reload, { key: 'settled', duel: false, inspected: true, settled: true })));
    expect(mock.arenaPhase).toHaveBeenCalledTimes(2);
  });

  it('resends a saved finish report when the page reloads during submission', async () => {
    const report = { serverIssuedAt: issued, durationMs: 1000 };
    localStorage.setItem(`competition-arena-report:seat:2:${issued}`, JSON.stringify({ startKey: 'start-key', pending: { key: 'report-key', report } }));
    mock.start.mockResolvedValueOnce({ runId: 'run' });
    mock.report.mockResolvedValueOnce({ status: 'device_reported' });
    await act(async () => root.render(createElement(Reload, { duel: false, inspected: true })));
    expect(mock.report).toHaveBeenCalledExactlyOnceWith('seat', false, 2, { ...report, runId: 'run' }, 'report-key');
    expect(mock.arenaPhase).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'rejects connections without a Bluetooth transport', installed: false, expectedCalls: 0 },
    { label: 'uses the installed bridge without Web Bluetooth', installed: true, expectedCalls: 1 },
  ])('$label', async ({ installed, expectedCalls }) => {
    expect(navigator.bluetooth?.requestDevice).toBeUndefined();
    if (installed) setInstalledBleBridge(window.location.origin);
    function Connect() {
      const cube = useCompetitionCube({
        id: 'seat', duel: false, smart: true, roomId: null, credentials: null, roundNumber: 1,
        round: null, offset: 0, settled: true, refresh: mock.refresh,
      });
      return createElement('button', { onClick: () => cube.openDevice(true) },
        cube.deviceOpen ? 'Connection panel' : 'Connect');
    }
    await act(async () => root.render(createElement(Connect)));
    await act(async () => host.querySelector('button')!.click());
    expect(host.textContent).toBe('Connection panel');
    expect(mock.connect).toHaveBeenCalledTimes(expectedCalls);
    expect(mock.arenaPhase).not.toHaveBeenCalled();
  });

  it('keeps ordinary seats in 2D and shows a solved 3D placeholder for disconnected smart seats', async () => {
    const disconnected = { cube: { status: { connected: false } } } as ArenaCube;
    await act(async () => root.render(createElement(Fragment, null,
      createElement(ArenaLocalCube, { project: '444', scramble: 'Rw U' }),
      createElement(ArenaLocalCube, { cube: disconnected, project: '333', scramble: 'R U' }),
      createElement(ArenaRemoteCube, { project: '333', scramble: 'U F', smart: true }),
      createElement(ArenaRemoteCube, { project: '333', scramble: 'F R',
        remote: { playerId: 'peer', round: 1, connected: true, smart: false,
          syncing: false, seq: 0, facelets: null, moves: [], algAnchored: false, updatedAt: 0 } }),
    )));
    expect([...host.querySelectorAll('[data-preview="2D"]')].map(net => [net.getAttribute('data-event'), net.textContent]))
      .toEqual([['444', 'Rw U'], ['333', 'solved']]);
    await vi.waitFor(() => expect(host.querySelectorAll('[data-disconnected="true"] [data-preview="3d"]')).toHaveLength(2));
    expect([...host.querySelectorAll('[data-preview="3d"]')].map(cube => cube.getAttribute('data-facelets')))
      .toEqual([SOLVED_SMART_CUBE_FACELETS, SOLVED_SMART_CUBE_FACELETS]);
    expect(host.querySelector('.competition-arena-cube-tools')).toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('keeps a live smart seat visible while the peer is anchoring and shows ordinary opponent phases', async () => {
    const liveSource = { getSnapshot: () => ({ moves: ['R'], algAnchored: false }), subscribe: vi.fn(() => () => {}) };
    const remote = { playerId: 'peer', round: 2, connected: true, smart: true, syncing: true, seq: 1,
      facelets: SOLVED_SMART_CUBE_FACELETS, moves: ['R'], algAnchored: false, updatedAt: 0,
      liveSource };
    const draw = (stage: 'inspecting' | 'running' | 'finished') => act(async () => root.render(createElement(Fragment, null,
      createElement(ArenaRemoteCube, { project: '333', scramble: 'R U', smart: true, remote }),
      createElement(ArenaRemoteCube, { project: '333', scramble: 'R U', stage, hasPenalty: stage === 'finished' }),
    )));
    await draw('inspecting');
    await vi.waitFor(() => expect(host.querySelector('[data-preview="3d"]')).not.toBeNull());
    expect(host.querySelector('[data-disconnected]')).toBeNull();
    expect(host.querySelector('[data-preview="2D"]')?.textContent).toBe('R U');
    await draw('running');
    expect(host.querySelector('[role="status"]')?.textContent).toMatch(/Solving|对手复原中/);
    await draw('finished');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('DNF');
    expect(host.querySelector('[data-preview="2D"]')?.textContent).toBe('solved');
  });

  it('closes the mobile leaderboard on outside pointer down and on both timing transitions', async () => {
    const draw = (stage: 'scrambling' | 'inspecting' | 'running') =>
      createElement(ArenaBoardToggle, { stage, summary: 'Live standings', children: createElement('p', null, 'Standings') });
    await act(async () => root.render(draw('scrambling')));
    const drawer = host.querySelector('details')!;
    drawer.open = true;
    drawer.querySelector('p')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(drawer.open).toBe(true);
    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(drawer.open).toBe(false);
    for (const stage of ['inspecting', 'running'] as const) {
      drawer.open = true;
      await act(async () => root.render(draw(stage)));
      expect(drawer.open).toBe(false);
    }
  });

  it('uses the completed-round average and a deterministic tie break for pending seats', () => {
    const player = (id: string, scores: number[]): CompetitionArenaPlayer => ({
      id, name: 'Same name', wcaId: null, countryCode: null,
      attempts: scores.map((centiseconds, i) => ({ attemptNumber: i + 1, centiseconds, penalty: 'none',
        inspectAt: null, solveAt: null, dnfReason: null, replay: false })),
    });
    const field = [player('d', [800, 2000]), player('c', [1000, 1100]), player('b', [1000, 1100]), player('a', [5000, 5000, 999])];
    const order = (items: CompetitionArenaPlayer[]) => rankArena(items, 3, '333').map(row => row.player.id);
    expect(order(field)).toEqual(['a', 'b', 'c', 'd']);
    expect(order([...field].reverse())).toEqual(order(field));
  });
});
