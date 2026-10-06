// @vitest-environment jsdom

import type {
  NetBattleClient,
  NetBattleSession,
  NetRoomState,
} from '@cuberoot/shared/timer';
import { generateTimerScramble } from '@cuberoot/shared/timer';
import { TwistyPlayer } from 'cubing/twisty';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LocalBattleMode,
  NetBattleMode,
  type BattleSmartCubeHandlers,
} from './BattleModes';
import { COPY } from './copy';
import type { InstalledAppNetBattle } from './platform';

vi.mock('@cuberoot/shared/timer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cuberoot/shared/timer')>();
  return {
    ...actual,
    generateTimerScramble: vi.fn(),
  };
});

const eventGroups = [{
  id: 'wca',
  label: 'WCA',
  items: [
    { id: '333', label: '3×3', iconClass: '333' },
    { id: '222', label: '2×2', iconClass: '222' },
  ],
}];

const baseProps = {
  copy: COPY.en,
  eventGroups,
  hideTime: false,
  holdMs: 550,
  inspectionSec: 0,
  language: 'en' as const,
  onActivityChange: vi.fn(),
  onModeChange: vi.fn(),
  precision: 3 as const,
  runningPrecision: 3 as const,
  scramblePreviewSettings: { showCubePreview: false, prefer3D: false },
  writeClipboardText: vi.fn(async () => undefined),
};

