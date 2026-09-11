// @vitest-environment jsdom

// Real App, timer/controller, repository and reconstruction UI. Only IndexedDB
// IO, host radio and WebGL are replaced; this is not a physical GAN acceptance.
import { activeTimerSolves, createTimerStoreData, type TimerPhase, type TimerStoreData } from '@cuberoot/shared/timer';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstalledAppHost, InstalledAppSmartCube, InstalledAppSmartCubeOptions } from './platform';
import { writeRealScrambleCache } from './data/real-scramble-pool';

const memory = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('./data/timer-repository', async (original) => ({
  ...await original<typeof import('./data/timer-repository')>(),
  IndexedDbTimerStoreDriver: class {
    async read() { return structuredClone(memory.data); }
    async readRecovery() { return undefined; }
    async write(data: TimerStoreData) { memory.data = structuredClone(data); }
    async writeWithRecovery(data: TimerStoreData) { memory.data = structuredClone(data); }
  },
}));
vi.mock('@cuberoot/timer-ui/SimCubeView', () => ({
  default: ({ moves, ariaLabel }: { moves: string[]; ariaLabel: string }) => (
    <output data-webgl-mock aria-label={ariaLabel}>{moves.join(' ')}</output>
  ),
}));

import { App } from './App';

let options: InstalledAppSmartCubeOptions;
let setRadio: (value: InstalledAppSmartCube) => void;
let radio: InstalledAppSmartCube;
let now = 1_000;
let phase: TimerPhase = 'idle';
const host: InstalledAppHost = {
  addNetworkListener: async () => ({ remove: async () => undefined }),
  getNetworkStatus: async () => false,
  isInstalled: () => true,
  openExternal: async () => undefined,
  print: async () => undefined,
  writeClipboardText: async () => undefined,
  useAuth: () => ({ busy: false, error: false, loading: false, session: null,
    login: async () => undefined, logout: async () => undefined,
    issueWebSessionTicket: async () => { throw new Error('offline test'); },
  }),
  useSmartCube: (callbacks) => {
    options = callbacks;
    const [state, setState] = useState<InstalledAppSmartCube>(() => ({
      connect: async () => 'GAN16ui', disconnect: async () => undefined,
      deviceName: '', facelets: '', lastMove: '', phase: 'idle',
    }));
    setRadio = setState;
    radio = state;
    return state;
  },
  useTimerEffects: (nextPhase) => { phase = nextPhase; },
  version: 'test',
};

let root: Root;
let container: HTMLDivElement;
const saved = () => activeTimerSolves(memory.data as TimerStoreData, '333');
const move = (token: string, at: number) => {
  now = at;
  const facelets = cubeMove(radio.facelets, token);
  setRadio({ ...radio, facelets, lastMove: token });
  options.onMove(token, at, facelets);
};
const settle = async () => { await act(async () => { await new Promise((done) => setTimeout(done, 30)); }); };

beforeEach(async () => {
  now = 1_000;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  localStorage.clear();
  const data = createTimerStoreData(Date.now(), 'test-session', 'en');
  data.settings = { ...data.settings, event: '333', language: 'en', liveCubeView: '3d',
    recordGyro: true, autoRecap: true, bluetoothAutoReady: 'scrambled', inspectionSec: 0,
    showCubePreview: false, wcaUseOptimal: false };
  memory.data = data;
  writeRealScrambleCache({ ...data.settings, event: '333' }, [
    { competitionId: 'Test2026', competitionName: 'Test 2026', eventId: '333', groupId: 'A',
      roundTypeId: '1', scramble: 'R', scrambleNumber: 1, isExtra: false },
    { competitionId: 'Test2026', competitionName: 'Test 2026', eventId: '333', groupId: 'A',
      roundTypeId: '1', scramble: 'F', scrambleNumber: 2, isExtra: false },
  ]);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<App host={host} />));
  await settle();
  await act(async () => setRadio({ ...radio, phase: 'connected', deviceName: 'GAN16ui', facelets: SOLVED_3X3 }));
  await settle();
});

afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('installed App GAN lifecycle integration', () => {
  it('routes the live cube, first/final turns, recorded gyro, saved recap and full history report', async () => {
    expect(container.querySelector('[aria-label="Live 3D smart-cube state"]')).not.toBeNull();
    await act(async () => move('R', 1_000));
    expect(container.querySelector('[aria-label="Live 3D smart-cube state"]')?.textContent).toBe('R');
    await act(async () => options.onGyro?.({ w: 1, x: 0, y: 0, z: 0 }, 1_010));
    await act(async () => move('U', 2_000));
    expect(phase).toBe('running');
    await act(async () => options.onGyro?.({ w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 }, 2_100));
    await act(async () => move("U'", 2_250));
    await act(async () => move("R'", 2_500));
    expect(saved()).toHaveLength(0);
    expect(phase).toBe('running');
    await act(async () => options.onSolved?.(2_500));
    await settle();
    expect(saved()).toHaveLength(1);
    expect(phase).toBe('stopped');
    expect(saved()[0]).toMatchObject({ timeMs: 500, scramble: 'R', device: { model: 'gan-v4', name: 'GAN16ui' },
      moves: [{ m: 'U', ts: 0 }, { m: "U'", ts: 250 }, { m: "R'", ts: 500 }] });
    const gyro = decodeGyroTrack(saved()[0].gyro!);
    expect(gyro?.map((sample) => sample.tMs)).toEqual([0, 100]);
    await act(async () => options.onSolved?.(2_500));
    await settle();
    expect(saved()).toHaveLength(1);
    await vi.waitFor(async () => { await settle(); expect(container.querySelector('.shell-recap')).not.toBeNull(); });
    const full = container.querySelector<HTMLButtonElement>('.shell-recap-btn')!;
    await act(async () => full.click());
    await settle();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await vi.waitFor(async () => { await settle(); expect(document.body.textContent).toContain('Move stream (3)'); }, { timeout: 5_000 });
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('#1');
    await act(async () => document.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.close"]')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // A second real attempt must be independent of the closed detail. Exercise
    // both the automatic recap entry and the actual history row activation.
    await act(async () => container.querySelector<HTMLButtonElement>('.primary-nav button')!.click());
    await settle();
    await act(async () => move('F', 4_000));
    expect(phase).toBe('holding');
    await act(async () => move('U', 5_000));
    expect(phase).toBe('running');
    await act(async () => move("U'", 5_250));
    await act(async () => move("F'", 5_500));
    await act(async () => options.onSolved?.(5_500));
    await settle();
    expect(saved()).toHaveLength(2);
    expect(saved()[1]).toMatchObject({ timeMs: 500, scramble: 'F' });
    expect(saved()[1].id).not.toBe(saved()[0].id);
    await vi.waitFor(async () => { await settle(); expect(container.querySelector('.shell-recap')).not.toBeNull(); });
    await act(async () => container.querySelector<HTMLButtonElement>('.shell-recap-btn')!.click());
    await settle();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('#2');
    await act(async () => document.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.close"]')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const firstRow = Array.from(container.querySelectorAll<HTMLButtonElement>('.timer-history-row'))
      .find((row) => row.querySelector('.idx')?.textContent === '1')!;
    await act(async () => firstRow.click());
    await settle();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('#1');
  }, 15_000);

  it('cancels pending preparation on disconnect and does not start on a stray post-disconnect turn', async () => {
    await act(async () => move('R', 1_000));
    expect(phase).toBe('holding');
    await act(async () => setRadio({ ...radio, phase: 'idle', deviceName: '', facelets: '' }));
    expect(phase).toBe('idle');
    now = 2_000;
    await act(async () => options.onMove('U', 2_000, cubeMove(cubeMove(SOLVED_3X3, 'R'), 'U')));
    await act(async () => options.onSolved?.(2_500));
    await settle();
    expect(saved()).toHaveLength(0);
    expect(phase).toBe('idle');
    expect(container.querySelector('.shell-recap')).toBeNull();
  });
});
