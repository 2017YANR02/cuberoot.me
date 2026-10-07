// @vitest-environment jsdom
import type { ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import type { StackmatMicSource } from '@cuberoot/shared/timer/external/stackmat-state';

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
let backListener: (() => void) | null = null;
let now = 1_000;
let phase: TimerPhase = 'idle';
const stackmatListeners = new Set<(event: ExternalTimerEvent) => void>();
let stackmatListening = false;
const stackmatSource: StackmatMicSource = {
  kind: 'stackmat-mic', deviceName: 'Stackmat', deviceId: '', state: 'IDLE', lastTimeMs: 0,
  get connected() { return stackmatListening; },
  connect: async () => { stackmatListening = true; },
  disconnect: async () => { stackmatListening = false; },
  subscribe: listener => { stackmatListeners.add(listener); return () => { stackmatListeners.delete(listener); }; },
  subscribeSnapshot: () => () => {}, listInputDevices: async () => [],
  snapshot: () => ({phase:'idle', ms:0, listening:stackmatListening, signalLevel:0, signalPresent:false, noise:0, stateByte:'', unit:0, deviceId:''}),
};
const host: InstalledAppHost = {
  createStackmatSource: () => stackmatSource,
  addBackButtonListener: async (listener) => {
    backListener = listener;
    return { remove: async () => { if (backListener === listener) backListener = null; } };
  },
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

let wideViewport = false;
const mediaListeners = new Set<() => void>();
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
  stackmatListening = false;
  now = 1_000;
  backListener = null;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  wideViewport = false;
  mediaListeners.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query === '(min-width: 1024px)' && wideViewport; },
    addEventListener: (_: string, fn: () => void) => mediaListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => mediaListeners.delete(fn),
  }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  localStorage.clear();
  const data = createTimerStoreData(Date.now(), 'test-session', 'en');
  data.settings = { ...data.settings, event: '333', language: 'en', liveCubeView: '3d',
    scrambleClickAction: 'copy',
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
  vi.useRealTimers();
  await act(async () => root.unmount()); container.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('installed App GAN lifecycle integration', () => {
  it.each(['cross', 'f2l', 'oll', 'coll', 'cmll'] as const)('persists %s at its shared partial finish line in the selected grip', async (event) => {
    await act(async () => root.unmount());
    const data = createTimerStoreData(Date.now(), 'training-session', 'en');
    data.settings = { ...data.settings, event, language: 'en', preScrT: 'z2',
      manualScrambles: 'U R2', bluetoothAutoReady: 'scrambled', inspectionSec: 0,
      showCubePreview: false, autoRecap: false };
    memory.data = data;
    root = createRoot(container);
    await act(async () => root.render(<App host={host} />));
    await settle();
    await act(async () => container.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger')!.click());
    const manual = [...document.querySelectorAll<HTMLButtonElement>('.timer-scramble-source-option')]
      .find(button => button.textContent?.includes('Manual'))!;
    await act(async () => manual.click());
    await settle();
    await act(async () => setRadio({ ...radio, phase: 'connected', deviceName: 'GAN16ui', facelets: SOLVED_3X3 }));
    await act(async () => move('D', 2_000));
    await act(async () => move('L2', 2_100));
    expect(phase).toBe('ready');
    await act(async () => move('L', 3_000));
    expect(phase).toBe('running');
    await act(async () => move('L', 3_250));
    expect(phase).toBe('stopped');
    expect(radio.facelets).toBe(cubeMove(SOLVED_3X3, 'D'));
    await settle();
    const solves = activeTimerSolves(memory.data as TimerStoreData, event);
    expect(solves).toHaveLength(1);
    expect(solves[0]).toMatchObject({ event, timeMs: 250, penalty: 'ok',
      scramble: 'D L2', moves: [{ m: 'L', ts: 0 }, { m: 'L', ts: 250 }] });
  });

  it('keeps the timer mounted beside wide history and switches to a full page on narrow screens', async () => {
    await act(async () => { wideViewport = true; mediaListeners.forEach(fn => fn()); });
    const timerNode = container.querySelector('.timing-surface');
    const nav = container.querySelectorAll<HTMLButtonElement>('.primary-nav button');
    await act(async () => container.querySelector<HTMLButtonElement>('.shell-stat-rail')!.click());
    expect(container.querySelector('.timing-surface')).toBe(timerNode);
    expect(container.querySelector('.timer-workspace[data-panel-open]')).not.toBeNull();
    expect(container.querySelector('.history-view .app-titlebar')).not.toBeNull();
    await act(async () => nav[0].click());
    expect(container.querySelector('.timing-surface')).toBe(timerNode);
    await act(async () => container.querySelector<HTMLButtonElement>('.shell-stat-rail')!.click());
    await act(async () => { wideViewport = false; mediaListeners.forEach(fn => fn()); });
    expect(container.querySelector('.timing-surface')).toBeNull();
    expect(container.querySelector('.app-shell > .app-titlebar')).not.toBeNull();
    await act(async () => nav[0].click());
    expect(container.querySelector('.timing-surface')).not.toBeNull();
  });

  it('applies shared typography settings to the installed timing surface', async () => {
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click());
    const timerNode = container.querySelector('.timing-surface');
    const dialog = document.querySelector<HTMLElement>('.settings-modal')!;
    expect(dialog).not.toBeNull();
    await act(async () => move('R', 2_000));
    expect(phase).toBe('idle');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    });
    expect(phase).toBe('idle');
    const category = dialog.querySelector<HTMLSelectElement>('.settings-category-select')!;
    await act(async () => { category.value = 'appearance'; category.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => dialog.querySelector<HTMLButtonElement>('.tfp-trigger')!.click());
    const inter = [...document.querySelectorAll<HTMLButtonElement>('.tfp-item')].find(node => node.textContent?.includes('Inter'))!;
    await act(async () => inter.click());
    await settle();
    expect((memory.data as TimerStoreData).settings.timerFont).toBe('sans');
    await act(async () => dialog.querySelector<HTMLButtonElement>('.settings-modal-close')!.click());
    expect(container.querySelector('.timing-surface')).toBe(timerNode);
    expect(container.querySelector('.tf-sans')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click());
    await act(async () => backListener?.());
    expect(document.querySelector('.settings-modal')).toBeNull();
  });

  it.each(['2', '3', '4'])('shares device operations in %s-player mode without disconnecting on entry', async (mode) => {
    const disconnect = vi.fn(async () => undefined);
    const resetState = vi.fn();
    await act(async () => setRadio({ ...radio, disconnect, resetState }));
    const selector = container.querySelector<HTMLSelectElement>('.shell-players-select')!;
    await act(async () => {
      selector.value = mode;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    await act(async () => container.querySelector<HTMLButtonElement>('.timer-stage-footer .shell-device-center-trigger')!.click());
    // Both the chooser and the connected shortcut lead to the same operation dialog.
    await act(async () => container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click());
    const dialog = document.querySelector<HTMLElement>('.timer-smart-cube-device__modal')!;
    expect(dialog).not.toBeNull();
    expect(disconnect).not.toHaveBeenCalled();
    const reset = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Reset state'))!;
    await act(async () => reset.click());
    expect(resetState).toHaveBeenCalledOnce();
    await act(async () => backListener?.());
    expect(document.querySelector('.timer-smart-cube-device__modal')).toBeNull();
    expect(container.querySelectorAll('.battle-player')).toHaveLength(Number(mode));
  });

  it('opens the disconnected device menu and starts scanning from its action', async () => {
    const scanDevices = vi.fn(async () => undefined);
    await act(async () => setRadio({ ...radio, phase: 'idle', deviceName: '', scanDevices }));
    await settle();
    const trigger = container.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!;
    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const item = container.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(item).not.toBeNull();
    await act(async () => item!.click());
    expect(document.querySelector('.timer-smart-cube-device__modal')).not.toBeNull();
    expect(scanDevices).toHaveBeenCalledOnce();
  });

  it('opens the shared device modal and routes reset, disconnect, and Android Back', async () => {
    const connect = vi.fn(async () => 'GAN16ui');
    const disconnect = vi.fn(async () => undefined);
    const requestState = vi.fn(async () => undefined);
    const resetDeviceState = vi.fn(async () => undefined);
    const resetState = vi.fn();
    await act(async () => setRadio({
      ...radio,
      connect,
      disconnect,
      quaternion: { w: 1, x: 0, y: 0, z: 0 },
      requestState,
      resetDeviceState,
      resetState,
      solved: false,
      status: {
        badFrames: 0,
        battery: 72,
        moveCounter: 3,
        pendingMoves: 0,
        protocol: 'gan-v4',
        stateReady: true,
      },
    }));
    await settle();

    const trigger = container.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!;
    await act(async () => trigger.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click());
    await settle();
    expect(connect).not.toHaveBeenCalled();

    const dialog = document.querySelector<HTMLElement>('.timer-smart-cube-device__modal')!;
    expect(dialog.textContent).toContain('GAN16ui');
    expect(dialog.textContent).toContain('Connected, unsolved');
    expect(dialog.textContent).toContain('72%');
    expect(dialog.textContent).toContain('gan-v4');
    expect(dialog.textContent).not.toContain('Last move');
    const button = (label: string) => [...dialog.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.textContent?.includes(label))!;

    await act(async () => button('Reset state').click());
    expect(resetDeviceState).toHaveBeenCalledOnce();
    expect(resetState).not.toHaveBeenCalled();
    expect(requestState).not.toHaveBeenCalled();
    expect(button('Reset gyroscope').disabled).toBe(false);

    await act(async () => button('Disconnect').click());
    expect(disconnect).toHaveBeenCalledOnce();
    expect(document.querySelector('.timer-smart-cube-device__modal')).toBeNull();

    await act(async () => trigger.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click());
    expect(document.querySelector('.timer-smart-cube-device__modal')).not.toBeNull();
    await act(async () => backListener?.());
    expect(document.querySelector('.timer-smart-cube-device__modal')).toBeNull();
  });

  it('opens the desktop scan list and connects the selected smart cube', async () => {
    const connect = vi.fn(async () => 'WCU_MY32_A1B2');
    const scanDevices = vi.fn(async () => undefined);
    await act(async () => setRadio({
      ...radio,
      availableDevices: [{ id: 'moyu', name: 'WCU_MY32_A1B2', rssi: -43 }],
      connect,
      deviceName: '',
      phase: 'idle',
      scanDevices,
      scanning: false,
      stopScan: vi.fn(async () => undefined),
    }));
    await settle();

    await act(async () => container.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click());
    await settle();
    expect(scanDevices).toHaveBeenCalledOnce();
    const dialog = document.querySelector<HTMLElement>('.timer-smart-cube-device__modal')!;
    expect(dialog.textContent).toContain('WCU_MY32_A1B2');
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Connect WCU_MY32_A1B2"]')!.click());
    expect(connect).toHaveBeenCalledWith('moyu');
  });

  it.each([
    ['touch', '.timer-display-value'], ['mouse', '.timer-display-value'],
  ])('keeps legacy copy settings inert and %s presses on %s on the real timer', async (pointerType, selector) => {
    const clipboard = vi.spyOn(host, 'writeClipboardText');
    const scramble = container.querySelector<HTMLElement>('.scramble-moves')!;
    const originalScramble = scramble.textContent;
    await act(async () => scramble.click());
    expect(clipboard).not.toHaveBeenCalled();
    expect(scramble.textContent).toBe(originalScramble);
    expect(scramble.closest('[data-interactive="true"]')).toBeNull();
    for (const type of ['touchstart', 'selectstart']) {
      expect(scramble.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(true);
    }
    expect(scramble.dispatchEvent(new Event('contextmenu', {
      bubbles: true,
      cancelable: true,
    }))).toBe(false);
    const ignoredPress = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(ignoredPress, {
      pointerType: { value: pointerType }, pointerId: { value: 2 }, button: { value: 0 },
      clientX: { value: 100 }, clientY: { value: 100 },
    });
    scramble.dispatchEvent(ignoredPress);
    expect(phase).toBe('idle');
    const timingText = container.querySelector<HTMLElement>(selector)!;
    // Hold readiness must be deterministic even on a busy build machine.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pointer = async (type: string, x = 100) => act(async () => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        pointerType: { value: pointerType }, pointerId: { value: 1 }, button: { value: 0 },
        clientX: { value: x }, clientY: { value: 100 },
      });
      timingText.dispatchEvent(event);
    });
    await pointer('pointerdown');
    expect(phase).toBe('holding');
    await pointer('pointermove', 220);
    expect(container.querySelector('.gesture-wheel.is-visible')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(phase).toBe('ready');
    now = 2_000;
    await pointer('pointerup', 220);
    expect(phase).toBe('running');
    now = 2_600;
    await pointer('pointerdown');
    await pointer('pointerup');
    vi.useRealTimers();
    await settle();
    expect(phase).toBe('stopped');
    expect(saved()).toHaveLength(1);
    expect(saved()[0].timeMs).toBe(600);
    expect(clipboard).not.toHaveBeenCalled();
  });

  it.each([false, true])('routes the live cube, saved recap and full report (wide=%s)', async (wide) => {
    await act(async () => { wideViewport = wide; mediaListeners.forEach(fn => fn()); });
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
    expect(container.querySelector('.timer-workspace > .shell-recap-rail .shell-recap') !== null).toBe(wide);
    expect(container.querySelector('.timer-view .shell-recap') !== null).toBe(!wide);
    expect(container.querySelector('.timer-workspace[data-recap-open]') !== null).toBe(wide);
    if (wide) {
      const timerNode = container.querySelector('.timing-surface');
      await act(async () => container.querySelector<HTMLButtonElement>('.shell-stat-rail')!.click());
      expect(container.querySelector('.shell-recap-rail')).toBeNull();
      expect(container.querySelector('.timer-workspace[data-recap-open]')).toBeNull();
      expect(container.querySelector('.timing-surface')).toBe(timerNode);
      await act(async () => container.querySelector<HTMLButtonElement>('.primary-nav button')!.click());
      await act(async () => { wideViewport = false; mediaListeners.forEach(fn => fn()); });
      expect(container.querySelector('.shell-recap-rail')).toBeNull();
      await vi.waitFor(async () => { await settle(); expect(container.querySelector('.timer-view .shell-recap')).not.toBeNull(); });
      await act(async () => { wideViewport = true; mediaListeners.forEach(fn => fn()); });
      await vi.waitFor(async () => { await settle(); expect(container.querySelector('.shell-recap-rail .shell-recap')).not.toBeNull(); });
    }
    const full = container.querySelector<HTMLButtonElement>('.shell-recap-btn')!;
    await act(async () => full.click());
    await settle();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await vi.waitFor(async () => { await settle(); expect(document.body.textContent).toContain('Move stream (3)'); }, { timeout: 5_000 });
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('#1');
    await act(async () => document.querySelector<HTMLButtonElement>('[data-history-action-id="solve.detail.close"]')!.click());
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

    // A second real attempt must be independent of the closed detail. Exercise
    // both the automatic recap entry and the actual history row activation.
    await act(async () => container.querySelector<HTMLButtonElement>('.primary-nav button')!.click());
    await settle();
    await act(async () => move('F', 4_000));
    expect(phase).toBe('ready');
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
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    const firstRow = Array.from(container.querySelectorAll<HTMLButtonElement>('.timer-history-row'))
      .find((row) => row.querySelector('.idx')?.textContent === '1')!;
    await act(async () => firstRow.click());
    await settle();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('#1');
  }, 15_000);

  it('cancels pending preparation on disconnect and does not start on a stray post-disconnect turn', async () => {
    await act(async () => move('R', 1_000));
    expect(phase).toBe('ready');
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

it('records one exact Stackmat reading with its starting scramble and keeps the panel reset-free', async () => {
  await act(async () => setRadio({...radio, phase: 'idle', deviceName: ''}));
  await act(async () => container.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!.click());
  const item = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent?.includes('Stackmat'))!;
  await act(async () => item.click());
  const dialog = document.querySelector<HTMLElement>('.stackmat-modal')!;
  expect(dialog).not.toBeNull();
  expect(dialog.textContent).not.toContain('Reset state');
  expect(dialog.textContent).toContain('Stop listening');
  await act(async () => { for(const listener of stackmatListeners) listener({state:'RUNNING'}); });
  expect(phase).toBe('running');
  await act(async () => { for(const listener of stackmatListeners) listener({state:'STOPPED',solveTime:12345}); });
  await settle();
  await act(async () => { for(const listener of stackmatListeners) listener({state:'STOPPED',solveTime:12345}); });
  await settle();
  expect(saved()).toHaveLength(1);
  expect(saved()[0]).toMatchObject({timeMs:12345, penalty:'ok', event:'333', scramble:'R'});
});

it('blocks cube starts in full statistics and Back closes the dialog before history', async () => {
  await act(async () => { wideViewport = true; mediaListeners.forEach(fn => fn()); });
  await act(async () => container.querySelector<HTMLButtonElement>('.shell-stat-rail')!.click());
  const view = container.querySelector<HTMLSelectElement>('[aria-label="Results view"]')!;
  await act(async () => { view.value='stats'; view.dispatchEvent(new Event('change',{bubbles:true})); });
  const full=[...container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Full stats')!;
  await act(async () => full.click());
  expect(document.querySelector('.stats-modal')).not.toBeNull();
  await act(async () => move('R',1_100));
  await act(async () => move('U',2_000));
  expect(phase).not.toBe('running');
  expect(saved()).toHaveLength(0);
  await act(async () => backListener?.());
  expect(document.querySelector('.stats-modal')).toBeNull();
  expect(container.querySelector('.history-view')).not.toBeNull();
});
