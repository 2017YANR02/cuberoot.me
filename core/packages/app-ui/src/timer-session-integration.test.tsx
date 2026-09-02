// @vitest-environment jsdom

import { activeTimerSolves, type TimerStoreData } from '@cuberoot/shared/timer';
import {
  TimerSessionSwitcher,
  timerSessionSwitcherLabels,
  type TimerSessionSwitcherHost,
} from '@cuberoot/timer-ui';
import { act, createElement, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LatestSnapshotGate } from './data/latest-snapshot-gate';
import {
  TimerRepository,
  type TimerStoreDriver,
} from './data/timer-repository';

class MemoryDriver implements TimerStoreDriver {
  data: TimerStoreData | undefined;

  async read() { return structuredClone(this.data); }
  async readRecovery() { return undefined; }
  async write(data: TimerStoreData) { this.data = structuredClone(data); }
  async writeWithRecovery(data: TimerStoreData) { this.data = structuredClone(data); }
}

describe('Mobile shared session UI + repository integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 320 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 568 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('tsession-trigger')) {
        return {
          x: 12, y: 80, left: 12, top: 80, right: 308, bottom: 116,
          width: 296, height: 36, toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0,
        width: 0, height: 0, toJSON: () => ({}),
      } as DOMRect;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll('.tsession-panel').forEach((panel) => panel.remove());
    vi.restoreAllMocks();
  });

  it('switches persisted active data without changing event, then selects event atomically', async () => {
    const driver = new MemoryDriver();
    let now = 100;
    let id = 0;
    const repository = new TimerRepository(driver, {
      now: () => now++,
      createId: () => `id-${id++}`,
      language: () => 'en',
    });
    await repository.addSolve({ timeMs: 3_000, penalty: 'ok', scramble: 'R', event: '333' });
    const defaultSessionId = (await repository.load()).database.activeSessionId;
    let seeded = await repository.createSession('Pocket', '222');
    const pocketSessionId = seeded.database.activeSessionId;
    await repository.addSolve({ timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '222' });
    seeded = await repository.activateSession(defaultSessionId);

    function Harness() {
      const [store, setStore] = useState(seeded);
      const gate = useRef(new LatestSnapshotGate<TimerStoreData>());
      const commit = async (operation: () => Promise<TimerStoreData>) => {
        const revision = gate.current.beginMutation();
        const data = await operation();
        gate.current.commitIfLatest(revision, data, setStore);
      };
      const host = useMemo<TimerSessionSwitcherHost>(() => ({
        activate: (sessionId) => commit(() => repository.activateSession(sessionId)),
        create: (name, event) => commit(() => repository.createSession(name, event)),
        rename: (sessionId, name) => commit(() => repository.renameSession(sessionId, name)),
        clear: (sessionId) => commit(() => repository.clearSession(sessionId)),
        delete: (sessionId) => commit(() => repository.deleteSession(sessionId)),
      }), []);
      const solves = activeTimerSolves(store, store.settings.event);
      return createElement('div', null,
        createElement(TimerSessionSwitcher, {
          activeSessionId: store.database.activeSessionId,
          event: store.settings.event,
          host,
          labels: timerSessionSwitcherLabels('en'),
          sessions: store.database.sessions,
          viewportBottomInset: 96,
        }),
        createElement('output', { 'data-testid': 'state' }, [
          store.database.activeSessionId,
          store.settings.event,
          String(solves.length),
        ].join('|')),
        createElement('button', {
          type: 'button',
          onClick: () => { void commit(() => repository.selectEvent('222')); },
        }, 'select 222'),
      );
    }

    await act(async () => root.render(createElement(Harness)));
    await act(async () => container.querySelector<HTMLButtonElement>('.tsession-trigger')!.click());
    const panel = document.querySelector<HTMLDivElement>('.tsession-panel')!;
    const pocket = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-session-id]'))
      .find((button) => button.dataset.sessionId === pocketSessionId)!;
    await act(async () => pocket.click());

    expect(container.querySelector('output')?.textContent).toBe(`${pocketSessionId}|333|0`);
    expect(container.querySelector('.tsession-trigger-name')?.textContent).toBe('Pocket');
    expect((await new TimerRepository(driver, {
      now: () => 999,
      createId: () => 'restart',
      language: () => 'en',
    }).load()).database.activeSessionId).toBe(pocketSessionId);

    await act(async () => container.querySelector<HTMLButtonElement>('button:not(.tsession-trigger)')!.click());
    expect(container.querySelector('output')?.textContent).toBe(`${pocketSessionId}|222|1`);
    const restored = await repository.load();
    expect(restored.database.sessions.find((session) => session.id === pocketSessionId)?.event).toBe('222');
  });
});
