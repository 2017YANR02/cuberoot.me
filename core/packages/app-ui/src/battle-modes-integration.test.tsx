// @vitest-environment jsdom

import type {
  NetBattleClient,
  NetBattleSession,
  NetRoomState,
} from '@cuberoot/shared/timer';
import { generateTimerScramble } from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { act, createElement } from 'react';
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

vi.mock('@cuberoot/timer-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cuberoot/timer-ui')>();
  return {
    ...actual,
    TimerCubePreview: ({ ariaLabel, visualization }: {
      ariaLabel?: string;
      visualization?: '2D' | '3D';
    }) => createElement('div', {
      'aria-label': ariaLabel,
      'data-preview-visualization': visualization,
      role: 'img',
    }),
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
  });

  it('renders real 2/3/4 and online mode choices without a browser fallback', async () => {
    const onModeChange = vi.fn();
    await act(async () => root.render(
      <LocalBattleMode {...baseProps} onModeChange={onModeChange} playerCount={2} />,
    ));
    await act(async () => Promise.resolve());

    expect(host.querySelectorAll('.battle-player')).toHaveLength(2);
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

    const retry = host.querySelector<HTMLElement>('.scramble-strip[role="button"]')!;
    expect(retry.textContent).toContain('Try again');
    await act(async () => retry.click());
    await act(async () => Promise.resolve());

    expect(generateTimerScramble).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.scramble-strip')?.textContent).toContain("R U R'");
  });

  it('uses the injected shared room client and protected session store to create a room', async () => {
    const state = roomState();
    const credentials = { playerId: 'abcdef', playerToken: 'x'.repeat(48) };
    const createNetRoom = vi.fn(async () => ({ state, credentials }));
    const writeClipboardText = vi.fn(async () => undefined);
    let saved: NetBattleSession | null = null;
    const client = {
      createNetRoom,
      joinNetRoom: vi.fn(),
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
    await act(async () => host.querySelector<HTMLButtonElement>('.battle-primary-action')!.click());

    expect(createNetRoom).toHaveBeenCalledWith('333', { name: 'Cuber' });
    expect(saved).toEqual({ code: '1234', name: 'Cuber', ...credentials });
    expect(host.textContent).toContain('1234');
    expect(host.querySelectorAll('.battle-player-list li')).toHaveLength(1);
    const preview = host.querySelector<HTMLElement>('.timing-surface-cube .mobile-cube-preview[data-no-timer]');
    expect(preview).not.toBeNull();
    expect(preview?.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(COPY.en.cubeState);
    expect(preview?.querySelector<HTMLElement>('[role="img"]')
      ?.dataset.previewVisualization).toBe('3D');
    const surface = host.querySelector<HTMLElement>('.battle-net-timer .timing-surface')!;
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
    const syncStart = Array.from(host.querySelectorAll<HTMLButtonElement>('.battle-room-header button'))
      .find((button) => button.textContent === 'Synchronized start')!;
    await act(async () => syncStart.click());
    expect(client.postNetSyncStart).toHaveBeenCalledWith('1234', credentials, true);
    const qrButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.battle-room-header button'))
      .find((button) => button.textContent === 'Invite QR')!;
    await act(async () => qrButton.click());
    expect(document.querySelector('.room-qr-code svg')).not.toBeNull();
    expect(document.querySelector('.room-qr-link')?.textContent).toContain(
      'https://cuberoot.me/timer?players=net&room=1234',
    );
    await act(async () => document.querySelector<HTMLButtonElement>('.room-qr-close')!.click());
  });

  it('routes a batched smart-cube scramble completion and first solve move through the online timer', async () => {
    const state = roomState();
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
        onSmartCubeHandlersChange={(next) => { handlers = next; }}
        smartCube={smartCube}
      />,
    ));
    await act(async () => host.querySelector<HTMLButtonElement>('.battle-primary-action')!.click());
    expect(handlers).not.toBeNull();

    const startedAt = performance.now();
    await act(async () => {
      handlers!.onMove('F', startedAt - 20, SOLVED_3X3);
      handlers!.onSolved(startedAt - 10);
    });
    expect(postNetResult).not.toHaveBeenCalled();

    await act(async () => {
      handlers!.onMove("R'", startedAt, smartCubeTargetFacelets("R U R'")!);
      handlers!.onMove('R', startedAt + 10, 'U'.repeat(54));
      handlers!.onSolved(startedAt + 1_010);
    });
    await act(async () => Promise.resolve());
    expect(postNetResult).toHaveBeenCalledTimes(1);
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
    await act(async () => handlers!.onMove('F', at - 20, SOLVED_3X3));
    await act(async () => handlers!.onSolved(at - 10));
    expect(host.querySelectorAll('.battle-penalties')).toHaveLength(0);

    await act(async () => handlers!.onMove('R', at, target));
    await act(async () => handlers!.onMove('U', at + 10, 'U'.repeat(54)));
    await act(async () => handlers!.onSolved(at + 1_010));

    const holderButtons = host.querySelectorAll<HTMLButtonElement>('.battle-cube-holders button');
    expect(holderButtons[0].getAttribute('aria-pressed')).toBe('false');
    expect(holderButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelectorAll('.battle-penalties')).toHaveLength(1);
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
    await act(async () => host.querySelector<HTMLButtonElement>('.battle-primary-action')!.click());

    const surface = host.querySelector<HTMLElement>('.battle-net-timer .timing-surface')!;
    expect(surface.getAttribute('role')).toBeNull();
    expect(surface.querySelector('.timer-display')?.textContent).toBe('3');
  });

  it('uses the shared room transition to advance a settled round without forcing it', async () => {
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
    await act(async () => host.querySelector<HTMLButtonElement>('.battle-primary-action')!.click());
    await act(async () => Promise.resolve());

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

    await act(async () => root.render(<NetBattleMode {...baseProps} capability={capability} />));
    await act(async () => host.querySelector<HTMLButtonElement>('.battle-primary-action')!.click());

    const historyButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.battle-room-header button'))
      .find((button) => button.textContent === 'History and statistics')!;
    await act(async () => historyButton.click());
    expect(host.querySelector('.battle-history-panel')?.textContent).toContain('Xuanyi Geng');
    expect(host.querySelector('.battle-history-panel')?.textContent).toContain('Best');
    expect(host.querySelector('.battle-history-panel')?.textContent).toContain('U R U\'');

    const adminButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.battle-room-header button'))
      .find((button) => button.textContent === 'Room management')!;
    await act(async () => adminButton.click());
    const makeHost = Array.from(host.querySelectorAll<HTMLButtonElement>('.battle-admin-list button'))
      .find((button) => button.textContent === 'Make host')!;
    await act(async () => makeHost.click());
    expect(postNetAdmin).toHaveBeenCalledWith('1234', credentials, 'ghijkl');

    await act(async () => adminButton.click());
    const remove = Array.from(host.querySelectorAll<HTMLButtonElement>('.battle-admin-list button'))
      .find((button) => button.textContent === 'Remove')!;
    await act(async () => remove.click());
    expect(postNetKick).toHaveBeenCalledWith('1234', credentials, 'ghijkl');
  });
});