function dispatchPointer(target: Element, type: string, pointerId: number): void {
  const event = new MouseEvent(type, { bubbles: true, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
}

function roomState(): NetRoomState {
  return {
    code: '1234',
    revision: 1,
    videoGeneration: '11111111-1111-4111-8111-111111111111',
    roundRoster: [],
    event: '333',
    round: 1,
    scrambles: { '333': "R U R'" },
    players: {
      abcdef: {
        name: 'Cuber', joined: 1, seen: 10, ph: 'idle', at: 0, event: '333',
      },
    },
    results: { '1': {} },
    history: [],
    scores: { abcdef: 0 },
    admin: 'abcdef',
    syncStart: false,
    startAt: null,
    now: 10,
  };
}

describe('installed app multiplayer modes', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const captures = new WeakMap<HTMLElement, Set<number>>();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(function setPointerCapture(this: HTMLElement, pointerId: number) {
        const ids = captures.get(this) ?? new Set<number>();
        ids.add(pointerId);
        captures.set(this, ids);
      }),
    });
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(function hasPointerCapture(this: HTMLElement, pointerId: number) {
        return captures.get(this)?.has(pointerId) ?? false;
      }),
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(function releasePointerCapture(this: HTMLElement, pointerId: number) {
        captures.get(this)?.delete(pointerId);
      }),
    });
    window.localStorage.clear();
    vi.mocked(TwistyPlayer).mockClear();
    vi.mocked(generateTimerScramble).mockReset().mockImplementation(async ({ event }) => ({
      ok: true,
      event,
      kind: 'generated',
      provider: 'cubing',
      scramble: "R U R'",
    }));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders real 2/3/4 and online mode choices without a browser fallback', async () => {
    const onModeChange = vi.fn();
    await act(async () => root.render(
      <LocalBattleMode {...baseProps} onModeChange={onModeChange} playerCount={2} />,
    ));
    await act(async () => Promise.resolve());

    expect(host.querySelectorAll('.battle-player')).toHaveLength(2);
    expect(host.querySelectorAll('.timing-surface--local')).toHaveLength(2);
    expect(host.querySelectorAll('.timing-surface-scramble-top')).toHaveLength(2);
    const selector = host.querySelector<HTMLSelectElement>('.shell-players-select')!;
    expect(Array.from(selector.options).map((option) => option.value)).toEqual(['1', '2', '3', '4', 'net']);

    await act(async () => {
      selector.value = '4';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onModeChange).toHaveBeenCalledWith(4);

    await act(async () => {
      selector.value = 'net';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onModeChange).toHaveBeenCalledWith('net');
    expect(host.querySelector('a[href*="timer"]')).toBeNull();
  });

  it.each([2, 3, 4] as const)('shares local preview slots for %s players and follows preview settings', async (playerCount) => {
    const draw = (showCubePreview: boolean, prefer3D: boolean) => root.render(
      <LocalBattleMode {...baseProps} playerCount={playerCount}
        scramblePreviewSettings={{ showCubePreview, prefer3D }} />,
    );
    await act(async () => draw(true, false));
    const readout = host.querySelector('.timer-display');
    await vi.waitFor(() => expect(host.querySelectorAll('[data-visualization="2D"]')).toHaveLength(2));
    await act(async () => draw(true, true));
    await vi.waitFor(() => expect(host.querySelectorAll('[data-visualization="3D"]')).toHaveLength(2));
    expect(host.querySelector('.timer-display')).toBe(readout);
    await act(async () => draw(false, true));
    expect(host.querySelector('.timing-surface-cube-frame')).toBeNull();
    expect(host.querySelector('.timer-display')).toBe(readout);
  });

  it('cancels a held local key when the device dialog opens and blocks new presses', async () => {
    const render = (inputBlocked: boolean) => root.render(
      <LocalBattleMode {...baseProps} inputBlocked={inputBlocked} playerCount={2} />,
    );
    await act(async () => render(false));
    const key = ' ';
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key })));
    expect(host.querySelector('.timer-display.holding')).not.toBeNull();
    await act(async () => render(true));
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    });
    expect(host.querySelector('.timer-display.holding, .timer-display.running')).toBeNull();
    await act(async () => render(false));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key })));
    expect(host.querySelector('.timer-display.holding')).not.toBeNull();
  });

  it('renders a working retry after local scramble generation fails', async () => {
    vi.mocked(generateTimerScramble)
      .mockResolvedValueOnce({
        ok: false,
        event: '333',
        code: 'generation-failed',
        retryable: true,
      });
    await act(async () => root.render(<LocalBattleMode {...baseProps} playerCount={2} />));
    await act(async () => Promise.resolve());

    const retry = host.querySelector<HTMLElement>('.scramble-text[role="button"]')!;
    expect(retry.textContent).toContain('Unable to load scramble. Retry');
    await act(async () => retry.click());
    await act(async () => Promise.resolve());

    expect(generateTimerScramble).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.scramble-strip')?.textContent).toContain("R U R'");
  });

  it('cancels an old source and preserves the completed round through failed prefetch, then deletes it without resurrection', async () => {
    let resolveOld!: (row: { scramble: string }) => void;
    const oldProvider = () => new Promise<{ scramble: string }>(resolve => { resolveOld = resolve; });
    const provider = vi.fn().mockResolvedValueOnce({ scramble: 'F' }).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ scramble: 'U' });
    await act(async () => root.render(<LocalBattleMode {...baseProps} playerCount={2} scrambleProvider={oldProvider} />));
    await act(async () => root.render(<LocalBattleMode {...baseProps} playerCount={2} scrambleProvider={provider} />));
    await act(async () => resolveOld({ scramble: 'R' }));
    expect(host.querySelector('.scramble-strip')?.textContent).toContain('F');
    vi.useFakeTimers(); let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const surfaces = host.querySelectorAll('.timing-surface--local');
    for (const id of [0, 1]) {
      await act(async () => { dispatchPointer(surfaces[id], 'pointerdown', id + 1); await vi.advanceTimersByTimeAsync(350); dispatchPointer(surfaces[id], 'pointerup', id + 1); });
    }
    for (const id of [0, 1]) { now = 2000 + id * 500; await act(async () => dispatchPointer(surfaces[id], 'pointerdown', id + 1)); }
    const key = 'cuberoot_local_battle_rounds_v1';
    const original = JSON.parse(localStorage.getItem(key)!)[0];
    expect(original.attempts[0].solve.scramble).toBe('F');
    const retry = host.querySelector<HTMLElement>('.scramble-text[role="button"]')!;
    await act(async () => retry.click());
    expect(host.querySelector('.scramble-strip')?.textContent).toContain('U');
    expect(JSON.parse(localStorage.getItem(key)!)[0].id).toBe(original.id);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Local battle history"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-battle-history-list button')!.click());
    const remove = [...document.querySelectorAll<HTMLButtonElement>('.timer-room-actions button')].find(button => button.textContent === 'Delete round')!;
    await act(async () => remove.click()); await act(async () => remove.click());
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([]);
    expect(host.querySelectorAll('.timer-battle-player-actions button')).toHaveLength(0);
  });

  it.each(['create', 'join'])('uses the shared lobby to %s a room and preserves its protected session', async (entry) => {
    const state = roomState();
    const credentials = { playerId: 'abcdef', playerToken: 'x'.repeat(48) };
    const createNetRoom = vi.fn(async () => ({ state, credentials }));
    const writeClipboardText = vi.fn(async () => undefined);
    let saved: NetBattleSession | null = null;
    const client = {
      createNetRoom,
      joinNetRoom: vi.fn(async () => ({ state, credentials })),
      getNetRoom: vi.fn(async () => state),
      postNetStatus: vi.fn(async () => state),
      postNetSyncStart: vi.fn(async () => state),
      postNetAdmin: vi.fn(async () => state),
      postNetKick: vi.fn(async () => state),
      renameNetPlayer: vi.fn(async () => state),
      postNetEvent: vi.fn(async () => state),
      ensureNetScramble: vi.fn(async () => state),
      postNetResult: vi.fn(async () => state),
      nextNetRound: vi.fn(async () => state),
      leaveNetRoom: vi.fn(async () => undefined),
    } as unknown as NetBattleClient;
    const capability: InstalledAppNetBattle = {
      client,
      sessions: {
        clear: vi.fn(async () => { saved = null; }),
        load: vi.fn(async () => null),
        save: vi.fn(async (session) => { saved = session; }),
      },
    };

    await act(async () => root.render(
      <NetBattleMode
        {...baseProps}
        capability={capability}
        scramblePreviewSettings={{ showCubePreview: true, prefer3D: true }}
        writeClipboardText={writeClipboardText}
      />,
    ));
    await act(async () => Promise.resolve());
    if (entry === 'create') {
      await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-lobby-actions button')!.click());
      expect(createNetRoom).toHaveBeenCalledWith('333', { name: 'Cuber' });
    } else {
      const codeInput = host.querySelector<HTMLInputElement>('[aria-label="Room code"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(codeInput, '1234');
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(client.joinNetRoom).toHaveBeenCalledExactlyOnceWith('1234', { name: 'Cuber' });
      expect(createNetRoom).not.toHaveBeenCalled();
    }
    expect(saved).toEqual({ code: '1234', name: 'Cuber', ...credentials });
    expect(host.textContent).toContain('1234');
    expect(host.querySelectorAll('.timer-room-player')).toHaveLength(1);
    const preview = host.querySelector<HTMLElement>('.timing-surface-cube-frame[data-no-timer]');
    expect(preview).not.toBeNull();
    expect(preview?.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(COPY.en.cubeState);
    await vi.waitFor(() => {
      const player = preview?.querySelector<HTMLElement>('[data-test-twisty-player]');
      expect(player?.dataset.visualization).toBe('3D');
      expect(player?.dataset.scramble).toBe("R U R'");
    });
    const surface = host.querySelector<HTMLElement>('.timer-room-stage .timing-surface')!;
    expect(surface.classList.contains('timing-surface--net')).toBe(true);
    expect(surface.firstElementChild?.classList.contains('timing-surface-scramble-top')).toBe(true);
    expect(surface.querySelector<HTMLElement>('.timer-display')!.style.fontSize)
      .toContain('clamp(48px, 10vw, 132px)');
    const postNetStatus = vi.mocked(client.postNetStatus);
    await act(async () => {
      dispatchPointer(surface, 'pointerdown', 1);
    });
    expect(surface.querySelector('.timer-display')?.classList).toContain('holding');
    await act(async () => {
      dispatchPointer(preview!, 'pointerdown', 2);
      dispatchPointer(surface, 'pointerup', 2);
      dispatchPointer(surface, 'pointercancel', 2);
    });
    expect(surface.querySelector('.timer-display')?.classList).toContain('holding');
    expect(postNetStatus).not.toHaveBeenCalled();
    expect(writeClipboardText).not.toHaveBeenCalled();
    await act(async () => dispatchPointer(surface, 'pointercancel', 1));
    await act(async () => host.querySelector<HTMLButtonElement>(
      `[aria-label="${COPY.en.battleCopyCode}"]`,
    )!.click());
    expect(writeClipboardText).toHaveBeenCalledWith('1234');
    expect(host.textContent).toContain(COPY.en.battleInviteCopied);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Room settings"]')!.click());
    const syncStart = document.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Synchronized start"]')!;
    await act(async () => syncStart.click());
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-room-dialog [aria-label="Close"]')!.click());
    expect(client.postNetSyncStart).toHaveBeenCalledWith('1234', credentials, true);
    const qrButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.timer-room-toolbar button'))
      .find((button) => button.getAttribute('aria-label') === 'Room QR code')!;
    await act(async () => qrButton.click());
    expect(document.querySelector('.room-qr-code svg')).not.toBeNull();
    expect(document.querySelector('.room-qr-link')?.textContent).toContain(
      'https://cuberoot.me/timer?players=net&room=1234',
    );
    await act(async () => document.querySelector<HTMLButtonElement>('.room-qr-close')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-player-name')!.click());
    const nickname = document.querySelector<HTMLInputElement>('.timer-room-dialog input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nickname, 'Guest alias');
      nickname.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-room-dialog .timer-room-actions button')!.click());
    expect(client.renameNetPlayer).toHaveBeenCalledWith('1234', credentials, { name: 'Guest alias' });
    expect(document.querySelector('.timer-room-dialog')).toBeNull();
  });

  it('routes a batched smart-cube scramble completion and first solve move through the online timer', async () => {
    const openDevice = vi.fn();
    const onRecordSolve = vi.fn(async (_record: import('@cuberoot/shared/timer').NetRecordedAttempt) => undefined);
    let state = roomState();
    const credentials = { playerId: 'abcdef', playerToken: 'x'.repeat(48) };
    const postNetResult = vi.fn(async () => state);
    const client = {
      createNetRoom: vi.fn(async () => ({ state, credentials })),
      getNetRoom: vi.fn(async () => state),
      ensureNetScramble: vi.fn(async () => state),
      postNetResult,
      postNetStatus: vi.fn(async () => state),
      nextNetRound: vi.fn(async () => state),
      leaveNetRoom: vi.fn(async () => undefined),
    } as unknown as NetBattleClient;
    const capability: InstalledAppNetBattle = {
      client,
      sessions: {
        clear: vi.fn(async () => undefined),
        load: vi.fn(async () => null),
        save: vi.fn(async () => undefined),
      },
    };
    let handlers: BattleSmartCubeHandlers | null = null;
    const smartCube = {
      connect: vi.fn(async () => 'GAN16ui'),
      deviceName: 'GAN16ui',
      disconnect: vi.fn(async () => undefined),
      facelets: smartCubeTargetFacelets("R U R'")!,
      lastMove: '',
      phase: 'connected' as const,
    };

    await act(async () => root.render(
      <NetBattleMode
        {...baseProps}
        capability={capability}
        sessionId="session-original"
        onRecordSolve={onRecordSolve}
        recordGyro
        deviceControls={<button data-device-controls onClick={openDevice}>Device operations</button>}
        onSmartCubeHandlersChange={(next) => { handlers = next; }}
        smartCube={smartCube}
      />,
    ));
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-lobby-actions button')!.click());
    expect(handlers).not.toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-device-controls]')!.click());
    expect(openDevice).toHaveBeenCalledOnce();
    expect(smartCube.disconnect).not.toHaveBeenCalled();

    const startedAt = Math.ceil(performance.now());
    let clock = startedAt;
    const performanceSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    await act(async () => {
      handlers!.onMove('F', startedAt - 20, SOLVED_3X3);
      handlers!.onSolved(startedAt - 10);
    });
    expect(postNetResult).not.toHaveBeenCalled();

    await act(async () => {
      handlers!.onMove("R'", startedAt, smartCubeTargetFacelets("R U R'")!);
      clock = startedAt + 10;
      handlers!.onMove('R', clock, 'U'.repeat(54));
    });
    // A newer room countdown must not replace the active attempt's round or clock.
    state = { ...state, revision: 2, round: 2, syncStart: true,
      roundRoster: ['abcdef'], startAt: Date.now() - 10, now: Date.now(),
      scrambles: { '333': 'F' }, results: { '1': {}, '2': {} } };
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => {
      clock = startedAt + 510;
      handlers!.onGyro?.({ w: 1, x: 0, y: 0, z: 0 }, clock);
      handlers!.onMove("U'", clock, 'U'.repeat(54));
      clock = startedAt + 1010;
      handlers!.onMove("R'", clock, SOLVED_3X3);
      handlers!.onSolved(clock);
    });
    await act(async () => Promise.resolve());
    expect(postNetResult).not.toHaveBeenCalled();
    expect(onRecordSolve).toHaveBeenCalledTimes(1);
    expect(onRecordSolve.mock.calls[0]![0]).toMatchObject({
      context: { code: '1234', round: 1, sessionId: 'session-original' },
      solve: { timeMs: 1000, scramble: "R U R'", moves: [
        { m: 'R', ts: 0 }, { m: "U'", ts: 500 }, { m: "R'", ts: 1000 },
      ], gyro: expect.any(String) },
    });
    performanceSpy.mockRestore();
  });

  it('routes one installed smart cube through the shared local-battle timer and hands it off', async () => {
    let handlers: BattleSmartCubeHandlers | null = null;
    const smartCube = {
      connect: vi.fn(async () => 'GAN16ui'),
      deviceName: 'GAN16ui',
      disconnect: vi.fn(async () => undefined),
      facelets: smartCubeTargetFacelets("R U R'")!,
      lastMove: '',
      phase: 'connected' as const,
    };
    await act(async () => root.render(
      <LocalBattleMode
        {...baseProps}
        onSmartCubeHandlersChange={(next) => { handlers = next; }}
        playerCount={2}
        smartCube={smartCube}
      />,
    ));
    await act(async () => Promise.resolve());
    expect(handlers).not.toBeNull();
    const target = smartCubeTargetFacelets("R U R'")!;
    const at = performance.now();
    let clock = at;
    const performanceSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    await act(async () => handlers!.onMove('F', at - 20, SOLVED_3X3));
    await act(async () => handlers!.onSolved(at - 10));
    expect(host.querySelectorAll('.timer-penalty-actions')).toHaveLength(0);

    await act(async () => handlers!.onMove('R', at, target));
    await act(async () => handlers!.onMove('U', at + 10, 'U'.repeat(54)));
    clock = at + 1_010;
    await act(async () => handlers!.onSolved(clock));
    performanceSpy.mockRestore();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click());
    const holderButtons = document.querySelectorAll<HTMLButtonElement>('.timer-battle-cube-controls [aria-label="Now up"] button');
    expect(holderButtons[0].getAttribute('aria-pressed')).toBe('false');
    expect(holderButtons[1].getAttribute('aria-pressed')).toBe('true');
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-room-dialog [aria-label="Close"]')!.click());
    expect(host.querySelectorAll('.timer-penalty-actions')).toHaveLength(1);
    const penalties = host.querySelectorAll<HTMLButtonElement>('.timer-penalty-actions button');
    const originalSeconds = Number.parseFloat(host.querySelector('[data-player-id="0"] .battle-player .timer-display')!.textContent!);
    await act(async () => penalties[1].click());
    expect(penalties[1].getAttribute('aria-pressed')).toBe('true');
    expect(Number.parseFloat(host.querySelector('[data-player-id="0"] .battle-player .timer-display')!.textContent!))
      .toBeCloseTo(originalSeconds + 2, 3);
    await act(async () => penalties[2].click());
    expect(host.querySelector('[data-player-id="0"] .battle-player .timer-display')?.textContent).toBe('DNF');
  });

  it('keeps manual input disabled while the server owns a synchronized countdown', async () => {
    const state = roomState();
    state.syncStart = true;
    state.now = Date.now();
    state.startAt = state.now + 3_000;
    state.roundRoster = ['abcdef'];
    const credentials = { playerId: 'abcdef', playerToken: 'x'.repeat(48) };
    const client = {
      createNetRoom: vi.fn(async () => ({ state, credentials })),
      getNetRoom: vi.fn(async () => state),
    } as unknown as NetBattleClient;
    const capability: InstalledAppNetBattle = {
      client,
      sessions: {
        clear: vi.fn(async () => undefined),
        load: vi.fn(async () => null),
        save: vi.fn(async () => undefined),
      },
    };

    await act(async () => root.render(<NetBattleMode {...baseProps} capability={capability} />));
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-lobby-actions button')!.click());

    const surface = host.querySelector<HTMLElement>('.timer-room-stage .timing-surface')!;
    expect(surface.getAttribute('role')).toBeNull();
    expect(surface.querySelector('.timer-display')?.textContent).toBe('3');
  });

  it('restores the same room identity after a temporary outage and clears an expired room on wake', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const state = roomState();
    const session = { code: '1234', playerId: 'abcdef', playerToken: 'x'.repeat(48), name: 'Cuber' };
    const clear = vi.fn(async () => undefined);
    const getNetRoom = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(state)
      .mockRejectedValue(new Error('room not found'));
    const joinNetRoom = vi.fn();
    const capability: InstalledAppNetBattle = {
      client: { getNetRoom, joinNetRoom } as unknown as NetBattleClient,
      sessions: { clear, load: vi.fn(async () => session), save: vi.fn(async () => undefined) },
    };
    await act(async () => root.render(<NetBattleMode {...baseProps} capability={capability} />));
    expect(clear).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(host.querySelector('.timer-room-stage')).not.toBeNull();
    expect(joinNetRoom).not.toHaveBeenCalled();
    expect(getNetRoom.mock.calls[1]?.[1]).toMatchObject({ playerId: session.playerId, playerToken: session.playerToken });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(clear).toHaveBeenCalledOnce();
    expect(host.querySelector('.timer-room-stage')).toBeNull();
    expect(host.textContent).toContain('Room not found or expired');
  });

  it('holds a settled round until this device requests the next round', async () => {
    const state = roomState();
    state.results = { '1': { abcdef: { t: 1_000, p: 'ok' } } };
    const nextState = { ...state, revision: 2, round: 2, results: { ...state.results, '2': {} } };
    const credentials = { playerId: 'abcdef', playerToken: 'x'.repeat(48) };
    const nextNetRound = vi.fn(async () => nextState);
    const client = {
      createNetRoom: vi.fn(async () => ({ state, credentials })),
      getNetRoom: vi.fn(async () => state),
      nextNetRound,
    } as unknown as NetBattleClient;
    const capability: InstalledAppNetBattle = {
      client,
      sessions: {
        clear: vi.fn(async () => undefined),
        load: vi.fn(async () => null),
        save: vi.fn(async () => undefined),
      },
    };

    await act(async () => root.render(<NetBattleMode {...baseProps} capability={capability} />));
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-lobby-actions button')!.click());
    await act(async () => Promise.resolve());

    expect(nextNetRound).not.toHaveBeenCalled();
    const nextButton = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Next round'))!;
    await act(async () => nextButton.click());
    expect(nextNetRound).toHaveBeenCalledWith('1234', credentials, 1, false);
  });

  it('renders shared room statistics and delegates host transfer and removal to the room client', async () => {
    const state = roomState();
    state.players.ghijkl = {
      name: 'Xuanyi Geng (耿暄一)',
      wcaId: '2017GENG01',
      iso2: 'CN',
      joined: 2,
      seen: 10,
      ph: 'done',
      at: 0,
      event: '333',
    };
    state.scores.ghijkl = 1;
    state.round = 2;
    state.results = {
      '2': {
        abcdef: { t: 1_000, p: 'ok' },
        ghijkl: { t: 900, p: 'ok' },
      },
    };
    state.history = [{
      round: 1,
      scrambles: { '333': 'U R U\'' },
      playerEvents: { abcdef: '333', ghijkl: '333' },
      results: {
        abcdef: { t: 2_000, p: 'ok' },
        ghijkl: { t: 2_100, p: '+2' },
      },
      winners: ['abcdef'],
    }];
    const credentials = { playerId: 'abcdef', playerToken: 'x'.repeat(48) };
    const postNetAdmin = vi.fn(async () => state);
    const postNetKick = vi.fn(async () => state);
    const client = {
      createNetRoom: vi.fn(async () => ({ state, credentials })),
      getNetRoom: vi.fn(async () => state),
      postNetStatus: vi.fn(async () => state),
      postNetSyncStart: vi.fn(async () => state),
      postNetAdmin,
      postNetKick,
      postNetEvent: vi.fn(async () => state),
      ensureNetScramble: vi.fn(async () => state),
      postNetResult: vi.fn(async () => state),
      nextNetRound: vi.fn(async () => state),
      leaveNetRoom: vi.fn(async () => undefined),
    } as unknown as NetBattleClient;
    const capability: InstalledAppNetBattle = {
      client,
      sessions: {
        clear: vi.fn(async () => undefined),
        load: vi.fn(async () => null),
        save: vi.fn(async () => undefined),
      },
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    let closeOverlay: (() => void) | null = null;
    await act(async () => root.render(<NetBattleMode {...baseProps} capability={capability}
      onOverlayCloseChange={(close) => { closeOverlay = close; }} />));
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-lobby-actions button')!.click());

    const historyButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.timer-room-toolbar button'))
      .find((button) => button.getAttribute('aria-label') === 'Scramble history and results')!;
    await act(async () => historyButton.click());
    expect(document.querySelector('.timer-room-dialog')?.textContent).toContain('Xuanyi Geng');
    expect(document.querySelector('.timer-room-dialog')?.textContent).toContain('Best');
    expect(document.querySelector('.timer-room-dialog')?.textContent).toContain('U R U\'');
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(TwistyPlayer).toHaveBeenCalled();
    expect(document.querySelector('.timer-room-dialog [data-test-twisty-player]')).not.toBeNull();
    expect(vi.mocked(TwistyPlayer).mock.calls.some(([options]) => options?.puzzle === '3x3x3')).toBe(true);

    expect(closeOverlay).not.toBeNull();
    await act(async () => { closeOverlay?.(); });
    expect(document.querySelector('.timer-room-dialog')).toBeNull();
    const adminButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.timer-room-toolbar button'))
      .find((button) => button.getAttribute('aria-label') === 'Room settings')!;
    await act(async () => adminButton.click());
    const makeHost = Array.from(document.querySelectorAll<HTMLButtonElement>('.timer-room-admin-list button'))
      .find((button) => button.textContent === 'Make host')!;
    await act(async () => makeHost.click());
    expect(postNetAdmin).not.toHaveBeenCalled();
    await act(async () => makeHost.click());
    expect(postNetAdmin).toHaveBeenCalledWith('1234', credentials, 'ghijkl');

    await act(async () => adminButton.click());
    const remove = Array.from(document.querySelectorAll<HTMLButtonElement>('.timer-room-admin-list button'))
      .find((button) => button.textContent === 'Remove')!;
    await act(async () => remove.click());
    expect(postNetKick).not.toHaveBeenCalled();
    await act(async () => remove.click());
    expect(postNetKick).toHaveBeenCalledWith('1234', credentials, 'ghijkl');
  });
});
